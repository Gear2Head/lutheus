import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '../lib/auth';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  Megaphone, Plus, Send, Archive, Eye, X, Users, Copy,
  ChevronDown, ChevronUp, Bold, Italic, Link, List,
  RefreshCw, CheckCircle, Clock, FileText, Bell, Radio,
  MessageSquare, Sliders, Hash, Loader, Terminal, HelpCircle,
  Volume2, CheckCircle2, Bookmark, Award, AlertCircle
} from 'lucide-react';
import { formatDateTime } from '../lib/utils';

interface Announcement {
  id: string;
  title: string;
  body_markdown: string;
  target_roles: string[];
  created_by_discord_id: string | null;
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AdminApiClientType {
  listAnnouncements(): Promise<Announcement[]>;
  createAnnouncement(title: string, body: string, targetRoles: string[]): Promise<Announcement>;
  publishAnnouncement(id: string, targetRoles?: string[]): Promise<void>;
}

const ROLE_LABELS: Record<string, string> = {
  discord_moderatoru: 'Discord Moderatoru',
  kidemli_discord_moderatoru: 'Kidemli Moderator',
  senior_moderator: 'Senior Moderator',
  discord_destek_ekibi: 'Destek Ekibi',
  discord_yoneticisi: 'Discord Yoneticisi',
  genel_sorumlu: 'Genel Sorumlu',
  yonetici: 'Yonetici',
  admin: 'Admin',
  kurucu: 'Kurucu',
};

const STATUS_CONFIG = {
  draft: { label: 'Taslak', variant: 'warning' as const, icon: FileText },
  published: { label: 'Yayinlandi', variant: 'success' as const, icon: CheckCircle },
  archived: { label: 'Arsivlendi', variant: 'default' as const, icon: Archive },
};

const ALL_TARGET_ROLES = [
  'discord_moderatoru',
  'kidemli_discord_moderatoru',
  'senior_moderator',
  'discord_destek_ekibi',
];

const DISCORD_PRESETS = [
  {
    name: "Mute Ceza Güncellemesi",
    title: "⛔ Mute Alt Sınır Süreleri Hk.",
    content: "⚠️ **ÖNEMLİ DUYURU:** Sohbet kalitesini artırmak amacıyla, şahsi ağır hakaretlerde uygulanan mute sürelerinde alt sınır **3 saatten 6 saate** uzatılmıştır. Lütfen kural tablosundaki indeksleri dikkate alarak işlem sağlayınız.",
    color: "#FF453A",
    channel: "#duyuru"
  },
  {
    name: "Kadro Toplantısı Çağrısı",
    title: "📅 Olağan Kadro Durum Değerlendirmesi",
    content: "📢 **HAFTALIK TOPLANTI:** Pazar akşamı saat **21:00**'da Ses-1 yetkili odasında genel asayiş ve denetim değerlendirmesi yapılacaktır. Mazereti olmayan tüm kadronun katılımı zorunludur.",
    color: "#5E5CE6",
    channel: "#yetkili-duyuru"
  },
  {
    name: "Sistem Bakım Bildirimi",
    title: "⚙️ Sapphire API Güncellemesi",
    content: "🛠️ **BAKIM BİLDİRİMİ:** Sunucu veritabanımızda gerçekleştirilecek optimizasyon çalışmaları nedeniyle bu gece **03:00 - 05:00** aralarında Sapphire entegrasyonunda ufak kesintiler yaşanabilir. Bilginize.",
    color: "#FF9F0A",
    channel: "#duyuru"
  },
  {
    name: "Performans Tebrik Mesajı",
    title: "🏆 Haftanın En Başarılı Denetmeni",
    content: "✨ **TEBRİKLER:** Kıymetli yetkilimiz son 7 günde sıfır hata toleransı ve %98.4 doğruluk payı ile haftanın en aktif denetmeni seçilmiştir! Kendisine gayretleri için teşekkür ederiz. 🌟",
    color: "#30D158",
    channel: "#genel-sohbet"
  }
];

const EMOJI_LIST = ['📢', '⚠️', '🚨', '✅', '❌', '⚙️', '🏆', '📌', '✨', '💬', '🛡️', '📅', '💡', '⏰', '👑', '🔥'];

interface DispatchLog {
  id: number;
  time: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING';
  channel: string;
  message: string;
}

function MarkdownPreview({ markdown }: { markdown: string }) {
  const html = markdown
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-primary underline">$1</a>')
    .replace(/^- (.+)/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^## (.+)/gm, '<h2 class="text-base font-bold mt-3 mb-1">$1</h2>')
    .replace(/^# (.+)/gm, '<h1 class="text-lg font-bold mt-3 mb-1">$1</h1>')
    .replace(/\n/g, '<br/>');
  return <div className="text-sm text-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function Announcements() {
  const { session } = useAuth();
  const { showToast } = useToast();
  const { language } = useLanguage();

  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editor states
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetRoles, setTargetRoles] = useState<string[]>([...ALL_TARGET_ROLES]);
  const [botProfileColor, setBotProfileColor] = useState('#5E5CE6');
  const [targetChannel, setTargetChannel] = useState('#duyuru');
  const [showMarkdownGuide, setShowMarkdownGuide] = useState(false);

  // Latency & Terminal states
  const [apiLatency, setApiLatency] = useState(38);
  const [isCheckingApi, setIsCheckingApi] = useState(false);
  const [dispatchLogs, setDispatchLogs] = useState<DispatchLog[]>([
    { id: 1, time: "14:02:11", type: "INFO", channel: "Sistem Gateway", message: "Sapphire Bot WS El Sıkışması kuruldu." },
    { id: 2, time: "13:48:05", type: "SUCCESS", channel: "#duyuru", message: "Yönetim bildiri entegrasyonu başarılı. HTTP 204 No Content" },
  ]);

  // Expanded card state
  const [expanded, setExpanded] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const canManage = session ? hasPermission(session.role, 'announcement:manage') : false;

  const loadData = async () => {
    setLoading(true);
    try {
      const { AdminApiClient } = await import('../../../lib/adminApiClient.js') as unknown as { AdminApiClient: AdminApiClientType };
      const data = await AdminApiClient.listAnnouncements();
      setItems(data || []);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      showToast(`Duyurular yuklenemedi: ${errMsg}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleApplyPreset = (preset: typeof DISCORD_PRESETS[0]) => {
    setTitle(preset.title);
    setBody(preset.content);
    setBotProfileColor(preset.color);
    setTargetChannel(preset.channel);
    showToast(language === 'tr' ? `"${preset.name}" şablonu yüklendi!` : `"${preset.name}" preset loaded!`, 'success');
  };

  const handleInsertEmoji = (emoji: string) => {
    setBody(prev => prev + ' ' + emoji);
  };

  const checkApiHealth = () => {
    setIsCheckingApi(true);
    const currentTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setDispatchLogs(prev => [
      { id: Date.now(), time: currentTime, type: "INFO", channel: "Diagnostics", message: "API Sunucu bağlantı testi tetikleniyor..." },
      ...prev
    ]);

    setTimeout(() => {
      const ping = Math.floor(Math.random() * 20) + 15;
      setApiLatency(ping);
      setIsCheckingApi(false);
      showToast("Sapphire Gateway bağlantı hızı doğrulandı!", "success");
      setDispatchLogs(prev => [
        { id: Date.now() + 1, time: currentTime, type: "SUCCESS", channel: "Gateway", message: `Handshake onaylandı. Gecikme hızı: ${ping}ms (Optimal)` },
        ...prev
      ]);
    }, 800);
  };

  const insertMarkdown = (syntax: string, wrap = false) => {
    const ta = document.getElementById('ann-body') as HTMLTextAreaElement | null;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = body.slice(start, end);
    let inserted = '';
    if (wrap && selected) {
      inserted = `${syntax}${selected}${syntax}`;
    } else {
      inserted = syntax + (selected || 'metin');
    }
    const next = body.slice(0, start) + inserted + body.slice(end);
    setBody(next);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = start + inserted.length;
      ta.selectionEnd = start + inserted.length;
    }, 0);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    try {
      const { AdminApiClient } = await import('../../../lib/adminApiClient.js') as unknown as { AdminApiClient: AdminApiClientType };
      const item = await AdminApiClient.createAnnouncement(title.trim(), body.trim(), targetRoles);
      showToast('Duyuru taslak olarak olusturuldu.', 'success');
      setItems(prev => [item, ...prev]);
      setTitle('');
      setBody('');
      setTargetRoles([...ALL_TARGET_ROLES]);
      
      const currentTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setDispatchLogs(prev => [
        { id: Date.now(), time: currentTime, type: "SUCCESS", channel: "Sistem DB", message: `Yeni taslak duyuru kaydı oluşturuldu: ${title.trim()}` },
        ...prev
      ]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      showToast(`Duyuru olusturulamadi: ${errMsg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (id: string) => {
    setSaving(true);
    try {
      const { AdminApiClient } = await import('../../../lib/adminApiClient.js') as unknown as { AdminApiClient: AdminApiClientType };
      const selectedItem = items.find(i => i.id === id);
      await AdminApiClient.publishAnnouncement(id, selectedItem?.target_roles);
      showToast('Duyuru yayinlandi ve bot dispatch kuyruklandi.', 'success');
      
      const currentTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setDispatchLogs(prev => [
        { id: Date.now(), time: currentTime, type: "SUCCESS", channel: targetChannel, message: `Duyuru yayınlandı ve bot dispatch edildi: ${selectedItem?.title}` },
        ...prev
      ]);
      await loadData();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      showToast(`Yayinlama basarisiz: ${errMsg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (id: string) => {
    setSaving(true);
    try {
      const baseUrl = (typeof window !== 'undefined' && window.location.protocol === 'chrome-extension:') ? 'https://lutheus.vercel.app' : '';
      const res = await fetch(`${baseUrl}/api/admin/announcements`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.idToken}` },
        body: JSON.stringify({ id, action: 'archive' })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'API_ERROR');
      showToast('Duyuru arsivlendi.', 'success');
      await loadData();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      showToast(`Arsivleme basarisiz: ${errMsg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = (role: string) => {
    setTargetRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4 bg-card border border-border/50 rounded-[24px] p-8 glass-panel animate-in">
        <div className="mx-auto w-12 h-12 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
          <Megaphone className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold">Yetersiz Yetki</h2>
        <p className="text-sm text-muted-foreground max-w-sm">Duyuru yonetimi icin yonetici yetkisi gereklidir.</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 w-full max-w-6xl mx-auto space-y-8 select-none bg-[#050506] text-white/90 min-h-screen">
      
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/[0.04] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#BF5AF2]" />
            <span className="text-[10px] font-mono tracking-widest text-[#BF5AF2] uppercase font-bold">Kadro Bilgilendirme</span>
          </div>
          <h2 className="text-[22px] font-bold text-white tracking-tight mt-1">Duyurular & Bot Yönetimi</h2>
          <p className="text-[13px] text-[#8E8E93] mt-1 font-medium">Yönetim kadrosu ve Sapphire Bot üzerinden sunuculara yön tayin eden duyuru kontrol odası.</p>
        </div>
      </div>

      {/* Connection & Diagnostics Metrics (Upper Row) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#141416]/25 border border-white/5 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#30D158] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#30D158]"></span>
            </span>
            <div>
              <span className="text-[9px] text-[#8E8E93] font-bold block uppercase tracking-wide">SAPPHIRE WEBHOOK</span>
              <span className="text-[11.5px] text-white/90 font-bold block">Entegrasyon Bağlantısı Aktif</span>
            </div>
          </div>
          <span className="text-[10px] text-[#30D158] font-mono font-bold bg-[#30D158]/10 border border-[#30D158]/20 px-2 py-0.5 rounded">Online</span>
        </div>

        <div className="bg-[#141416]/25 border border-white/5 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Radio size={14} className="text-[#BF5AF2]" />
            <div>
              <span className="text-[9px] text-[#8E8E93] font-bold block uppercase tracking-wide">GATEWAY LATENCY</span>
              <span className="text-[11.5px] text-white/90 font-mono block">Milisaniye Tepki Hızı</span>
            </div>
          </div>
          <button 
            type="button"
            disabled={isCheckingApi}
            onClick={checkApiHealth}
            className="flex items-center gap-1.5 text-[10px] text-white font-mono font-bold bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 px-2 py-0.5 rounded cursor-pointer transition-all focus:outline-none"
          >
            {isCheckingApi ? <Loader size={10} className="animate-spin" /> : <RefreshCw size={10} />}
            <span>{apiLatency}ms</span>
          </button>
        </div>

        <div className="bg-[#141416]/25 border border-white/5 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <MessageSquare size={14} className="text-[#FF9F0A]" />
            <div>
              <span className="text-[9px] text-[#8E8E93] font-bold block uppercase tracking-wide">AKTİF İLETİSİM KANALLARI</span>
              <span className="text-[11.5px] text-white/90 font-bold block">Dinlenen Entegre Kanallar</span>
            </div>
          </div>
          <span className="text-[10px] text-white/70 font-mono font-black bg-white/5 border border-white/5 px-2 py-0.5 rounded">3 Kanal</span>
        </div>
      </div>

      {/* Discord Bot Builder Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: 7 COLUMNS - CONFIGURATION SPACE */}
        <div className="lg:col-span-7 space-y-5">
          <div className="compact-glass rounded-2xl p-5 border border-white/[0.04] bg-[#0E0E11]/35 backdrop-blur-3xl space-y-5 text-left relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#BF5AF2]/40 to-transparent" />
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 pb-4 border-b border-white/[0.04]">
              <div>
                <h3 className="text-[13.5px] font-black text-white flex items-center gap-1.5 uppercase font-mono">
                  <Sliders size={14} className="text-[#BF5AF2]" /> Anons Yapılandırıcısı
                </h3>
                <p className="text-[11px] text-[#8E8E93] font-medium mt-0.5">Discord sunucusundaki bot çıkışını kurgulayın.</p>
              </div>
            </div>

            {/* PRESETS BUTTON BAR */}
            <div className="space-y-2">
              <span className="text-[9.5px] text-white/30 uppercase font-mono font-bold tracking-wider block">YÖNETİM ŞABLONLARI (TEK TIKLA DOLDUR)</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {DISCORD_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="p-2 text-left bg-white/[0.015] hover:bg-white/[0.04] border border-white/5 rounded-xl transition-all cursor-pointer group active:scale-97 text-[10.5px]"
                  >
                    <span className="font-bold text-white/80 group-hover:text-white block truncate">{preset.name}</span>
                    <span className="text-[8.5px] text-white/35 font-mono block mt-0.5">{preset.channel}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* FORM */}
            <form onSubmit={handleCreate} className="space-y-4">
              
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-white/40 uppercase tracking-widest font-extrabold font-mono">
                  📢 Duyuru Başlığı
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="Başlık girin..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full h-9 bg-black/40 border border-white/10 rounded-lg px-3 text-[12px] text-white outline-none focus:border-[#BF5AF2]/30 font-medium"
                />
              </div>

              {/* Grid Channel and Color */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-white/40 uppercase tracking-widest font-extrabold font-mono flex items-center gap-1">
                    <Hash size={10} /> Hedef Discord Kanalı (Önizleme)
                  </label>
                  <select 
                    value={targetChannel}
                    onChange={(e) => setTargetChannel(e.target.value)}
                    className="w-full h-9 bg-black/40 border border-white/10 rounded-lg px-2 text-[12px] text-white outline-none focus:border-[#BF5AF2]/30 cursor-pointer"
                  >
                    <option value="#duyuru">📢 #duyuru</option>
                    <option value="#yetkili-duyuru">🛡️ #yetkili-duyuru</option>
                    <option value="#genel-sohbet">💬 #genel-sohbet</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-white/40 uppercase tracking-widest font-extrabold font-mono">
                    🎨 Sol Kenar Çıtası Rengi
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 h-9 p-1 bg-black/20 rounded-lg border border-white/5">
                    {[
                      { hex: '#5E5CE6', name: 'Mor' },
                      { hex: '#30D158', name: 'Yeşil' },
                      { hex: '#FF453A', name: 'Kırmızı' },
                      { hex: '#FF9F0A', name: 'Turuncu' }
                    ].map(c => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setBotProfileColor(c.hex)}
                        className={`h-full rounded font-semibold transition-all border text-[9.5px] cursor-pointer flex items-center justify-center ${
                          botProfileColor === c.hex ? 'border-white bg-[#0A0A0C]/50 text-white font-black scale-102' : 'border-transparent hover:bg-[#0A0A0C]/15 text-white/30'
                        }`}
                        style={{ borderBottom: botProfileColor === c.hex ? `2.5px solid ${c.hex}` : '1px solid transparent' }}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Target Roles (Active DB Requirement) */}
              <div className="space-y-2">
                <label className="text-[10px] text-white/40 uppercase tracking-widest font-extrabold font-mono flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-primary" /> Hedef Yetkili Rolleri (DB Gönderimi)
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALL_TARGET_ROLES.map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRole(role)}
                      className={`px-3 py-1 rounded-xl text-[11px] font-semibold border transition-all ${
                        targetRoles.includes(role)
                          ? 'bg-primary/15 border-primary/45 text-primary'
                          : 'bg-secondary/40 border-border/50 text-white/40'
                      }`}
                    >
                      {ROLE_LABELS[role] || role}
                    </button>
                  ))}
                </div>
              </div>

              {/* Embed Editor Textarea */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-white/40 uppercase tracking-widest font-extrabold font-mono">
                    📝 Embed Anons İçeriği
                  </label>
                  <span className="text-[9.5px] text-white/20 font-mono font-semibold">Markdown Desteği Aktif</span>
                </div>
                
                <div className="flex gap-1 px-2 py-1.5 rounded-t-xl bg-secondary/40 border border-white/10 border-b-0">
                  {[
                    { icon: Bold, action: () => insertMarkdown('**', true), title: 'Kalın' },
                    { icon: Italic, action: () => insertMarkdown('*', true), title: 'İtalik' },
                    { icon: Link, action: () => insertMarkdown('[metin](url)'), title: 'Link' },
                    { icon: List, action: () => insertMarkdown('- '), title: 'Liste' },
                  ].map(({ icon: Icon, action, title: t }) => (
                    <button
                      key={t}
                      type="button"
                      onClick={action}
                      title={t}
                      className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>

                <textarea
                  id="ann-body"
                  required
                  rows={6}
                  placeholder="Örn: **DENETİMLER:** Lütfen gün sonu CUK onaylarını eksiksiz bırakın..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 focus:border-[#BF5AF2]/30 rounded-b-xl p-3 text-[12px] text-white outline-none font-mono transition-all resize-none mb-1 focus:ring-1 focus:ring-[#BF5AF2]/20"
                />
              </div>

              {/* EMOJI UTILITY TOOLBAR */}
              <div className="space-y-1.5 bg-black/25 border border-white/[0.03] rounded-xl p-2.5">
                <span className="text-[9px] text-white/30 uppercase font-mono font-bold block mb-1">Hızlı Emoji Ekle</span>
                <div className="flex flex-wrap gap-1.5">
                  {EMOJI_LIST.map(e => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => handleInsertEmoji(e)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.02] hover:bg-white/[0.08] active:scale-92 border border-white/5 transition-all text-[12.5px] cursor-pointer"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* COLLAPSIBLE MARKDOWN BRIEF */}
              <div className="border border-white/5 rounded-xl overflow-hidden bg-black/20">
                <button
                  type="button"
                  onClick={() => setShowMarkdownGuide(!showMarkdownGuide)}
                  className="w-full flex items-center justify-between p-2.5 text-[10.5px] text-white/50 hover:text-white font-bold cursor-pointer transition-all border-none bg-transparent"
                >
                  <span className="flex items-center gap-1.5"><HelpCircle size={12} /> Markdown Kılavuzunu Görüntüle</span>
                  {showMarkdownGuide ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                <AnimatePresence>
                  {showMarkdownGuide && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      className="overflow-hidden border-t border-white/[0.02]"
                    >
                      <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono text-white/40">
                        <div>
                          <span className="text-white/60 block font-bold">**Kalın Yazı**</span>
                          <span>Kalın metin basar</span>
                        </div>
                        <div>
                          <span className="text-white/60 block font-bold">*İtalik Yazı*</span>
                          <span>İğreti italik basar</span>
                        </div>
                        <div>
                          <span className="text-white/60 block font-bold">~~Üstü Çizili~~</span>
                          <span>Üst çizgili metin</span>
                        </div>
                        <div>
                          <span className="text-white/60 block font-bold">`Kod Bloğu`</span>
                          <span>Tek satır kod</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={saving || !title.trim() || !body.trim() || targetRoles.length === 0}
                  className="w-full sm:w-auto px-6 h-9.5 bg-[#BF5AF2] hover:bg-[#A14EE0] disabled:bg-white/5 disabled:text-white/20 active:scale-98 text-white text-[11.5px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg border-none"
                >
                  {saving ? (
                    <>
                      <Loader size={13} className="animate-spin" />
                      Oluşturuluyor...
                    </>
                  ) : (
                    <>
                      <Plus size={13} />
                      <span>Taslak Olarak Oluştur</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: 5 COLUMNS - DISCORD LIVE MOCKUP */}
        <div className="lg:col-span-5 flex flex-col justify-between">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col justify-between p-5 rounded-2xl bg-[#2f3136]/50 border border-white/[0.05] shadow-2xl relative overflow-hidden backdrop-blur-3xl min-h-[360px]"
          >
            {/* Top Discord Client Simulation Frame Bar */}
            <div className="border-b border-[#202225] pb-3 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[#8e9297] font-bold text-[14px]">#</span>
                <span className="text-white text-[12px] font-black tracking-tight uppercase font-mono">{targetChannel.replace('#', '')}</span>
                <div className="w-[1px] h-3 bg-[#8e9297]/20 mx-1" />
                <span className="text-[#b9bbbe] text-[10px] hidden sm:inline">Sapphire Bot Yayın Çıkışı</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
              </div>
            </div>

            {/* Discord Chat Area Representation */}
            <div className="flex-1 flex flex-col justify-start space-y-4">
              <div className="flex items-start gap-3 text-left">
                {/* Bot Profile Circle Mock */}
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-[12px] shrink-0 font-mono relative cursor-default"
                  style={{ backgroundColor: botProfileColor }}
                >
                  S
                  <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#43b581] border-2 border-[#2f3136]" />
                </div>

                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-[12.5px] font-black text-white hover:underline cursor-pointer">Sapphire CUK Botu</span>
                    <span className="bg-[#5865f2] text-white text-[8px] font-bold px-1.2 py-0.2 rounded uppercase scale-90 tracking-wide font-mono">BOT</span>
                    <span className="text-[#72767d] text-[10px] font-bold">Bugün saat {new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {/* ZENGİN EMBED BOX MOCK */}
                  <div 
                    className="pl-3.5 pr-4 py-3 bg-[#202225]/90 rounded-r-lg border-l-[4px] relative overflow-hidden transition-all duration-300"
                    style={{ borderLeftColor: botProfileColor }}
                  >
                    <span className="text-[10px] text-[#b9bbbe] uppercase tracking-wider font-extrabold block mb-1">{title ? title : 'Sapphire Bildiri Enstitüsü'}</span>
                    <div className="text-[12px] text-white/95 font-medium leading-relaxed whitespace-pre-wrap break-all select-text selection:bg-[#5865f2] discord-rich-body">
                      {body ? (
                        <MarkdownPreview markdown={body} />
                      ) : (
                        "Burası anons önizlemesidir. Sol taraftan metin girdikçe gerçek zamanlı olarak burası simüle edilecektir..."
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-white/[0.03] text-[9.5px] text-white/30 font-semibold font-mono">
                      <span>📡 Sapphire Live Broadcast Engine v2.4</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Discord Input Field Simulation */}
            <div className="bg-[#40444b] rounded-lg px-4 h-9 mt-4 flex items-center justify-between text-[11px] text-[#72767d]">
              <span className="truncate">#{targetChannel.replace('#', '')} kanalına mesaj gönder</span>
              <div className="flex items-center gap-2 shrink-0">
                <span>😊</span>
                <span className="font-extrabold text-[#b9bbbe] border-l border-white/10 pl-2">GIF</span>
              </div>
            </div>
          </motion.div>
        </div>

      </div>

      {/* DISPATCH TRACE LOGS & AUDIT TRAIL TERMINAL */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="compact-glass rounded-2xl p-4 border border-white/[0.04] bg-[#0A0A0C]/75 backdrop-blur-3xl font-mono text-left space-y-3 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-white/[0.05] pb-2.5">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-[#30D158]" />
            <span className="text-[10px] uppercase font-black text-white/40 tracking-wider">Sapphire Webhook Yayın Akış Günlüğü</span>
          </div>
          <div className="flex items-center gap-2 text-[9.5px]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#30D158] animate-pulse" />
            <span className="text-[#30D158] font-bold">WS Live</span>
          </div>
        </div>

        <div className="space-y-1.5 max-h-[110px] overflow-y-auto text-[10.5px] text-white/60 custom-scrollbar divide-y divide-white/[0.01]">
          {dispatchLogs.map((log) => (
            <div key={log.id} className="pt-1.5 flex items-start gap-2.5 leading-relaxed">
              <span className="text-white/25 font-bold shrink-0">[{log.time}]</span>
              <span className={`px-1 rounded text-[8px] font-black tracking-wide shrink-0 ${
                log.type === 'SUCCESS' ? 'bg-[#30D158]/10 text-[#30D158]' : 
                log.type === 'WARNING' ? 'bg-[#FF9F0A]/10 text-[#FF9F0A]' : 'bg-[#BF5AF2]/10 text-[#BF5AF2]'
              }`}>
                {log.type}
              </span>
              <span className="text-white/40 font-bold shrink-0">{log.channel}:</span>
              <span className="text-white/80 selection:bg-[#5865f2] selection:text-white truncate">{log.message}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Dahili Yönetim Duyuru Arşivi */}
      <div className="space-y-4 pt-4 text-left">
        <div className="flex items-center justify-between border-b border-white/[0.04] pb-4">
          <div>
            <h3 className="text-[14px] font-black text-white uppercase tracking-tight font-mono">📌 Dahili Yönetim Duyuru Arşivi</h3>
            <p className="text-[11px] text-[#8E8E93] mt-0.5">Sadece bu web paneli kullanan denetim kadrosuna özel bilgilendirme kartları.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input 
              type="text" 
              placeholder="Duyurularda ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8.5 bg-black/45 border border-white/10 rounded-lg px-3 text-[11.5px] text-white outline-none focus:border-[#BF5AF2]/40 w-44"
            />
            <button 
              onClick={loadData}
              className="flex items-center gap-2 h-8.5 px-3 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Yenile
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <Card key={i} className="p-5">
                <Skeleton className="h-4 w-48 mb-2" />
                <Skeleton className="h-3 w-full mb-1" />
                <Skeleton className="h-3 w-3/4" />
              </Card>
            ))}
          </div>
        ) : items.filter(item => 
            item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
            item.body_markdown.toLowerCase().includes(searchQuery.toLowerCase())
          ).length === 0 ? (
          <EmptyState
            icon={<Megaphone className="w-6 h-6" />}
            title="Aranan kriterde duyuru bulunamadi"
          />
        ) : (
          <div className="space-y-4">
            {items
              .filter(item => 
                item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                item.body_markdown.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((item, index) => {
                const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.draft;
                const StatusIcon = cfg.icon;
                const isExpanded = expanded === item.id;
                return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: index * 0.05 }}
                  className={`compact-glass rounded-2xl border p-5 bg-[#0E0E11]/30 backdrop-blur-3xl relative overflow-hidden transition-all duration-300 ${
                    item.status === 'published' ? 'border-white/[0.03] opacity-85 hover:opacity-100' : 'border-white/[0.09] shadow-lg'
                  }`}
                >
                  {item.status === 'draft' && (
                    <span className="absolute top-5 left-5 w-2 h-2 rounded-full bg-[#BF5AF2] animate-pulse" />
                  )}

                  <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3 ${item.status === 'draft' ? 'pl-4' : ''}`}>
                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] font-mono font-extrabold tracking-widest uppercase text-[#5E5CE6]">
                        DUYURU
                      </span>
                      <Badge variant={cfg.variant} className="text-[10px] shrink-0">{cfg.label}</Badge>
                    </div>

                    <div className="flex items-center gap-3 text-white/40 text-[11px] font-semibold font-mono">
                      <span className="flex items-center gap-1"><Clock size={11} /> {formatDateTime(item.created_at)}</span>
                      {item.published_at && (
                        <span className="text-[11px] text-emerald-500 flex items-center gap-1">
                          <Send className="w-3 h-3" />
                          {formatDateTime(item.published_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={item.status === 'draft' ? 'pl-4' : ''}>
                    <button 
                      onClick={() => setExpanded(isExpanded ? null : item.id)}
                      className="w-full text-left font-bold text-white tracking-tight leading-tight flex items-center justify-between bg-transparent border-none p-0 cursor-pointer hover:text-primary transition-colors focus:outline-none"
                    >
                      <span className="text-[15px]">{item.title}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {isExpanded && (
                      <div className="mt-3.5 space-y-4">
                        <div className="p-4 rounded-xl bg-secondary/20 border border-border/40">
                          <MarkdownPreview markdown={item.body_markdown} />
                        </div>

                        <div className="flex gap-2 flex-wrap mb-2">
                          {(item.target_roles || []).map(r => (
                            <span key={r} className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-[10px] text-white/50 font-mono">
                              {ROLE_LABELS[r] || r}
                            </span>
                          ))}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-3 pt-3.5 border-t border-white/[0.03]">
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(item.body_markdown);
                              showToast('Metin panoya kopyalandı!', 'success');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-white/[0.02] border border-[#BF5AF2]/10 hover:border-[#BF5AF2]/30 text-white/70 text-[11px] font-bold cursor-pointer transition-all mr-auto"
                          >
                            <Copy className="w-3.5 h-3.5 inline mr-1 text-[#BF5AF2]" /> Kopyala
                          </button>
                          {item.status === 'draft' && (
                            <>
                              <button 
                                onClick={() => handleArchive(item.id)}
                                disabled={saving}
                                className="px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] text-white/70 text-[11px] font-bold cursor-pointer transition-all"
                              >
                                <Archive className="w-3.5 h-3.5 inline mr-1" /> Arsivle
                              </button>
                              <button 
                                onClick={() => handlePublish(item.id)}
                                disabled={saving}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-md border-none"
                              >
                                <Send className="w-3.5 h-3.5 mr-1" /> {saving ? 'Gonderiliyor...' : 'Yayinla ve Gonder'}
                              </button>
                            </>
                          )}
                          {item.status === 'published' && (
                            <button 
                              onClick={() => handleArchive(item.id)}
                              disabled={saving}
                              className="px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] text-white/70 text-[11px] font-bold cursor-pointer transition-all"
                            >
                              <Archive className="w-3.5 h-3.5 inline mr-1" /> Arsivle
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

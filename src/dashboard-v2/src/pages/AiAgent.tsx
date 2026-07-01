// SECTION: AI_AGENT_PAGE
// PURPOSE: CUK Denetim AI sohbet ekranı + Sorgu Geçmişi + Doğrudan DM Mesaj Paneli.
// Sekme 1: Sohbet (mevcut Groq analiz arayüzü)
// Sekme 2: Sorgu Geçmişi (bot_ai_query audit_logs tablosundan)
// Sekme 3: DM Gönder (bot üzerinden seçilen yetkiliye veya rütbeye DM gönder)

import { useEffect, useRef, useState, useCallback } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import {
  Bot, Image as ImageIcon, Send, Sparkles, X, AlertTriangle,
  History, MessageSquareDot, RefreshCw, CheckCircle, XCircle,
  Clock, Users, ChevronDown, Shield, SendHorizontal
} from 'lucide-react';
import { validateCase } from '../lib/cukEngine';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { formatDateTime } from '../lib/utils';
import { hasPermission } from '../lib/auth';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  badge?: { source: string; confidence: string };
  imageAttached?: string;
}

interface AiQueryLog {
  id: string;
  actor_discord_id: string | null;
  created_at: string;
  metadata: {
    discordId?: string;
    displayName?: string;
    role?: string;
    question?: string;
    response?: {
      valid?: boolean;
      categoryMatched?: string;
      summary?: string;
      recommendedAction?: string;
    };
    hasImage?: boolean;
    quotaRemaining?: number;
    quotaLimit?: number;
  };
}

interface StaffProfile {
  discord_id: string;
  display_name: string;
  staff_rank: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  discord_moderatoru: 'Discord Moderatörü',
  kidemli_discord_moderatoru: 'Kıdemli Moderatör',
  senior_moderator: 'Senior Moderatör',
  discord_destek_ekibi: 'Destek Ekibi',
  discord_yoneticisi: 'Discord Yöneticisi',
  genel_sorumlu: 'Genel Sorumlu',
  yonetici: 'Yönetici',
  admin: 'Admin',
  kurucu: 'Kurucu',
};

type TabId = 'chat' | 'history' | 'dm';

// ─── Component ────────────────────────────────────────────────────────────────
export default function AiAgent() {
  const { session } = useAuth();
  const { t, language } = useLanguage();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>('chat');

  // ── Chat tab state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── History tab state
  const [queryLogs, setQueryLogs] = useState<AiQueryLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // ── DM tab state
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [dmTarget, setDmTarget] = useState<'role' | 'user'>('role');
  const [dmRole, setDmRole] = useState<string>('all');
  const [dmUserId, setDmUserId] = useState<string>('');
  const [dmMessage, setDmMessage] = useState('');
  const [dmSending, setDmSending] = useState(false);

  const canViewHistory = hasPermission(session?.role || '', 'audit_logs:view');
  const canSendDm = hasPermission(session?.role || '', 'discord_bot:update');
  const avatarUrl = session?.profile?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${session?.profile?.discordId || 'user'}`;

  // ── Welcome message
  useEffect(() => {
    setMessages([{ id: 0, role: 'assistant', content: t('ai.welcome') }]);
  }, [language]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Load query history
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const token = session?.idToken || '';
      const baseUrl = (typeof window !== 'undefined' && window.location.protocol === 'chrome-extension:')
        ? 'https://lutheus.vercel.app' : '';
      const res = await fetch(`${baseUrl}/api/admin/audit-logs?action=bot_ai_query&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setQueryLogs(data.logs || []);
    } catch (err: any) {
      showToast('Sorgu geçmişi yüklenemedi: ' + err.message, 'error');
    } finally {
      setHistoryLoading(false);
    }
  }, [session?.idToken]);

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
    if (activeTab === 'dm') loadStaff();
  }, [activeTab]);

  // ── Load staff for DM tab
  const loadStaff = useCallback(async () => {
    setStaffLoading(true);
    try {
      const token = session?.idToken || '';
      const baseUrl = (typeof window !== 'undefined' && window.location.protocol === 'chrome-extension:')
        ? 'https://lutheus.vercel.app' : '';
      const res = await fetch(`${baseUrl}/api/admin/staff-profiles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const profiles = (data.items || []).filter((p: any) => p.isActiveStaff !== false);
      setStaffList(profiles.map((p: any) => ({
        discord_id: p.discordId || p.discord_id || '',
        display_name: p.displayName || p.name || p.username || p.discord_id || '',
        staff_rank: p.role || p.staffRank || p.staff_rank || 'pending',
      })));
    } catch {
      setStaffList([]);
    } finally {
      setStaffLoading(false);
    }
  }, [session?.idToken]);

  function parseUserInput(text: string): { reason: string; durationMins: number | null } {
    const hourMatch = text.match(/(\d+)\s*(saat|hour)/i);
    const minuteMatch = text.match(/(\d+)\s*(dakika|dk|min)/i);
    const dayMatch = text.match(/(\d+)\s*(gün|gun|day)/i);
    let mins: number | null = null;
    if (dayMatch) mins = Number(dayMatch[1]) * 1440;
    else if (hourMatch) mins = Number(hourMatch[1]) * 60;
    else if (minuteMatch) mins = Number(minuteMatch[1]);
    return { reason: text, durationMins: mins };
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast(t('ai.uploadError'), 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => { setSelectedImage(reader.result as string); showToast(t('ai.visionReady'), 'info'); };
    reader.onerror = () => showToast(t('ai.uploadError'), 'error');
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent<any>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            setSelectedImage(reader.result as string);
            showToast('Panodan görsel yüklendi!', 'success');
          };
          reader.onerror = () => showToast(t('ai.uploadError'), 'error');
          reader.readAsDataURL(file);
          e.preventDefault();
          break;
        }
      }
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !selectedImage) || loading) return;

    const currentImg = selectedImage;
    const userMsg: Message = {
      id: Date.now(), role: 'user',
      content: input || (language === 'tr' ? '[Görsel Analizi İstendi]' : '[Image Analysis Requested]'),
      imageAttached: currentImg || undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSelectedImage(null);
    setLoading(true);

    try {
      const { reason, durationMins } = parseUserInput(input);
      const result = validateCase(reason, durationMins);
      let response = '';
      let badgeSource = result.categoryMatched || 'CUK Engine';
      const confidenceScore = `%${Math.round(result.score * 100)}`;

      try {
        const token = session?.idToken || '';
        const baseUrl = (typeof window !== 'undefined' && window.location.protocol === 'chrome-extension:') ? 'https://lutheus.vercel.app' : '';
        const res = await fetch(`${baseUrl}/api/ai/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ reason_raw: reason, duration_ms: durationMins ? durationMins * 60000 : 0, image: currentImg || undefined }),
        });
        if (!res.ok) throw new Error(`AI_ENDPOINT_FAILED_${res.status}`);
        const data = await res.json();
        if (data.success && data.analysis) {
          const ai = data.analysis;
          response = result.valid
            ? `[${t('ai.engineVerdict')}] ${t('ai.engineVerdictValid')}\n${t('home.status')}: ${result.categoryMatched}\n\n`
            : `[${t('ai.engineVerdict')}] ${t('ai.engineVerdictInvalid')}\n${t('ai.engineVerdictMsg')}: ${result.message}\n\n`;

          response += `${t('ai.groqReport')}\n`;
          response += `- ${t('ai.groqSummary')}: ${ai.summary || 'N/A'}\n`;
          response += `- ${t('ai.groqRisks')}: ${ai.riskReasons || 'N/A'}\n`;
          response += `- ${t('ai.groqAction')}: ${ai.recommendedAction || 'N/A'}\n`;
          response += `- ${t('ai.groqConfidence')}: ${ai.confidenceNote || 'N/A'}`;
          badgeSource = 'Groq AI + CUK';
        } else throw new Error('AI_INVALID_RESPONSE');
      } catch {
        response = result.valid
          ? `${t('ai.engineVerdictValid')}\n\n${t('home.status')}: ${result.categoryMatched}\n${t('ai.engineVerdictMsg')}: ${result.message}`
          : `${t('ai.engineVerdictInvalid')}\n\n${t('home.status')}: ${result.categoryMatched || 'Tanımsız'}\n${t('ai.engineVerdictMsg')}: ${result.message}`;
        response += `\n\n[Hata] ${t('ai.endpointError')}`;
      }

      setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', content: response, badge: { source: badgeSource, confidence: confidenceScore } }]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDmSend = async () => {
    if (!dmMessage.trim()) { showToast('Mesaj boş olamaz.', 'error'); return; }
    setDmSending(true);
    try {
      const token = session?.idToken || '';
      const baseUrl = (typeof window !== 'undefined' && window.location.protocol === 'chrome-extension:') ? 'https://lutheus.vercel.app' : '';
      const body: Record<string, unknown> = {
        action: 'dispatch_direct_message',
        guildId: 'dm_only',
        payload: {
          mesaj: dmMessage,
          gonderenAdi: session?.profile?.displayName || 'Yönetim',
          ...(dmTarget === 'role' ? { hedefRol: dmRole } : { hedefKullanici: dmUserId }),
        },
      };
      const res = await fetch(`${baseUrl}/api/admin/discord-bot-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast('✅ Mesaj kuyruğa alındı. Bot kısa süre içinde iletecek.', 'success');
      setDmMessage('');
    } catch (err: any) {
      showToast('Mesaj gönderilemedi: ' + err.message, 'error');
    } finally {
      setDmSending(false);
    }
  };

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'chat', label: 'CUK Analiz', icon: Bot },
    ...(canViewHistory ? [{ id: 'history' as TabId, label: 'Sorgu Geçmişi', icon: History }] : []),
    ...(canSendDm ? [{ id: 'dm' as TabId, label: 'DM Gönder', icon: MessageSquareDot }] : []),
  ];

  return (
    <div onPaste={handlePaste} className="p-6 md:p-8 w-full">
    <div className="max-w-5xl mx-auto flex flex-col space-y-6 animate-in fade-in duration-300">
      
      {/* Premium Header with Glowing Accent */}
      <div className="relative p-6 rounded-3xl overflow-hidden border border-white/[0.06] bg-black/35 backdrop-blur-2xl shadow-[0_0_50px_0_rgba(162,89,254,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="absolute top-0 right-0 w-80 h-32 bg-[#A259FE]/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#5E5CE6]/20 to-[#A259FE]/20 border border-[#A259FE]/30 flex items-center justify-center text-[#A259FE] shadow-[0_0_20px_0_rgba(162,89,254,0.15)] animate-pulse">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              {t('ai.title')}
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-[#A259FE]/20 text-[#A259FE] border border-[#A259FE]/30 tracking-wider">CUK v2</span>
            </h2>
            <p className="text-xs text-white/50 mt-1">{t('ai.subtitle')}</p>
          </div>
        </div>

        {/* Tab Selection Row */}
        <div className="flex p-1 bg-white/[0.03] border border-white/[0.06] rounded-2xl w-fit">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              id={`ai-tab-${id}`}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeTab === id
                  ? 'bg-gradient-to-r from-[#5E5CE6]/30 to-[#A259FE]/30 text-white border border-white/[0.08] shadow-md shadow-[#A259FE]/5'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── TAB: Chat ──────────────────────────────────────────────────── */}
      {activeTab === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          
          {/* Chat main area */}
          <div className="lg:col-span-3 flex flex-col h-[calc(100vh-270px)] min-h-[480px] rounded-3xl border border-white/[0.06] bg-black/25 backdrop-blur-3xl overflow-hidden shadow-2xl">
            <div className="flex-1 overflow-y-auto p-6 space-y-6 hide-scrollbar">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-200`}>
                  <div className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    
                    {m.role === 'assistant' ? (
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#5E5CE6]/10 to-[#A259FE]/10 border border-[#A259FE]/20 flex items-center justify-center shrink-0 shadow-lg text-[#A259FE] mt-1">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/[0.06] flex items-center justify-center shrink-0 mt-1 overflow-hidden">
                        <img src={avatarUrl} alt="" className="w-full h-full object-cover animate-in fade-in" />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <div className={`p-4 rounded-[22px] whitespace-pre-wrap text-sm leading-relaxed ${
                        m.role === 'user' 
                          ? 'bg-gradient-to-br from-[#5E5CE6]/15 to-[#A259FE]/15 text-white border border-[#A259FE]/20 rounded-tr-sm shadow-md' 
                          : 'bg-white/[0.02] text-white/90 border border-white/[0.06] rounded-tl-sm'
                      }`}>
                        {m.imageAttached && (
                          <div className="mb-3.5 rounded-2xl overflow-hidden max-w-sm border border-white/[0.08] shadow-lg">
                            <img src={m.imageAttached} alt="Attached screenshot" className="w-full object-cover max-h-56" />
                          </div>
                        )}
                        <p className="font-medium text-xs sm:text-sm tracking-wide">{m.content}</p>
                      </div>

                      {m.badge && m.role === 'assistant' && (
                        <div className="flex items-center gap-1.5 flex-wrap px-2">
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-[#A259FE]/10 text-[#A259FE] border border-[#A259FE]/20 tracking-wider">
                            {m.badge.source}
                          </span>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 tracking-wider">
                            {t('pt.reliability')}: {m.badge.confidence}
                          </span>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#5E5CE6]/10 to-[#A259FE]/10 border border-[#A259FE]/20 flex items-center justify-center shrink-0 text-[#A259FE] mt-1">
                      <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                    </div>
                    <div className="p-4 rounded-[22px] bg-white/[0.02] border border-white/[0.06] rounded-tl-sm flex items-center gap-1">
                      {[0, 150, 300].map((d) => (
                        <div key={d} className="w-1.5 h-1.5 rounded-full bg-[#A259FE] animate-bounce" style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Premium Input Workspace */}
            <div className="p-4 border-t border-white/[0.06] bg-black/45 space-y-3">
              {selectedImage && (
                <div className="flex items-center gap-3.5 p-3 rounded-2xl border border-[#A259FE]/20 bg-[#A259FE]/5 animate-in slide-in-from-bottom-2 duration-200">
                  <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/[0.1] shrink-0 relative shadow-inner">
                    <img src={selectedImage} alt="Thumbnail preview" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => setSelectedImage(null)}
                      className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-black/80 hover:bg-black text-white transition-colors cursor-pointer border border-white/[0.08]">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-[#A259FE] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> {t('ai.visionReady')}
                    </div>
                    <div className="text-[10px] text-white/40 mt-0.5 flex items-center gap-1 truncate">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="truncate">{t('ai.imageNotSaved')}</span>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
                <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
                
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className={`shrink-0 w-11 h-11 flex items-center justify-center transition-all rounded-xl border cursor-pointer ${
                    selectedImage 
                      ? 'bg-[#A259FE]/15 text-[#A259FE] border-[#A259FE]/30' 
                      : 'bg-white/5 border-white/[0.06] text-white/50 hover:text-[#A259FE] hover:bg-white/10'
                  }`}
                  title="Görsel veya Kanıt Yükle"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>

                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                  onPaste={handlePaste}
                  placeholder={t('ai.placeholder')}
                  className="flex-1 h-11 bg-white/5 focus:bg-[#0D0D11]/60 border border-white/[0.06] focus:border-[#A259FE]/40 rounded-xl px-4 text-xs focus:outline-none placeholder:text-white/20 transition-all text-white font-medium" 
                />

                <button type="submit" disabled={(!input.trim() && !selectedImage) || loading}
                  className="shrink-0 w-11 h-11 flex items-center justify-center text-white bg-gradient-to-tr from-[#5E5CE6] to-[#A259FE] hover:shadow-[0_0_20px_0_rgba(162,89,254,0.25)] rounded-xl hover:opacity-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer"
                >
                  <SendHorizontal className="w-4 h-4" />
                </button>
              </form>

              <div className="text-center text-[9px] text-white/20 font-bold uppercase tracking-widest pt-1">
                {t('ai.warning')}
              </div>
            </div>
          </div>

          {/* Quick instructions sidebar */}
          <div className="space-y-4">
            <div className="p-5 rounded-3xl border border-white/[0.06] bg-black/20 backdrop-blur-xl space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#A259FE] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                AI Analiz Kılavuzu
              </h3>
              <p className="text-xs text-white/60 leading-relaxed">
                Ceza analizi yaparken sebep ve süreyi girerek kural ihlallerini doğrulayabilirsiniz.
              </p>
              
              <div className="space-y-2 text-[11px] font-mono text-white/40">
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="text-[9px] text-[#A259FE] font-bold">Örnek Sorgu:</div>
                  <div className="text-white/80 mt-1 leading-snug">"Yetkiliye saygısızlık — 12 saat"</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="text-[9px] text-[#A259FE] font-bold">Görsel Analizi:</div>
                  <div className="text-white/80 mt-1 leading-snug">Sol alttaki görsel butonunu kullanarak veya direkt pano üzerinden ekran görüntüsü yapıştırarak (CTRL+V) görsel CUK analizi yaptırabilirsiniz.</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ─── TAB: Query History ─────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.05] pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">Sorgu Geçmişi</h3>
              <p className="text-xs text-white/40 mt-1">Discord üzerinden yapılan AI sorgu logları listesi.</p>
            </div>
            <Button variant="outline" size="sm" onClick={loadHistory} disabled={historyLoading} id="ai-history-refresh" className="cursor-pointer border-white/[0.08] hover:bg-white/5">
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${historyLoading ? 'animate-spin' : ''}`} />
              Yenile
            </Button>
          </div>

          {historyLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
            </div>
          ) : queryLogs.length === 0 ? (
            <Card className="p-12 text-center border-white/[0.06] bg-black/15">
              <History className="w-10 h-10 text-white/10 mx-auto mb-3" />
              <p className="text-xs text-white/40 font-semibold">Henüz sorgu kaydı bulunmuyor.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {queryLogs.map((log) => {
                const meta = log.metadata || {};
                const isExpanded = expandedLog === log.id;
                const verdict = meta.response?.valid;
                return (
                  <Card key={log.id} className="overflow-hidden border border-white/[0.06] bg-black/15 hover:border-[#A259FE]/20 transition-all rounded-2xl">
                    <button
                      id={`ai-log-${log.id}`}
                      onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                      className="w-full p-4 flex items-center gap-4 text-left cursor-pointer"
                    >
                      <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${
                        verdict === true ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        verdict === false ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                        'bg-white/5 border border-white/[0.08] text-white/40'
                      }`}>
                        {verdict === true ? <CheckCircle className="w-4 h-4" /> :
                         verdict === false ? <XCircle className="w-4 h-4" /> :
                         <Shield className="w-4 h-4" />}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white truncate">{meta.displayName || meta.discordId || 'Bilinmeyen Yetkili'}</span>
                          {meta.role && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/5 border border-white/[0.08] text-white/60">
                              {ROLE_LABELS[meta.role] || meta.role}
                            </span>
                          )}
                          {meta.hasImage && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#A259FE]/10 text-[#A259FE] border border-[#A259FE]/20">📷 Görsel</span>}
                          {verdict !== undefined && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${verdict ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                              {verdict ? '✅ Geçerli' : '❌ Geçersiz'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/60 truncate font-mono">{meta.question || '-'}</p>
                        <div className="flex items-center gap-3 text-[10px] text-white/30 font-semibold">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDateTime(log.created_at)}</span>
                          {meta.quotaLimit !== undefined && (
                            <span className="flex items-center gap-1">
                              <Shield className="w-3 h-3" />
                              Kota: {(meta.quotaLimit - (meta.quotaLimit - (meta.quotaRemaining ?? 0)))}/{meta.quotaLimit}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-white/40 shrink-0 transition-transform ${isExpanded ? 'rotate-180 text-white' : ''}`} />
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-white/[0.04] bg-white/[0.01] space-y-3.5 pt-3.5 animate-in slide-in-from-top-1 duration-150">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white/[0.02] border border-white/[0.04] rounded-2xl p-3">
                            <div className="text-[9px] font-bold uppercase tracking-wider text-white/30">Discord ID</div>
                            <div className="text-xs font-mono font-semibold text-white/80 mt-1">{meta.discordId || '-'}</div>
                          </div>
                          <div className="bg-white/[0.02] border border-white/[0.04] rounded-2xl p-3">
                            <div className="text-[9px] font-bold uppercase tracking-wider text-white/30">Eşleşen CUK Kategorisi</div>
                            <div className="text-xs font-bold text-white/80 mt-1">{meta.response?.categoryMatched || '-'}</div>
                          </div>
                        </div>

                        {meta.question && (
                          <div className="bg-white/[0.02] border border-white/[0.04] rounded-2xl p-3.5">
                            <div className="text-[9px] font-bold uppercase tracking-wider text-white/30">Sorgulanan Ceza Sebebi / Metin</div>
                            <p className="text-xs font-semibold text-white/90 mt-1.5 whitespace-pre-wrap leading-relaxed">{meta.question}</p>
                          </div>
                        )}

                        {meta.response?.summary && (
                          <div className="bg-white/[0.02] border border-white/[0.04] rounded-2xl p-3.5">
                            <div className="text-[9px] font-bold uppercase tracking-wider text-white/30">AI Yapay Zeka Özeti</div>
                            <p className="text-xs font-medium text-white/80 mt-1.5 leading-relaxed">{meta.response.summary}</p>
                          </div>
                        )}

                        {meta.response?.recommendedAction && (
                          <div className="bg-gradient-to-br from-[#5E5CE6]/10 to-[#A259FE]/10 border border-[#A259FE]/20 rounded-2xl p-3.5">
                            <div className="text-[9px] font-bold uppercase tracking-wider text-[#A259FE]">Yapay Zeka Önerilen Aksiyon</div>
                            <p className="text-xs font-bold text-white/95 mt-1.5 leading-relaxed">{meta.response.recommendedAction}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: DM Gönder ─────────────────────────────────────────────── */}
      {activeTab === 'dm' && canSendDm && (
        <div className="space-y-4">
          <div className="border-b border-white/[0.05] pb-3">
            <h3 className="text-sm font-bold text-white">DM Gönder</h3>
            <p className="text-xs text-white/40 mt-1">Sapphire Bot üzerinden yetkililere veya belirli rütbelere direkt mesaj iletin.</p>
          </div>

          <Card className="p-6 space-y-5 border-white/[0.06] bg-black/15 rounded-3xl">
            {/* Target type selector */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold uppercase tracking-widest text-white/40">Hedef Türü</label>
              <div className="flex gap-2">
                <button
                  id="dm-target-role"
                  onClick={() => setDmTarget('role')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    dmTarget === 'role' 
                      ? 'bg-gradient-to-r from-[#5E5CE6]/20 to-[#A259FE]/20 border-[#A259FE]/30 text-white shadow-lg' 
                      : 'bg-white/5 border-white/[0.06] text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Rütbeye Göre Toplu
                </button>
                <button
                  id="dm-target-user"
                  onClick={() => setDmTarget('user')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    dmTarget === 'user' 
                      ? 'bg-gradient-to-r from-[#5E5CE6]/20 to-[#A259FE]/20 border-[#A259FE]/30 text-white shadow-lg' 
                      : 'bg-white/5 border-white/[0.06] text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Bot className="w-3.5 h-3.5" />
                  Tekil Yetkiliye Özel
                </button>
              </div>
            </div>

            {/* Target inputs layout */}
            <div className="grid grid-cols-1 gap-4">
              {/* Role selector */}
              {dmTarget === 'role' && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-white/40">Hedef Yetki Sınıfı</label>
                  <select
                    id="dm-role-select"
                    value={dmRole}
                    onChange={(e) => setDmRole(e.target.value)}
                    className="w-full h-11 bg-[#0D0D11]/60 border border-white/[0.06] focus:border-[#A259FE]/40 rounded-xl px-3 text-xs text-white outline-none focus:ring-1 focus:ring-[#A259FE]/30 font-semibold"
                  >
                    <option value="all">Tüm Aktif Yetkililer</option>
                    {Object.entries(ROLE_LABELS).map(([val, lbl]) => (
                      <option key={val} value={val}>{lbl}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* User selector */}
              {dmTarget === 'user' && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-white/40">Hedef Yetkili</label>
                  {staffLoading ? (
                    <Skeleton className="h-11 rounded-xl" />
                  ) : (
                    <select
                      id="dm-user-select"
                      value={dmUserId}
                      onChange={(e) => setDmUserId(e.target.value)}
                      className="w-full h-11 bg-[#0D0D11]/60 border border-white/[0.06] focus:border-[#A259FE]/40 rounded-xl px-3 text-xs text-white outline-none focus:ring-1 focus:ring-[#A259FE]/30 font-semibold"
                    >
                      <option value="">-- Hedef yetkili seçin --</option>
                      {staffList.map((s) => (
                        <option key={s.discord_id} value={s.discord_id}>
                          {s.display_name} — {ROLE_LABELS[s.staff_rank] || s.staff_rank}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* Message content textarea */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-white/40">Mesaj İçeriği (Markdown Destekler)</label>
              <textarea
                id="dm-message-input"
                value={dmMessage}
                onChange={(e) => setDmMessage(e.target.value)}
                placeholder="İletilecek mesaj detaylarını yazın..."
                rows={6}
                className="w-full bg-[#0D0D11]/60 border border-white/[0.06] focus:border-[#A259FE]/40 rounded-2xl px-4 py-3 text-xs text-white outline-none focus:ring-1 focus:ring-[#A259FE]/30 placeholder:text-white/20 resize-none font-medium leading-relaxed"
              />
              <div className="flex items-center justify-between text-[10px] font-semibold text-white/30">
                <span>Mesaj bot tarafından Discord DM kutusuna doğrudan iletilir.</span>
                <span className={dmMessage.length > 1900 ? 'text-red-400 font-bold' : ''}>{dmMessage.length}/2000</span>
              </div>
            </div>

            {/* Send panel footer */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-white/[0.05]">
              <div className="text-[10px] font-bold text-white/30 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                Duyurular ve acil bildirimler için kullanılması önerilir.
              </div>
              <Button
                id="dm-send-button"
                onClick={handleDmSend}
                disabled={dmSending || !dmMessage.trim() || (dmTarget === 'user' && !dmUserId)}
                className="bg-gradient-to-r from-[#5E5CE6] to-[#A259FE] hover:shadow-[0_0_20px_0_rgba(162,89,254,0.2)] text-white font-bold h-10 px-6 rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                {dmSending ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Gönderiliyor...</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" /> DM Gönder</>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
    </div>
  );
}

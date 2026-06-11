'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, Calendar, Plus, X, Eye, FileText, CheckCircle2, 
  Sparkles, Award, Archive, Bookmark, AlertCircle, Radio,
  Send, Loader2
} from 'lucide-react';
import Tooltip from '@/components/ui/Tooltip';

interface Announcement {
  id: number;
  title: string;
  category: 'KURAL GÜNCELLEMESİ' | 'DUYURU' | 'PERFORMANS' | 'ETKİNLİK';
  content: string;
  date: string;
  author: string;
  isRead: boolean;
  priority: 'Yüksek' | 'Normal';
}

const DEFAULT_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 1,
    title: "CUK-02 Madde Hükmü Güncellemesi Hakkında",
    category: "KURAL GÜNCELLEMESİ",
    content: "Sohbet genel kalitesini artırmak adına, şahsi ağır hakaretlerde uygulanan mute sürelerinde alt sınır 3 saatten 6 saate çıkarılmıştır. Tüm denetmenlerin yeni süre tablosunu incelemesi önemle rica olunur.",
    date: "08.06.2026",
    author: "Gear_Head",
    isRead: false,
    priority: "Yüksek"
  },
  {
    id: 2,
    title: "Haftanın En Başarılı Yetkilisi Seçimi",
    category: "PERFORMANS",
    content: "Geçtiğimiz hafta boyunca toplam 48 başarılı denetim gerçekleştiren ve %98.4 doğruluk oranına ulaşan 'dadlukedi' haftanın en başarılı yetkilisi unvanına hak kazanmıştır! Kendisini tebrik ederiz.",
    date: "06.06.2026",
    author: "Gear_Head",
    isRead: true,
    priority: "Normal"
  },
  {
    id: 3,
    title: "Sapphire API Sunucu Bakım Çalışması",
    category: "DUYURU",
    content: "Lutheus analiz motorunun bağlı olduğu Sapphire API arayüzünde yapılacak olan sürüm güncellemeleri nedeniyle 10 Haziran gecesi saat 02.00-04.00 aralığında kısa süreli veri kesintileri yaşanabilir.",
    date: "05.06.2026",
    author: "Lutheus Sistem",
    isRead: true,
    priority: "Normal"
  }
];

export default function Announcements() {
  const [items, setItems] = useState<Announcement[]>(DEFAULT_ANNOUNCEMENTS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<'KURAL GÜNCELLEMESİ' | 'DUYURU' | 'PERFORMANS' | 'ETKİNLİK'>('DUYURU');
  const [newPriority, setNewPriority] = useState<'Yüksek' | 'Normal'>('Normal');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // discord bot announcement panel states
  const [targetChannel, setTargetChannel] = useState('#duyuru');
  const [botMessage, setBotMessage] = useState('');
  const [botProfileColor, setBotProfileColor] = useState('#5E5CE6');
  const [isBotSending, setIsBotSending] = useState(false);
  const [botSendSuccess, setBotSendSuccess] = useState(false);

  const handleSendDiscordBotAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!botMessage.trim()) return;

    setIsBotSending(true);
    setBotSendSuccess(false);

    setTimeout(() => {
      setIsBotSending(false);
      setBotSendSuccess(true);
      setBotMessage('');
      setToastMessage(`Duyuru Discord Sapphire Bot ile ${targetChannel} kanalına başarıyla servis edildi!`);
      setTimeout(() => {
        setBotSendSuccess(false);
        setToastMessage(null);
      }, 3000);
    }, 1800);
  };

  const getPriorityStyle = (priority: 'Yüksek' | 'Normal') => {
    return priority === 'Yüksek' 
      ? 'bg-[#FF453A]/10 border-[#FF453A]/20 text-[#FF453A]' 
      : 'bg-white/5 border-white/5 text-white/50';
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'KURAL GÜNCELLEMESİ': return 'text-[#FF9F0A]';
      case 'PERFORMANS': return 'text-[#32D74B]';
      case 'ETKİNLİK': return 'text-[#0DF5FF]';
      default: return 'text-[#5E5CE6]'; // DUYURU
    }
  };

  const handleMarkAsRead = (id: number) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, isRead: true } : item));
  };

  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const created: Announcement = {
      id: Date.now(),
      title: newTitle,
      category: newCategory,
      content: newContent,
      date: new Date().toLocaleDateString('tr-TR'),
      author: "Gear_Head",
      isRead: false,
      priority: newPriority
    };

    setItems(prev => [created, ...prev]);
    setShowAddModal(false);
    setNewTitle('');
    setNewContent('');
    setNewCategory('DUYURU');
    setNewPriority('Normal');

    setToastMessage("Duyuru başarıyla yayımlandı!");
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleDeleteAnnouncement = (id: number) => {
    if (confirm("Bu duyuruyu silmek istediğinizden emin misiniz?")) {
      setItems(prev => prev.filter(item => item.id !== id));
      setToastMessage("Duyuru silindi.");
      setTimeout(() => setToastMessage(null), 2500);
    }
  };

  return (
    <div className="p-6 md:p-8 w-full max-w-5xl mx-auto space-y-8 select-none">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/[0.04] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#5E5CE6]" />
            <span className="text-[10px] font-mono tracking-widest text-[#5E5CE6] uppercase font-bold">Kadro Bilgilendirme</span>
          </div>
          <h2 className="text-[22px] font-bold text-white tracking-tight mt-1">Duyurular & Genelgeler</h2>
          <p className="text-[13px] text-[#8E8E93] mt-1 font-medium">Yönetim kadrosu tarafından yayınlanan güncel talimatnameleri ve duyuruları takip edin.</p>
        </div>

        <button 
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 text-[11px] font-bold text-white bg-[#5E5CE6] hover:bg-[#4E4CD6] rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-md self-start md:self-auto"
        >
          <Plus size={13} /> Duyuru Yayınla
        </button>
      </div>

      {/* Discord Bot Integration & Announcement Broadcaster Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="compact-glass rounded-2xl p-6 border border-white/[0.04] bg-[#0E0E11]/35 backdrop-blur-3xl space-y-5 text-left"
      >
        <div className="flex items-center justify-between border-b border-white/[0.04] pb-4">
          <div className="flex items-center gap-2.5">
            <Radio size={16} className="text-[#BF5AF2] animate-pulse" />
            <div>
              <h3 className="text-[14px] font-bold text-white flex items-center gap-2">🤖 Discord Bot Entegrasyonu & Anons Paneli</h3>
              <p className="text-[11px] text-[#8E8E93] mt-0.5">Yönetici yetkisi ile Sapphire Bot üzerinden tüm sunucuya anlık duyuru yayınlayın.</p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded border border-[#BF5AF2]/20 bg-[#BF5AF2]/10 text-[#BF5AF2] text-[9.5px] font-black tracking-widest uppercase">
            Sistem Aktif
          </span>
        </div>

        <form onSubmit={handleSendDiscordBotAnnouncement} className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Form configurations */}
          <div className="md:col-span-8 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-white/40 uppercase tracking-widest font-extrabold">Hedef Discord Kanalı</label>
                <select 
                  value={targetChannel}
                  onChange={(e) => setTargetChannel(e.target.value)}
                  className="w-full h-9 bg-black/40 border border-white/10 rounded-lg px-2 text-[12px] text-white outline-none focus:border-[#BF5AF2]/30"
                >
                  <option value="#duyuru">📢 #duyuru</option>
                  <option value="#yetkili-duyuru">🛡️ #yetkili-duyuru</option>
                  <option value="#genel-sohbet">💬 #genel-sohbet</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-white/40 uppercase tracking-widest font-extrabold">Anons Ön-izleme Teması</label>
                <div className="flex items-center gap-2 h-9 p-1 bg-black/20 rounded-lg border border-white/5">
                  {[
                    { hex: '#5E5CE6', name: 'Violet' },
                    { hex: '#32D74B', name: 'Emerald' },
                    { hex: '#FF453A', name: 'Coral' },
                    { hex: '#FF9F0A', name: 'Amber' }
                  ].map(c => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setBotProfileColor(c.hex)}
                      className={`flex-1 h-full rounded transition-all border ${
                        botProfileColor === c.hex ? 'border-white bg-white/10 scale-102 font-bold' : 'border-transparent hover:bg-white/5 text-white/40'
                      } text-[10px]`}
                      style={{ color: botProfileColor === c.hex ? '#fff' : c.hex }}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-white/40 uppercase tracking-widest font-extrabold">Duyuru / Anons İçeriği (Markdown Desteklenir)</label>
              <textarea
                required
                rows={3}
                placeholder="Örn: **YENİLİK:** Yetkili ceza puanı hiyerarşisi yeniden yapılandırıldı..."
                value={botMessage}
                onChange={(e) => setBotMessage(e.target.value)}
                className="w-full bg-black/40 border border-white/10 focus:border-[#BF5AF2]/30 rounded-lg p-3 text-[12px] text-white outline-none font-medium transition-colors resize-none mb-1"
              />
              <div className="flex justify-between text-[10px] text-white/30 font-semibold px-0.5">
                <span>Markdown formatlama aktiftir</span>
                <span>{botMessage.length} karakter</span>
              </div>
            </div>
          </div>

          {/* Interactive Live Embed Preview Box */}
          <div className="md:col-span-4 flex flex-col justify-between p-4 rounded-xl bg-[#202225]/45 border border-white/[0.04] space-y-4">
            <div className="space-y-2">
              <span className="text-[9.5px] font-mono font-black text-white/30 uppercase tracking-widest block">Discord Embed Ön-izleme</span>
              <div className="pl-3 relative text-left" style={{ borderLeft: `4px solid ${botProfileColor}` }}>
                <span className="text-[12px] font-bold text-white block">Sapphire CUK Botu</span>
                <p className="text-[11.5px] text-white/70 leading-relaxed font-normal mt-1 whitespace-pre-wrap break-all">
                  {botMessage ? botMessage : "Anons içeriğini sol kısımdan yazarak canlı yayını burada simüle edebilirsiniz..."}
                </p>
                <div className="text-[9px] font-mono text-white/20 mt-3 font-semibold">
                  Bugün saat 18:44 • Sapphire Systems
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isBotSending || !botMessage.trim()}
              className="w-full h-9 bg-[#BF5AF2] hover:bg-[#A14EE0] disabled:bg-white/5 disabled:text-white/20 active:scale-98 text-white text-[11.5px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shrink-0"
            >
              {isBotSending ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Yayın Gönderiliyor...
                </>
              ) : (
                <>
                  <Send size={13} />
                  Kanalda Yayınla
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>

      {/* Announcements List Layout */}
      <div className="space-y-4">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.05 }}
            className={`compact-glass rounded-2xl border p-6 bg-[#0E0E11]/30 backdrop-blur-3xl relative overflow-hidden transition-all duration-300 ${
              item.isRead ? 'border-white/[0.03] opacity-80' : 'border-white/[0.09] shadow-lg'
            }`}
          >
            {/* Ambient subtle state dot */}
            {!item.isRead && (
              <span className="absolute top-6 left-6 w-2 h-2 rounded-full bg-[#5E5CE6] animate-pulse" />
            )}

            <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 ${!item.isRead ? 'pl-4' : ''}`}>
              <div className="flex items-center gap-2.5">
                <span className={`text-[10px] font-mono font-extrabold tracking-widest ${getCategoryColor(item.category)}`}>
                  {item.category}
                </span>

                {item.priority === 'Yüksek' && (
                  <span className="px-2 py-0.5 rounded border text-[9px] font-extrabold uppercase bg-[#FF453A]/10 border-[#FF453A]/20 text-[#FF453A]">
                    ACİL
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-white/40 text-[11px] font-semibold">
                <span className="flex items-center gap-1"><Calendar size={11} /> {item.date}</span>
                <span>Yazar: <span className="text-white/70 font-bold">{item.author}</span></span>
              </div>
            </div>

            <div className={`text-left ${!item.isRead ? 'pl-4' : ''}`}>
              <h3 className="text-[15.5px] font-bold text-white tracking-tight leading-tight">{item.title}</h3>
              <p className="text-[12.5px] text-white/60 mt-3 leading-relaxed font-medium">{item.content}</p>
            </div>

            <div className="flex items-center justify-end gap-3 mt-5 pt-4 border-t border-white/[0.03]">
              {!item.isRead && (
                <button 
                  onClick={() => handleMarkAsRead(item.id)}
                  className="px-3 py-1.5 rounded-lg bg-[#5E5CE6]/10 border border-[#5E5CE6]/20 hover:bg-[#5E5CE6]/15 hover:border-[#5E5CE6]/30 text-[#5E5CE6] text-[11px] font-bold cursor-pointer transition-all"
                >
                  Okundu Olarak İşaretle
                </button>
              )}
              <button 
                onClick={() => handleDeleteAnnouncement(item.id)}
                className="px-3 py-1.5 rounded-lg bg-[#FF453A]/5 border border-[#FF453A]/10 hover:bg-[#FF453A]/15 hover:border-[#FF453A]/20 text-[#FF453A] text-[11px] font-bold cursor-pointer transition-all"
              >
                Duyuruyu Sil
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Add Announcement Overlay Modal */}
      <AnimatePresence>
        {showAddModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm z-45 cursor-pointer"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="fixed inset-x-4 top-[10%] md:mx-auto max-w-sm bg-[#0E0E11]/95 border border-white/[0.08] backdrop-blur-3xl rounded-2xl shadow-[0_25px_50px_rgba(0,0,0,0.7)] z-50 overflow-hidden text-left"
            >
              <div className="p-5 border-b border-white/[0.05] bg-black/20 flex items-center justify-between">
                <h3 className="text-[13.5px] font-bold text-white tracking-tight">Yeni Duyuru Yayınla</h3>
                <button onClick={() => setShowAddModal(false)} className="text-white/40 hover:text-white cursor-pointer"><X size={15} /></button>
              </div>

              <form onSubmit={handleCreateAnnouncement} className="p-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Duyuru Başlığı</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Örn: CUK Kural Güncellemesi"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full h-9 bg-[#141416] border border-white/10 focus:border-[#5E5CE6]/30 rounded-lg px-3 text-[12px] text-white outline-none font-medium transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Duyuru Türü</label>
                  <select 
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full h-9 bg-[#141416] border border-white/10 rounded-lg px-2 text-[12px] text-white outline-none"
                  >
                    <option value="DUYURU">Duyuru</option>
                    <option value="KURAL GÜNCELLEMESİ">Kural Güncellemesi</option>
                    <option value="PERFORMANS">Kadro Performansı</option>
                    <option value="ETKİNLİK">Etkinlik</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Öncelik Seviyesi</label>
                  <select 
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full h-9 bg-[#141416] border border-white/10 rounded-lg px-2 text-[12px] text-white outline-none"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Yüksek">Yüksek / Acil</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Duyuru İçeriği</label>
                  <textarea 
                    required
                    placeholder="Duyuru içeriği detaylarını yazın..."
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    className="w-full h-24 bg-[#141416] border border-white/10 focus:border-[#5E5CE6]/30 rounded-lg p-3 text-[11px] text-white outline-none font-medium transition-colors resize-none"
                  />
                </div>

                <div className="pt-3 border-t border-white/[0.04] flex items-center justify-end gap-2 text-[12.5px]">
                  <button type="button" onClick={() => setShowAddModal(false)} className="px-3 py-1.5 border border-white/5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 font-semibold">Vazgeç</button>
                  <button type="submit" className="px-4 py-1.5 bg-[#5E5CE6] hover:bg-[#4E4CD6] rounded-lg text-white font-bold transition-all shadow-md">Yayınla</button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Custom float toast alerts */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-55 px-4 py-3 rounded-xl bg-black/90 border border-white/10 text-white text-[12px] font-bold shadow-2xl flex items-center gap-2"
          >
            <CheckCircle2 className="text-[#32D74B] w-4 h-4" /> {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

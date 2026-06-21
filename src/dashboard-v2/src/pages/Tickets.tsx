import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Ticket, ExternalLink, Loader2, MessageSquare,
  User, Layers, Filter, Star, X, Clock, Lock, Shield
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { getTickets, UserTicket } from '../lib/supabase';
import { getHadronTranscriptUrl } from '../utils/hadronHelper';
import { formatDate } from '../lib/utils';

// ─── Metrik Kartı ─────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: string | number; icon: React.ElementType; color: string;
}) {
  return (
    <div className="p-4 rounded-2xl bg-secondary/10 border border-white/[0.05] flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{label}</span>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={14} />
        </div>
      </div>
      <span className="text-2xl font-bold text-white">{value}</span>
    </div>
  );
}

// ─── Bilete Git Butonu ────────────────────────────────────────────────────────
function GoToTicketButton({ ticketId }: { ticketId: string }) {
  return (
    <a
      href={getHadronTranscriptUrl(ticketId)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-[#5E5CE6]/10 border border-[#5E5CE6]/20 text-[#5E5CE6] hover:bg-[#5E5CE6]/20 transition-all whitespace-nowrap cursor-pointer select-none active:scale-95"
      title={`Hadron Transkript #${ticketId}`}
    >
      <ExternalLink size={11} /> Bilete Git
    </a>
  );
}

// ─── Filtre input bileşeni ────────────────────────────────────────────────────
function FilterInput({ label, placeholder, value, onChange }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[9.5px] font-bold text-white/40 uppercase tracking-wider">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 px-3 rounded-xl bg-secondary/10 border border-white/[0.06] text-[12px] text-white placeholder:text-white/25 outline-none focus:border-[#5E5CE6]/50 transition-colors"
      />
    </div>
  );
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────
export default function Tickets() {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<UserTicket | null>(null);

  // Filtre alanları (Hadron ile birebir)
  const [fTicketId,   setFTicketId]   = useState('');
  const [fUsername,   setFUsername]   = useState('');
  const [fUserId,     setFUserId]     = useState('');
  const [fClosedById, setFClosedById] = useState('');
  const [fPanel,      setFPanel]      = useState('all');
  const [fRating,     setFRating]     = useState('all');
  const [fClaimedBy,  setFClaimedBy]  = useState('');

  // Aktif filtre (sadece "Filtrele" butonuna basınca uygulanır)
  const [activeFilters, setActiveFilters] = useState({
    ticketId: '', username: '', userId: '', closedById: '',
    panel: 'all', rating: 'all', claimedBy: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getTickets({ limit: 500 });
      setTickets(data);
    } catch (err: any) {
      console.warn('Lutheus Scraper Fail:', err);
      showToast('Bilet verileri yüklenirken hata oluştu', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Benzersiz panel listesi
  const panels = useMemo(() => {
    const cats = Array.from(new Set(tickets.map(t => t.category).filter(Boolean))) as string[];
    return cats.sort();
  }, [tickets]);

  // İstatistikler
  const stats = useMemo(() => {
    const total = tickets.length;
    const uniqueUsers = new Set(tickets.map(t => t.user_id)).size;
    const uniqueMods  = new Set(tickets.map(t => t.assigned_mod_id).filter(Boolean)).size;
    const avgMsgCount = total > 0
      ? Math.round(tickets.reduce((s, t) => s + (t.message_count || 0), 0) / total)
      : 0;
    return { total, uniqueUsers, uniqueMods, avgMsgCount };
  }, [tickets]);

  // Filtreleri uygula
  const filtered = useMemo(() => {
    let list = tickets;
    const { ticketId, username, userId, closedById, panel, rating, claimedBy } = activeFilters;

    if (ticketId.trim())   list = list.filter(t => t.ticket_id.includes(ticketId.trim()));
    if (username.trim())   list = list.filter(t => (t.user_tag || '').toLowerCase().includes(username.toLowerCase().trim()));
    if (userId.trim())     list = list.filter(t => (t.user_id || '').includes(userId.trim()));
    if (closedById.trim()) list = list.filter(t => (t.assigned_mod_id || '').includes(closedById.trim()));
    if (claimedBy.trim())  list = list.filter(t => (t.assigned_mod_id || '').includes(claimedBy.trim()));
    if (panel !== 'all')   list = list.filter(t => t.category === panel);
    if (rating !== 'all') {
      if (rating === 'none') list = list.filter(t => !t.rating);
      else list = list.filter(t => t.rating === Number(rating));
    }

    // En yüksek ID'den en düşük ID'ye doğru sayısal olarak sırala (#12, #8, #7...)
    const getNumericId = (id: string) => {
      const match = id.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    };
    return [...list].sort((a, b) => getNumericId(b.ticket_id) - getNumericId(a.ticket_id));
  }, [tickets, activeFilters]);

  const applyFilters = () => {
    setActiveFilters({
      ticketId: fTicketId, username: fUsername, userId: fUserId,
      closedById: fClosedById, panel: fPanel, rating: fRating, claimedBy: fClaimedBy,
    });
  };

  const resetFilters = () => {
    setFTicketId(''); setFUsername(''); setFUserId('');
    setFClosedById(''); setFPanel('all'); setFRating('all'); setFClaimedBy('');
    setActiveFilters({ ticketId: '', username: '', userId: '', closedById: '', panel: 'all', rating: 'all', claimedBy: '' });
  };

  const hasActiveFilters = Object.entries(activeFilters).some(([, v]) => v !== '' && v !== 'all');

  return (
    <div className="p-6 md:p-8 w-full min-h-screen flex flex-col text-left select-none">
      <div className="flex flex-col md:flex-row justify-between mb-8 gap-4 border-b border-white/[0.04] pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5E5CE6]" />
            <span className="text-[11px] font-mono tracking-widest text-[#5E5CE6] font-semibold uppercase">Hadron Destek Talebi Havuzu</span>
          </div>
          <h2 className="text-[22px] font-bold text-white tracking-tight leading-none mt-2">Bilet Yönetimi</h2>
          <p className="text-[12px] text-white/40 mt-1.5 font-medium">
            Hadron transkriptlerinden kazınan destek talebi kayıtları.
          </p>
        </div>
        <button
          onClick={loadData}
          className="self-start px-4 py-2 rounded-xl bg-[#5E5CE6]/10 border border-[#5E5CE6]/20 text-[#5E5CE6] text-xs font-bold hover:bg-[#5E5CE6]/20 transition-all cursor-pointer"
        >
          Yenile
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-[#5E5CE6] animate-spin" />
            <span className="text-xs text-white/40">Bilet kayıtları yükleniyor...</span>
          </div>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Toplam Bilet" value={stats.total} icon={Ticket} color="bg-[#5E5CE6]/10 text-[#5E5CE6]" />
            <StatCard label="Benzersiz Üye" value={stats.uniqueUsers} icon={User} color="bg-amber-500/10 text-amber-400" />
            <StatCard label="İlgilenen Yetkili" value={stats.uniqueMods} icon={Layers} color="bg-emerald-500/10 text-emerald-400" />
            <StatCard label="Ort. Mesaj Sayısı" value={stats.avgMsgCount} icon={MessageSquare} color="bg-sky-500/10 text-sky-400" />
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-secondary/5 p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Filter size={13} className="text-[#5E5CE6]" />
              <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider">Kayıtları Filtrele</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <FilterInput label="Ticket ID" placeholder="Ticket ID" value={fTicketId} onChange={setFTicketId} />
              <FilterInput label="Kullanıcı Adı" placeholder="Username" value={fUsername} onChange={setFUsername} />
              <FilterInput label="Kullanıcı ID" placeholder="User ID" value={fUserId} onChange={setFUserId} />
              <FilterInput label="Kapatan ID" placeholder="Closed By" value={fClosedById} onChange={setFClosedById} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9.5px] font-bold text-white/40 uppercase tracking-wider">Kapatılma Sebebi</label>
                <select
                  value={fPanel}
                  onChange={(e) => setFPanel(e.target.value)}
                  className="h-9 px-3 rounded-xl bg-secondary/10 border border-white/[0.06] text-[12px] text-white/80 outline-none focus:border-[#5E5CE6]/50 transition-colors cursor-pointer"
                >
                  <option value="all">Panel seçin...</option>
                  {panels.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[9.5px] font-bold text-white/40 uppercase tracking-wider flex items-center gap-1">
                  <Star size={9} className="text-amber-400" /> Puan
                </label>
                <select
                  value={fRating}
                  onChange={(e) => setFRating(e.target.value)}
                  className="h-9 px-3 rounded-xl bg-secondary/10 border border-white/[0.06] text-[12px] text-white/80 outline-none focus:border-[#5E5CE6]/50 transition-colors cursor-pointer"
                >
                  <option value="all">Herhangi</option>
                  <option value="none">Puan yok</option>
                  <option value="1">1 ⭐</option>
                  <option value="2">2 ⭐</option>
                  <option value="3">3 ⭐</option>
                  <option value="4">4 ⭐</option>
                  <option value="5">5 ⭐</option>
                </select>
              </div>
              <FilterInput label="Üstlenen ID" placeholder="Claimed By" value={fClaimedBy} onChange={setFClaimedBy} />
              <div className="flex gap-2">
                <button
                  onClick={applyFilters}
                  className="flex-1 h-9 flex items-center justify-center gap-2 rounded-xl bg-[#5E5CE6] text-white text-[12px] font-bold hover:bg-[#4F4CD4] transition-all cursor-pointer active:scale-95"
                >
                  <Filter size={12} /> Filtrele
                </button>
                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="h-9 px-3 rounded-xl bg-white/5 border border-white/[0.06] text-white/50 text-[11px] font-semibold hover:bg-white/10 hover:text-white transition-all cursor-pointer"
                    title="Filtreleri Sıfırla"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-secondary/5 border border-white/[0.04]">
              <Ticket className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-sm text-white/40 font-medium">
                {tickets.length === 0
                  ? 'Henüz bilet kaydı yok. Uzantı Hadron transkript sayfasını taradıkça veriler burada görünür.'
                  : 'Filtreyle eşleşen kayıt bulunamadı.'}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
              <div className="grid grid-cols-[80px_1fr_1fr_100px_70px_90px_auto] gap-3 px-5 py-3 bg-secondary/10 border-b border-white/[0.04]">
                {['Bilet No', 'Üye', 'Kapatılma Sebebi', 'Yetkili', 'Mesaj', 'Kapanış', ''].map(h => (
                  <span key={h} className="text-[9.5px] font-bold text-white/30 uppercase tracking-wider">{h}</span>
                ))}
              </div>

              <div className="divide-y divide-white/[0.03]">
                {filtered.map((ticket) => (
                  <motion.div
                    key={ticket.id}
                    layout
                    onClick={() => setSelectedTicket(ticket)}
                    className="grid grid-cols-[80px_1fr_1fr_100px_70px_90px_auto] gap-3 px-5 py-3.5 hover:bg-white/[0.025] transition-colors items-center cursor-pointer"
                  >
                    <div>
                      <span className="text-xs font-mono font-bold text-[#5E5CE6]">
                        #{ticket.ticket_id}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">
                        {ticket.user_tag || ticket.user_id}
                      </p>
                      {ticket.user_tag && (
                        <p className="text-[10px] font-mono text-white/30 truncate">{ticket.user_id}</p>
                      )}
                    </div>

                    <span className="text-xs text-white/60 truncate">
                      {ticket.category || '—'}
                    </span>

                    <span className="text-[11px] font-mono text-white/50 truncate">
                      {ticket.assigned_mod_id ? ticket.assigned_mod_id.slice(-6) : '—'}
                    </span>

                    <div className="flex items-center gap-1 text-xs text-white/60">
                      <MessageSquare size={11} className="text-white/30 shrink-0" />
                      {ticket.message_count}
                    </div>

                    <span className="text-[11px] text-white/40">
                      {formatDate(ticket.closed_at)}
                    </span>

                    <GoToTicketButton ticketId={ticket.ticket_id} />
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Transcript Drawer */}
      <AnimatePresence>
        {selectedTicket && (
          <>
            <motion.div
              key="ticket-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-45"
              onClick={() => setSelectedTicket(null)}
            />
            <motion.div
              key="ticket-drawer"
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 340, damping: 32, mass: 0.9 }}
              className="fixed top-0 right-0 h-full w-full max-w-2xl bg-[#0D0D11]/98 backdrop-blur-2xl border-l border-white/[0.06] z-50 flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="sticky top-0 bg-[#0D0D11]/95 backdrop-blur-xl border-b border-white/[0.04] px-6 py-4 flex items-center justify-between z-10 shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#5E5CE6]" />
                    <span className="text-[10px] font-mono tracking-widest text-[#5E5CE6] font-semibold uppercase">Hadron Transkript Arşivi</span>
                  </div>
                  <h3 className="text-base font-bold text-white mt-0.5">
                    #{selectedTicket.ticket_id} - {selectedTicket.user_tag || selectedTicket.user_id}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Body Content */}
              <div className="flex-1 overflow-y-auto p-6 min-h-0 space-y-6">
                {/* Metadata Card */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/[0.02] border border-white/[0.04] p-4 rounded-xl">
                  <div>
                    <span className="text-[9px] text-white/40 block uppercase tracking-wider">Kapatılma Sebebi</span>
                    <span className="text-xs font-semibold text-white/80">{selectedTicket.category || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-white/40 block uppercase tracking-wider">Rating</span>
                    <span className="text-xs font-semibold text-amber-400">{selectedTicket.rating ? '⭐'.repeat(selectedTicket.rating) : 'Puan Yok'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-white/40 block uppercase tracking-wider">Mesaj Sayısı</span>
                    <span className="text-xs font-semibold text-white/80">{selectedTicket.message_count} Mesaj</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-white/40 block uppercase tracking-wider">Kapatan Yetkili</span>
                    <span className="text-xs font-mono font-semibold text-[#5E5CE6]">{selectedTicket.assigned_mod_id || 'Bilinmiyor'}</span>
                  </div>
                </div>

                {/* Chat Messages */}
                <div className="space-y-4">
                  <h4 className="text-[11px] font-bold text-white/40 uppercase tracking-wider">Konuşma Geçmişi</h4>
                  
                  {(() => {
                    const tJson = selectedTicket.transcript_json;
                    let messageList = [];
                    if (tJson) {
                      if (Array.isArray(tJson)) {
                        messageList = tJson;
                      } else if (typeof tJson === 'object' && Array.isArray((tJson as any).messages)) {
                        messageList = (tJson as any).messages;
                      }
                    }

                    if (messageList.length === 0) {
                      return (
                        <div className="p-8 text-center rounded-xl bg-secondary/5 border border-white/[0.03] space-y-3">
                          <MessageSquare className="w-10 h-10 text-white/20 mx-auto" />
                          <p className="text-xs text-white/55 max-w-sm mx-auto leading-relaxed">
                            Bu biletin detaylı konuşma geçmişi taranmamış. Detaylı konuşmaları görmek için uzantıdan <b>'Detaylı Bilet Tarama (Tab Modu)'</b> seçeneğini açarak tarama yapın.
                          </p>
                          <a
                            href={selectedTicket.transcript_url || getHadronTranscriptUrl(selectedTicket.ticket_id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#5E5CE6] text-white hover:bg-[#4F4CD4] transition-all cursor-pointer shadow-lg shadow-[#5E5CE6]/15"
                          >
                            <ExternalLink size={12} /> Hadron Üzerinde Görüntüle
                          </a>
                        </div>
                      );
                    }

                    return (
                      <div className="rounded-xl border border-white/[0.06] bg-[#1a1b20] overflow-hidden p-4 space-y-4 font-sans text-left">
                        {messageList.map((msg: any, idx: number) => {
                          const authorObj = typeof msg.author === 'object' ? msg.author : {};
                          const authorName = authorObj.username || msg.author_name || 'Bilinmeyen';
                          const isBot = msg.author_badge === 'BOT' || msg.author_id === '435890325098201108' || authorObj.is_bot;
                          return (
                            <div key={idx} className="flex gap-3 hover:bg-white/[0.01] p-1 rounded transition-colors">
                              <div className="w-8 h-8 rounded-full bg-white/5 flex-shrink-0 flex items-center justify-center text-xs font-bold text-white/60 select-none">
                                {authorName.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2 flex-wrap">
                                  <span className={`text-xs font-bold truncate ${isBot ? 'text-blue-400' : 'text-white'}`}>
                                    {authorName}
                                  </span>
                                  {isBot && (
                                    <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1 py-0.5 rounded font-bold uppercase tracking-wider">BOT</span>
                                  )}
                                  <span className="text-[9px] text-white/30 font-mono">
                                    {msg.timestamp ? new Date(msg.timestamp).toLocaleString('tr-TR') : ''}
                                  </span>
                                </div>
                                <p className="text-xs text-white/80 leading-relaxed mt-1 whitespace-pre-wrap break-words selection:bg-[#5E5CE6]/30">
                                  {msg.content}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-[#0D0D11]/95 backdrop-blur-xl border-t border-white/[0.04] px-6 py-4 flex items-center justify-end shrink-0 gap-2">
                <a
                  href={selectedTicket.transcript_url || getHadronTranscriptUrl(selectedTicket.ticket_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
                >
                  <ExternalLink size={12} /> Hadron'da Aç
                </a>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Kapat
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

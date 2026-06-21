import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, ShieldAlert, Award, MessageSquare, AlertCircle, 
  Send, Loader2, Calendar, FileText, BadgeAlert, AlertTriangle, ExternalLink,
  Scale, Ticket, CheckCircle2, XCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { 
  getCases, getStaffWarnings, getStaffMessages, sendStaffMessage, 
  SapphireCase, StaffWarning, StaffMessage, getStaffProfiles, StaffProfile,
  getAppeals, getTickets, CaseAppeal, UserTicket
} from '../lib/supabase';
import { formatDate } from '../lib/utils';
import { getRoleColor, getRoleLabel } from '../lib/auth';
import { calculatePerformanceScore, getReliabilityStatus, validateCase } from '../lib/cukEngine';
import { Badge } from '../components/ui/Badge';
import { buildSapphireCaseUrl } from '../lib/sapphireUrl';
import ProofDrawer from '../components/ProofDrawer';
import { getHadronTranscriptUrl } from '../utils/hadronHelper';

export default function Profile() {
  const { session } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [cases, setCases] = useState<SapphireCase[]>([]);
  const [warnings, setWarnings] = useState<StaffWarning[]>([]);
  const [messages, setMessages] = useState<StaffMessage[]>([]);

  // Form states
  const [activeTab, setActiveTab] = useState<'overview' | 'cases' | 'warnings' | 'messages' | 'tickets'>('overview');
  const [newMessage, setNewMessage] = useState('');
  const [submittingMessage, setSubmittingMessage] = useState(false);
  const [proofCaseId, setProofCaseId] = useState<string | null>(null);
  const [selectedProofCase, setSelectedProofCase] = useState<SapphireCase | null>(null);
  // Appeals & Tickets
  const [myAppeals, setMyAppeals] = useState<CaseAppeal[]>([]);
  const [myTickets, setMyTickets] = useState<UserTicket[]>([]);

  const discordId = session?.profile?.discordId;

  const loadData = async () => {
    if (!discordId) return;
    setLoading(true);
    try {
      const [allProfiles, allCases, staffWarnings, staffMessages, appealData, ticketData] = await Promise.all([
        getStaffProfiles(),
        getCases(500),
        getStaffWarnings(discordId),
        getStaffMessages(discordId),
        getAppeals(discordId),
        getTickets({ userId: discordId }),
      ]);

      const myProfile = allProfiles.find(p => p.discord_id === discordId);
      if (myProfile) {
        setProfile(myProfile);
      } else {
        // Fallback profile if not in DB yet
        setProfile({
          discord_id: discordId,
          username: session?.profile?.username || 'Bilinmeyen Yetkili',
          role: session?.role || 'discord_moderatoru',
          in_game_name: session?.profile?.displayName || 'Yetkili',
          status: 'ACTIVE',
          created_at: new Date().toISOString()
        });
      }

      // Filter cases created by this staff member
      const myCases = allCases.filter(c => c.author_discord_id === discordId);
      setCases(myCases);
      setWarnings(staffWarnings);
      setMessages(staffMessages);
      setMyAppeals(appealData);
      setMyTickets(ticketData);
    } catch (err: any) {
      console.error('Failed to load profile data:', err);
      showToast('Profil verileri yüklenirken hata oluştu', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [discordId]);

  // Compute metrics
  const metrics = useMemo(() => {
    const total = cases.length;
    const valid = cases.filter(c => c.cuk_verdict === 'valid').length;
    const invalid = cases.filter(c => c.cuk_verdict === 'invalid').length;
    const pending = cases.filter(c => c.cuk_verdict === 'pending' || !c.cuk_verdict).length;
    const accuracy = total > 0 ? Math.round((valid / total) * 100) : 100;
    const score = calculatePerformanceScore(valid, invalid, pending);
    const reliability = getReliabilityStatus(accuracy, total);

    // List of invalid cases to review errors
    const invalidCases = cases.filter(c => c.cuk_verdict === 'invalid');

    return { total, valid, invalid, pending, accuracy, score, reliability, invalidCases };
  }, [cases]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discordId || !newMessage.trim()) return;
    setSubmittingMessage(true);

    try {
      await sendStaffMessage({
        staff_discord_id: discordId,
        message: newMessage.trim(),
        created_by: session?.profile?.displayName || session?.profile?.username || 'Yetkili',
      });
      showToast('Mesajınız yönetime iletildi ve loglandı.', 'success');
      setNewMessage('');
      // Reload messages
      const updatedMessages = await getStaffMessages(discordId);
      setMessages(updatedMessages);
    } catch (err: any) {
      showToast(`Hata: ${err.message || err}`, 'error');
    } finally {
      setSubmittingMessage(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 text-[#5E5CE6] animate-spin" />
        <span className="text-xs text-white/40 font-medium mt-3">Profil verileriniz yükleniyor...</span>
      </div>
    );
  }

  const roleColor = profile ? getRoleColor(profile.role) : '#64748b';
  const roleLabel = profile ? getRoleLabel(profile.role) : '';

  return (
    <div className="p-6 md:p-8 w-full min-h-screen flex flex-col relative text-left select-none">
      {/* Upper header */}
      <div className="flex flex-col md:flex-row justify-between mb-8 gap-4 border-b border-white/[0.04] pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5E5CE6]" />
            <span className="text-[11px] font-mono tracking-widest text-[#5E5CE6] font-semibold uppercase">Yetkili Paneli</span>
          </div>
          <h2 className="text-[22px] font-bold text-white tracking-tight leading-none mt-2">Profilim</h2>
          <p className="text-[12px] text-white/40 mt-1.5 font-medium">
            Performans karneniz, uyarılarınız ve yönetimle iletişim portalınız.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left column: Profile card & metrics */}
        <div className="space-y-6">
          {/* Profile card showcase */}
          <div className="p-5 rounded-2xl bg-secondary/10 border border-white/[0.08] backdrop-blur-md relative overflow-hidden flex flex-col items-center text-center shadow-xl">
            <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-r from-[#5E5CE6]/20 to-[#A259FE]/20" />
            <img 
              src={session?.profile?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${discordId}`}
              alt="" 
              className="w-20 h-20 rounded-2xl bg-[#141416] object-cover border-2 border-white/10 relative z-10 mt-6 shadow-md"
            />
            <h3 className="font-bold text-lg text-white mt-4 leading-tight">{profile?.username}</h3>
            <span 
              className="text-[10px] font-extrabold uppercase tracking-widest mt-1.5 px-3 py-1 rounded-full border bg-black/40" 
              style={{ color: roleColor, borderColor: `${roleColor}25` }}
            >
              {roleLabel}
            </span>
            <div className="text-[11px] text-white/40 font-mono mt-2">{discordId}</div>

            {/* General Info */}
            <div className="w-full mt-6 pt-5 border-t border-white/[0.05] space-y-3.5 text-left text-xs text-white/70">
              {profile?.last_promoted_at && (
                <div className="flex justify-between items-center bg-white/[0.02] border border-white/[0.05] p-2.5 rounded-xl">
                  <span className="text-white/40 font-bold uppercase text-[9px] tracking-wider">Son Terfi Tarihi</span>
                  <span className="font-semibold text-white/90">{formatDate(profile.last_promoted_at)}</span>
                </div>
              )}
              {profile?.management_comments && (
                <div className="bg-white/[0.02] border border-white/[0.05] p-3 rounded-xl">
                  <span className="text-white/40 font-bold uppercase text-[9px] tracking-wider block mb-1.5">Yönetim Görüşü</span>
                  <p className="text-xs text-white/80 italic leading-relaxed">"{profile.management_comments}"</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Cezalarım', val: metrics.total, color: 'text-foreground' },
              { label: 'Doğruluk', val: `%${metrics.accuracy}`, color: metrics.accuracy >= 70 ? 'text-emerald-400' : 'text-amber-400' },
              { label: 'CUK Skoru', val: metrics.score, color: 'text-[#5E5CE6]' },
              { label: 'Uyarılarım', val: warnings.reduce((sum, w) => sum + (w.points || 1), 0), color: 'text-amber-500' }
            ].map(({ label, val, color }) => (
              <div key={label} className="p-3.5 rounded-xl bg-secondary/15 border border-white/[0.05]">
                <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider block mb-1">{label}</span>
                <span className={`text-xl font-bold ${color}`}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right column: Tabs container */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex bg-[#111112] border border-white/10 rounded-xl p-1 flex-wrap gap-0.5">
            {[
              { id: 'overview', label: 'Genel Karnem' },
              { id: 'cases', label: 'Cezalarım' },
              { id: 'warnings', label: 'Uyarılarım' },
              { id: 'messages', label: 'Yönetime Ulaş' },
              { id: 'tickets', label: '🎫 Biletlerim' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer min-w-[90px] ${
                  activeTab === tab.id ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content wrapper */}
          <div className="min-h-[300px]">
            <AnimatePresence mode="wait">
              {activeTab === 'overview' && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-6 text-left"
                >
                  <div className="p-4 rounded-xl bg-secondary/15 border border-white/[0.05] space-y-4">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Hata Analizi</h4>
                    <p className="text-xs text-white/60 leading-relaxed">
                      Sistem (CUK Engine) tarafından analiz edilen cezalarınızda tespit edilen kuralsızlıklar veya hatalı süre kullanımları aşağıda listelenmiştir. Lütfen bu kararları inceleyerek gelecekteki cezalarınızı optimize edin.
                    </p>

                    {metrics.invalidCases.length === 0 ? (
                      <div className="p-5 rounded-lg border border-dashed border-emerald-500/20 bg-emerald-500/5 text-center space-y-2">
                        <Award className="w-8 h-8 text-emerald-400 mx-auto" />
                        <h5 className="text-xs font-bold text-white">Harika! Hiç Hatalı Cezanız Bulunmuyor</h5>
                        <p className="text-[11px] text-white/50 max-w-xs mx-auto">
                          Tüm cezalarınız kurallara ve limitlere tamamen uygun şekilde uygulanmıştır.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {metrics.invalidCases.map((c) => (
                          <div key={c.case_id} className="p-3.5 rounded-lg bg-red-500/5 border border-red-500/10 flex flex-col gap-2">
                            <div className="flex justify-between items-center flex-wrap gap-2">
                              <span className="text-[11px] font-mono font-bold text-red-400">Case #{c.case_id}</span>
                              <span className="text-[10px] text-white/30">{formatDate(c.created_at_sapphire)}</span>
                            </div>
                            <div className="text-xs text-white/80">
                              <span className="font-semibold block text-[10px] uppercase text-white/40 mb-0.5">Ceza Sebebi:</span>
                              "{c.reason_raw || '—'}"
                            </div>
                            {c.cuk_analysis?.message && (
                              <div className="text-xs text-red-300 bg-red-950/20 p-2.5 rounded border border-red-900/35">
                                <span className="font-bold text-[10px] uppercase text-red-400/80 block mb-0.5">CUK Hata Analizi:</span>
                                {c.cuk_analysis.message}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'cases' && (
                <motion.div
                  key="cases"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-3 text-left"
                >
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Son Cezalandırdığım Kullanıcılar</h4>
                  {cases.length === 0 ? (
                    <div className="text-xs text-white/40 italic py-8 text-center bg-secondary/10 rounded-xl border border-white/[0.03]">
                      Henüz hiçbir ceza kaydınız bulunmamaktadır.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {cases.slice(0, 20).map((c) => (
                        <div 
                          key={c.case_id} 
                          onClick={() => {
                            setProofCaseId(c.case_id);
                            setSelectedProofCase(c);
                          }}
                          className="p-3 rounded-xl bg-secondary/15 border border-white/[0.05] flex items-center justify-between hover:bg-secondary/20 transition-colors cursor-pointer select-none active:scale-[0.98]"
                        >
                          <div className="flex-1 min-w-0 mr-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-[#5E5CE6]">#{c.case_id}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-white/60 uppercase font-mono">{c.type}</span>
                            </div>
                            <div className="text-xs text-white/70 truncate mt-1">
                              Sebep: {c.reason_raw || '—'}
                            </div>
                            <div className="text-[10px] text-white/30 mt-0.5">
                              Hedef ID: {c.punished_user_discord_id}
                            </div>
                          </div>
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <span className={`status-badge scale-90 ${c.cuk_verdict === 'valid' ? 'success' : c.cuk_verdict === 'invalid' ? 'danger' : 'neutral'}`}>
                              {c.cuk_verdict === 'valid' ? 'DOĞRU' : c.cuk_verdict === 'invalid' ? 'HATALI' : 'BEKLEYEN'}
                            </span>
                            <button
                              onClick={() => {
                                const url = buildSapphireCaseUrl(c.guild_id, c.case_id);
                                if (url) window.open(url, '_blank', 'noopener,noreferrer');
                              }}
                              className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-all cursor-pointer"
                              title="Sapphire'de Aç"
                            >
                              <ExternalLink size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'warnings' && (
                <motion.div
                  key="warnings"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-3 text-left"
                >
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Aldığım Resmi Uyarılar</h4>
                  {warnings.length === 0 ? (
                    <div className="p-8 text-center rounded-xl bg-emerald-500/5 border border-emerald-500/10 space-y-2">
                      <Award className="w-8 h-8 text-emerald-400 mx-auto" />
                      <h5 className="text-xs font-bold text-white">Temiz Sicil!</h5>
                      <p className="text-[11.5px] text-white/50">
                        Yönetim tarafından verilmiş herhangi bir uyarınız bulunmamaktadır.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {warnings.map((w) => (
                        <div key={w.id} className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 flex flex-col gap-2 relative">
                          <div className="flex justify-between items-center flex-wrap gap-2">
                            <span className="text-xs font-bold text-white">{w.reason}</span>
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded">
                              {w.points} Puan
                            </span>
                          </div>
                          <div className="text-[10px] text-white/40">
                            {formatDate(w.created_at)} • Veren Yönetici: {w.created_by}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'messages' && (
                <motion.div
                  key="messages"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-4 text-left"
                >
                  <div className="p-4 rounded-xl bg-secondary/15 border border-white/[0.05] space-y-3">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare size={13} className="text-primary" /> Yönetim İletişim Portalı
                    </h4>
                    <p className="text-xs text-white/60 leading-relaxed">
                      Aldığınız uyarılar, CUK analizleri veya genel moderasyon ile ilgili itiraz veya geri bildirimlerinizi doğrudan buraya yazabilirsiniz. Yazdığınız mesajlar bot tarafından hem DM hem de log kanalı üzerinden yöneticilere iletilecektir.
                    </p>

                    <form onSubmit={handleSendMessage} className="space-y-3 pt-2">
                      <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Yönetim kadrosuna mesajınızı yazın..."
                        required
                        className="w-full h-24 p-3 rounded-xl bg-background/50 border border-white/10 text-xs text-white focus:outline-none focus:border-primary/50 resize-none leading-relaxed"
                      />
                      <button
                        type="submit"
                        disabled={submittingMessage || !newMessage.trim()}
                        className="px-4 py-2.5 rounded-xl bg-[#5E5CE6] hover:bg-[#5E5CE6]/90 disabled:opacity-50 text-xs font-bold text-white flex items-center justify-center gap-1.5 shadow-lg shadow-[#5E5CE6]/20 cursor-pointer self-end ml-auto"
                      >
                        {submittingMessage ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <Send size={12} /> Mesajı Gönder
                          </>
                        )}
                      </button>
                    </form>
                  </div>

                  {/* Previous messages / Dispute logs */}
                  <div className="space-y-3">
                    <h5 className="text-[11px] font-bold text-white/40 uppercase tracking-wider">Geçmiş Mesajlarım & İtirazlarım</h5>
                    {messages.length === 0 ? (
                      <div className="text-xs text-white/30 italic py-4 text-center">
                        Daha önce gönderilmiş bir mesajınız bulunmuyor.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {messages.map((m) => (
                          <div key={m.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-white/40 font-mono">{formatDate(m.created_at)}</span>
                              <span className={`text-[9.5px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${m.response ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'}`}>
                                {m.response ? 'Cevaplandı' : 'Beklemede'}
                              </span>
                            </div>
                            <p className="text-xs text-white/80 leading-relaxed font-medium">"{m.message}"</p>
                            
                            {m.response && (
                              <div className="mt-2.5 p-3 rounded-lg bg-primary/5 border border-primary/15 space-y-1">
                                <div className="text-[9.5px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                                  <User size={10} /> Yönetim Yanıtı ({m.responded_by || 'Yönetici'}):
                                </div>
                                <p className="text-xs text-white/90 italic leading-relaxed">"{m.response}"</p>
                                <span className="text-[9px] text-white/30 block text-right mt-1 font-mono">{formatDate(m.responded_at || '')}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ─── Hadron Biletlerim Sekmesi ─── */}
              {activeTab === 'tickets' && (
                <motion.div
                  key="tickets"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-3 text-left"
                >
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Ticket size={13} className="text-[#5E5CE6]" /> Hadron Destek Taleplerim
                  </h4>
                  {myTickets.length === 0 ? (
                    <div className="p-8 text-center rounded-xl bg-secondary/10 border border-white/[0.04]">
                      <Ticket className="w-8 h-8 text-white/20 mx-auto mb-2" />
                      <p className="text-xs text-white/40">Adınıza kayıtlı Hadron destek talebi bulunmamaktadır.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {myTickets.map((t) => (
                        <div key={t.id} className="p-3.5 rounded-xl bg-secondary/15 border border-white/[0.05] flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono font-bold text-[#5E5CE6]">#{t.ticket_id}</span>
                              {t.ticket_name && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-white/50 font-mono">{t.ticket_name}</span>
                              )}
                              {t.category && (
                                <span className="text-[10px] text-white/40">{t.category}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-white/30">
                              <span>{t.message_count} mesaj</span>
                              <span>•</span>
                              <span>{formatDate(t.closed_at)}</span>
                            </div>
                          </div>
                          <a
                            href={getHadronTranscriptUrl(t.ticket_id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-[#5E5CE6]/10 border border-[#5E5CE6]/20 text-[#5E5CE6] hover:bg-[#5E5CE6]/20 transition-all whitespace-nowrap cursor-pointer shrink-0 active:scale-95"
                          >
                            <ExternalLink size={11} /> Bilete Git
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <ProofDrawer
        caseId={proofCaseId}
        onClose={() => {
          setProofCaseId(null);
          setSelectedProofCase(null);
        }}
        caseData={selectedProofCase}
      />
    </div>
  );
}

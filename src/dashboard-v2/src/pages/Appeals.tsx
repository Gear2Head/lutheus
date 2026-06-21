import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isManagementRole } from '../lib/auth';
import { motion, AnimatePresence } from 'motion/react';
import {
  Scale, CheckCircle2, XCircle, Clock, Loader2,
  ChevronDown, X, ExternalLink, User, FileText, Hash, MessageSquare
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { getAppeals, getAppealStats, CaseAppeal } from '../lib/supabase';
import { formatDate } from '../lib/utils';
import { buildSapphireCaseUrl } from '../lib/sapphireUrl';

// ─── Metrik Kartı ─────────────────────────────────────────────────────────────
function StatCard({
  label, value, icon: Icon, color
}: {
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

// ─── Appeal Reason Parser ─────────────────────────────────────────────────────
interface ParsedAppeal {
  title: string;
  form: string;
  userMention: string;
  penaltyType: string;
  penaltyId: string;
  fields: { question: string; answer: string }[];
  modNote: string;
  modMention: string;
  timestamp: string;
}

function parseAppealReason(raw: string | null | undefined): ParsedAppeal {
  const text = raw || '';

  // ── Başlık ──────────────────────────────────────────────────────────────────
  const titleMatch = text.match(/\[Başlık\]\s*(.+?)(?:\n|$)/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  // ── Açıklama (Form, Kullanıcı, Ceza Türü, Ceza ID) ──────────────────────────
  const descMatch = text.match(/\[Açıklama\]\s*([\s\S]*?)(?:\[Alanlar\]|\[Alt Bilgi\]|$)/i);
  const descBlock = descMatch ? descMatch[1] : '';

  const formMatch    = descBlock.match(/Form:\s*([^-\n]+)/i);
  const userMatch    = descBlock.match(/Kullanıcı:\s*([^-\n]+)/i);
  const typeMatch    = descBlock.match(/Ceza Türü:\s*([^-\n]+)/i);
  const idMatch      = descBlock.match(/Ceza ID:\s*([^-\n]+)/i);

  const form         = formMatch  ? formMatch[1].trim()  : '';
  const userMention  = userMatch  ? userMatch[1].trim()  : '';
  const penaltyType  = typeMatch  ? typeMatch[1].trim()  : '';
  const penaltyId    = idMatch    ? idMatch[1].trim()    : '';

  // ── Alanlar (Soru-Cevap çiftleri) ────────────────────────────────────────────
  const fieldsMatch  = text.match(/\[Alanlar\]\s*([\s\S]*?)(?:\[Alt Bilgi\]|$)/i);
  const fieldsBlock  = fieldsMatch ? fieldsMatch[1] : '';
  const fields: { question: string; answer: string }[] = [];

  const seenKeys = new Set<string>();
  const fieldLines = fieldsBlock.split(/\n- /);
  for (const chunk of fieldLines) {
    const colonIdx = chunk.indexOf(':');
    if (colonIdx === -1) continue;
    const q = chunk.slice(0, colonIdx).replace(/^-\s*/, '').trim();
    const a = chunk.slice(colonIdx + 1).trim();
    if (!q || !a) continue;
    const key = q.slice(0, 50).toLowerCase();
    if (seenKeys.has(key)) continue; // dedup (scraper bug: same field appears twice)
    seenKeys.add(key);
    fields.push({ question: q, answer: a });
  }

  // ── Alt Bilgi (Mod notu) ──────────────────────────────────────────────────────
  const footerMatch  = text.match(/\[Alt Bilgi\]\s*([\s\S]*?)$/i);
  const footerBlock  = footerMatch ? footerMatch[1] : '';

  const modMentionMatch = footerBlock.match(/@([\w.]+)/);
  const modMention      = modMentionMatch ? modMentionMatch[0] : '';

  const sebepMatch = footerBlock.match(/Sebep:\s*([\s\S]*?)(?:[•·]\d|$)/i);
  const modNote    = sebepMatch ? sebepMatch[1].trim() : footerBlock.replace(modMention, '').trim();

  // Timestamp e.g. "•6/14/26, 7:50 AM"
  const tsMatch    = footerBlock.match(/[•·]\s*(\d{1,2}\/\d{1,2}\/\d{2,4}[^"]*)/);
  const timestamp  = tsMatch ? tsMatch[1].trim() : '';

  return { title, form, userMention, penaltyType, penaltyId, fields, modNote, modMention, timestamp };
}

// ─── İtiraz Detay Drawer ─────────────────────────────────────────────────────
function AppealDetailDrawer({
  appeal, onClose
}: {
  appeal: CaseAppeal | null; onClose: () => void;
}) {
  const isOpen     = !!appeal;
  const isApproved = appeal?.status === 'approved';
  const parsed     = appeal ? parseAppealReason(appeal.appeal_reason) : null;

  const accentColor = isApproved ? 'bg-emerald-500' : 'bg-red-500';
  const statusBg    = isApproved ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20';
  const statusText  = isApproved ? 'text-emerald-400' : 'text-red-400';

  return (
    <AnimatePresence>
      {isOpen && appeal && parsed && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          {/* Drawer */}
          <motion.div
            key="drawer"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 32, mass: 0.9 }}
            className="fixed top-0 right-0 h-full w-full max-w-[520px] bg-[#0D0D11] border-l border-white/[0.06] z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="shrink-0 bg-[#0D0D11]/95 backdrop-blur-xl border-b border-white/[0.04] px-6 py-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#5E5CE6]" />
                  <span className="text-[10px] font-mono tracking-widest text-[#5E5CE6] font-semibold uppercase">İtiraz Detayı</span>
                </div>
                <h3 className="text-base font-bold text-white mt-0.5 truncate max-w-[340px]">
                  {appeal.user_tag || appeal.user_id}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all cursor-pointer shrink-0"
              >
                <X size={15} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto hide-scrollbar p-5 space-y-3">

              {/* ── Status ────────────────────────────────────────────────── */}
              <div className={`flex items-center gap-3 p-4 rounded-2xl border ${statusBg}`}>
                {isApproved
                  ? <CheckCircle2 size={22} className="text-emerald-400 shrink-0" />
                  : <XCircle size={22} className="text-red-400 shrink-0" />
                }
                <div>
                  <p className={`text-sm font-bold ${statusText}`}>
                    {parsed.title || (isApproved ? 'İtiraz Onaylandı' : 'İtiraz Reddedildi')}
                  </p>
                  <p className="text-[11px] text-white/40 mt-0.5">
                    {isApproved ? 'Ceza kaldırıldı / düzeltildi.' : 'Ceza geçerliliğini koruyor.'}
                  </p>
                </div>
              </div>

              {/* ── Discord Embed: Form Bilgileri ─────────────────────────── */}
              <div className="rounded-xl bg-[#111114] border border-white/[0.06] overflow-hidden">
                <div className="flex">
                  <div className={`w-[3px] shrink-0 ${accentColor}`} />
                  <div className="flex-1 p-4">
                    <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                      {parsed.form && (
                        <div>
                          <p className="text-[9px] text-white/35 uppercase font-bold tracking-wider mb-1">Form</p>
                          <p className="text-xs font-semibold text-white/85">{parsed.form}</p>
                        </div>
                      )}
                      {parsed.userMention && (
                        <div>
                          <p className="text-[9px] text-white/35 uppercase font-bold tracking-wider mb-1">Kullanıcı</p>
                          <p className="text-[11px] font-mono text-white/70 break-all leading-snug">{parsed.userMention}</p>
                        </div>
                      )}
                      {parsed.penaltyType && (
                        <div>
                          <p className="text-[9px] text-white/35 uppercase font-bold tracking-wider mb-1">Ceza Türü</p>
                          <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {parsed.penaltyType}
                          </span>
                        </div>
                      )}
                      {(parsed.penaltyId || appeal.case_id) && (
                        <div>
                          <p className="text-[9px] text-white/35 uppercase font-bold tracking-wider mb-1">Ceza ID</p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono font-bold text-[#5E5CE6]">
                              #{parsed.penaltyId || appeal.case_id}
                            </span>
                            {appeal.case_id && (
                              <button
                                onClick={() => {
                                  const url = buildSapphireCaseUrl('1223431616081166336', appeal.case_id!);
                                  if (url) window.open(url, '_blank', 'noopener,noreferrer');
                                }}
                                className="p-0.5 rounded hover:bg-white/10 text-white/30 hover:text-white transition-all cursor-pointer"
                                title="Sapphire'de Aç"
                              >
                                <ExternalLink size={10} />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Soru / Cevap Alanları ─────────────────────────────────── */}
              {parsed.fields.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[9px] font-bold text-white/30 uppercase tracking-wider px-1 flex items-center gap-1.5">
                    <MessageSquare size={10} /> Üye Savunması
                  </p>
                  {parsed.fields.map((f, i) => (
                    <div
                      key={i}
                      className="rounded-xl bg-[#111114] border border-white/[0.05] p-3.5 space-y-1.5"
                    >
                      <p className="text-[10px] font-semibold text-white/45 leading-tight">{f.question}</p>
                      <p className="text-[13px] text-white/85 leading-relaxed whitespace-pre-wrap break-words">{f.answer}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Alt Bilgi / Mod Notu (Discord footer style) ────────────── */}
              {parsed.modNote && (
                <div className="rounded-xl bg-[#111114] border border-white/[0.05] overflow-hidden">
                  <div className="flex">
                    <div className={`w-[3px] shrink-0 opacity-60 ${accentColor}`} />
                    <div className="flex-1 p-3.5 space-y-2">
                      {parsed.modMention && (
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-[#5E5CE6]/15 flex items-center justify-center shrink-0">
                            <User size={10} className="text-[#5E5CE6]" />
                          </div>
                          <span className="text-[10px] font-bold text-[#5E5CE6]">{parsed.modMention}</span>
                          <span className="text-[9px] text-white/25 ml-auto font-medium">Yetkili Notu</span>
                        </div>
                      )}
                      <p className="text-[12px] text-white/70 leading-relaxed whitespace-pre-wrap break-words">
                        {parsed.modNote}
                      </p>
                      {parsed.timestamp && (
                        <p className="text-[9px] text-white/25 font-mono">• {parsed.timestamp}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Meta ───────────────────────────────────────────────────── */}
              <div className="text-[10px] text-white/25 font-mono pt-1 border-t border-white/[0.03]">
                İtiraz Tarihi: {formatDate(appeal.created_at)} • Mesaj ID: {appeal.discord_message_id}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────
export default function Appeals() {
  const { showToast } = useToast();
  const { session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (session && !isManagementRole(session.role)) {
      navigate('/home');
    }
  }, [session, navigate]);

  const [loading, setLoading] = useState(true);
  const [appeals, setAppeals] = useState<CaseAppeal[]>([]);
  const [stats, setStats] = useState({ total: 0, approved: 0, rejected: 0, approvalRate: 0 });
  const [selectedAppeal, setSelectedAppeal] = useState<CaseAppeal | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [appealData, statData] = await Promise.all([
        getAppeals(),
        getAppealStats(),
      ]);
      setAppeals(appealData);
      setStats(statData);
    } catch (err: any) {
      console.warn('Lutheus Scraper Fail:', err);
      showToast('İtiraz verileri yüklenirken hata oluştu', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    let list = appeals;
    if (statusFilter !== 'all') list = list.filter(a => a.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a =>
        a.user_id.includes(q) ||
        (a.user_tag || '').toLowerCase().includes(q) ||
        (a.case_id || '').toLowerCase().includes(q) ||
        (a.appeal_reason || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [appeals, statusFilter, searchQuery]);

  // Extract a short clean preview from raw appeal_reason
  function getReasonPreview(raw: string | null | undefined): string {
    if (!raw) return '—';
    // Try to find first user Q&A field
    const fieldsMatch = raw.match(/\[Alanlar\]\s*([\s\S]*?)(?:\[Alt Bilgi\]|$)/i);
    if (fieldsMatch) {
      const firstField = fieldsMatch[1].split(/\n- /)[1];
      if (firstField) {
        const colonIdx = firstField.indexOf(':');
        if (colonIdx !== -1) {
          const answer = firstField.slice(colonIdx + 1).trim();
          return answer.slice(0, 90) + (answer.length > 90 ? '…' : '');
        }
      }
    }
    return raw.slice(0, 90) + (raw.length > 90 ? '…' : '');
  }

  return (
    <div className="p-6 md:p-8 w-full min-h-screen flex flex-col text-left select-none">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between mb-8 gap-4 border-b border-white/[0.04] pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5E5CE6]" />
            <span className="text-[11px] font-mono tracking-widest text-[#5E5CE6] font-semibold uppercase">Appeal.gg Log Havuzu</span>
          </div>
          <h2 className="text-[22px] font-bold text-white tracking-tight leading-none mt-2">İtiraz Yönetimi</h2>
          <p className="text-[12px] text-white/40 mt-1.5 font-medium">
            #dispute-logs kanalından kazınan Appeal.gg itiraz kayıtları.
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
            <span className="text-xs text-white/40">İtiraz kayıtları yükleniyor...</span>
          </div>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="space-y-6"
        >
          {/* Metrik Kartları */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Toplam İtiraz" value={stats.total} icon={Scale} color="bg-[#5E5CE6]/10 text-[#5E5CE6]" />
            <StatCard label="Onaylanan" value={stats.approved} icon={CheckCircle2} color="bg-emerald-500/10 text-emerald-400" />
            <StatCard label="Reddedilen" value={stats.rejected} icon={XCircle} color="bg-red-500/10 text-red-400" />
            <StatCard label="Kabul Oranı" value={`%${stats.approvalRate}`} icon={Clock} color="bg-amber-500/10 text-amber-400" />
          </div>

          {/* Filtreler */}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Kullanıcı ID, isim veya ceza no ara..."
              className="flex-1 px-4 py-2.5 rounded-xl bg-secondary/10 border border-white/[0.06] text-sm text-white placeholder:text-white/30 outline-none focus:border-[#5E5CE6]/50 transition-colors"
            />
            <div className="flex bg-[#111112] border border-white/[0.06] rounded-xl p-1 gap-1 shrink-0">
              {(['all', 'approved', 'rejected'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === f
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-white/40 hover:text-white'
                  }`}
                >
                  {f === 'all' ? 'Tümü' : f === 'approved' ? '✅ Onaylı' : '❌ Reddedilen'}
                </button>
              ))}
            </div>
          </div>

          {/* Tablo */}
          {filtered.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-secondary/5 border border-white/[0.04]">
              <Scale className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-sm text-white/40 font-medium">
                {appeals.length === 0
                  ? 'Henüz kayıt bulunmuyor. Uzantı #dispute-logs kanalını tarıdıkça veriler burada görünür.'
                  : 'Filtreyle eşleşen kayıt bulunamadı.'}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
              {/* Tablo başlık */}
              <div className="grid grid-cols-[1fr_1fr_120px_100px_auto] gap-4 px-5 py-3 bg-secondary/10 border-b border-white/[0.04]">
                <span className="text-[9.5px] font-bold text-white/30 uppercase tracking-wider">Kullanıcı</span>
                <span className="text-[9.5px] font-bold text-white/30 uppercase tracking-wider">Savunma</span>
                <span className="text-[9.5px] font-bold text-white/30 uppercase tracking-wider">Ceza No</span>
                <span className="text-[9.5px] font-bold text-white/30 uppercase tracking-wider">Tarih</span>
                <span className="text-[9.5px] font-bold text-white/30 uppercase tracking-wider">Durum</span>
              </div>

              <div className="divide-y divide-white/[0.03]">
                {filtered.map((appeal) => {
                  const isApproved = appeal.status === 'approved';
                  return (
                    <motion.div
                      key={appeal.id}
                      layout
                      onClick={() => setSelectedAppeal(appeal)}
                      className="grid grid-cols-[1fr_1fr_120px_100px_auto] gap-4 px-5 py-3.5 hover:bg-white/[0.025] transition-colors cursor-pointer items-center group active:scale-[0.995]"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">
                          {appeal.user_tag || <span className="font-mono text-white/60">{appeal.user_id}</span>}
                        </p>
                        {appeal.user_tag && (
                          <p className="text-[10px] font-mono text-white/30 truncate mt-0.5">{appeal.user_id}</p>
                        )}
                      </div>

                      <p className="text-xs text-white/55 truncate leading-relaxed">
                        {getReasonPreview(appeal.appeal_reason)}
                      </p>

                      <span className="text-xs font-mono text-[#5E5CE6]">
                        {appeal.case_id ? `#${appeal.case_id}` : '—'}
                      </span>

                      <span className="text-[11px] text-white/40">
                        {formatDate(appeal.created_at)}
                      </span>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                        isApproved
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {isApproved ? 'Onaylandı' : 'Reddedildi'}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Detay Drawer */}
      <AppealDetailDrawer
        appeal={selectedAppeal}
        onClose={() => setSelectedAppeal(null)}
      />
    </div>
  );
}

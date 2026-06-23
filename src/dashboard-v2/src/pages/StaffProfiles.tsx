import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, ShieldAlert, Award, MessageSquare, AlertCircle, 
  Send, Loader2, Calendar, FileText, BadgeAlert, AlertTriangle, ExternalLink,
  ChevronLeft, Search, Plus, Trash2, Edit2, Check, TrendingUp
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { 
  getCases, getStaffWarnings, getStaffMessages, sendStaffMessage, replyStaffMessage,
  addStaffWarning, deleteStaffWarning, updateStaffProfile, getTickets,
  SapphireCase, StaffWarning, StaffMessage, getStaffProfiles, StaffProfile, UserTicket
} from '../lib/supabase';
import { formatDate } from '../lib/utils';
import { getRoleColor, getRoleLabel, isManagementKadrosu, isManagementRole, ROLE_LABELS } from '../lib/auth';
import { calculatePerformanceScore, getReliabilityStatus } from '../lib/cukEngine';
import { Badge } from '../components/ui/Badge';
import { buildSapphireCaseUrl } from '../lib/sapphireUrl';
import ProofDrawer from '../components/ProofDrawer';

export default function StaffProfiles() {
  const { session } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<StaffProfile[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);
  
  // Detail states
  const [cases, setCases] = useState<SapphireCase[]>([]);
  const [warnings, setWarnings] = useState<StaffWarning[]>([]);
  const [messages, setMessages] = useState<StaffMessage[]>([]);
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Detail tab states
  const [activeTab, setActiveTab] = useState<'overview' | 'cases' | 'warnings' | 'messages' | 'tickets'>('overview');
  
  // Inline edit states
  const [promotedDate, setPromotedDate] = useState('');
  const [mgmtComments, setMgmtComments] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingRole, setSavingRole] = useState(false);

  // Warning Form states
  const [warningReason, setWarningReason] = useState('');
  const [warningPoints, setWarningPoints] = useState(1);
  const [submittingWarning, setSubmittingWarning] = useState(false);

  // Case details popup states
  const [proofCaseId, setProofCaseId] = useState<string | null>(null);
  const [selectedProofCase, setSelectedProofCase] = useState<SapphireCase | null>(null);

  // Reply states
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [submittingReply, setSubmittingReply] = useState<Record<string, boolean>>({});

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const data = await getStaffProfiles();
      setProfiles(data);
    } catch (err: any) {
      console.error('Failed to load profiles:', err);
      showToast('Yetkili listesi yüklenirken hata oluştu', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadStaffDetails = async (staff: StaffProfile) => {
    setDetailLoading(true);
    try {
      const [allCases, staffWarnings, staffMessages, staffTickets] = await Promise.all([
        getCases(500),
        getStaffWarnings(staff.discord_id),
        getStaffMessages(staff.discord_id),
        getTickets({ modId: staff.discord_id, limit: 100 })
      ]);

      const staffCases = allCases.filter(c => c.author_discord_id === staff.discord_id);
      setCases(staffCases);
      setWarnings(staffWarnings);
      setMessages(staffMessages);
      setTickets(staffTickets || []);
      
      // Sync form states
      setPromotedDate(staff.last_promoted_at ? new Date(staff.last_promoted_at).toISOString().split('T')[0] : '');
      setMgmtComments(staff.management_comments || '');
      setActiveTab('overview');
    } catch (err: any) {
      console.error('Failed to load details:', err);
      showToast('Yetkili detayları yüklenirken hata oluştu', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSelectStaff = (staff: StaffProfile) => {
    setSelectedStaff(staff);
    setSelectedRole(staff.role || '');
    setPromotedDate(staff.last_promoted_at ? staff.last_promoted_at.split('T')[0] : '');
    setMgmtComments(staff.management_comments || '');
    loadStaffDetails(staff);
  };

  const handleBack = () => {
    setSelectedStaff(null);
    loadProfiles(); // Refresh list to reflect updates
  };

  // Compute metrics for selected staff
  const metrics = useMemo(() => {
    const isManagement = session ? isManagementRole(session.role) : false;
    const visibleCases = cases.filter(c => c.is_public || isManagement);

    const total = cases.length;
    const valid = visibleCases.filter(c => c.cuk_verdict === 'valid').length;
    const invalid = visibleCases.filter(c => c.cuk_verdict === 'invalid').length;
    const pending = total - (valid + invalid);
    const accuracy = total > 0 ? Math.round((valid / total) * 100) : 100;
    const score = calculatePerformanceScore(valid, invalid, pending);
    const reliability = getReliabilityStatus(accuracy, total);
    const invalidCases = visibleCases.filter(c => c.cuk_verdict === 'invalid');

    return { total, valid, invalid, pending, accuracy, score, reliability, invalidCases };
  }, [cases, session]);

  // Save promotion date and comments
  const handleSaveMeta = async () => {
    if (!selectedStaff) return;
    setSavingMeta(true);
    try {
      await updateStaffProfile(selectedStaff.discord_id, {
        last_promoted_at: promotedDate ? new Date(promotedDate).toISOString() : null,
        management_comments: mgmtComments.trim() || null
      });
      showToast('Yetkili bilgileri başarıyla güncellendi.', 'success');
      setSelectedStaff(prev => prev ? {
        ...prev,
        last_promoted_at: promotedDate ? new Date(promotedDate).toISOString() : undefined,
        management_comments: mgmtComments.trim() || undefined
      } : null);
    } catch (err: any) {
      showToast(`Hata: ${err.message || err}`, 'error');
    } finally {
      setSavingMeta(false);
    }
  };

  // Save role/rank change
  const handleSaveRole = async () => {
    if (!selectedStaff || !selectedRole || selectedRole === (selectedStaff.role || '')) return;
    setSavingRole(true);
    try {
      await updateStaffProfile(selectedStaff.discord_id, { role: selectedRole });
      showToast(`Rütbe başarıyla güncellendi: ${getRoleLabel(selectedRole)}`, 'success');
      setSelectedStaff(prev => prev ? { ...prev, role: selectedRole } : null);
      // Also update in the profiles list
      setProfiles(prev => prev.map(p => p.discord_id === selectedStaff.discord_id ? { ...p, role: selectedRole } : p));
    } catch (err: any) {
      showToast(`Rütbe güncellenirken hata: ${err.message || err}`, 'error');
    } finally {
      setSavingRole(false);
    }
  };

  // Warning Management
  const handleAddWarning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff || !warningReason.trim()) return;
    setSubmittingWarning(true);
    try {
      await addStaffWarning({
        staff_discord_id: selectedStaff.discord_id,
        reason: warningReason.trim(),
        points: warningPoints,
        created_by: session?.profile?.displayName || session?.profile?.username || 'Yönetim'
      });
      showToast('Uyarı başarıyla eklendi.', 'success');
      setWarningReason('');
      setWarningPoints(1);
      // Reload warnings
      const updated = await getStaffWarnings(selectedStaff.discord_id);
      setWarnings(updated);
    } catch (err: any) {
      showToast(`Hata: ${err.message || err}`, 'error');
    } finally {
      setSubmittingWarning(false);
    }
  };

  const handleDeleteWarning = async (id: string) => {
    if (!selectedStaff) return;
    try {
      await deleteStaffWarning(id);
      showToast('Uyarı silindi.', 'success');
      const updated = await getStaffWarnings(selectedStaff.discord_id);
      setWarnings(updated);
    } catch (err: any) {
      showToast(`Hata: ${err.message || err}`, 'error');
    }
  };

  // Reply Message
  const handleReplyMessage = async (msgId: string) => {
    const text = replyTexts[msgId] || '';
    if (!text.trim() || !selectedStaff) return;
    
    setSubmittingReply(prev => ({ ...prev, [msgId]: true }));
    try {
      const replier = session?.profile?.displayName || session?.profile?.username || 'Yönetici';
      await replyStaffMessage(msgId, text.trim(), replier);
      showToast('Yanıtınız iletildi ve kaydedildi.', 'success');
      setReplyTexts(prev => ({ ...prev, [msgId]: '' }));
      // Reload messages
      const updated = await getStaffMessages(selectedStaff.discord_id);
      setMessages(updated);
    } catch (err: any) {
      showToast(`Hata: ${err.message || err}`, 'error');
    } finally {
      setSubmittingReply(prev => ({ ...prev, [msgId]: false }));
    }
  };

  // Filter profile list
  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      const matchQuery = 
        p.username?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.in_game_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.discord_id?.includes(searchQuery);
      
      if (roleFilter === 'all') return matchQuery;
      return matchQuery && p.role === roleFilter;
    });
  }, [profiles, searchQuery, roleFilter]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 text-[#5E5CE6] animate-spin" />
        <span className="text-xs text-white/40 font-medium mt-3">Yetkili listesi yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 w-full min-h-screen flex flex-col relative text-left select-none">
      <AnimatePresence mode="wait">
        {!selectedStaff ? (
          // GRID SELECTION VIEW
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between gap-4 border-b border-white/[0.04] pb-6">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#5E5CE6]" />
                  <span className="text-[11px] font-mono tracking-widest text-[#5E5CE6] font-semibold uppercase">Yönetim Paneli</span>
                </div>
                <h2 className="text-[22px] font-bold text-white tracking-tight leading-none mt-2">Yetkili Profilleri</h2>
                <p className="text-[12px] text-white/40 mt-1.5 font-medium">
                  Tüm yetkililerin karnelerini, uyarılarını ve yönetim iletişim kayıtlarını tek bir panelden yönetin.
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-[#111112] border border-white/[0.08] p-4 rounded-2xl backdrop-blur-md">
              <div className="relative w-full md:w-80">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  placeholder="İsim, kullanıcı adı veya Discord ID ile ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>

              <div className="flex gap-2 w-full md:w-auto">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-primary/50 cursor-pointer transition-colors"
                >
                  <option value="all">Tüm Rütbeler</option>
                  {Array.from(new Set(profiles.map(p => p.role).filter(Boolean))).map(role => (
                    <option key={role} value={role}>{getRoleLabel(role || '')}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Grid */}
            {(() => {
              const managementKadrosu = filteredProfiles.filter(p => p.role !== 'eski_yetkili' && isManagementKadrosu(p.role || ''));
              const aktifYetkiliKadrosu = filteredProfiles.filter(p => p.role !== 'eski_yetkili' && !isManagementKadrosu(p.role || ''));
              const eskiYetkililer = filteredProfiles.filter(p => p.role === 'eski_yetkili');

              const renderProfileCard = (p: StaffProfile) => {
                const color = getRoleColor(p.role);
                return (
                  <button
                    key={p.discord_id}
                    onClick={() => handleSelectStaff(p)}
                    className="p-5 rounded-2xl bg-[#111112]/50 border border-white/[0.06] hover:border-white/20 transition-all duration-200 text-center flex flex-col items-center group relative overflow-hidden active:scale-[0.97] cursor-pointer w-full text-left"
                  >
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-[#A259FE] opacity-0 group-hover:opacity-100 transition-opacity" />
                    <img
                      src={p.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.discord_id}`}
                      alt=""
                      className="w-16 h-16 rounded-xl object-cover bg-black/50 border border-white/10 shadow-sm mx-auto"
                    />
                    <h4 className="font-bold text-white text-sm mt-3.5 truncate w-full group-hover:text-primary transition-colors text-center">
                      {p.in_game_name || p.username}
                    </h4>
                    <span 
                      className="text-[9px] font-extrabold uppercase tracking-widest mt-1.5 px-2.5 py-0.5 rounded-full border bg-black/40 text-center block mx-auto" 
                      style={{ color, borderColor: `${color}25` }}
                    >
                      {getRoleLabel(p.role || '')}
                    </span>
                    <span className="text-[10px] text-white/30 font-mono mt-2 text-center block w-full">{p.discord_id}</span>
                  </button>
                );
              };

              return (
                <div className="space-y-8 w-full">
                  {/* Yönetim Kadrosu */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-[#A259FE] uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#A259FE]" />
                      Yönetim Kadrosu ({managementKadrosu.length})
                    </h3>
                    {managementKadrosu.length === 0 ? (
                      <div className="p-6 rounded-2xl border border-dashed border-white/[0.06] text-center text-xs text-white/40 italic bg-white/[0.01]">
                        Kayıtlı yönetim yetkilisi bulunmamaktadır.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                        {managementKadrosu.map(renderProfileCard)}
                      </div>
                    )}
                  </div>

                  {/* Aktif Yetkili Kadrosu */}
                  <div className="space-y-4 pt-6 border-t border-white/[0.04]">
                    <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Aktif Yetkili Kadrosu ({aktifYetkiliKadrosu.length})
                    </h3>
                    {aktifYetkiliKadrosu.length === 0 ? (
                      <div className="p-6 rounded-2xl border border-dashed border-white/[0.06] text-center text-xs text-white/40 italic bg-white/[0.01]">
                        Aktif yetkili bulunmamaktadır.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                        {aktifYetkiliKadrosu.map(renderProfileCard)}
                      </div>
                    )}
                  </div>

                  {/* Eski Yetkililer */}
                  <div className="space-y-4 pt-6 border-t border-white/[0.04]">
                    <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-500" />
                      Eski Yetkililer ({eskiYetkililer.length})
                    </h3>
                    {eskiYetkililer.length === 0 ? (
                      <div className="p-6 rounded-2xl border border-dashed border-white/[0.06] text-center text-xs text-white/40 italic bg-white/[0.01]">
                        Kayıtlı eski yetkili bulunmamaktadır.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                        {eskiYetkililer.map(renderProfileCard)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </motion.div>
        ) : (
          // DETAILED STAFF VIEW & EDIT PANELS
          <motion.div
            key="details"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between mb-2 gap-4 border-b border-white/[0.04] pb-6">
              <div>
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white font-bold transition-colors mb-4 cursor-pointer"
                >
                  <ChevronLeft size={14} /> Yetkili Listesine Dön
                </button>
                <div className="flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#5E5CE6]" />
                  <span className="text-[11px] font-mono tracking-widest text-[#5E5CE6] font-semibold uppercase">Yönetim Panel Detayı</span>
                </div>
                <h2 className="text-[22px] font-bold text-white tracking-tight leading-none mt-2">
                  {selectedStaff.in_game_name || selectedStaff.username} Profili
                </h2>
              </div>
            </div>

            {detailLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <span className="text-xs text-white/40 mt-3 font-semibold">Profil verileri ve istatistikleri alınıyor...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Left column: Profile card & metrics */}
                <div className="space-y-6">
                  {/* Profile card showcase */}
                  <div className="p-5 rounded-2xl bg-[#111112]/30 border border-white/[0.08] backdrop-blur-md relative overflow-hidden flex flex-col items-center text-center shadow-xl">
                    <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-r from-[#5E5CE6]/20 to-[#A259FE]/20" />
                    <img 
                      src={selectedStaff.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedStaff.discord_id}`}
                      alt="" 
                      className="w-20 h-20 rounded-2xl bg-[#141416] object-cover border-2 border-white/10 relative z-10 mt-6 shadow-md"
                    />
                    <h3 className="font-bold text-lg text-white mt-4 leading-tight">{selectedStaff.in_game_name || selectedStaff.username}</h3>
                    <span 
                      className="text-[10px] font-extrabold uppercase tracking-widest mt-1.5 px-3 py-1 rounded-full border bg-black/40" 
                      style={{ color: getRoleColor(selectedStaff.role), borderColor: `${getRoleColor(selectedStaff.role)}25` }}
                    >
                      {getRoleLabel(selectedStaff.role || '')}
                    </span>
                    <div className="text-[11px] text-white/40 font-mono mt-2">{selectedStaff.discord_id}</div>
                  </div>

                  {/* Quick Metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Cezaları', val: metrics.total, color: 'text-foreground' },
                      { label: 'Doğruluk', val: `%${metrics.accuracy}`, color: metrics.accuracy >= 70 ? 'text-emerald-400' : 'text-amber-400' },
                      { label: 'CUK Skoru', val: metrics.score, color: 'text-[#5E5CE6]' },
                      { label: 'Uyarı Puanı', val: warnings.reduce((sum, w) => sum + (w.points || 1), 0), color: 'text-amber-500' }
                    ].map(({ label, val, color }) => (
                      <div key={label} className="p-3.5 rounded-xl bg-[#111112]/20 border border-white/[0.05]">
                        <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider block mb-1">{label}</span>
                        <span className={`text-xl font-bold ${color}`}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right column: Tabs container */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="flex bg-[#111112] border border-white/10 rounded-xl p-1">
                    {(() => {
                      const isManager = session ? isManagementRole(session.role) : false;
                      const isSelf = session?.profile?.discordId === selectedStaff.discord_id;
                      
                      const allTabs = [
                        { id: 'overview', label: 'Yönetim & Karne' },
                        { id: 'cases', label: 'Cezaları' },
                        { id: 'warnings', label: 'Uyarıları' },
                        { id: 'messages', label: 'İtiraz & Mesajları' },
                        { id: 'tickets', label: 'Hadron Biletleri' }
                      ];

                      // Non-managers viewing other profiles only see cases and tickets
                      const visibleTabs = (isManager || isSelf) 
                        ? allTabs 
                        : allTabs.filter(t => t.id === 'cases' || t.id === 'tickets');

                      return visibleTabs.map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${activeTab === tab.id ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white'}`}
                        >
                          {tab.label}
                        </button>
                      ));
                    })()}
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
                          {/* Inline Edit Form */}
                          <div className="p-5 rounded-2xl bg-[#111112]/20 border border-white/[0.05] space-y-4 shadow-xl">
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                              <Edit2 size={13} className="text-primary" /> Yetkili Bilgilerini Düzenle
                            </h4>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Son Terfi Tarihi</label>
                                <input
                                  type="date"
                                  value={promotedDate}
                                  onChange={(e) => setPromotedDate(e.target.value)}
                                  className="px-3.5 py-2 bg-background border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-primary/50"
                                />
                              </div>
                            </div>

                            {/* Rank/Role Change */}
                            <div className="p-4 rounded-xl bg-[#5E5CE6]/5 border border-[#5E5CE6]/15 space-y-3">
                              <h5 className="text-[10px] font-bold text-[#5E5CE6] uppercase tracking-wider flex items-center gap-1.5">
                                <TrendingUp size={12} /> Rütbe / Terfi İşlemi
                              </h5>
                              <div className="flex gap-2">
                                <select
                                  value={selectedRole}
                                  onChange={(e) => setSelectedRole(e.target.value)}
                                  className="flex-1 px-3.5 py-2 bg-background border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-primary/50 cursor-pointer"
                                >
                                  {Object.entries(ROLE_LABELS).filter(([key]) => key !== 'viewer' && key !== 'pending' && key !== 'blocked').map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                  ))}
                                </select>
                                <button
                                  onClick={handleSaveRole}
                                  disabled={savingRole || selectedRole === (selectedStaff?.role || '')}
                                  className="px-4 py-2 rounded-xl bg-[#5E5CE6] hover:bg-[#5E5CE6]/90 disabled:opacity-40 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer transition-all duration-150 active:scale-[0.97] whitespace-nowrap"
                                >
                                  {savingRole ? <Loader2 size={12} className="animate-spin" /> : <><TrendingUp size={12} /> Rütbeyi Güncelle</>}
                                </button>
                              </div>
                              {selectedRole !== (selectedStaff?.role || '') && (
                                <p className="text-[10px] text-amber-400/80">
                                  ⚠ {getRoleLabel(selectedStaff?.role || 'Bilinmiyor')} → {getRoleLabel(selectedRole)} olarak güncellenecek
                                </p>
                              )}
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Yönetim Görüşleri / Özel Notlar</label>
                              <textarea
                                value={mgmtComments}
                                onChange={(e) => setMgmtComments(e.target.value)}
                                placeholder="Yönetim ekibi için bu yetkili hakkındaki genel değerlendirme veya notlar..."
                                className="w-full h-20 p-3 bg-background border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-primary/50 resize-none leading-relaxed"
                              />
                            </div>

                            <button
                              onClick={handleSaveMeta}
                              disabled={savingMeta}
                              className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/95 disabled:opacity-50 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer ml-auto transition-all duration-150 active:scale-[0.97] shadow-lg shadow-primary/25"
                            >
                              {savingMeta ? <Loader2 size={12} className="animate-spin" /> : <><Check size={12} /> Bilgileri Kaydet</>}
                            </button>
                          </div>

                          {/* Invalid Cases analysis */}
                          <div className="p-4 rounded-xl bg-[#111112]/20 border border-white/[0.05] space-y-4">
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Hatalı Karar Sicili ({metrics.invalidCases.length})</h4>
                            
                            {metrics.invalidCases.length === 0 ? (
                              <div className="p-5 rounded-lg border border-dashed border-emerald-500/20 bg-emerald-500/5 text-center">
                                <Award className="w-8 h-8 text-emerald-400 mx-auto" />
                                <h5 className="text-xs font-bold text-white mt-2">Hatalı Karar Kaydı Bulunmuyor</h5>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {metrics.invalidCases.map((c) => (
                                  <div key={c.case_id} className="p-3.5 rounded-lg bg-red-500/5 border border-red-500/10 flex flex-col gap-2">
                                    <div className="flex justify-between items-center">
                                      <span className="text-[11px] font-mono font-bold text-red-400">Case #{c.case_id}</span>
                                      <span className="text-[10px] text-white/30">{formatDate(c.created_at_sapphire)}</span>
                                    </div>
                                    <div className="text-xs text-white/80">
                                      <span className="font-semibold block text-[10px] uppercase text-white/40 mb-0.5">Sebep:</span>
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
                          className="space-y-2 text-left"
                        >
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Son Cezalandırdığı Kullanıcılar</h4>
                          {cases.length === 0 ? (
                            <div className="text-xs text-white/40 italic py-8 text-center bg-[#111112]/10 rounded-xl border border-white/[0.03]">
                              Kayıtlı ceza bulunmamaktadır.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {cases.slice(0, 50).map((c) => (
                                <div 
                                  key={c.case_id} 
                                  onClick={() => {
                                    setProofCaseId(c.case_id);
                                    setSelectedProofCase(c);
                                  }}
                                  className="p-3 rounded-xl bg-[#111112]/20 border border-white/[0.05] flex items-center justify-between hover:bg-secondary/20 transition-colors cursor-pointer select-none active:scale-[0.98]"
                                >
                                  <div className="flex-1 min-w-0 mr-3">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-mono font-bold text-[#5E5CE6]">#{c.case_id}</span>
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-white/60 uppercase font-mono">{c.type}</span>
                                    </div>
                                    <div className="text-xs text-white/70 truncate mt-1">
                                      Sebep: {c.reason_raw || '—'}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                    {(() => {
                                      const isManagement = session ? isManagementRole(session.role) : false;
                                      const shouldShowVerdict = c.is_public || isManagement;
                                      const statusClass = !shouldShowVerdict 
                                        ? 'neutral' 
                                        : c.cuk_verdict === 'valid' 
                                        ? 'success' 
                                        : c.cuk_verdict === 'invalid' 
                                        ? 'danger' 
                                        : 'neutral';
                                      return (
                                        <span className={`status-badge scale-90 ${statusClass}`}>
                                          {!shouldShowVerdict ? 'GİZLİ' : c.cuk_verdict === 'valid' ? 'DOĞRU' : c.cuk_verdict === 'invalid' ? 'HATALI' : 'BEKLEYEN'}
                                        </span>
                                      );
                                    })()}
                                    <button
                                      onClick={() => {
                                        const url = buildSapphireCaseUrl(c.guild_id, c.case_id);
                                        if (url) window.open(url, '_blank', 'noopener,noreferrer');
                                      }}
                                      className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-all cursor-pointer"
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
                          className="space-y-6 text-left"
                        >
                          {/* Add Warning Form */}
                          <form onSubmit={handleAddWarning} className="p-4 rounded-xl bg-[#111112]/25 border border-white/[0.05] space-y-4">
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                              <BadgeAlert size={13} className="text-amber-500" /> Yeni Uyarı Gir
                            </h4>
                            <div className="grid grid-cols-3 gap-3">
                              <div className="col-span-2 flex flex-col gap-1">
                                <input
                                  type="text"
                                  placeholder="Uyarı sebebi girin..."
                                  value={warningReason}
                                  onChange={(e) => setWarningReason(e.target.value)}
                                  required
                                  className="w-full px-3 py-2 bg-background border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-primary/50"
                                />
                              </div>
                              <div className="flex gap-2">
                                <select
                                  value={warningPoints}
                                  onChange={(e) => setWarningPoints(Number(e.target.value))}
                                  className="px-2 py-2 bg-background border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-primary/50 w-full"
                                >
                                  {[1, 2, 3, 4, 5].map(p => (
                                    <option key={p} value={p}>{p} Puan</option>
                                  ))}
                                </select>
                                <button
                                  type="submit"
                                  disabled={submittingWarning || !warningReason.trim()}
                                  className="p-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center min-w-[36px]"
                                >
                                  {submittingWarning ? <Loader2 size={12} className="animate-spin" /> : <Plus size={14} />}
                                </button>
                              </div>
                            </div>
                          </form>

                          {/* Warning list */}
                          <div className="space-y-2">
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Mevcut Uyarılar ({warnings.length})</h4>
                            {warnings.length === 0 ? (
                              <div className="p-6 text-center rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-xs text-white/50 italic">
                                Sicil temiz. Herhangi bir uyarı bulunmuyor.
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {warnings.map((w) => (
                                  <div key={w.id} className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 flex items-center justify-between">
                                    <div className="space-y-1">
                                      <div className="text-xs font-bold text-white">{w.reason}</div>
                                      <div className="text-[10px] text-white/40">
                                        {formatDate(w.created_at)} • Yönetici: {w.created_by}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded">
                                        {w.points} Puan
                                      </span>
                                      <button
                                        onClick={() => handleDeleteWarning(w.id)}
                                        className="p-1 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded transition-all cursor-pointer"
                                        title="Uyarıyı Sil"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
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
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">İtiraz ve Destek Talepleri ({messages.length})</h4>
                          
                          {messages.length === 0 ? (
                            <div className="text-xs text-white/30 italic py-8 text-center bg-[#111112]/10 rounded-xl border border-white/[0.03]">
                              Kayıtlı mesaj bulunmuyor.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {messages.map((m) => (
                                <div key={m.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-3 shadow-md">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-white/40 font-mono">{formatDate(m.created_at)}</span>
                                    <span className={`text-[9.5px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${m.response ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'}`}>
                                      {m.response ? 'Cevaplandı' : 'Cevap Bekliyor'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-white/90 font-medium">"{m.message}"</p>
                                  
                                  {m.response ? (
                                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/15 space-y-1">
                                      <div className="text-[9.5px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                                        <User size={10} /> Yanıtlayan ({m.responded_by || 'Yönetici'}):
                                      </div>
                                      <p className="text-xs text-white/90 italic leading-relaxed">"{m.response}"</p>
                                      <span className="text-[9px] text-white/30 block text-right mt-1 font-mono">{formatDate(m.responded_at || '')}</span>
                                    </div>
                                  ) : (
                                    // Reply Input Form
                                    <div className="pt-2 border-t border-white/[0.05] space-y-2">
                                      <textarea
                                        value={replyTexts[m.id] || ''}
                                        onChange={(e) => setReplyTexts(prev => ({ ...prev, [m.id]: e.target.value }))}
                                        placeholder="Yetkiliye cevap yazın (Mesaj bot tarafından DM atılacaktır)..."
                                        className="w-full h-16 p-2.5 bg-background border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-primary/50 resize-none leading-relaxed"
                                      />
                                      <button
                                        onClick={() => handleReplyMessage(m.id)}
                                        disabled={submittingReply[m.id] || !(replyTexts[m.id] || '').trim()}
                                        className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer ml-auto transition-all"
                                      >
                                        {submittingReply[m.id] ? <Loader2 size={12} className="animate-spin" /> : <><Send size={11} /> Cevapla</>}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )}

                      {activeTab === 'tickets' && (
                        <motion.div
                          key="tickets"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="space-y-4 text-left"
                        >
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Hadron Destek Bileti Geçmişi ({tickets.length})</h4>
                          
                          {tickets.length === 0 ? (
                            <div className="text-xs text-white/30 italic py-8 text-center bg-[#111112]/10 rounded-xl border border-white/[0.03]">
                              Bu yetkili tarafından kapatılmış Hadron bileti bulunmuyor.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {tickets.map((t) => (
                                <div key={t.id} className="p-3.5 rounded-xl bg-[#111112]/20 border border-white/[0.05] flex items-center justify-between hover:bg-secondary/20 transition-colors">
                                  <div className="flex-1 min-w-0 mr-3">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-mono font-bold text-[#5E5CE6]">#{t.ticket_id}</span>
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-white/60 uppercase font-mono">{t.category || 'Genel'}</span>
                                    </div>
                                    <div className="text-xs text-white/70 truncate mt-1">
                                      {t.ticket_name || 'İsimsiz Bilet'}
                                    </div>
                                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-white/40">
                                      <span className="flex items-center gap-1">
                                        <MessageSquare size={10} /> {t.message_count} mesaj
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Calendar size={10} /> {formatDate(t.closed_at)}
                                      </span>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => {
                                      const cleanId = t.ticket_id.replace(/[^0-9]/g, '').trim();
                                      const url = `https://dash.hadron.bot/manage/1223431616081166336/transcripts/view/${cleanId}`;
                                      window.open(url, '_blank', 'noopener,noreferrer');
                                    }}
                                    className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-all cursor-pointer flex items-center gap-1.5"
                                    title="Bilete Git"
                                  >
                                    <ExternalLink size={12} />
                                    <span className="text-[10px] font-bold">Bilete Git</span>
                                  </button>
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
            )}
          </motion.div>
        )}
      </AnimatePresence>
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

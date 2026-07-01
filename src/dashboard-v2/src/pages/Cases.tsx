import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, RefreshCw, X, CheckCircle2, ShieldAlert, Copy, 
  ExternalLink, MessageSquare, AlertCircle, Info, 
  User, ShieldCheck, Share2, Filter, Zap, ChevronLeft, ChevronRight,
  Eye, Sparkles
} from 'lucide-react';
import { getCases, getStaffProfiles, SapphireCase, StaffProfile, bulkUpdateVerdict, updateCaseVerdict, deleteCase, updateCasePublicStatus, bulkUpdatePublicStatus, getCaseProof, CaseProof } from '../lib/supabase';
import ProofDrawer from '../components/ProofDrawer';
import { validateCase } from '../lib/cukEngine';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission, isManagementRole } from '../lib/auth';
import { minutesToHuman, relativeTime, parseDateSafe, formatDate, isPenaltyActive, cn } from '../lib/utils';
import { useToast } from '../contexts/ToastContext';
import { resolveStaffName, resolveStaffAvatar } from '../lib/staffDisplay';
import { useLanguage } from '../contexts/LanguageContext';
import { getGlassClass } from '../lib/theme';
import Tooltip from '../components/Tooltip';
import RoleBadge from '../components/RoleBadge';
import { ValidDurationsPanel } from '../components/ui/ValidDurationsPanel';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { buildSapphireCaseUrl } from '../lib/sapphireUrl';
import { buildLutheusCaseUrl } from '../lib/lutheusUrl';

export default function Cases() {
  const { session } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const { t, language } = useLanguage();
  const canEdit = hasPermission(session?.role || '', 'penalties:update');

  const [cases, setCases] = useState<SapphireCase[]>([]);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [verdictFilter, setVerdictFilter] = useState<'all' | 'valid' | 'invalid' | 'pending'>('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | 'week' | 'month'>('week');
  const [penaltyTypeFilter, setPenaltyTypeFilter] = useState<'all' | 'mute' | 'ban' | 'warn'>('all');
  
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedCase, setSelectedCase] = useState<SapphireCase | null>(null);
  const [proofCaseId, setProofCaseId] = useState<string | null>(null);
  const [selectedProofCase, setSelectedProofCase] = useState<SapphireCase | null>(null);
  const [confirmBulk, setConfirmBulk] = useState<'valid' | 'invalid' | 'public' | 'private' | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [caseUpdating, setCaseUpdating] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, caseData: SapphireCase } | null>(null);
  const [bulkSelectStartDate, setBulkSelectStartDate] = useState('');
  const [bulkSelectEndDate, setBulkSelectEndDate] = useState('');
  
  // AI Sidebar & Weekly scan states
  const [selectedCaseProof, setSelectedCaseProof] = useState<CaseProof | null>(null);
  const [loadingSelectedProof, setLoadingSelectedProof] = useState(false);
  const [aiScanning, setAiScanning] = useState(false);

  // Close context menu on window click
  useEffect(() => {
    const handleClose = () => setContextMenu(null);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  // Theme states
  const [theme, setTheme] = useState<'midnight' | 'deepspace' | 'sunset' | 'arctic'>(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'lavender') return 'midnight';
    if (stored === 'corporate') return 'sunset';
    if (stored === 'light') return 'arctic';
    return 'deepspace';
  });

  const [intensity, setIntensity] = useState<string>(() => {
    return localStorage.getItem('lutheus-intensity') || 'frosted';
  });

  // Panel layout: 'side' → sağ panel, 'center' → orta modal
  const [panelStyle, setPanelStyle] = useState<string>(() => {
    return localStorage.getItem('panelStyle') || 'side';
  });

  // Lightbox: görsel tam boyut önizleme (sağ panel açıkken üste binmesin)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);


  useEffect(() => {
    const handleThemeChange = () => {
      const stored = localStorage.getItem('theme');
      if (stored === 'lavender') setTheme('midnight');
      else if (stored === 'corporate') setTheme('sunset');
      else if (stored === 'light') setTheme('arctic');
      else setTheme('deepspace');
    };
    const handleIntensityChange = () => {
      setIntensity(localStorage.getItem('lutheus-intensity') || 'frosted');
    };
    const handlePanelStyleChange = () => {
      setPanelStyle(localStorage.getItem('panelStyle') || 'side');
    };
    window.addEventListener('storage', handleThemeChange);
    window.addEventListener('storage', handleIntensityChange);
    window.addEventListener('storage', handlePanelStyleChange);
    window.addEventListener('lutheus-theme-change', handleThemeChange);
    window.addEventListener('lutheus-intensity-change', handleIntensityChange);
    return () => {
      window.removeEventListener('storage', handleThemeChange);
      window.removeEventListener('storage', handleIntensityChange);
      window.removeEventListener('storage', handlePanelStyleChange);
      window.removeEventListener('lutheus-theme-change', handleThemeChange);
      window.removeEventListener('lutheus-intensity-change', handleIntensityChange);
    };

  }, []);

  const loadData = async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const [casesData, staffData] = await Promise.all([
        getCases(300),
        getStaffProfiles()
      ]);
      setCases(casesData);
      setStaff(staffData);
      if (refresh) {
        showToast(language === 'tr' ? 'Cezalar başarıyla güncellendi' : 'Cases refreshed successfully', 'success');
      }
    } catch (err: any) {
      setError(err?.message || String(err));
      showToast('Veriler yüklenirken hata oluştu', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Fetch proof for sidebar dynamically
  useEffect(() => {
    if (!selectedCase?.case_id) {
      setSelectedCaseProof(null);
      return;
    }
    setLoadingSelectedProof(true);
    getCaseProof(selectedCase.case_id).then(proofData => {
      setSelectedCaseProof(proofData);
    }).catch(err => {
      console.error('Error fetching proof for sidebar:', err);
    }).finally(() => {
      setLoadingSelectedProof(false);
    });
  }, [selectedCase?.case_id]);

  const runWeeklyAiScan = async () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const weeklyCases = cases.filter(c => {
      const createdDate = new Date(c.created_at_sapphire || '');
      return createdDate >= sevenDaysAgo;
    });

    if (weeklyCases.length === 0) {
      showToast('Son 7 gün içinde atılmış ceza bulunamadı.', 'info');
      return;
    }

    setAiScanning(true);
    showToast(`Haftalık AI Taraması başlatıldı (${weeklyCases.length} ceza)...`, 'info');

    let successCount = 0;
    let failCount = 0;

    for (const c of weeklyCases) {
      try {
        const token = session?.idToken;
        const baseUrl = (typeof window !== 'undefined' && window.location.protocol === 'chrome-extension:') ? 'https://lutheus.vercel.app' : '';
        const res = await fetch(`${baseUrl}/api/ai/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ case_id: c.case_id, force_reanalyze: true })
        });

        if (res.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        failCount++;
      }
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    setAiScanning(false);
    showToast(`AI Taraması Bitti! Başarılı: ${successCount}, Hatalı: ${failCount}`, 'success');
    loadData(true);
  };

  const staffMap = useMemo(() => {
    return new Map(staff.map(sp => [sp.discord_id, sp]));
  }, [staff]);

  const getModName = (discordId: string, defaultName: string) => {
    const profile = staffMap.get(discordId);
    return resolveStaffName(profile, {
      author_discord_id: discordId,
      author_display_name: defaultName,
    } as SapphireCase);
  };

  // Pre-fill search filter from routing state if present
  useEffect(() => {
    const state = location.state as { search?: string } | null;
    if (state?.search) {
      setSearch(state.search);
      // Clean up state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Open drawer when linked via ?case= query param
  useEffect(() => {
    if (loading || cases.length === 0) return;
    const caseId = searchParams.get('case');
    if (!caseId) return;
    const match = cases.find((c) => c.case_id === caseId);
    if (match) setSelectedCase(match);
    setSearchParams({}, { replace: true });
  }, [loading, cases, searchParams, setSearchParams]);

  // Auto-run CUK on cases that are still pending
  const runAutoValidate = async () => {
    const pendingCases = cases.filter((c) => c.cuk_verdict === 'pending');
    showToast(`${pendingCases.length} bekleyen ceza doğrulanıyor...`, 'info');
    try {
      for (const c of pendingCases) {
        const durationMins = c.duration_ms ? Math.floor(c.duration_ms / 60000) : 0;
        const result = validateCase(c.reason_raw, durationMins);
        const verdict = result.valid ? 'valid' : 'invalid';
        await updateCaseVerdict(c.case_id, verdict, {
          message: result.message,
          category: result.categoryMatched || 'Diğer',
          score: result.score,
        });
      }
      showToast('Bekleyen tüm cezalar başarıyla doğrulandı', 'success');
      loadData(true);
    } catch {
      showToast('Doğrulama işlemi sırasında hata oluştu', 'error');
    }
  };

  const filtered = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOf7DaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const startOf30DaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    
    return cases
      .filter((c) => {
        // Date / Period Filter
        if (periodFilter !== 'all') {
          const tVal = parseDateSafe(c.created_at_sapphire).getTime();
          if (isNaN(tVal)) return false;
          
          if (periodFilter === 'today' && tVal < startOfToday) return false;
          if (periodFilter === 'week' && tVal < startOf7DaysAgo) return false;
          if (periodFilter === 'month' && tVal < startOf30DaysAgo) return false;
        }
        
        // Verdict Filter
        if (verdictFilter !== 'all' && c.cuk_verdict !== verdictFilter) return false;
        
        // Penalty Type Filter
        if (penaltyTypeFilter !== 'all') {
          const cType = (c.type || '').toLowerCase();
          if (penaltyTypeFilter === 'mute' && !cType.includes('mute')) return false;
          if (penaltyTypeFilter === 'ban' && !cType.includes('ban')) return false;
          if (penaltyTypeFilter === 'warn' && !cType.includes('warn')) return false;
        }

        // Search Filter
        if (search) {
          const s = search.toLowerCase();
          const authorName = getModName(c.author_discord_id, c.author_display_name).toLowerCase();
          const authorId = (c.author_discord_id || '').toLowerCase();
          const targetName = (c.punished_user_display_name || '').toLowerCase();
          const targetId = (c.punished_user_discord_id || '').toLowerCase();
          const reason = (c.reason_raw || '').toLowerCase();
          
          return (c.case_id || '').toLowerCase().includes(s)
            || authorName.includes(s)
            || authorId.includes(s)
            || targetName.includes(s)
            || targetId.includes(s)
            || reason.includes(s);
        }
        return true;
      })
      .sort((a, b) => {
        const timeA = parseDateSafe(a.created_at_sapphire).getTime();
        const timeB = parseDateSafe(b.created_at_sapphire).getTime();
        return timeB - timeA;
      });
  }, [cases, periodFilter, verdictFilter, penaltyTypeFilter, search, staffMap]);

  const handleBulkAction = async () => {
    if (!confirmBulk) return;
    setBulkLoading(true);
    try {
      if (confirmBulk === 'public' || confirmBulk === 'private') {
        const makePublic = confirmBulk === 'public';
        await bulkUpdatePublicStatus(Array.from(selectedIds), makePublic);
        showToast(`${selectedIds.size} adet ceza başarıyla ${makePublic ? 'yayınlandı' : 'gizlendi'}`, 'success');
      } else {
        await bulkUpdateVerdict(Array.from(selectedIds), confirmBulk);
        const actionName = confirmBulk === 'valid' ? 'doğrulandı' : 'reddedildi';
        showToast(`${selectedIds.size} adet ceza başarıyla ${actionName}`, 'success');
      }
      setSelectedIds(new Set());
      await loadData(true);
    } catch {
      showToast('Toplu işlem gerçekleştirilirken hata oluştu', 'error');
    } finally {
      setBulkLoading(false);
      setConfirmBulk(null);
    }
  };

  const handleSingleVerdict = async (c: SapphireCase, verdict: 'valid' | 'invalid') => {
    if (!canEdit) return;
    setCaseUpdating(c.case_id);
    const durationMins = c.duration_ms ? Math.floor(c.duration_ms / 60000) : 0;
    const result = validateCase(c.reason_raw, durationMins);
    try {
      await updateCaseVerdict(c.case_id, verdict, {
        message: result.message,
        category: result.categoryMatched || 'Diğer',
        score: result.score,
      });
      const actionName = verdict === 'valid' ? 'doğrulandı' : 'hatalı olarak işaretlendi';
      showToast(`Case #${c.case_id} ${actionName}`, 'success');
      setCases((prev) => prev.map((p) => p.case_id === c.case_id ? { ...p, cuk_verdict: verdict } : p));
      
      if (selectedCase?.case_id === c.case_id) {
        setSelectedCase(prev => prev ? { ...prev, cuk_verdict: verdict } : null);
      }
    } catch {
      showToast('İşlem kaydedilirken bir hata oluştu', 'error');
    } finally {
      setCaseUpdating(null);
    }
  };

  const handleDeleteCase = async (c: SapphireCase) => {
    if (!session || !isManagementRole(session.role)) {
      showToast('Bu işlemi gerçekleştirmek için yetkiniz yok', 'error');
      return;
    }
    if (!window.confirm(`Case #${c.case_id} silinecektir. Emin misiniz?`)) return;

    setCaseUpdating(c.case_id);
    try {
      await deleteCase(c.case_id);
      showToast(`Case #${c.case_id} başarıyla silindi`, 'success');
      setCases((prev) => prev.filter((p) => p.case_id !== c.case_id));
      if (selectedCase?.case_id === c.case_id) {
        setSelectedCase(null);
      }
    } catch (err: any) {
      showToast(`Hata: ${err.message || err}`, 'error');
    } finally {
      setCaseUpdating(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((c) => c.case_id)));
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    showToast(language === 'tr' ? 'ID panoya kopyalandı!' : 'ID copied to clipboard!', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openSapphireCase = (c: SapphireCase) => {
    const url = buildSapphireCaseUrl(c.guild_id, c.case_id) || c.case_url;
    if (!url) {
      showToast('Sapphire URL üretilemedi', 'error');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const isFormerStaff = (profile: StaffProfile | undefined): boolean => {
    if (!profile) return false;
    return profile.role === 'eski_yetkili';
  };

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginated = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const pendingCount = cases.filter((c) => c.cuk_verdict === 'pending').length;
  const isDrawerOpen = proofCaseId !== null || selectedCase !== null;

  return (
    <>
      <motion.div 
        animate={{ scale: isDrawerOpen ? 0.98 : 1, filter: isDrawerOpen ? 'blur(3px)' : 'blur(0px)' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="p-6 md:p-8 w-full min-h-screen flex flex-col relative select-none text-left"
      >
      
      {/* Top Section Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-white/[0.04] pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5E5CE6]" />
            <span className="text-[11px] font-mono tracking-widest text-[#5E5CE6] font-semibold uppercase">Lutheus Ceza Raporlama</span>
          </div>
          <h2 className="text-[22px] font-bold text-white tracking-tight leading-none mt-2">Cezalar</h2>
          <p className="text-[12px] text-white/40 mt-1.5 font-medium flex items-center gap-1.5">
            <Info size={12} className="text-white/30" />
            Sapphire ile entegre gerçek zamanlı işlem paneli • <span className="font-semibold text-white/50">{cases.length} kayıt listelendi</span>
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {canEdit && (
            <motion.button
              disabled={aiScanning}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={runWeeklyAiScan}
              className="px-3.5 py-1.5 rounded-lg bg-[#5E5CE6]/15 hover:bg-[#5E5CE6]/25 border border-[#5E5CE6]/35 text-[#5E5CE6] text-[11px] font-black tracking-wide flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles size={12} className={aiScanning ? 'animate-pulse' : ''} /> 
              {aiScanning ? 'AI Taranıyor...' : 'Haftalık AI Taraması'}
            </motion.button>
          )}
          {pendingCount > 0 && canEdit && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={runAutoValidate}
              className="px-3.5 py-1.5 rounded-lg bg-[#5E5CE6]/15 hover:bg-[#5E5CE6]/25 border border-[#5E5CE6]/35 text-[#5E5CE6] text-[11px] font-black tracking-wide flex items-center gap-1.5 cursor-pointer"
            >
              <Zap size={12} /> {pendingCount} {language === 'tr' ? 'Bekleyeni Doğrula' : 'Verify Pending'}
            </motion.button>
          )}
          <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.05] px-3.5 py-1.5 rounded-full backdrop-blur-md">
            <div className="w-1.5 h-1.5 rounded-full bg-[#32D74B]" />
            <span className="text-[10px] font-bold text-white/40 tracking-wider">AKTİF</span>
          </div>
        </div>
      </div>

      {/* Control Board: Search & Filters */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Main search bar */}
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
            <input 
              type="text" 
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Case ID, yetkili veya sebep..." 
              className="clean-input w-full md:w-[250px] h-9 bg-[#111112] border border-white/10 rounded-lg pl-10 pr-4 text-[12px] transition-colors focus:bg-[#151517] focus:border-white/20 font-medium"
            />
            {search && (
              <button 
                onClick={() => {
                  setSearch('');
                  setCurrentPage(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white p-1"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Period selector */}
          <div className="relative">
            <select 
              value={periodFilter}
              onChange={(e) => {
                setPeriodFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="h-9 bg-[#111112] border border-white/10 rounded-lg px-3.5 pr-8 text-[12px] text-white/80 outline-none appearance-none hover:border-white/20 transition-colors font-medium cursor-pointer"
            >
              <option value="all">Tüm Zamanlar</option>
              <option value="week">Bu Hafta</option>
              <option value="today">Bugün</option>
              <option value="month">Bu Ay</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/40 text-[9px]">▼</div>
          </div>

          {/* Validation Status Filter */}
          <div className="flex bg-[#111112] border border-white/10 rounded-lg p-1">
            {(['all', 'valid', 'invalid', 'pending'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => {
                  setVerdictFilter(filter);
                  setCurrentPage(1);
                }}
                className={`px-3.5 py-1 rounded-md text-[12px] font-semibold transition-all duration-200 cursor-pointer ${
                  verdictFilter === filter 
                    ? 'bg-white/10 text-white shadow-sm' 
                    : 'text-white/40 hover:text-white/80'
                }`}
              >
                {filter === 'all' ? 'Tümü' : filter === 'valid' ? 'Doğru' : filter === 'invalid' ? 'Hatalı' : 'Bekleyen'}
              </button>
            ))}
          </div>

          {/* Penalty Type Filter */}
          <div className="flex bg-[#111112] border border-white/10 rounded-lg p-1">
            {(['all', 'mute', 'ban', 'warn'] as const).map((type) => (
              <button
                key={type}
                onClick={() => {
                  setPenaltyTypeFilter(type);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-md text-[12px] font-bold transition-all duration-200 cursor-pointer ${
                  penaltyTypeFilter === type 
                    ? 'bg-white/10 text-white shadow-sm' 
                    : 'text-white/40 hover:text-white/80'
                }`}
              >
                {type === 'all' ? 'Her Tür' : type === 'mute' ? 'Mute' : type === 'ban' ? 'Ban' : 'Warn'}
              </button>
            ))}
          </div>

          {/* Page size limit */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-[10px] font-bold uppercase tracking-wider font-mono">LİMİT:</span>
            <select 
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="h-9 bg-[#111112] border border-white/10 rounded-lg pl-14 pr-9 text-[12px] text-white/80 outline-none appearance-none hover:border-white/20 transition-colors font-mono font-bold cursor-pointer"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-white/40 text-[9px] font-bold">▼</div>
          </div>
        </div>

        {/* Refresh button & date range selection */}
        <div className="flex items-center gap-3">
          {isManagementRole(session?.role || '') && (
            <div className="flex items-center gap-2 bg-[#111112] border border-white/10 rounded-lg p-1">
              <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest pl-2">Aralık Seç:</span>
              <input 
                type="date" 
                value={bulkSelectStartDate} 
                onChange={(e) => setBulkSelectStartDate(e.target.value)} 
                className="bg-black/40 border border-white/5 rounded px-2 py-1 text-[11px] text-white/90 outline-none w-28"
              />
              <span className="text-white/30 text-xs">-</span>
              <input 
                type="date" 
                value={bulkSelectEndDate} 
                onChange={(e) => setBulkSelectEndDate(e.target.value)} 
                className="bg-black/40 border border-white/5 rounded px-2 py-1 text-[11px] text-white/90 outline-none w-28"
              />
              <button 
                onClick={() => {
                  if (!bulkSelectStartDate || !bulkSelectEndDate) {
                    showToast('Lütfen başlangıç ve bitiş tarihlerini seçin.', 'error');
                    return;
                  }
                  const start = new Date(bulkSelectStartDate);
                  start.setHours(0, 0, 0, 0);
                  const end = new Date(bulkSelectEndDate);
                  end.setHours(23, 59, 59, 999);

                  const matched = cases.filter(c => {
                    const date = parseDateSafe(c.created_at_sapphire);
                    return date >= start && date <= end;
                  });

                  if (matched.length === 0) {
                    showToast('Seçilen tarih aralığında ceza bulunamadı.', 'info');
                  } else {
                    setSelectedIds(new Set(matched.map(c => c.case_id)));
                    showToast(`${matched.length} ceza otomatik olarak seçildi.`, 'success');
                  }
                }}
                className="px-3 py-1 bg-[#5E5CE6]/20 hover:bg-[#5E5CE6]/35 border border-[#5E5CE6]/30 rounded-md text-[11px] text-[#5E5CE6] font-extrabold transition-all cursor-pointer whitespace-nowrap"
              >
                Cezaları Seç
              </button>
            </div>
          )}

          {refreshing && (
            <span className="text-[11px] font-mono text-[#5E5CE6]">Veriler güncelleniyor...</span>
          )}
          <Tooltip content="Ceza Listesini Yenile">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="w-9 h-9 rounded-full bg-[#111112] border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/5 transition-all shadow-lg cursor-pointer"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin text-[#5E5CE6]' : ''} />
            </motion.button>
          </Tooltip>
        </div>
      </div>

      {/* Bulk action toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/10 border border-primary/20 rounded-2xl animate-in mb-4">
          <span className="text-sm font-semibold text-primary">{selectedIds.size} seçildi</span>
          <button 
            className="px-3 py-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            onClick={() => setConfirmBulk('valid')}
          >
            <CheckCircle2 size={13} /> Onayla
          </button>
          <button 
            className="px-3 py-1.5 rounded-lg text-destructive hover:bg-[#FF453A]/10 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            onClick={() => setConfirmBulk('invalid')}
          >
            <ShieldAlert size={13} /> Reddet
          </button>
          
          {isManagementRole(session?.role || '') && (
            <>
              <div className="w-[1px] h-4 bg-white/10 self-center"></div>
              <button 
                className="px-3 py-1.5 rounded-lg text-indigo-400 hover:bg-indigo-500/10 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                onClick={() => setConfirmBulk('public')}
              >
                <Share2 size={13} /> Yayınla (Public Yap)
              </button>
              <button 
                className="px-3 py-1.5 rounded-lg text-zinc-400 hover:bg-zinc-500/10 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                onClick={() => setConfirmBulk('private')}
              >
                <X size={13} /> Gizle (Private Yap)
              </button>
            </>
          )}

          <button 
            onClick={() => setSelectedIds(new Set())} 
            className="ml-auto text-xs text-white/40 hover:text-white transition-colors cursor-pointer"
          >
            Seçimi Temizle
          </button>
        </div>
      )}

      {/* Main Table */}
      <div className={`flex-1 min-w-0 rounded-2xl border overflow-hidden flex flex-col relative ${getGlassClass(intensity, theme)}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/[0.05] bg-black/40">
                <th className="py-4 px-4 w-12 text-[10px] font-bold text-white/40 tracking-wider uppercase font-mono text-center">
                  #
                </th>
                <th className="py-4 px-2 text-[10px] font-bold text-white/40 tracking-wider uppercase font-mono w-24">ID</th>
                <th className="py-4 px-4 text-[11px] font-bold text-white/40 tracking-wider uppercase">Yetkili</th>
                <th className="py-4 px-4 text-[11px] font-bold text-white/40 tracking-wider uppercase">Sebep</th>
                <th className="py-4 px-4 text-[11px] font-bold text-white/40 tracking-wider uppercase text-center w-28">Süre</th>
                <th className="py-4 px-4 text-[11px] font-bold text-white/40 tracking-wider uppercase text-center w-28">Tarih</th>
                <th className="py-4 px-4 text-[11px] font-bold text-white/40 tracking-wider uppercase text-right w-28">Durum</th>
                <th className="py-4 px-4 text-[11px] font-bold text-white/40 tracking-wider uppercase text-center w-20">Kanıt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {loading ? (
                <TableSkeleton />
              ) : error ? (
                <tr>
                  <td colSpan={8} className="py-20 px-4 text-center">
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center justify-center max-w-md mx-auto"
                    >
                      <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4 text-red-500">
                        <AlertCircle size={20} />
                      </div>
                      <h4 className="text-sm font-bold text-white mb-2">{language === 'tr' ? 'Veri Yükleme Hatası' : 'Data Loading Error'}</h4>
                      <p className="text-xs text-white/50 mb-6 leading-relaxed">
                        {language === 'tr' 
                          ? 'Cezalar ve yetkili profilleri Supabase sunucusundan çekilemedi. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.' 
                          : 'Failed to fetch cases and staff profiles from Supabase. Please check your internet connection and try again.'}
                      </p>
                      <button
                        onClick={() => loadData(false)}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold text-white transition-colors cursor-pointer"
                      >
                        {language === 'tr' ? 'Yeniden Dene' : 'Try Again'}
                      </button>
                    </motion.div>
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-20 px-4 text-center relative overflow-hidden">
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center justify-center max-w-md mx-auto"
                    >
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-[#5E5CE6]/5 blur-[60px] rounded-full pointer-events-none" />
                      
                      <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-center mb-5 relative group shadow-2xl">
                        <div className="absolute inset-0 rounded-2xl bg-[#5E5CE6]/10 blur-md opacity-35 group-hover:opacity-75 transition-opacity" />
                        <span className="text-white/30 group-hover:text-white/50 transition-colors">
                          <AlertCircle size={24} />
                        </span>
                      </div>
                      
                      <h3 className="text-[14.5px] font-bold text-white/90 tracking-tight">Kayıt Bulunamadı</h3>
                      <p className="text-[12px] text-[#8E8E93] mt-2 mb-6 leading-relaxed max-w-xs font-medium">
                        Aradığınız kriterlere uygun işlem geçmişi veya ceza kaydı bulunmamaktadır. Lütfen filtrelerinizi sıfırlayın.
                      </p>
                      
                      <motion.button 
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => { setSearch(''); setVerdictFilter('all'); setPeriodFilter('all'); setPenaltyTypeFilter('all'); }}
                        className="px-4 py-2.5 text-[11.5px] font-bold text-white bg-white/[0.05] border border-white/[0.08] rounded-lg hover:bg-white/[0.08] hover:border-white/[0.15] cursor-pointer shadow-md transition-colors"
                      >
                        Aramayı ve Filtreleri Sıfırla
                      </motion.button>
                    </motion.div>
                  </td>
                </tr>
              ) : (
                <AnimatePresence mode="popLayout">
                  {paginated.map((c, index) => {
                    const isSelected = selectedCase?.case_id === c.case_id;
                    const profile = staffMap.get(c.author_discord_id);
                    const name = getModName(c.author_discord_id, c.author_display_name);
                    const avatar = resolveStaffAvatar(profile, c, c.author_discord_id);
                    
                    // Case validity rules: Hide validity/accuracy status from normal staff unless public or manager
                    const isManagement = session ? isManagementRole(session.role) : false;
                    const shouldShowVerdict = c.is_public || isManagement;
                    
                    const statusClass = !shouldShowVerdict 
                      ? 'neutral' 
                      : c.cuk_verdict === 'valid' 
                      ? 'success' 
                      : c.cuk_verdict === 'invalid' 
                      ? 'danger' 
                      : 'neutral';
                      
                    const durationText = c.is_permanent ? 'Kalıcı' : minutesToHuman(Math.floor((c.duration_ms || 0) / 60000));

                    return (
                      <tr 
                        key={c.case_id}
                        className={cn(
                          "transition-colors cursor-pointer relative group duration-100",
                          isSelected ? "bg-white/[0.04]" : "hover:bg-white/[0.03]",
                          selectedIds.has(c.case_id) ? "bg-[#5E5CE6]/10 border-l border-l-[#5E5CE6]" : "",
                          shouldShowVerdict && c.cuk_verdict === 'invalid' ? "bg-[#FF453A]/[0.01] hover:bg-[#FF453A]/[0.03]" : ""
                        )}
                        onClick={(e) => {
                          if (e.ctrlKey) {
                            toggleSelect(c.case_id);
                          } else {
                            setSelectedCase(c);
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (e.ctrlKey) {
                            toggleSelect(c.case_id);
                          } else {
                            setContextMenu({
                              x: e.clientX,
                              y: e.clientY,
                              caseData: c
                            });
                          }
                        }}
                      >
                        <td className="py-3.5 px-4 w-12 text-center text-xs font-mono font-bold text-white/30" onClick={(e) => e.stopPropagation()}>
                          {(currentPage - 1) * pageSize + index + 1}
                        </td>

                        {/* Case ID */}
                        <td className="py-3.5 px-2">
                          <div className="flex items-center gap-2">
                            {/* Aktiflik Dotu */}
                            <span 
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${isPenaltyActive(c) ? 'bg-[#32D74B] animate-pulse shadow-[0_0_8px_rgba(50,215,75,0.8)]' : 'bg-white/20'}`}
                              title={isPenaltyActive(c) ? 'Aktif Ceza' : 'Süresi Dolmuş / Pasif'} 
                            />
                            
                            {/* Ceza İkonu */}
                            <span className="shrink-0 flex items-center justify-center min-w-[14px]">
                              {(() => {
                                const t = (c.type || '').toLowerCase();
                                if (t.includes('mute')) return <i className="fa-solid fa-microphone-slash text-[10px] text-[#FF9F0A]" title="Mute" />;
                                if (t.includes('ban')) return <i className="fa-solid fa-gavel text-[10px] text-[#FF453A]" title="Ban" />;
                                if (t.includes('warn')) return <i className="fa-solid fa-triangle-exclamation text-[10px] text-[#FFD60A]" title="Uyarı" />;
                                return <i className="fa-solid fa-gavel text-[10px] text-white/40" />;
                              })()}
                            </span>

                            <span className="text-[12px] font-mono font-semibold text-[#5E5CE6] flex items-center gap-1.5 group-hover:text-[#A259FE] transition-colors">
                              <span className="opacity-40">#</span>{c.case_id}
                            </span>
                            <Tooltip content="Sapphire Panelinde Göster">
                              <a 
                                href={buildSapphireCaseUrl(c.guild_id, c.case_id) || c.case_url || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-all cursor-pointer inline-flex items-center"
                              >
                                <ExternalLink size={11} />
                              </a>
                            </Tooltip>
                          </div>
                        </td>

                        {/* Yetkili */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <img src={avatar} alt="avatar" className="w-6 h-6 rounded-md object-cover border border-white/10 shrink-0" />
                            <span className="text-[13px] font-medium text-white/90 group-hover:text-white transition-colors truncate max-w-[120px]">
                              {name}
                            </span>
                          </div>
                        </td>

                        {/* Sebep */}
                        <td className="py-3.5 px-4 text-[13px] text-white/70 max-w-[280px] truncate">
                          {c.reason_raw || '—'}
                        </td>

                        {/* Süre */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex w-[92px] items-center justify-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.02] border border-white/[0.05]">
                            {isPenaltyActive(c) && <span className="w-1.5 h-1.5 rounded-full bg-[#32D74B] animate-pulse" />}
                            <span className={`text-[12px] font-medium font-mono ${c.is_permanent ? 'text-white/80' : 'text-white/60'}`}>
                              {durationText}
                            </span>
                          </div>
                        </td>

                        {/* Tarih */}
                        <td className="py-3.5 px-4 text-center text-[12px] text-white/50 font-medium">
                          {relativeTime(c.created_at_sapphire)}
                        </td>

                        {/* Durum */}
                        <td className="py-3.5 px-4 text-right">
                          <span className={`status-badge ${statusClass}`}>
                            {!shouldShowVerdict ? 'GİZLİ' : c.cuk_verdict === 'valid' ? 'DOĞRU' : c.cuk_verdict === 'invalid' ? 'HATALI' : 'BEKLEYEN'}
                          </span>
                        </td>
                        
                        {/* Kanıt */}
                        <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setProofCaseId(c.case_id);
                              setSelectedProofCase(c);
                            }}
                            className="p-1.5 rounded-lg bg-white/[0.02] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] text-white/60 hover:text-white transition-all cursor-pointer inline-flex items-center justify-center animate-in fade-in zoom-in-95 duration-150"
                            title="Kanıt ve AI Analizi"
                          >
                            <Eye size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        <div className="py-2.5 mt-auto border-t border-white/[0.05] flex flex-col sm:flex-row items-center justify-between px-5 gap-3 bg-black/20 text-[#8E8E93] min-h-[44px]">
          <span className="text-[11px] font-mono text-center sm:text-left select-none">
            Toplam <span className="text-white font-semibold">{totalItems}</span> kayıttan{' '}
            <span className="text-white font-semibold">
              {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </span>
            -
            <span className="text-white font-semibold">
              {Math.min(currentPage * pageSize, totalItems)}
            </span>{' '}
            arası gösteriliyor • Sayfa <span className="text-[#5E5CE6] font-bold">{currentPage}</span> / <span className="font-semibold">{totalPages}</span>
          </span>
          <div className="flex gap-1.5 items-center">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className={`px-3 py-1 rounded text-[11px] font-medium transition-colors ${
                currentPage === 1 
                  ? 'text-white/20 cursor-not-allowed' 
                  : 'text-white/60 hover:text-white hover:bg-white/5 cursor-pointer'
              }`}
            >
              Önceki
            </button>
            <div className="w-[1px] h-3 bg-white/10 self-center"></div>
            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className={`px-3 py-1 rounded text-[11px] font-medium transition-colors ${
                currentPage === totalPages 
                  ? 'text-white/20 cursor-not-allowed' 
                  : 'text-white/60 hover:text-white hover:bg-white/5 cursor-pointer'
              }`}
            >
              Sonraki
            </button>
          </div>
        </div>
      </div>
      </motion.div>

      {/* Details Side-Drawer */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedCase && (
            <>
              {/* Backdrop Blur Overlay */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedCase(null)}
                className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 cursor-pointer"
              />
              
              {/* Slide-in glassmorphic drawer */}
              <motion.div 
                initial={{ x: '100%', opacity: 0.9 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0.9 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                className="fixed right-0 top-0 bottom-0 w-full sm:w-[500px] bg-[#0A0A0C]/95 backdrop-blur-3xl z-50 border-l border-white/[0.08] shadow-[20px_0_60px_-15px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden"
              >
                {/* Header Details */}
                <div className="p-6 border-b border-white/[0.05] flex items-center justify-between bg-black/20">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-white/5 border border-white/5 text-[#5E5CE6]">
                      <MessageSquare size={16} />
                    </div>
                    {(() => {
                      const isManagement = session ? isManagementRole(session.role) : false;
                      const shouldShowVerdict = selectedCase.is_public || isManagement;
                      const statusClass = !shouldShowVerdict 
                        ? 'neutral' 
                        : selectedCase.cuk_verdict === 'valid' 
                        ? 'success' 
                        : selectedCase.cuk_verdict === 'invalid' 
                        ? 'danger' 
                        : 'neutral';

                      return (
                        <div>
                          <div className="flex items-center gap-2">
                            <a 
                              href={buildSapphireCaseUrl(selectedCase.guild_id, selectedCase.case_id) || selectedCase.case_url || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[13px] font-mono font-bold text-[#5E5CE6] hover:text-[#A259FE] hover:underline cursor-pointer flex items-center gap-1"
                              title="Sapphire Panelinde Göster"
                            >
                              #{selectedCase.case_id}
                              <ExternalLink size={10} className="opacity-60" />
                            </a>
                            <span className={`status-badge ${statusClass} scale-90`}>
                              {!shouldShowVerdict ? 'GİZLİ' : selectedCase.cuk_verdict === 'valid' ? 'DOĞRU' : selectedCase.cuk_verdict === 'invalid' ? 'HATALI' : 'BEKLEYEN'}
                            </span>
                            {selectedCaseProof?.ai_verdict && (
                              <span className={`status-badge ${selectedCaseProof.ai_verdict === 'valid' ? 'success' : 'danger'} scale-90 flex items-center gap-1`}>
                                <Sparkles size={10} /> AI: {selectedCaseProof.ai_verdict === 'valid' ? 'DOĞRU' : 'HATALI'}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-white/40 mt-0.5 tracking-wider font-mono uppercase">{selectedCase.type} • DETAYLAR</p>
                        </div>
                      );
                    })()}
                  </div>
                  
                  <button 
                    onClick={() => setSelectedCase(null)} 
                    className="w-8 h-8 rounded-full hover:bg-white/5 border border-transparent hover:border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Scrollable details container */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar scroll-smooth">
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.15 }}
                    className="space-y-6"
                  >
                  
                  {/* Users list info */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block">Kullanıcı İlişkileri</span>
                    
                    {/* Target User Info card */}
                    <div className="bg-[#141416]/60 border border-white/5 rounded-xl p-3 flex flex-col gap-2 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[#5E5CE6]/3 rounded-full filter blur-xl pointer-events-none" />
                      <span className="text-[9px] font-bold text-white/30 uppercase tracking-wider block">Cezalı Kullanıcı</span>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img 
                            src={selectedCase.punished_user_avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedCase.punished_user_discord_id}`} 
                            alt="target user" 
                            className="w-10 h-10 rounded-full border border-white/10 object-cover" 
                          />
                          <div>
                            {!selectedCase.punished_user_display_name || /^(unknown user|bilinmeyen kullanıcı|bilinmeyen|unknown|bilinmeyen kullanici)$/i.test(selectedCase.punished_user_display_name.trim()) ? (
                              <div className="flex items-center gap-1.5">
                                <p className="text-[13px] font-bold text-white font-mono">{selectedCase.punished_user_discord_id || '—'}</p>
                                {selectedCase.punished_user_discord_id && (
                                  <button 
                                    onClick={() => handleCopy(selectedCase.punished_user_discord_id)}
                                    className="p-1 rounded text-white/30 hover:text-white hover:bg-white/5 transition-all outline-none cursor-pointer flex items-center justify-center"
                                  >
                                    <Copy size={11} className={copiedId === selectedCase.punished_user_discord_id ? 'text-[#32D74B]' : ''} />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <>
                                <p className="text-[13px] font-bold text-white">{selectedCase.punished_user_display_name}</p>
                                <div className="flex items-center gap-1 text-white/40 mt-0.5">
                                  <span className="text-[11px] font-mono">{selectedCase.punished_user_discord_id || '—'}</span>
                                  {selectedCase.punished_user_discord_id && (
                                    <button 
                                      onClick={() => handleCopy(selectedCase.punished_user_discord_id)}
                                      className="p-1 rounded text-white/30 hover:text-white hover:bg-white/5 transition-all outline-none cursor-pointer flex items-center justify-center"
                                    >
                                      <Copy size={11} className={copiedId === selectedCase.punished_user_discord_id ? 'text-[#32D74B]' : ''} />
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Staff Info card */}
                    <div className="bg-[#141416]/60 border border-white/5 rounded-xl p-3 flex flex-col gap-2 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[#A259FE]/3 rounded-full filter blur-xl pointer-events-none" />
                      <span className="text-[9px] font-bold text-white/30 uppercase tracking-wider block">Cezalandıran Yetkili</span>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <img 
                            src={resolveStaffAvatar(staffMap.get(selectedCase.author_discord_id), selectedCase, selectedCase.author_discord_id)} 
                            alt="staff" 
                            className="w-10 h-10 rounded-lg border border-white/10 object-cover" 
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-[13px] font-bold text-white">{getModName(selectedCase.author_discord_id, selectedCase.author_display_name)}</p>
                              {isFormerStaff(staffMap.get(selectedCase.author_discord_id)) && (
                                <span className="text-[9px] font-extrabold text-[#FF453A] bg-[#FF453A]/10 border border-[#FF453A]/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                  Eski Yetkili
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-white/40 mt-0.5">
                              <span className="text-[11px] font-mono">{selectedCase.author_discord_id}</span>
                              <button 
                                onClick={() => handleCopy(selectedCase.author_discord_id)}
                                className="p-1 rounded text-white/30 hover:text-white hover:bg-white/5 transition-all outline-none cursor-pointer"
                              >
                                <Copy size={11} className={copiedId === selectedCase.author_discord_id ? 'text-[#32D74B]' : ''} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Valid Durations Analysis Panel */}
                  {(() => {
                    const isManagement = session ? isManagementRole(session.role) : false;
                    const shouldShowVerdict = selectedCase.is_public || isManagement;
                    if (!shouldShowVerdict) return null;

                    return (
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-2.5">CUK Süre Karşılaştırması</span>
                        <ValidDurationsPanel caseData={selectedCase} />
                      </div>
                    );
                  })()}

                  {/* Additional Metadata Rows */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-2.5">Ek Detaylar</span>
                    <div className="divide-y divide-white/[0.03] bg-[#141416]/40 border border-white/5 rounded-xl px-4 py-2">
                      <DetailMetadataRow label="Sebep" value={selectedCase.reason_raw || '—'} />
                      <DetailMetadataRow label="Süre" value={selectedCase.is_permanent ? 'Kalıcı' : minutesToHuman(Math.floor((selectedCase.duration_ms || 0) / 60000))} />
                      <DetailMetadataRow label="Tarih" value={formatDate(selectedCase.created_at_sapphire)} />
                      {(() => {
                        const isManagement = session ? isManagementRole(session.role) : false;
                        const shouldShowVerdict = selectedCase.is_public || isManagement;
                        if (shouldShowVerdict && selectedCase.cuk_analysis) {
                          return (
                            <>
                              <DetailMetadataRow label="CUK Kategori" value={selectedCase.cuk_analysis.category} />
                              <DetailMetadataRow label="CUK Mesaj" value={selectedCase.cuk_analysis.message} isHighlight={selectedCase.cuk_verdict === 'invalid'} />
                            </>
                          );
                        }
                        return null;
                      })()}
                      
                      {selectedCaseProof?.ai_analysis && (
                        <div className="bg-[#5E5CE6]/[0.02] border border-[#5E5CE6]/10 rounded-xl p-3 flex flex-col gap-1.5 relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-16 h-16 bg-[#5E5CE6]/3 rounded-full filter blur-md pointer-events-none" />
                          <span className="text-[9px] font-bold text-[#5E5CE6] uppercase tracking-wider flex items-center gap-1">
                            <Sparkles size={10} /> AI Gerekçesi (Vision OCR)
                          </span>
                          <p className="text-[12px] text-white/70 leading-relaxed font-medium">
                            {selectedCaseProof.ai_analysis}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  </motion.div>
                </div>

                {/* Bottom Action buttons */}
                {canEdit && (
                  <div className="p-6 border-t border-white/[0.05] bg-black/40 space-y-2 shrink-0">
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        disabled={caseUpdating === selectedCase.case_id}
                        onClick={() => handleSingleVerdict(selectedCase, 'valid')}
                        className={`py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                          selectedCase.cuk_verdict === 'valid' 
                            ? 'bg-[#32D74B] text-black border border-[#32D74B]' 
                            : 'bg-[#32D74B]/10 border border-[#32D74B]/20 text-[#32D74B] hover:bg-[#32D74B]/15'
                        }`}
                      >
                        <CheckCircle2 size={13} /> Doğru
                      </button>
                      <button 
                        disabled={caseUpdating === selectedCase.case_id}
                        onClick={() => handleSingleVerdict(selectedCase, 'invalid')}
                        className={`py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                          selectedCase.cuk_verdict === 'invalid' 
                            ? 'bg-[#FF453A] text-white border border-[#FF453A]' 
                            : 'bg-[#FF453A]/10 border border-[#FF453A]/20 text-[#FF453A] hover:bg-[#FF453A]/15'
                        }`}
                      >
                        <AlertCircle size={13} /> Hatalı
                      </button>
                    </div>
                    
                    <button 
                      onClick={() => {
                        setProofCaseId(selectedCase.case_id);
                        setSelectedProofCase(selectedCase);
                      }}
                      className="w-full py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] flex items-center justify-center gap-2 text-[12px] text-white/95 font-bold transition-all cursor-pointer"
                    >
                      <Eye size={13} className="text-white/40" /> Kanıt Görseli & AI Analizi
                    </button>

                    <button 
                      onClick={() => {
                        const sapphireUrl = buildSapphireCaseUrl(selectedCase.guild_id, selectedCase.case_id) || selectedCase.case_url;
                        if (sapphireUrl) {
                          window.open(sapphireUrl, '_blank', 'noopener,noreferrer');
                        } else {
                          showToast('Sapphire URL oluşturulamadı. Case ID eksik olabilir.', 'error');
                        }
                      }}
                      className="w-full py-2.5 rounded-xl bg-[#5E5CE6]/10 hover:bg-[#5E5CE6]/20 border border-[#5E5CE6]/20 flex items-center justify-center gap-2 text-[12px] text-white/95 font-bold transition-all cursor-pointer"
                    >
                      <ExternalLink size={13} className="text-white/40" /> Case Dashboard'da Aç (Sapphire)
                    </button>
                    <button 
                      onClick={() => window.open(buildLutheusCaseUrl(selectedCase.case_id), '_blank', 'noopener,noreferrer')}
                      className="w-full py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center gap-2 text-[12px] text-white/90 font-semibold transition-all cursor-pointer"
                    >
                      <Share2 size={13} className="text-white/40" /> Lutheus Raporu Paylaş
                    </button>
                    {isManagementRole(session?.role || '') && (
                      <div className="pt-2 border-t border-white/[0.05] space-y-2">
                        <button 
                          onClick={() => window.open(`https://supabase.com/dashboard/project/jxhzhaqqtlynbnntwpyu/editor/sapphire_cases?filter=case_id%3Deq%3D${encodeURIComponent(selectedCase.case_id)}`, '_blank', 'noopener,noreferrer')}
                          className="w-full py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 flex items-center justify-center gap-2 text-[12px] text-emerald-400 font-bold transition-all cursor-pointer"
                        >
                          <ExternalLink size={13} className="text-emerald-400/40" /> Supabase'de Aç
                        </button>
                        <button 
                          disabled={caseUpdating === selectedCase.case_id}
                          onClick={() => handleDeleteCase(selectedCase)}
                          className="w-full py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 flex items-center justify-center gap-2 text-[12px] text-red-400 font-bold transition-all cursor-pointer disabled:opacity-50"
                        >
                          <X size={13} /> Cezayı (Case) Veri Tabanından Sil
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </>
          )}
        </ AnimatePresence>,
        document.body
      )}

      {/* Bulk action confirmation modal */}
      {typeof document !== 'undefined' && createPortal(
        <ConfirmationModal
          isOpen={confirmBulk !== null}
          onClose={() => setConfirmBulk(null)}
          onConfirm={handleBulkAction}
          title={
            confirmBulk === 'public'
              ? `${selectedIds.size} kayıt yayınlanacak (Public yapılacak)`
              : confirmBulk === 'private'
              ? `${selectedIds.size} kayıt gizlenecek (Private yapılacak)`
              : `${selectedIds.size} kayıt toplu ${confirmBulk === 'valid' ? 'onaylanacak' : 'reddedilecek'}`
          }
          description={
            confirmBulk === 'public'
              ? "Bu işlem seçili tüm cezaların doğruluk durumunun yetkililer tarafından görülmesini sağlayacaktır."
              : confirmBulk === 'private'
              ? "Bu işlem seçili tüm cezaların doğruluk durumunu yetkililerden gizleyecektir."
              : "Bu işlem seçili tüm cezaların durumunu değiştirecek ve Supabase'e yazılacak."
          }
          confirmText={
            confirmBulk === 'public'
              ? 'Yayınla'
              : confirmBulk === 'private'
              ? 'Gizle'
              : confirmBulk === 'valid'
              ? 'Onayla'
              : 'Reddet'
          }
          danger={confirmBulk === 'invalid' || confirmBulk === 'private'}
          loading={bulkLoading}
        />,
        document.body
      )}

      {/* Case Proof and AI Analysis Drawer */}
      <ProofDrawer
        caseId={proofCaseId}
        onClose={() => {
          setProofCaseId(null);
          setSelectedProofCase(null);
        }}
        caseData={selectedProofCase}
        intensity={intensity}
        theme={theme}
        panelStyle={panelStyle}
        onOpenLightbox={(url) => setLightboxUrl(url)}
      />

      {/* ── Lightbox: Tam boyut görsel önizleme ──
          Sağ panel açıkken lightbox ekranin SOL bölümünde
          Center modda ise tam orta da gözüksün */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {lightboxUrl && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setLightboxUrl(null)}
                className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] cursor-zoom-out"
              />
              {/* Image container — sağ panel varsa solda, yoksa orta */}
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ type: 'spring', damping: 24, stiffness: 260 }}
                className={`fixed z-[70] flex flex-col items-center gap-3 ${
                  panelStyle === 'side' && proofCaseId
                    ? 'top-1/2 left-[calc(50%-240px)] -translate-y-1/2 -translate-x-1/2 max-w-[calc(100vw-520px)]'
                    : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[90vw]'
                } w-full`}
              >
                <img
                  src={lightboxUrl}
                  alt="Kanıt Görseli"
                  className="max-h-[80vh] w-full object-contain rounded-2xl shadow-2xl border border-white/10"
                  onClick={e => e.stopPropagation()}
                />
                <div className="flex items-center gap-3">
                  <a
                    href={lightboxUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-[12px] font-bold flex items-center gap-1.5 transition-all"
                  >
                    <ExternalLink size={13} />
                    Yeni Sekmede Aç
                  </a>
                  <button
                    type="button"
                    onClick={() => setLightboxUrl(null)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-[12px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <X size={13} />
                    Kapat
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── Discord-Style Glassmorphic Context Menu ── */}
      {typeof document !== 'undefined' && contextMenu && createPortal(
        <div 
          style={{ 
            position: 'fixed', 
            top: contextMenu.y, 
            left: contextMenu.x, 
            zIndex: 100 
          }}
          className="animate-in fade-in zoom-in-95 duration-100 select-none text-left"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-56 rounded-xl border border-white/[0.08] bg-[#0A0A0C]/90 backdrop-blur-2xl shadow-2xl p-1.5 flex flex-col gap-0.5">
            <div className="px-2.5 py-1.5 border-b border-white/[0.05] mb-1">
              <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Ceza Kontrol Paneli</div>
              <div className="text-xs font-bold text-white truncate mt-0.5">#{contextMenu.caseData.case_id}</div>
            </div>
            
            {/* Management Only Toggles */}
            {isManagementRole(session?.role || '') && (
              <>
                <button
                  onClick={async () => {
                    const targetCase = contextMenu.caseData;
                    const newPublicStatus = !targetCase.is_public;
                    setContextMenu(null);
                    try {
                      await updateCasePublicStatus(targetCase.case_id, newPublicStatus);
                      setCases((prev) => prev.map((p) => p.case_id === targetCase.case_id ? { ...p, is_public: newPublicStatus } : p));
                      showToast(
                        newPublicStatus 
                          ? `Case #${targetCase.case_id} başarıyla herkese görünür yapıldı!` 
                          : `Case #${targetCase.case_id} gizlendi!`,
                        'success'
                      );
                    } catch (err: any) {
                      showToast(`Hata: ${err.message || err}`, 'error');
                    }
                  }}
                  className="w-full px-2.5 py-2 text-left text-xs font-semibold text-white/80 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span>{contextMenu.caseData.is_public ? 'Gizli Yap (Private)' : 'Yayınla (Public Yap)'}</span>
                  <Share2 size={12} className="text-white/40" />
                </button>

                <button
                  onClick={() => {
                    const targetCase = contextMenu.caseData;
                    setContextMenu(null);
                    handleSingleVerdict(targetCase, 'valid');
                  }}
                  className="w-full px-2.5 py-2 text-left text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span>Doğru Olarak İşaretle</span>
                  <CheckCircle2 size={12} className="text-emerald-400/50" />
                </button>

                <button
                  onClick={() => {
                    const targetCase = contextMenu.caseData;
                    setContextMenu(null);
                    handleSingleVerdict(targetCase, 'invalid');
                  }}
                  className="w-full px-2.5 py-2 text-left text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span>Hatalı Olarak İşaretle</span>
                  <AlertCircle size={12} className="text-red-400/50" />
                </button>

                <div className="h-[1px] bg-white/[0.05] my-1" />
              </>
            )}

            <button
              onClick={() => {
                const targetCase = contextMenu.caseData;
                setContextMenu(null);
                setProofCaseId(targetCase.case_id);
                setSelectedProofCase(targetCase);
              }}
              className="w-full px-2.5 py-2 text-left text-xs font-semibold text-white/80 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors flex items-center justify-between cursor-pointer"
            >
              <span>Kanıt Ekle / Gör</span>
              <Eye size={12} className="text-white/40" />
            </button>

            <button
              onClick={() => {
                handleCopy(contextMenu.caseData.case_id);
                setContextMenu(null);
              }}
              className="w-full px-2.5 py-2 text-left text-xs font-semibold text-white/80 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors flex items-center justify-between cursor-pointer"
            >
              <span>ID Kopyala</span>
              <Copy size={12} className="text-white/40" />
            </button>

            {isManagementRole(session?.role || '') && (
              <>
                <div className="h-[1px] bg-white/[0.05] my-1" />
                <button
                  onClick={() => {
                    const targetCase = contextMenu.caseData;
                    setContextMenu(null);
                    handleDeleteCase(targetCase);
                  }}
                  className="w-full px-2.5 py-2 text-left text-xs font-bold text-red-500 hover:text-white hover:bg-red-600/20 rounded-lg transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span>Sil</span>
                  <X size={12} className="text-red-500/50" />
                </button>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// Subcomponents for Table loadings
function TableSkeleton() {
  return (
    <>
      {[...Array(6)].map((_, i) => (
        <tr key={i} className="border-b border-white/[0.02]">
          <td className="py-4 px-4 w-10">
            <div className="w-3.5 h-3.5 rounded bg-white/[0.04] animate-pulse"></div>
          </td>
          <td className="py-4 px-2">
            <div className="h-4 w-16 bg-white/[0.05] rounded-md animate-pulse"></div>
          </td>
          <td className="py-4 px-4">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded bg-white/[0.05] animate-pulse"></div>
              <div className="h-4 w-28 bg-white/[0.05] rounded-md animate-pulse"></div>
            </div>
          </td>
          <td className="py-4 px-4">
            <div className="h-4 w-52 bg-white/[0.05] rounded-md animate-pulse"></div>
          </td>
          <td className="py-4 px-4 text-center">
            <div className="inline-block h-5 w-14 bg-white/[0.05] rounded-md animate-pulse"></div>
          </td>
          <td className="py-4 px-4 text-center">
            <div className="inline-block h-4 w-16 bg-white/[0.05] rounded-md animate-pulse"></div>
          </td>
          <td className="py-4 px-4 text-right">
            <div className="inline-block h-5 w-14 bg-white/[0.04] rounded-md animate-pulse"></div>
          </td>
        </tr>
      ))}
    </>
  );
}

// Subcomponent for Drawer Metadata row
function DetailMetadataRow({ label, value, isHighlight }: { label: string, value: string, isHighlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-3">
      <span className="text-[12px] text-white/40 font-medium">{label}</span>
      <span className={`text-[12px] font-mono font-medium truncate max-w-[280px] ${
        isHighlight ? 'text-[#FF453A] font-bold' : 'text-white/80'
      }`}>
        {value}
      </span>
    </div>
  );
}

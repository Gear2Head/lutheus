import { useEffect, useState, useMemo } from 'react';
import { Search, RefreshCw, Filter, CheckCircle2, XCircle, ExternalLink, Zap } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { CaseIdBadge } from '../components/ui/CaseIdBadge';
import { CopyButton } from '../components/ui/CopyButton';
import { StatusBadge, type StatusKind } from '../components/ui/StatusBadge';
import { ValidDurationsPanel } from '../components/ui/ValidDurationsPanel';
import { buildSapphireCaseUrl } from '../lib/sapphireUrl';
import { Skeleton } from '../components/ui/Skeleton';
import { Drawer } from '../components/ui/Drawer';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { EmptyState } from '../components/ui/EmptyState';
import { getCases, getStaffProfiles, SapphireCase, StaffProfile, bulkUpdateVerdict, updateCaseVerdict } from '../lib/supabase';
import { validateCase } from '../lib/cukEngine';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '../lib/auth';
import { formatDate, minutesToHuman, relativeTime, parseDateSafe } from '../lib/utils';
import { useToast } from '../contexts/ToastContext';
import { resolveStaffName } from '../lib/staffDisplay';

type Verdict = 'all' | 'valid' | 'invalid' | 'pending';
type Period = 'all' | 'today' | 'week' | 'month';

function getDrawerPosition(): 'right' | 'center' {
  return (localStorage.getItem('panelStyle') || 'side') === 'center' ? 'center' : 'right';
}

function verdictToStatus(verdict: string): StatusKind {
  if (verdict === 'valid') return 'valid';
  if (verdict === 'invalid') return 'invalid';
  return 'pending';
}

function openSapphireCase(c: SapphireCase, showToast: (msg: string, type: 'success' | 'error' | 'info') => void) {
  const url = buildSapphireCaseUrl(c.guild_id, c.case_id) || c.case_url;
  if (!url) {
    showToast('Sapphire URL üretilemedi', 'error');
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

function isFormerStaff(profile: StaffProfile | undefined): boolean {
  if (!profile) return false;
  return profile.role === 'eski_yetkili' || profile.status === 'INACTIVE';
}

export default function Cases() {
  const { session } = useAuth();
  const location = useLocation();
  const { showToast } = useToast();
  const canEdit = hasPermission(session?.role || '', 'penalties:update');

  const [cases, setCases] = useState<SapphireCase[]>([]);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  type SortOrder = 'desc' | 'asc';

  const [search, setSearch] = useState('');
  const [verdictFilter, setVerdictFilter] = useState<Verdict>('all');
  const [periodFilter, setPeriodFilter] = useState<Period>('week');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawerCase, setDrawerCase] = useState<SapphireCase | null>(null);
  const [confirmBulk, setConfirmBulk] = useState<'valid' | 'invalid' | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [caseUpdating, setCaseUpdating] = useState<string | null>(null);

  const loadData = async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const [casesData, staffData] = await Promise.all([getCases(300), getStaffProfiles()]);
      setCases(casesData);
      setStaff(staffData);
      if (refresh) showToast('Cezalar basariyla guncellendi', 'success');
    } catch (err) {
      showToast('Cezalar yuklenirken bir hata olustu', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const staffMap = useMemo(() => {
    const map = new Map<string, StaffProfile>();
    for (const sp of staff) {
      map.set(sp.discord_id, sp);
    }
    return map;
  }, [staff]);

  const getModName = (discordId: string, defaultName: string) => {
    const profile = staffMap.get(discordId);
    return resolveStaffName(profile, {
      author_discord_id: discordId,
      author_display_name: defaultName,
    } as SapphireCase);
  };

  useEffect(() => { loadData(); }, []);

  // Pre-fill search filter from routing state if present
  useEffect(() => {
    const state = location.state as { search?: string } | null;
    if (state?.search) {
      setSearch(state.search);
      // Clean up state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Auto-run CUK on cases that are still pending
  const runAutoValidate = async () => {
    const pending = cases.filter((c) => c.cuk_verdict === 'pending');
    showToast(`${pending.length} bekleyen ceza dogrulaniyor...`, 'info');
    try {
      for (const c of pending) {
        const durationMins = c.duration_ms ? Math.floor(c.duration_ms / 60000) : 0;
        const result = validateCase(c.reason_raw, durationMins);
        const verdict = result.valid ? 'valid' : 'invalid';
        await updateCaseVerdict(c.case_id, verdict, {
          message: result.message,
          category: result.categoryMatched || 'Diger',
          score: result.score,
        });
      }
      showToast('Bekleyen tum cezalar basariyla dogrulandi', 'success');
      loadData(true);
    } catch {
      showToast('Dogrulama islemi sirasinda hata olustu', 'error');
    }
  };

  const filtered = useMemo(() => {
    const now = new Date();
    
    // Compute exact start limits
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOf7DaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const startOf30DaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    
    return cases
      .filter((c) => {
        // Date / Period Filter based on Sapphire penalty creation timestamp
        if (periodFilter !== 'all') {
          const t = parseDateSafe(c.created_at_sapphire).getTime();
          if (isNaN(t)) return false;
          
          if (periodFilter === 'today' && t < startOfToday) return false;
          if (periodFilter === 'week' && t < startOf7DaysAgo) return false;
          if (periodFilter === 'month' && t < startOf30DaysAgo) return false;
        }
        
        // Verdict Filter
        if (verdictFilter !== 'all' && c.cuk_verdict !== verdictFilter) return false;
        
        // Search Filter
        if (search) {
          const s = search.toLowerCase();
          const authorName = getModName(c.author_discord_id, c.author_display_name).toLowerCase();
          const authorId = (c.author_discord_id || '').toLowerCase();
          const targetName = (c.punished_user_display_name || '').toLowerCase();
          const targetId = (c.punished_user_discord_id || '').toLowerCase();
          const reason = (c.reason_raw || '').toLowerCase();
          
          const match = (c.case_id || '').toLowerCase().includes(s)
            || authorName.includes(s)
            || authorId.includes(s)
            || targetName.includes(s)
            || targetId.includes(s)
            || reason.includes(s);
            
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const timeA = parseDateSafe(a.created_at_sapphire).getTime();
        const timeB = parseDateSafe(b.created_at_sapphire).getTime();
        if (timeA !== timeB) {
          return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
        }
        return sortOrder === 'desc'
          ? b.case_id.localeCompare(a.case_id)
          : a.case_id.localeCompare(b.case_id);
      });
  }, [cases, periodFilter, verdictFilter, search, sortOrder]);

  const handleBulkAction = async () => {
    if (!confirmBulk) return;
    setBulkLoading(true);
    try {
      await bulkUpdateVerdict(Array.from(selectedIds), confirmBulk);
      const actionName = confirmBulk === 'valid' ? 'dogrulandi' : 'reddedildi';
      showToast(`${selectedIds.size} adet ceza basariyla ${actionName}`, 'success');
      setSelectedIds(new Set());
      await loadData(true);
    } catch {
      showToast('Toplu islem gerceklestirilirken hata olustu', 'error');
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
        category: result.categoryMatched || 'Diger',
        score: result.score,
      });
      const actionName = verdict === 'valid' ? 'dogrulandi' : 'hatali olarak isaretlendi';
      showToast(`Case #${c.case_id} ${actionName}`, 'success');
      setCases((prev) => prev.map((p) => p.case_id === c.case_id ? { ...p, cuk_verdict: verdict } : p));
      setDrawerCase(null);
    } catch {
      showToast('Islem kaydedilirken bir hata olustu', 'error');
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

  const pending = cases.filter((c) => c.cuk_verdict === 'pending').length;

  return (
    <div className="space-y-5 animate-in pb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Son Cezalar</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} kayıt</p>
        </div>
        <div className="flex gap-2">
          {pending > 0 && canEdit && (
            <Button variant="ghost" size="sm" onClick={runAutoValidate}>
              <Zap className="w-3.5 h-3.5" /> {pending} Bekleyeni Dogrula
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing}>
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Case ID, yetkili veya sebep..."
              className="h-9 w-full pl-9 pr-3 rounded-[12px] bg-secondary/50 border border-border/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground"
            />
          </div>
          <select
            value={periodFilter}
            onChange={(e) => {
              setPeriodFilter(e.target.value as Period);
              showToast(`Tarih filtresi guncellendi`, 'info');
            }}
            className="h-9 px-3 rounded-[12px] bg-secondary/30 border-2 border-border/50 focus:border-primary text-sm text-foreground focus:outline-none transition-colors"
          >
            <option value="today">Bugün</option>
            <option value="week">Bu Hafta</option>
            <option value="month">Bu Ay</option>
            <option value="all">Tümü</option>
          </select>
          <select
            value={sortOrder}
            onChange={(e) => {
              setSortOrder(e.target.value as SortOrder);
              showToast(`Siralama degistirildi`, 'info');
            }}
            className="h-9 px-3 rounded-[12px] bg-secondary/30 border-2 border-border/50 focus:border-primary text-sm text-foreground focus:outline-none transition-colors"
          >
            <option value="desc">Tarih: En Yakın (Yeni)</option>
            <option value="asc">Tarih: En Uzak (Eski)</option>
          </select>
          {(['all', 'valid', 'invalid', 'pending'] as Verdict[]).map((v) => (
            <button
              key={v}
              onClick={() => {
                setVerdictFilter(v);
                showToast(`Durum filtresi: ${v === 'all' ? 'Tumu' : v === 'valid' ? 'Dogru' : v === 'invalid' ? 'Hatali' : 'Bekleyen'} secildi`, 'info');
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 border-2 ${
                verdictFilter === v
                  ? 'bg-primary/10 text-primary border-primary shadow-[0_0_10px_rgba(124,58,237,0.2)] scale-105'
                  : 'bg-secondary/40 text-muted-foreground border-border/50 hover:bg-secondary/80 hover:text-foreground'
              }`}
            >
              {v === 'all' ? 'Tümü' : v === 'valid' ? 'Doğru' : v === 'invalid' ? 'Hatalı' : 'Bekleyen'}
            </button>
          ))}
        </div>
      </Card>

      {/* Bulk toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/10 border border-primary/20 rounded-2xl animate-in">
          <span className="text-sm font-semibold text-primary">{selectedIds.size} seçildi</span>
          <Button size="sm" variant="ghost" className="text-emerald-400 hover:bg-emerald-500/10" onClick={() => setConfirmBulk('valid')}>
            <CheckCircle2 className="w-3.5 h-3.5" /> Onayla
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setConfirmBulk('invalid')}>
            <XCircle className="w-3.5 h-3.5" /> Reddet
          </Button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors">
            Temizle
          </button>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="py-3 px-4 w-10">
                  {canEdit && (
                    <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleAll} className="rounded" />
                  )}
                </th>
                <th className="py-3 px-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">ID</th>
                <th className="py-3 px-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Yetkili</th>
                <th className="py-3 px-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Sebep</th>
                <th className="py-3 px-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Süre</th>
                <th className="py-3 px-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Tarih</th>
                <th className="py-3 px-4 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Durum</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="py-3 px-4" />
                    <td className="py-3 px-3"><Skeleton className="h-4 w-12" /></td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <Skeleton className="w-7 h-7 rounded-full shrink-0" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    </td>
                    <td className="py-3 px-3"><Skeleton className="h-4 w-36" /></td>
                    <td className="py-3 px-3"><Skeleton className="h-4 w-16" /></td>
                    <td className="py-3 px-3"><Skeleton className="h-4 w-16" /></td>
                    <td className="py-3 px-4 text-center"><Skeleton className="h-5 w-14 rounded-full mx-auto" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState icon={<Filter className="w-6 h-6" />} title="Kayıt yok" description="Filtrelerinizi değiştirin." />
                  </td>
                </tr>
              ) : filtered.map((c) => (
                <tr
                  key={c.case_id}
                  onClick={() => setDrawerCase(c)}
                  className={`border-b border-border/30 hover:bg-secondary/20 cursor-pointer transition-colors ${
                    c.cuk_verdict === 'invalid'
                      ? 'bg-red-500/10 hover:bg-red-500/20 text-red-200 border-red-500/20'
                      : ''
                  }`}
                >
                  <td className={`py-3 px-4 ${c.cuk_verdict === 'invalid' ? 'border-l-4 border-l-red-500' : ''}`} onClick={(e) => e.stopPropagation()}>
                    {canEdit && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.case_id)}
                        onChange={() => toggleSelect(c.case_id)}
                        className="rounded"
                      />
                    )}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <CaseIdBadge
                      caseId={c.case_id}
                      type={c.type}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDrawerCase(c);
                      }}
                    />
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <img src={c.author_avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.author_discord_id}`} alt="" className="w-7 h-7 rounded-full bg-secondary" />
                      <span className={`font-medium ${c.cuk_verdict === 'invalid' ? 'text-red-200' : 'text-foreground'}`}>{getModName(c.author_discord_id, c.author_display_name)}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 max-w-[200px]">
                    <span className={`truncate block text-xs ${c.cuk_verdict === 'invalid' ? 'text-red-300 font-medium' : 'text-muted-foreground'}`}>{c.reason_raw || '—'}</span>
                  </td>
                  <td className={`py-3 px-3 text-xs whitespace-nowrap ${c.cuk_verdict === 'invalid' ? 'text-red-300 font-medium' : 'text-muted-foreground'}`}>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-block w-2 h-2 rounded-full shrink-0 ${c.is_open ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse-dot' : 'bg-destructive/60'}`}
                        title={c.is_open ? 'Aktif Cezalandırma' : 'Süresi Bitti / Kaldırıldı'}
                      />
                      <span>{c.is_permanent ? 'Kalıcı' : minutesToHuman(Math.floor((c.duration_ms || 0) / 60000))}</span>
                    </div>
                  </td>
                  <td className={`py-3 px-3 text-xs whitespace-nowrap ${c.cuk_verdict === 'invalid' ? 'text-red-300 font-medium' : 'text-muted-foreground'}`}>
                    {relativeTime(c.created_at_sapphire)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <StatusBadge status={verdictToStatus(c.cuk_verdict)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Case Drawer */}
      {drawerCase && (
        <Drawer
          isOpen={true}
          onClose={() => setDrawerCase(null)}
          title=""
          position={getDrawerPosition()}
        >
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <CaseIdBadge
                caseId={drawerCase.case_id}
                type={drawerCase.type}
                onClick={() => openSapphireCase(drawerCase, showToast)}
              />
              <StatusBadge status={verdictToStatus(drawerCase.cuk_verdict)} />
              <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">{drawerCase.type}</span>
            </div>

            {/* Punished user */}
            <div className="p-4 rounded-2xl bg-secondary/30 border border-border/50">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Cezalı Kullanıcı</div>
              <div className="flex items-center gap-3">
                <img src={drawerCase.punished_user_avatar_url} alt="" className="w-10 h-10 rounded-full bg-secondary" />
                <div>
                  <div className="font-semibold text-sm text-foreground">{drawerCase.punished_user_display_name}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">{drawerCase.punished_user_discord_id}</span>
                    {drawerCase.punished_user_discord_id && (
                      <CopyButton
                        value={drawerCase.punished_user_discord_id}
                        label="Discord ID kopyala"
                        onError={() => showToast('Kopyalanamadı', 'error')}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Author */}
            <div className="p-4 rounded-2xl bg-secondary/30 border border-border/50">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Cezalandıran Yetkili</div>
              <div className="flex items-center gap-3">
                <img src={drawerCase.author_avatar_url} alt="" className="w-10 h-10 rounded-full bg-secondary" />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold text-sm text-foreground">
                      {getModName(drawerCase.author_discord_id, drawerCase.author_display_name)}
                    </div>
                    {isFormerStaff(staffMap.get(drawerCase.author_discord_id)) && (
                      <StatusBadge status="stale" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">{drawerCase.author_discord_id}</span>
                    {drawerCase.author_discord_id && (
                      <CopyButton
                        value={drawerCase.author_discord_id}
                        label="Yetkili Discord ID kopyala"
                        onError={() => showToast('Kopyalanamadı', 'error')}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Details */}
            <ValidDurationsPanel caseData={drawerCase} />

            <div className="space-y-3">
              <DetailRow label="Sebep" value={drawerCase.reason_raw || '—'} tone="neutral" />
              <DetailRow
                label="Süre"
                value={drawerCase.is_permanent ? 'Kalıcı' : minutesToHuman(Math.floor((drawerCase.duration_ms || 0) / 60000))}
                tone={drawerCase.cuk_verdict === 'invalid' ? 'danger' : drawerCase.cuk_verdict === 'valid' ? 'success' : 'warning'}
              />
              <DetailRow label="Tarih" value={formatDate(drawerCase.created_at_sapphire)} tone="neutral" />
              {drawerCase.cuk_analysis && (
                <>
                  <DetailRow label="CUK Kategori" value={drawerCase.cuk_analysis.category} tone="neutral" />
                  <DetailRow
                    label="CUK Mesaj"
                    value={drawerCase.cuk_analysis.message}
                    tone={
                      drawerCase.cuk_verdict === 'invalid'
                        ? 'danger'
                        : drawerCase.cuk_verdict === 'valid'
                          ? 'success'
                          : 'warning'
                    }
                  />
                </>
              )}
            </div>

            {/* Actions */}
            {canEdit && (
              <div className="space-y-2 pt-4 border-t border-border/50">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-emerald-400 hover:bg-emerald-500/10"
                    onClick={() => handleSingleVerdict(drawerCase, 'valid')}
                    disabled={caseUpdating === drawerCase.case_id}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Dogru
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-destructive hover:bg-destructive/10"
                    onClick={() => handleSingleVerdict(drawerCase, 'invalid')}
                    disabled={caseUpdating === drawerCase.case_id}
                  >
                    <XCircle className="w-3.5 h-3.5" /> Hatalı
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => openSapphireCase(drawerCase, showToast)}
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Sapphire&apos;da Aç
                </Button>
              </div>
            )}
          </div>
        </Drawer>
      )}

      {/* Bulk confirm */}
      <ConfirmationModal
        isOpen={confirmBulk !== null}
        onClose={() => setConfirmBulk(null)}
        onConfirm={handleBulkAction}
        title={`${selectedIds.size} kayıt toplu ${confirmBulk === 'valid' ? 'onaylanacak' : 'reddedilecek'}`}
        description="Bu işlem seçili tüm cezaların durumunu değiştirecek ve Supabase'e yazılacak."
        confirmText={confirmBulk === 'valid' ? 'Onayla' : 'Reddet'}
        danger={confirmBulk === 'invalid'}
        loading={bulkLoading}
      />
    </div>
  );
}

function DetailRow({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'success' | 'danger' | 'warning' | 'neutral';
}) {
  const toneClass =
    tone === 'success'
      ? 'text-emerald-400'
      : tone === 'danger'
        ? 'text-red-400'
        : tone === 'warning'
          ? 'text-amber-400'
          : 'text-foreground';
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className={`text-xs text-right leading-relaxed ${toneClass}`}>{value}</span>
    </div>
  );
}

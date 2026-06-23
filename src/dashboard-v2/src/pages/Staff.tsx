import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, RefreshCw, User, ShieldCheck, Plus, X, ArrowUpRight, ArrowDownRight, UserMinus, UserCheck, AlertTriangle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { Drawer } from '../components/ui/Drawer';
import { CopyButton } from '../components/ui/CopyButton';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { getCases, getStaffProfiles, SapphireCase, StaffProfile, updateStaffProfile, getStaffWarnings, addStaffWarning, deleteStaffWarning, StaffWarning } from '../lib/supabase';
import { validateCase, getReliabilityStatus, calculatePerformanceScore } from '../lib/cukEngine';
import { getRoleLabel, getRoleColor, hasPermission, isManagementRole, isManagementKadrosu } from '../lib/auth';
import { formatDate } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { formatStaffName, isGenericStaffName, resolveStaffAvatar, resolveStaffName } from '../lib/staffDisplay';

function getDrawerPosition(): 'right' | 'center' {
  return (localStorage.getItem('panelStyle') || 'side') === 'center' ? 'center' : 'right';
}

interface StaffWithStats {
  profile: StaffProfile | null;
  discordId: string;
  name: string;
  avatar: string;
  role: string;
  total: number;
  valid: number;
  invalid: number;
  pending: number;
  accuracy: number;
  score: number;
  reliability: string;
  recentCases: SapphireCase[];
}

export default function Staff() {
  const { session } = useAuth();
  const location = useLocation();
  const [cases, setCases] = useState<SapphireCase[]>([]);
  const [profiles, setProfiles] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<StaffWithStats | null>(null);

  // Local additions/modifications buffering
  const [bufferedChanges, setBufferedChanges] = useState<Record<string, Partial<StaffProfile>>>({});
  const [shakeBanner, setShakeBanner] = useState(false);
  const [flashRed, setFlashRed] = useState(false);

  // Ekle (Add Staff) modal state
  const [addOpen, setAddOpen] = useState(false);
  const [newDiscordId, setNewDiscordId] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('discord_moderatoru');
  const [savingNewStaff, setSavingNewStaff] = useState(false);

  const canManageStaff = session ? hasPermission(session.role, 'staff:update') : false;
  const isSelfManagement = session ? isManagementKadrosu(session.role) : false;
  const isDirty = Object.keys(bufferedChanges).length > 0;

  const [warnings, setWarnings] = useState<StaffWarning[]>([]);
  const [warningsLoading, setWarningsLoading] = useState(false);
  const [newWarningReason, setNewWarningReason] = useState('');
  const [newWarningPoints, setNewWarningPoints] = useState(1);
  const [newWarningMgmtNotes, setNewWarningMgmtNotes] = useState('');
  const [submittingWarning, setSubmittingWarning] = useState(false);
  const [showAddWarning, setShowAddWarning] = useState(false);

  useEffect(() => {
    setShowAddWarning(false);
    if (!selected) {
      setWarnings([]);
      return;
    }
    const targetDiscordId = selected.discordId;
    async function loadWarnings() {
      setWarningsLoading(true);
      try {
        const data = await getStaffWarnings(targetDiscordId);
        setWarnings(data);
      } catch (err) {
        console.error('Failed to load staff warnings:', err);
      } finally {
        setWarningsLoading(false);
      }
    }
    loadWarnings();
  }, [selected]);

  useEffect(() => {
    window.__lutheus_is_dirty = isDirty;
    return () => {
      window.__lutheus_is_dirty = false;
    };
  }, [isDirty]);

  // Alert/Banner feedback listener to trigger visual indicators from AppLayout intercept
  useEffect(() => {
    const handleDirtyNav = () => {
      setShakeBanner(true);
      setFlashRed(true);
      setTimeout(() => setShakeBanner(false), 500);
      setTimeout(() => setFlashRed(false), 2000);
    };
    window.addEventListener('lutheus-dirty-navigate', handleDirtyNav);
    return () => window.removeEventListener('lutheus-dirty-navigate', handleDirtyNav);
  }, []);

  // SECTION: STAFF_PROFILE_SYNC
  // PURPOSE: Eksik veya generic isimli yetkili profillerini gerçek case adı ve avatarı ile eşitler.
  const syncMissingProfiles = async (casesList: SapphireCase[], profilesList: StaffProfile[]) => {
    const existingProfiles = new Map(profilesList.map(p => [p.discord_id, p]));
    const missingProfiles: { discord_id: string, display_name: string, staff_rank: string, is_active_staff: boolean, access_status?: string, source_flags?: string[] }[] = [];
    const profileUpdates: { discord_id: string; display_name?: string; avatar_url?: string }[] = [];
    
    for (const c of casesList) {
      const id = c.author_discord_id;
      if (!id) continue;
      const displayName = formatStaffName(c.author_display_name, id);
      const hasRealCaseName = !isGenericStaffName(c.author_display_name, id);
      const existing = existingProfiles.get(id);

      if (!existing) {
        if (!missingProfiles.some(mp => mp.discord_id === id)) {
          // SECTION: SAPPHIRE_AUTHOR_PENDING
          // PURPOSE: Sapphire-detected case authors must NOT be approved/active automatically.
          // They are inserted as pending/unapproved with sapphire-author source flag.
          missingProfiles.push({
            discord_id: id,
            display_name: displayName,
            staff_rank: 'pending',
            is_active_staff: false,
            access_status: 'pending',
            source_flags: ['sapphire-author']
          });
        }
        continue;
      }

      const needsName = hasRealCaseName && isGenericStaffName(existing.in_game_name || existing.username, id);
      const needsAvatar = Boolean(c.author_avatar_url && !existing.avatar_url);
      if ((needsName || needsAvatar) && !profileUpdates.some((item) => item.discord_id === id)) {
        profileUpdates.push({
          discord_id: id,
          ...(needsName ? { display_name: displayName } : {}),
          ...(needsAvatar ? { avatar_url: c.author_avatar_url } : {}),
        });
      }
    }
    
    if (missingProfiles.length > 0 || profileUpdates.length > 0) {
      console.log(`[Lutheus] Syncing ${missingProfiles.length + profileUpdates.length} staff profiles...`);
      await Promise.all(missingProfiles.map(async (mp) => {
        try {
          // SECTION: ADMIN_API_STAFF_SYNC
          // PURPOSE: Missing profile writes go through updateStaffProfile (upsert), not raw POST.
          // access_status is kept pending; admin must manually approve.
          await updateStaffProfile(mp.discord_id, {
            discord_id: mp.discord_id,
            display_name: mp.display_name,
            staff_rank: mp.staff_rank,
            is_active_staff: mp.is_active_staff,
            access_status: mp.access_status,
            source_flags: mp.source_flags,
            updated_at: new Date().toISOString()
          });
        } catch (err) {
          console.warn('[Lutheus] Profile sync failed for', mp.discord_id, err);
        }
      }));
      await Promise.all(profileUpdates.map(async (update) => {
        try {
          const body: { display_name?: string; avatar_url?: string; updated_at: string } = { updated_at: new Date().toISOString() };
          if (update.display_name) body.display_name = update.display_name;
          if (update.avatar_url) body.avatar_url = update.avatar_url;
          await updateStaffProfile(update.discord_id, body);
        } catch (err) {
          console.warn('[Lutheus] Profile update failed for', update.discord_id, err);
        }
      }));
      // Reload profiles list
      const p = await getStaffProfiles();
      setProfiles(p);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([getCases(500), getStaffProfiles()]);
      setCases(c);
      setProfiles(p);
      syncMissingProfiles(c, p).catch(console.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Overlay buffered modifications onto real profiles locally
  const mergedProfiles = useMemo<StaffProfile[]>(() => {
    return profiles.map((p) => {
      const changes = bufferedChanges[p.discord_id];
      if (changes) {
        return {
          ...p,
          ...changes,
        } as StaffProfile;
      }
      return p;
    });
  }, [profiles, bufferedChanges]);

  // Aggregate stats from local cases + merged profiles
  const staffList = useMemo<StaffWithStats[]>(() => {
    const map = new Map<string, StaffWithStats>();

    // Pre-populate from real/modified profiles
    for (const p of mergedProfiles) {
      map.set(p.discord_id, {
        profile: p,
        discordId: p.discord_id,
        name: resolveStaffName(p, null),
        avatar: p.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.discord_id}`,
        role: p.role,
        total: 0, valid: 0, invalid: 0, pending: 0, accuracy: 0, score: 0,
        reliability: 'Bekleyen',
        recentCases: [],
      });
    }

    // Aggregate from cases
    for (const c of cases) {
      const id = c.author_discord_id;
      if (!id) continue;
      if (!map.has(id)) {
        map.set(id, {
          profile: null,
          discordId: id,
          name: resolveStaffName(null, c),
          avatar: resolveStaffAvatar(null, c, id),
          role: 'discord_moderatoru',
          total: 0, valid: 0, invalid: 0, pending: 0, accuracy: 0, score: 0,
          reliability: 'Bekleyen',
          recentCases: [],
        });
      }
      const s = map.get(id)!;
      // Sync names from cases when profile is missing or display name is fallback
      if (isGenericStaffName(s.name, id) && !isGenericStaffName(c.author_display_name, id)) {
        s.name = formatStaffName(c.author_display_name, id);
      }
      if (c.author_avatar_url && s.avatar.includes('dicebear.com')) {
        s.avatar = c.author_avatar_url;
      }
      s.total++;
      if (c.cuk_verdict === 'valid') s.valid++;
      else if (c.cuk_verdict === 'invalid') s.invalid++;
      else s.pending++;
      s.recentCases.push(c);
    }

    for (const s of map.values()) {
      s.accuracy = s.total > 0 ? Math.round((s.valid / s.total) * 100) : 0;
      s.score = calculatePerformanceScore(s.valid, s.invalid, s.pending);
      s.reliability = getReliabilityStatus(s.valid, s.invalid);
      s.recentCases = s.recentCases.slice(0, 5);
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [cases, mergedProfiles]);

  const filtered = useMemo(() =>
    staffList.filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()))
  , [staffList, search]);

  // Pre-fill drawer selection from router state
  useEffect(() => {
    const state = location.state as { discordId?: string } | null;
    if (!loading && state?.discordId) {
      const targetId = state.discordId;
      const found = staffList.find((s) => s.discordId === targetId);
      if (found) {
        setSelected(found);
      }
      // Clean up state
      window.history.replaceState({}, document.title);
    }
  }, [loading, location.state, staffList]);

  const triggerShakingAlarm = () => {
    setShakeBanner(true);
    setFlashRed(true);
    if (navigator.vibrate) {
      navigator.vibrate([80, 40, 80]);
    }
    setTimeout(() => setShakeBanner(false), 500);
    setTimeout(() => setFlashRed(false), 2500);
  };

  const handleCloseDrawer = () => {
    setSelected(null);
  };

  const handleAddWarning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !session) return;
    if (!newWarningReason.trim()) return;

    setSubmittingWarning(true);
    try {
      await addStaffWarning({
        staff_discord_id: selected.discordId,
        reason: newWarningReason,
        points: newWarningPoints,
        created_by: session.profile.displayName || session.profile.username || 'Yönetim',
        management_notes: newWarningMgmtNotes.trim() || null,
      });
      setNewWarningReason('');
      setNewWarningPoints(1);
      setNewWarningMgmtNotes('');
      // Reload warnings list
      const data = await getStaffWarnings(selected.discordId);
      setWarnings(data);
    } catch (err: any) {
      alert(`Uyarı eklenirken hata: ${err.message || err}`);
    } finally {
      setSubmittingWarning(false);
    }
  };

  const handleDeleteWarning = async (id: string) => {
    if (!selected || !window.confirm('Bu uyarıyı silmek istediğinize emin misiniz?')) return;
    try {
      await deleteStaffWarning(id);
      setWarnings(prev => prev.filter(w => w.id !== id));
    } catch (err: any) {
      alert(`Uyarı silinirken hata: ${err.message || err}`);
    }
  };

  const handleToggleActiveStatus = () => {
    if (!selected || !selected.profile) return;
    const currentActive = selected.profile.status === 'ACTIVE';
    const nextStatus = currentActive ? 'INACTIVE' : 'ACTIVE';
    
    // Buffer change locally
    setBufferedChanges(prev => ({
      ...prev,
      [selected.discordId]: {
        ...prev[selected.discordId],
        status: nextStatus,
        is_active_staff: nextStatus === 'ACTIVE'
      } as Partial<StaffProfile>
    }));

    // Update locally in selected item so drawer is reactive
    setSelected(prev => {
      if (!prev) return null;
      return {
        ...prev,
        profile: {
          ...prev.profile,
          status: nextStatus,
          is_active_staff: nextStatus === 'ACTIVE'
        } as StaffProfile
      };
    });
  };

  const handleChangeRole = (newRole: string) => {
    if (!selected) return;

    // Buffer change
    setBufferedChanges(prev => ({
      ...prev,
      [selected.discordId]: {
        ...prev[selected.discordId],
        staff_rank: newRole,
        role: newRole
      } as Partial<StaffProfile>
    }));

    // Reactive update drawer
    setSelected(prev => {
      if (!prev) return null;
      return {
        ...prev,
        role: newRole
      };
    });
  };

  const handleStepRank = (direction: 'up' | 'down') => {
    if (!selected) return;
    const ranks = ['eski_yetkili', 'discord_destek_ekibi', 'discord_moderatoru', 'kidemli_discord_moderatoru', 'senior_moderator', 'discord_yoneticisi', 'yonetici', 'admin', 'kurucu'];
    const idx = ranks.indexOf(selected.role);
    if (direction === 'up' && idx < ranks.length - 1) {
      handleChangeRole(ranks[idx + 1]);
    } else if (direction === 'down' && idx > 0) {
      handleChangeRole(ranks[idx - 1]);
    }
  };

  const handleSaveChanges = async () => {
    setSavingNewStaff(true);
    try {
      const promises = Object.entries(bufferedChanges).map(([id, updates]) => {
        // Direct REST sync
        return updateStaffProfile(id, updates);
      });
      await Promise.all(promises);
      setBufferedChanges({});
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingNewStaff(false);
    }
  };

  const handleResetChanges = () => {
    setBufferedChanges({});
  };

  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDiscordId.trim() || !newDisplayName.trim()) return;
    setSavingNewStaff(true);
    try {
      // Upsert profile in staff_profiles first
      await updateStaffProfile(newDiscordId.trim(), {
        discord_id: newDiscordId.trim(),
        display_name: newDisplayName.trim(),
        in_game_name: newDisplayName.trim(),
        staff_rank: newStaffRole,
        is_active_staff: true,
        status: 'ACTIVE'
      });
      setNewDiscordId('');
      setNewDisplayName('');
      setAddOpen(false);
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingNewStaff(false);
    }
  };

  const reliabilityColor = (r: string) =>
    r === 'Guvenilir' ? 'text-emerald-400' : r === 'Riskli' ? 'text-red-500' : 'text-amber-400';

  const reliabilityVariant = (r: string): 'success' | 'destructive' | 'warning' | 'default' =>
    r === 'Guvenilir' ? 'success' : r === 'Riskli' ? 'destructive' : 'warning';

  return (
    <div className="p-6 md:p-8 w-full space-y-6 md:space-y-8 select-none text-left animate-in pb-20 relative">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Yetkili Listesi</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} yetkili</p>
        </div>
        <div className="flex gap-2">
          {canManageStaff && (
            <Button onClick={() => setAddOpen(true)} size="sm" className="bg-primary hover:bg-primary/95 text-primary-foreground font-bold">
              <Plus className="w-4 h-4" /> Yetkili Ekle
            </Button>
          )}
          <button onClick={() => loadData()} className="flex items-center gap-2 px-3 py-2 rounded-[12px] bg-secondary/50 border border-border/50 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Yenile
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Yetkili ara..."
          className="h-9 w-full pl-9 pr-3 rounded-[12px] bg-card border border-border/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground"
        />
      </div>

      {/* Grid */}
      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="w-12 h-12 rounded-2xl" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-1.5" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="h-16 w-full rounded-xl" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<User className="w-6 h-6" />} title="Yetkili bulunamadı" />
      ) : (() => {
        const isSelfManagement = session ? isManagementKadrosu(session.role) : false;

        const activeManagement = filtered.filter((s) => s.role !== 'eski_yetkili' && isManagementKadrosu(s.role));
        const activeStaff = filtered.filter((s) => s.role !== 'eski_yetkili' && !isManagementKadrosu(s.role));
        const formerStaff = filtered.filter((s) => s.role === 'eski_yetkili');
        
        const renderStaffCard = (s: StaffWithStats) => {
          const roleColor = getRoleColor(s.role);
          const roleLabel = getRoleLabel(s.role);
          const isModified = !!bufferedChanges[s.discordId];
          const isTargetManagement = isManagementKadrosu(s.role);
          const hidePerformance = isTargetManagement && !isSelfManagement;

          return (
            <Card
              key={s.discordId}
              onClick={() => setSelected(s)}
              className={`p-5 cursor-pointer hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 group relative overflow-hidden ${isModified ? 'border-primary/40 bg-primary/[0.02]' : ''}`}
            >
              {isModified && (
                <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-primary" title="Kaydedilmemiş yerel değişiklik" />
              )}
              <div className="flex items-start gap-3 mb-4">
                <div className="relative">
                  <img
                    src={s.avatar}
                    alt=""
                    className="w-12 h-12 rounded-2xl bg-secondary object-cover"
                  />
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${s.profile?.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-muted'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">{s.name}</div>
                  <div className="text-[10px] text-muted-foreground/80 font-mono mt-0.5 truncate" title={s.discordId}>ID: {s.discordId}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: roleColor }}>{roleLabel}</div>
                </div>
                {!hidePerformance && (
                  <Badge variant={reliabilityVariant(s.reliability)} className="shrink-0 text-[10px]">
                    {s.reliability}
                  </Badge>
                )}
              </div>

              {!hidePerformance ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 rounded-xl bg-secondary/40 border border-border/50">
                      <div className="text-lg font-bold text-foreground">{s.total}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Toplam</div>
                    </div>
                    <div className="text-center p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <div className="text-lg font-bold text-emerald-400">{s.valid}</div>
                      <div className="text-[10px] text-emerald-500/80 font-medium mt-0.5">Doğru</div>
                    </div>
                    <div className="text-center p-2 rounded-xl bg-red-500/10 border border-red-500/20">
                      <div className="text-lg font-bold text-red-400">{s.invalid}</div>
                      <div className="text-[10px] text-red-500/80 font-medium mt-0.5">Hatalı</div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">Doğruluk</span>
                      <span className={`font-bold ${reliabilityColor(s.reliability)}`}>%{s.accuracy}</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${s.accuracy >= 70 ? 'bg-emerald-500' : s.accuracy >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${s.accuracy}%` }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center p-4 rounded-xl bg-[#111112]/30 border border-white/[0.03] text-xs text-white/40 italic">
                  Performans verileri gizli
                </div>
              )}
            </Card>
          );
        };

        return (
          <div className="space-y-8">
            {/* Active Management */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-[#A259FE] uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-lg bg-[#A259FE]" />
                Yönetim Kadrosu ({activeManagement.length})
              </h2>
              {activeManagement.length === 0 ? (
                <div className="p-6 rounded-2xl border border-dashed border-border/50 text-center text-xs text-muted-foreground italic bg-secondary/10">
                  Kayıtlı yönetim yetkilisi bulunmamaktadır.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeManagement.map(renderStaffCard)}
                </div>
              )}
            </div>

            {/* Active Staff */}
            <div className="space-y-4 pt-6 border-t border-white/[0.04]">
              <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-lg bg-emerald-500" />
                Yetkili ve Destek Ekibi ({activeStaff.length})
              </h2>
              {activeStaff.length === 0 ? (
                <EmptyState icon={<User className="w-6 h-6" />} title="Aktif yetkili bulunamadı" />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeStaff.map(renderStaffCard)}
                </div>
              )}
            </div>

            {/* Former Staff */}
            <div className="space-y-4 pt-6 border-t border-white/[0.04]">
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-lg bg-slate-500" />
                Eski Yetkililer ({formerStaff.length})
              </h2>
              {formerStaff.length === 0 ? (
                <div className="p-6 rounded-2xl border border-dashed border-border/50 text-center text-xs text-muted-foreground italic bg-secondary/10">
                  Kayıtlı eski yetkili bulunmamaktadır.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {formerStaff.map(renderStaffCard)}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Staff Detail Drawer */}
      {selected && (
        <Drawer isOpen={true} onClose={handleCloseDrawer} title={selected.name} position={getDrawerPosition()}>
          <div className="space-y-5">
            {/* Profile header */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-secondary/30 border border-border/50">
              <img src={selected.avatar} alt="" className="w-14 h-14 rounded-2xl bg-secondary object-cover" />
              <div>
                <div className="font-bold text-base text-foreground">{selected.name}</div>
                <div className="text-xs font-bold uppercase tracking-wider mt-0.5" style={{ color: getRoleColor(selected.role) }}>
                  {getRoleLabel(selected.role)}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground font-mono">{selected.discordId}</span>
                  <CopyButton value={selected.discordId} label="Discord ID kopyala" />
                </div>
              </div>
            </div>

            {/* Management Actions Section */}
            {canManageStaff && (
              <div className="p-4 rounded-2xl bg-secondary/20 border border-border/50 space-y-3.5">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" /> Yetkili Yönetimi
                </div>

                {/* Status active/inactive toggler */}
                <div className="flex items-center justify-between py-1 border-b border-border/30 pb-2">
                  <span className="text-xs font-semibold text-foreground">Görev Durumu</span>
                  {selected.profile ? (
                    <button
                      onClick={handleToggleActiveStatus}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${selected.profile.status === 'ACTIVE' ? 'bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'}`}
                    >
                      {selected.profile.status === 'ACTIVE' ? (
                        <><UserMinus className="w-3.5 h-3.5" /> Yetki Al (Pasif)</>
                      ) : (
                        <><UserCheck className="w-3.5 h-3.5" /> Göreve Başlat (Aktif)</>
                      )}
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Profil DB'de bulunamadı</span>
                  )}
                </div>

                {/* Step Promote/Demote buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleStepRank('down')}
                    disabled={selected.role === 'discord_destek_ekibi'}
                    className="py-2 px-3 rounded-xl bg-secondary/60 border border-border/50 text-xs font-bold text-foreground hover:bg-secondary hover:text-primary transition-all disabled:opacity-40 flex items-center justify-center gap-1"
                  >
                    <ArrowDownRight className="w-3.5 h-3.5 text-muted-foreground" /> Rütbe Kıs
                  </button>
                  <button
                    onClick={() => handleStepRank('up')}
                    disabled={selected.role === 'kurucu'}
                    className="py-2 px-3 rounded-xl bg-primary/10 border border-primary/20 text-xs font-black text-primary hover:bg-primary/25 transition-all disabled:opacity-40 flex items-center justify-center gap-1"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 text-primary" /> Terfi Ettir (Promote)
                  </button>
                </div>

                {/* Direct rank selector */}
                <div className="space-y-1.5 pt-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Doğrudan Rol Belirle</label>
                  <select
                    value={selected.role}
                    onChange={(e) => handleChangeRole(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-xl bg-secondary/50 border border-border/50 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="eski_yetkili">Eski Yetkili</option>
                    <option value="discord_destek_ekibi">Discord Destek Ekibi</option>
                    <option value="discord_moderatoru">Discord Moderatörü</option>
                    <option value="kidemli_discord_moderatoru">Kıdemli Discord Moderatörü</option>
                    <option value="senior_moderator">Senior Moderatör</option>
                    <option value="discord_yoneticisi">Discord Yöneticisi</option>
                    <option value="yonetici">Yönetici</option>
                    <option value="admin">Admin</option>
                    <option value="kurucu">Kurucu</option>
                  </select>
                </div>

                {/* Last Promoted At input */}
                <div className="space-y-1.5 pt-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Son Terfi Tarihi</label>
                  <input
                    type="date"
                    value={selected.profile?.last_promoted_at ? selected.profile.last_promoted_at.slice(0, 10) : ''}
                    onChange={(e) => {
                      const dateVal = e.target.value ? new Date(e.target.value).toISOString() : null;
                      setBufferedChanges(prev => ({
                        ...prev,
                        [selected.discordId]: {
                          ...prev[selected.discordId],
                          last_promoted_at: dateVal
                        }
                      }));
                      setSelected(prev => prev ? {
                        ...prev,
                        profile: prev.profile ? { ...prev.profile, last_promoted_at: dateVal } : null
                      } : null);
                    }}
                    className="w-full h-9 px-2.5 rounded-xl bg-secondary/50 border border-border/50 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  />
                </div>

                {/* Management Comments text area */}
                <div className="space-y-1.5 pt-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Yönetim Görüşleri / Notları</label>
                  <textarea
                    value={selected.profile?.management_comments || ''}
                    placeholder="Yetkili hakkında görüşlerinizi yazın..."
                    onChange={(e) => {
                      const val = e.target.value;
                      setBufferedChanges(prev => ({
                        ...prev,
                        [selected.discordId]: {
                          ...prev[selected.discordId],
                          management_comments: val
                        }
                      }));
                      setSelected(prev => prev ? {
                        ...prev,
                        profile: prev.profile ? { ...prev.profile, management_comments: val } : null
                      } : null);
                    }}
                    className="w-full h-20 p-2.5 rounded-xl bg-secondary/50 border border-border/50 text-xs text-[#E4E4E6] focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>
              </div>
            )}

            {/* Stats */}
            {!(isManagementKadrosu(selected.role) && !isSelfManagement) ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Toplam Ceza', val: selected.total, color: 'text-foreground' },
                    { label: 'Dogru', val: selected.valid, color: 'text-emerald-400' },
                    { label: 'Hatali', val: selected.invalid, color: 'text-destructive' },
                    { label: 'Dogruluk', val: `%${selected.accuracy}`, color: selected.accuracy >= 70 ? 'text-emerald-400' : selected.accuracy >= 50 ? 'text-amber-400' : 'text-red-500' },
                    { label: 'CUK Skoru', val: selected.score, color: 'text-primary' },
                    { label: 'Güvenilirlik', val: selected.reliability, color: reliabilityColor(selected.reliability) },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="p-3 rounded-xl bg-secondary/30 border border-border/50">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
                      <div className={`text-xl font-bold ${color}`}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* Genel Yetkili Bilgileri */}
                {(selected.profile?.last_promoted_at || selected.profile?.management_comments) && (
                  <div className="p-4 rounded-2xl bg-secondary/15 border border-border/40 space-y-3 mt-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Yetkili Bilgileri</div>
                    {selected.profile?.last_promoted_at && (
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase">Son Terfi Tarihi</div>
                        <div className="text-xs font-semibold text-foreground">{formatDate(selected.profile.last_promoted_at)}</div>
                      </div>
                    )}
                    {selected.profile?.management_comments && (
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase">Yönetim Görüşleri</div>
                        <div className="text-xs text-foreground italic mt-1 bg-background/30 p-2.5 rounded-lg border border-border/20 leading-relaxed">
                          "{selected.profile.management_comments}"
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Recent cases */}
                {selected.recentCases.length > 0 && (
                  <div className="mt-4">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Son Cezalar</div>
                    <div className="space-y-2">
                      {selected.recentCases.map((c) => {
                        const isManagement = session ? isManagementRole(session.role) : false;
                        const shouldShowVerdict = c.is_public || isManagement;
                        return (
                          <div key={c.case_id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/50">
                            <div className="flex-1 min-w-0 mr-3">
                              <div className="text-xs font-mono text-muted-foreground">#{c.case_id}</div>
                              <div className="text-xs text-foreground truncate mt-0.5">{c.reason_raw || '—'}</div>
                            </div>
                            {!shouldShowVerdict ? (
                              <Badge variant="default" className="text-muted-foreground border border-border/50 bg-secondary/20 font-bold">GİZLİ</Badge>
                            ) : c.cuk_verdict === 'valid' ? (
                              <Badge variant="success">Dogru</Badge>
                            ) : c.cuk_verdict === 'invalid' ? (
                              <Badge variant="destructive">Hatali</Badge>
                            ) : (
                              <Badge variant="warning">Bekl.</Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Staff Warnings Section */}
                <div className="pt-4 border-t border-border/40">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center justify-between">
                    <span>Resmi Uyarılar</span>
                    <span className="text-xs font-mono font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                      {warnings.reduce((sum, w) => sum + (w.points || 1), 0)} Puan
                    </span>
                  </div>

                  {warningsLoading ? (
                    <div className="text-xs text-muted-foreground italic py-2">Uyarılar yükleniyor...</div>
                  ) : warnings.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic py-4 bg-secondary/10 border border-dashed border-border/50 rounded-xl text-center">
                      Temiz! Bu yetkilinin henüz hiçbir uyarısı bulunmuyor.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {warnings.map((w) => (
                        <div key={w.id} className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 flex flex-col gap-1.5 relative group/warn">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="text-xs font-bold text-foreground">{w.reason}</div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {formatDate(w.created_at)} • Yetkili: {w.created_by}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded">
                                {w.points} Puan
                              </span>
                              {session && isManagementRole(session.role) && (
                                <button
                                  onClick={() => handleDeleteWarning(w.id)}
                                  className="text-[10px] font-bold text-destructive hover:underline opacity-0 group-hover/warn:opacity-100 transition-opacity"
                                >
                                  Sil
                                </button>
                              )}
                            </div>
                          </div>
                          {/* Management Notes (Visible ONLY to Management) */}
                          {session && isManagementRole(session.role) && w.management_notes && (
                            <div className="mt-1 p-2 rounded bg-destructive/10 border border-destructive/20 text-[11px] text-destructive-foreground">
                              <span className="font-bold block text-[10px] uppercase tracking-wider mb-0.5">Yönetim Özel Notu:</span>
                              {w.management_notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Warning Form (Collapsible, Visible ONLY to Management) */}
                  {session && isManagementRole(session.role) && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => setShowAddWarning(!showAddWarning)}
                        className="w-full py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 text-amber-400 text-xs font-bold transition-all flex items-center justify-between cursor-pointer"
                      >
                        <span>{showAddWarning ? '✕ Kapat' : '⚠️ Yeni Uyarı Ekle'}</span>
                        <span className="text-[10px] opacity-60">{showAddWarning ? '▲' : '▼'}</span>
                      </button>

                      <AnimatePresence>
                        {showAddWarning && (
                          <motion.form 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            onSubmit={handleAddWarning} 
                            className="mt-2.5 p-3 rounded-xl bg-secondary/20 border border-border/50 space-y-3 overflow-hidden"
                          >
                            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Yeni Uyarı Ekle</div>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="col-span-2">
                                <input
                                  type="text"
                                  value={newWarningReason}
                                  onChange={(e) => setNewWarningReason(e.target.value)}
                                  placeholder="Uyarı sebebi..."
                                  required
                                  className="w-full h-8 px-2.5 rounded-lg bg-background/50 border border-border/50 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                              </div>
                              <div>
                                <select
                                  value={newWarningPoints}
                                  onChange={(e) => setNewWarningPoints(Number(e.target.value))}
                                  className="w-full h-8 px-2 rounded-lg bg-background/50 border border-border/50 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                                >
                                  <option value="1">1 Puan</option>
                                  <option value="2">2 Puan</option>
                                  <option value="3">3 Puan</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <input
                                type="text"
                                value={newWarningMgmtNotes}
                                onChange={(e) => setNewWarningMgmtNotes(e.target.value)}
                                placeholder="Yönetim özel notu (opsiyonel)..."
                                className="w-full h-8 px-2.5 rounded-lg bg-background/50 border border-border/50 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={submittingWarning}
                              className="w-full py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                            >
                              {submittingWarning ? 'Ekleniyor...' : 'Uyarıyı Uygula'}
                            </button>
                          </motion.form>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-4 rounded-xl bg-[#111112]/30 border border-white/[0.03] text-xs text-white/40 text-center italic">
                Bu yetkilinin performans istatistikleri ve ceza geçmişi yetkili grubuna gizlidir.
              </div>
            )}
          </div>
        </Drawer>
      )}

      {/* Add Staff Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-[12px] p-4 transition-all duration-300">
          <div className="relative w-full max-w-md bg-card border border-border/60 shadow-2xl rounded-2xl overflow-hidden p-6 animate-in">
            <button onClick={() => setAddOpen(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
            <form onSubmit={handleAddStaffSubmit} className="space-y-4">
              <div>
                <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" /> Yeni Yetkili Ekle
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Yeni bir moderatör veya yetkili kaydı oluşturun.</p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Discord ID</label>
                  <Input value={newDiscordId} onChange={(e) => setNewDiscordId(e.target.value)} placeholder="Discord ID girin..." required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Görünen Ad / İsim</label>
                  <Input value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} placeholder="İsim veya kullanıcı adı..." required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Grup Rütbesi</label>
                  <select
                    value={newStaffRole}
                    onChange={(e) => setNewStaffRole(e.target.value)}
                    className="w-full h-10 px-2.5 rounded-xl bg-secondary/50 border border-border/50 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="discord_destek_ekibi">Discord Destek Ekibi</option>
                    <option value="discord_moderatoru">Discord Moderatörü</option>
                    <option value="kidemli_discord_moderatoru">Kıdemli Discord Moderatörü</option>
                    <option value="senior_moderator">Senior Moderatör</option>
                    <option value="discord_yoneticisi">Discord Yöneticisi</option>
                    <option value="yonetici">Yönetici</option>
                    <option value="admin">Admin</option>
                    <option value="kurucu">Kurucu</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setAddOpen(false)}>İptal</Button>
                <Button type="submit" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold" disabled={savingNewStaff}>
                  {savingNewStaff ? 'Kaydediliyor...' : 'Yetkili Ekle'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dirty Saving Bottom Banner */}
      {isDirty && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-xl px-5 py-4 border rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex items-center justify-between gap-4 transition-all duration-500 ease-in-out ${flashRed ? 'bg-red-950/95 border-red-500 text-red-100' : 'bg-secondary/95 border-primary/40 text-foreground'} backdrop-blur-md ${shakeBanner ? 'animate-shake' : ''}`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertTriangle className={`w-4 h-4 shrink-0 ${flashRed ? 'text-red-400' : 'text-primary'}`} />
            <span className="text-xs font-bold truncate">
              {flashRed ? 'Dikkat — Kaydedilmemiş değişiklikleri kaydetmelisiniz!' : 'Dikkat — kaydetmediğin değişiklikler var!'}
            </span>
          </div>
          <div className="flex items-center gap-3.5 shrink-0">
            <button
              onClick={handleResetChanges}
              className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              Sıfırla
            </button>
            <button
              onClick={handleSaveChanges}
              disabled={savingNewStaff}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs font-black text-white shadow-[0_0_12px_rgba(16,185,129,0.3)] transition-all"
            >
              {savingNewStaff ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

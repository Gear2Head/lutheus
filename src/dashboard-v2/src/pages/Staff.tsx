import { useEffect, useState, useMemo } from 'react';
import { Search, RefreshCw, User, ShieldCheck, Plus, X, ArrowUpRight, ArrowDownRight, UserMinus, UserCheck, AlertTriangle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { Drawer } from '../components/ui/Drawer';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { getCases, getStaffProfiles, SapphireCase, StaffProfile, updateStaffProfile, supabaseFetch } from '../lib/supabase';
import { validateCase, getReliabilityStatus, calculatePerformanceScore } from '../lib/cukEngine';
import { getRoleLabel, getRoleColor, hasPermission } from '../lib/auth';
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
  const isDirty = Object.keys(bufferedChanges).length > 0;

  // Expose dirty state globally for route transition & close protection
  useEffect(() => {
    (window as any).__lutheus_is_dirty = isDirty;
    return () => {
      (window as any).__lutheus_is_dirty = false;
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
    const missingProfiles: { discord_id: string, display_name: string, staff_rank: string, is_active_staff: boolean }[] = [];
    const profileUpdates: { discord_id: string; display_name?: string; avatar_url?: string }[] = [];
    
    for (const c of casesList) {
      const id = c.author_discord_id;
      if (!id) continue;
      const displayName = formatStaffName(c.author_display_name, id);
      const hasRealCaseName = !isGenericStaffName(c.author_display_name, id);
      const existing = existingProfiles.get(id);

      if (!existing) {
        if (!missingProfiles.some(mp => mp.discord_id === id)) {
          missingProfiles.push({
            discord_id: id,
            display_name: displayName,
            staff_rank: 'discord_moderatoru',
            is_active_staff: true
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
          await supabaseFetch('staff_profiles', 'POST', '', {
            discord_id: mp.discord_id,
            display_name: mp.display_name,
            staff_rank: mp.staff_rank,
            is_active_staff: mp.is_active_staff,
            updated_at: new Date().toISOString()
          });
        } catch (err) {
          console.warn('[Lutheus] Profile sync failed for', mp.discord_id, err);
        }
      }));
      await Promise.all(profileUpdates.map(async (update) => {
        try {
          const body: Record<string, any> = { updated_at: new Date().toISOString() };
          if (update.display_name) body.display_name = update.display_name;
          if (update.avatar_url) body.avatar_url = update.avatar_url;
          await supabaseFetch('staff_profiles', 'PATCH', `discord_id=eq.${encodeURIComponent(update.discord_id)}`, body);
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
    if (!loading && location.state && (location.state as any).discordId) {
      const targetId = (location.state as any).discordId;
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
      } as any);
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
    r === 'Guvenilir' ? 'text-emerald-400' : r === 'Riskli' ? 'text-destructive' : 'text-amber-400';

  const reliabilityVariant = (r: string): any =>
    r === 'Guvenilir' ? 'success' : r === 'Riskli' ? 'destructive' : 'warning';

  return (
    <div className="space-y-5 animate-in pb-20 relative">
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
        const activeStaff = filtered.filter((s) => s.role !== 'eski_yetkili');
        const formerStaff = filtered.filter((s) => s.role === 'eski_yetkili');
        
        const renderStaffCard = (s: StaffWithStats) => {
          const roleColor = getRoleColor(s.role);
          const roleLabel = getRoleLabel(s.role);
          const isModified = !!bufferedChanges[s.discordId];
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
                <Badge variant={reliabilityVariant(s.reliability)} className="shrink-0 text-[10px]">
                  {s.reliability}
                </Badge>
              </div>

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
                    className={`h-full rounded-full transition-all duration-700 ${s.accuracy >= 95 ? 'bg-emerald-500' : s.accuracy >= 80 ? 'bg-amber-500' : 'bg-destructive'}`}
                    style={{ width: `${s.accuracy}%` }}
                  />
                </div>
              </div>
            </Card>
          );
        };

        return (
          <div className="space-y-8">
            {/* Active Staff */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Aktif Yetkililer ({activeStaff.length})
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
            <div className="space-y-4 pt-6 border-t border-border/40">
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-500" />
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
                <div className="text-xs text-muted-foreground font-mono mt-1">{selected.discordId}</div>
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
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Toplam Ceza', val: selected.total, color: 'text-foreground' },
                { label: 'Dogru', val: selected.valid, color: 'text-emerald-400' },
                { label: 'Hatali', val: selected.invalid, color: 'text-destructive' },
                { label: 'Dogruluk', val: `%${selected.accuracy}`, color: selected.accuracy >= 95 ? 'text-emerald-400' : selected.accuracy >= 80 ? 'text-amber-400' : 'text-destructive' },
                { label: 'CUK Skoru', val: selected.score, color: 'text-primary' },
                { label: 'Güvenilirlik', val: selected.reliability, color: reliabilityColor(selected.reliability) },
              ].map(({ label, val, color }) => (
                <div key={label} className="p-3 rounded-xl bg-secondary/30 border border-border/50">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
                  <div className={`text-xl font-bold ${color}`}>{val}</div>
                </div>
              ))}
            </div>

            {/* Recent cases */}
            {selected.recentCases.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Son Cezalar</div>
                <div className="space-y-2">
                  {selected.recentCases.map((c) => (
                    <div key={c.case_id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/50">
                      <div className="flex-1 min-w-0 mr-3">
                        <div className="text-xs font-mono text-muted-foreground">#{c.case_id}</div>
                        <div className="text-xs text-foreground truncate mt-0.5">{c.reason_raw || '—'}</div>
                      </div>
                      {c.cuk_verdict === 'valid'
                        ? <Badge variant="success">Dogru</Badge>
                        : c.cuk_verdict === 'invalid'
                        ? <Badge variant="destructive">Hatali</Badge>
                        : <Badge variant="warning">Bekl.</Badge>}
                    </div>
                  ))}
                </div>
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

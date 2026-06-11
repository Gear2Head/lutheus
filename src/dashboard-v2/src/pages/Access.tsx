import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '../lib/auth';
import { getAuditLogs, AuditLog } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import { Badge } from '../components/ui/Badge';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, CheckCircle2, Search, X, Loader, Trash2,
  RefreshCw, Plus, Shield, UserX, UserCheck, 
  HelpCircle, MonitorDot, ListFilter, Grid, Lock, Check, Slash, Ban, AlertTriangle
} from 'lucide-react';
import { formatDateTime } from '../lib/utils';

interface AllowlistEntry {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

interface RoleCacheEntry {
  identity: string;
  display_name: string;
  role: string;
  created_at: string;
}

interface PendingRequest {
  discordId: string;
  displayName: string;
  avatarUrl?: string;
  requestedAt?: string;
}

interface DbRoleCachePayload {
  discordId?: string;
  identityKey?: string;
  id?: string;
  displayName?: string;
  name?: string;
  role?: string;
  updatedAt?: string;
}

interface AdminApiClientType {
  listGoogleAllowlist(): Promise<AllowlistEntry[]>;
  listRoleCache(): Promise<DbRoleCachePayload[]>;
  listStaffAccessRequests(): Promise<PendingRequest[]>;
  setGoogleAllowlist(email: string, data: Record<string, unknown>): Promise<unknown>;
  setRoleCache(identityKey: string, data: Record<string, unknown>): Promise<unknown>;
  deleteGoogleAllowlist(email: string): Promise<unknown>;
  deleteRoleCache(identityKey: string): Promise<unknown>;
  approveStaffAccess(discordId: string, action: string, role: string, rejectionReason?: string): Promise<unknown>;
  getRolePolicy(): Promise<Record<string, any>>;
  saveRolePolicy(policy: Record<string, any>): Promise<Record<string, any>>;
}

// Matrix types
interface MatrixPermission {
  id: string;
  label: string;
  category: string;
  description: string;
}

interface RoleMatrixConfig {
  id: string;
  name: string;
  color: string;
  level: number; // Hierarchy level (higher = more authority)
  isMaster?: boolean; // Always gets all permissions
  maxAllowedPermissionIds?: string[]; // If defined, can never receive other permissions
}

const matrixPermissions: MatrixPermission[] = [
  { id: 'view_penalties', label: 'Cezaları Gör', category: 'Görüntüleme', description: 'Log listesine, aramalara ve detaylara erişim sağlar' },
  { id: 'validate_penalties', label: 'Ceza Doğrula', category: 'Karar', description: 'Cezaları DOĞRU veya HATALI olarak işaretleyebilme izni' },
  { id: 'manage_staff', label: 'Kadroları Yönet', category: 'Yönetim', description: 'Yetkili ekibine el ile üye ekleme, silme ve düzenleme' },
  { id: 'discord_announcements', label: 'Anons Yayınla', category: 'Modül', description: 'Sapphire Botu üzerinden sunucu kanallarına anons geçme' },
  { id: 'bot_settings', label: 'Bot Yapılandırma', category: 'Modül', description: 'Uygulama genel bot tokenleri, webhook adresleri güncelleyebilme' },
  { id: 'manage_access', label: 'Erişimleri Yönet', category: 'Yönetim', description: 'Erişim talebi onaylama, allowlist ve cache düzenleme' },
  { id: 'system_diagnostics', label: 'Teşhis Çalıştır', category: 'Sistem', description: 'Bot sunucu bağlantı ve telemetri teşhisi başlatabilme' }
];

const roleConfigs: RoleMatrixConfig[] = [
  { id: 'kurucu', name: 'Kurucu / Admin', color: 'from-[#FF3B30] to-[#FF453A]', level: 10, isMaster: true },
  { id: 'genel_sorumlu', name: 'Genel Sorumlu', color: 'from-[#FF9F0A] to-[#FFB340]', level: 8 },
  { id: 'discord_yoneticisi', name: 'Discord Yöneticisi', color: 'from-[#BF5AF2] to-[#C97FFF]', level: 7 },
  { id: 'kidemli_discord_moderatoru', name: 'Kıdemli Moderatör', color: 'from-[#AF52DE] to-[#BF5AF2]', level: 5 },
  { id: 'discord_moderatoru', name: 'Moderatör Ekibi', color: 'from-[#5E5CE6] to-[#7876E6]', level: 4 },
  { id: 'discord_destek_ekibi', name: 'Destek Ekibi', color: 'from-[#30D158] to-[#4CD964]', level: 2, maxAllowedPermissionIds: ['view_penalties', 'discord_announcements'] },
  { id: 'viewer', name: 'Deneme Destek (Viewer)', color: 'from-[#0A84FF] to-[#3399FF]', level: 1, maxAllowedPermissionIds: ['view_penalties'] }
];

export default function Access() {
  const { session } = useAuth();
  const { showToast } = useToast();
  const { language } = useLanguage();

  const canManage = hasPermission(session?.role || '', 'google_allowlist:update');
  const canAssignRole = hasPermission(session?.role || '', 'staff:assign_role');
  const canRepair = ['kurucu', 'admin'].includes(session?.role?.toLowerCase() || '');
  const canApproveAccess = hasPermission(session?.role || '', 'staff:access_approve');

  // Tabs layout state
  const [activeTab, setActiveTab] = useState<'requests' | 'matrix'>('requests');
  const [searchQuery, setSearchQuery] = useState('');
  const [syncing, setSyncing] = useState(false);

  // DB states
  const [allowlist, setAllowlist] = useState<AllowlistEntry[]>([]);
  const [roleCache, setRoleCache] = useState<RoleCacheEntry[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [newEmail, setNewEmail] = useState('');
  const [newEmailRole, setNewEmailRole] = useState('discord_moderatoru');
  const [newIdentity, setNewIdentity] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('discord_moderatoru');

  // Matrix states
  const [permissionsMatrix, setPermissionsMatrix] = useState<Record<string, Record<string, boolean>>>({});
  const [policyLoading, setPolicyLoading] = useState(false);

  // SRE and Repair states
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'allow' | 'cache'; id: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [lockdown, setLockdown] = useState(false);
  const [lockdownConfirm, setLockdownConfirm] = useState(false);
  const [repairing, setRepairing] = useState(false);

  // Pending requests state
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [approveRole, setApproveRole] = useState<Record<string, string>>({});
  const [actionTarget, setActionTarget] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const { AdminApiClient } = await import('../../../lib/adminApiClient.js') as unknown as { AdminApiClient: AdminApiClientType };
      const [alPayload, rcPayload, lg] = await Promise.all([
        AdminApiClient.listGoogleAllowlist().catch(() => []),
        AdminApiClient.listRoleCache().catch(() => []),
        getAuditLogs(30).catch(() => []),
      ]);
      setAllowlist(alPayload || []);
      
      const mappedRoleCache = (rcPayload || []).map((r: DbRoleCachePayload) => {
        const discordId = r.discordId || String(r.identityKey || r.id || '').replace(/^discord:/, '');
        return {
          identity: `discord:${discordId}`,
          display_name: r.displayName || r.name || `User ${discordId}`,
          role: r.role || 'discord_moderatoru',
          created_at: r.updatedAt || new Date().toISOString()
        };
      });
      setRoleCache(mappedRoleCache);
      setLogs(lg);

      if (canApproveAccess) {
        setPendingLoading(true);
        try {
          const reqs = await AdminApiClient.listStaffAccessRequests();
          setPendingRequests(reqs || []);
        } catch (_e) { /* non-fatal */ } finally {
          setPendingLoading(false);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const loadPolicy = async () => {
    setPolicyLoading(true);
    try {
      const { AdminApiClient } = await import('../../../lib/adminApiClient.js') as unknown as { AdminApiClient: AdminApiClientType };
      const policy = await AdminApiClient.getRolePolicy();
      if (policy && policy.permissionsMatrix) {
        setPermissionsMatrix(policy.permissionsMatrix);
      } else {
        // Fallback default matrix configuration
        setPermissionsMatrix({
          kurucu: { view_penalties: true, validate_penalties: true, manage_staff: true, discord_announcements: true, bot_settings: true, manage_access: true, system_diagnostics: true },
          genel_sorumlu: { view_penalties: true, validate_penalties: true, manage_staff: true, discord_announcements: true, bot_settings: false, manage_access: true, system_diagnostics: true },
          discord_yoneticisi: { view_penalties: true, validate_penalties: true, manage_staff: false, discord_announcements: true, bot_settings: false, manage_access: false, system_diagnostics: true },
          kidemli_discord_moderatoru: { view_penalties: true, validate_penalties: true, manage_staff: false, discord_announcements: true, bot_settings: false, manage_access: false, system_diagnostics: false },
          discord_moderatoru: { view_penalties: true, validate_penalties: false, manage_staff: false, discord_announcements: false, bot_settings: false, manage_access: false, system_diagnostics: false },
          discord_destek_ekibi: { view_penalties: true, validate_penalties: false, manage_staff: false, discord_announcements: false, bot_settings: false, manage_access: false, system_diagnostics: false },
          viewer: { view_penalties: true, validate_penalties: false, manage_staff: false, discord_announcements: false, bot_settings: false, manage_access: false, system_diagnostics: false }
        });
      }
    } catch (err) {
      console.error('Failed to load role policy matrix:', err);
    } finally {
      setPolicyLoading(false);
    }
  };

  useEffect(() => { 
    loadData();
    loadPolicy();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await loadData();
      await loadPolicy();
      showToast(language === 'tr' ? 'Veritabanı ve CUK kilitleri senkronize edildi!' : 'Database and CUK locks synced!', 'success');
    } catch (err) {
      showToast(language === 'tr' ? 'Senkronizasyon hatası' : 'Sync error', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const addToAllowlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setSaving(true);
    try {
      const { AdminApiClient } = await import('../../../lib/adminApiClient.js') as unknown as { AdminApiClient: AdminApiClientType };
      await AdminApiClient.setGoogleAllowlist(newEmail.trim().toLowerCase(), {
        dashboard_access_role: newEmailRole,
        active: true,
      });
      setNewEmail('');
      showToast(language === 'tr' ? `"${newEmail}" adresi listeye yetkilendirildi.` : `"${newEmail}" authorized in Google allowlist.`, 'success');
      await loadData();
    } catch (err: unknown) {
      showToast(`Allowlist eklenemedi: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const addToRoleCache = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIdentity.trim() || !newName.trim()) return;
    setSaving(true);
    try {
      const discordId = newIdentity.trim().replace(/^discord:/, '');
      const identityKey = `discord:${discordId}`;
      const { AdminApiClient } = await import('../../../lib/adminApiClient.js') as unknown as { AdminApiClient: AdminApiClientType };
      await AdminApiClient.setRoleCache(identityKey, {
        discordId,
        displayName: newName.trim(),
        role: newRole,
        isActiveStaff: true,
      });
      setNewIdentity('');
      setNewName('');
      showToast(language === 'tr' ? `"${newName}" rol önbelleği el ile tanımlandı.` : `"${newName}" role cache manually defined.`, 'success');
      await loadData();
    } catch (err: unknown) {
      showToast(`Rol cache eklenemedi: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const { AdminApiClient } = await import('../../../lib/adminApiClient.js') as unknown as { AdminApiClient: AdminApiClientType };
      if (deleteTarget.type === 'allow') {
        await AdminApiClient.deleteGoogleAllowlist(deleteTarget.id);
        showToast(language === 'tr' ? 'Allowlist izni kaldırıldı.' : 'Allowlist access revoked.', 'success');
      } else {
        const identityKey = deleteTarget.id.startsWith('discord:') ? deleteTarget.id : `discord:${deleteTarget.id}`;
        await AdminApiClient.deleteRoleCache(identityKey);
        showToast(language === 'tr' ? 'Rol cache izni kaldırıldı.' : 'Role cache access revoked.', 'success');
      }
      setDeleteTarget(null);
      await loadData();
    } catch (err: unknown) {
      showToast(`Silme islemi basarisiz: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAccessAction = async (discordId: string, action: 'approve' | 'reject' | 'block') => {
    setActionTarget(discordId);
    try {
      const { AdminApiClient } = await import('../../../lib/adminApiClient.js') as unknown as { AdminApiClient: AdminApiClientType };
      const role = approveRole[discordId] || 'discord_destek_ekibi';
      const rejectionReason = action === 'reject' ? 'Yonetici tarafindan reddedildi' : undefined;
      await AdminApiClient.approveStaffAccess(discordId, action, role, rejectionReason);
      
      const actionMsg = action === 'approve' ? 'onaylandi' : action === 'reject' ? 'reddedildi' : 'engellendi';
      showToast(`Erisim talebi ${actionMsg}.`, 'success');
      await loadData();
    } catch (err: unknown) {
      showToast(`Islem basarisiz: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setActionTarget(null);
    }
  };

  const handleRepair = async () => {
    setRepairing(true);
    showToast(language === 'tr' ? 'Veritabanı onarım işlemi başlatıldı...' : 'Database repair process started...', 'info');
    try {
      const token = session?.idToken || '';
      const baseUrl = (typeof window !== 'undefined' && window.location.protocol === 'chrome-extension:')
        ? 'https://lutheus.vercel.app'
        : '';

      const res = await fetch(`${baseUrl}/api/admin/repair-dates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error(`REPAIR_ENDPOINT_FAILED_${res.status}`);
      }

      const data = await res.json();
      if (data.success) {
        showToast(language === 'tr' ? `Veritabanı başarıyla onarıldı! ${data.count} adet ceza düzeltildi.` : `Database successfully repaired! ${data.count} cases corrected.`, 'success');
      } else {
        showToast('Onarım tamamlandı ancak beklenen yanıt alınamadı.', 'info');
      }
    } catch (err: unknown) {
      console.error('[Access] Repair failed:', err);
      showToast('Onarım işlemi sırasında bir hata oluştu.', 'error');
    } finally {
      setRepairing(false);
    }
  };

  // Matrix Cell Toggle
  const handleTogglePermission = async (roleId: string, permId: string) => {
    const roleConf = roleConfigs.find(r => r.id === roleId);
    if (!roleConf) return;

    if (roleConf.isMaster) {
      showToast(language === 'tr' ? `"${roleConf.name}" yetkileri hiyerarşi gereği değiştirilemez!` : `"${roleConf.name}" permissions are fixed due to hierarchy!`, 'error');
      return;
    }

    if (roleConf.maxAllowedPermissionIds && !roleConf.maxAllowedPermissionIds.includes(permId)) {
      showToast(language === 'tr' ? `Hiyerarşik Kısıtlama: "${roleConf.name}" rolüne bu yetki verilemez!` : `Hierarchical Restriction: "${roleConf.name}" cannot receive this permission!`, 'error');
      return;
    }

    const currentVal = !!permissionsMatrix[roleId]?.[permId];
    const newVal = !currentVal;

    const updatedRoleMatrix = {
      ...(permissionsMatrix[roleId] || {}),
      [permId]: newVal
    };

    const newMatrix = {
      ...permissionsMatrix,
      [roleId]: updatedRoleMatrix
    };

    setPermissionsMatrix(newMatrix);

    try {
      const { AdminApiClient } = await import('../../../lib/adminApiClient.js') as unknown as { AdminApiClient: AdminApiClientType };
      const currentPolicy = await AdminApiClient.getRolePolicy();
      const updatedPolicy = {
        ...currentPolicy,
        permissionsMatrix: newMatrix
      };
      await AdminApiClient.saveRolePolicy(updatedPolicy);

      const permConf = matrixPermissions.find(p => p.id === permId);
      showToast(
        language === 'tr' 
          ? `"${roleConf.name}" için "${permConf?.label}" yetkisi güncellendi.` 
          : `Permission "${permConf?.label}" updated for "${roleConf.name}".`, 
        'success'
      );
    } catch (err: any) {
      showToast(language === 'tr' ? `Yetki güncellenemedi: ${err.message || err}` : `Failed to update permission: ${err.message || err}`, 'error');
    }
  };

  // Filter pending requests, allowlist, and role cache based on search query
  const filteredRequests = pendingRequests.filter(r => 
    r.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.discordId.includes(searchQuery)
  );

  const filteredAllowlist = allowlist.filter(a => 
    a.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRoleCache = roleCache.filter(r => 
    r.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.identity.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8 w-full max-w-7xl mx-auto space-y-6 select-none bg-[#050506] text-white/90 min-h-screen">
      
      {/* Top Header layout matching Apple style */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-white/[0.04] pb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-[22px] font-black text-white tracking-tight">CUK Büro ve Erişim</h2>
          <div className="h-4 w-[1px] bg-white/10 hidden sm:block" />
          <span className="text-[12px] text-[#8E8E93] hidden sm:block font-medium">Büro, rol yetkilendirmesi, Google & Discord allowlist protokolleri</span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {/* Synchronize Button */}
          <button 
            onClick={handleSync}
            disabled={syncing}
            className="h-9 px-4 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-all flex items-center gap-2 text-[12.5px] font-bold text-white cursor-pointer select-none disabled:opacity-50"
          >
            {syncing ? (
              <Loader size={12} className="animate-spin text-[#32D74B]" />
            ) : (
              <span className="flex items-center gap-1.5 text-[#32D74B] text-[12px] font-bold">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse">
                  <path d="M5 12h.01M19 12h.01M12 12h.01" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                Senkronize
              </span>
            )}
          </button>

          {/* Search bar */}
          <div className="relative w-44 sm:w-56">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ara..."
              className="clean-input w-full h-9 bg-[#111112]/50 border border-white/5 rounded-xl pl-9 pr-3 text-[12px] text-white/80 placeholder-white/30 font-medium focus:border-white/10"
            />
          </div>
        </div>
      </div>

      {/* Tabs Switcher Panels */}
      <div className="flex bg-[#111112]/50 border border-white/5 rounded-xl p-1 max-w-sm self-start shadow-md">
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex-1 py-2 px-4 rounded-lg text-[12px] font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'requests' 
              ? 'bg-white/10 text-white shadow-sm' 
              : 'text-white/40 hover:text-white/80'
          }`}
        >
          <ListFilter size={13} />
          Erişim İstekleri & Güvenlik
        </button>
        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex-1 py-2 px-4 rounded-lg text-[12px] font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'matrix' 
              ? 'bg-white/10 text-white shadow-sm' 
              : 'text-white/40 hover:text-white/80'
          }`}
        >
          <Grid size={13} />
          Rol Yetki Matrisi
        </button>
      </div>

      {/* RENDER ACTIVE TAB */}
      <AnimatePresence mode="wait">
        {activeTab === 'requests' ? (
          <motion.div 
            key="requests-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
            className="space-y-6"
          >
            {/* Waiting Requests */}
            {canApproveAccess && (
              <div className="bg-[#111112]/30 border border-white/[0.03] rounded-2.5xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.04] pb-3 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#FF453A]" />
                    <h3 className="text-[13.5px] font-black text-white tracking-wide">Bekleyen Erişim İstekleri ({filteredRequests.length})</h3>
                  </div>
                  <span className="text-[10px] font-mono text-white/25 font-bold uppercase">Canlı Discord API</span>
                </div>

                {pendingLoading ? (
                  <div className="py-6 space-y-3">
                    {[1, 2].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl bg-white/5" />)}
                  </div>
                ) : filteredRequests.length === 0 ? (
                  <div className="py-12 text-center text-white/30 text-[12px] font-medium border border-dashed border-white/5 rounded-2xl bg-black/10">
                    Bekleyen herhangi bir erişim isteği bulunmamaktadır.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredRequests.map((req) => (
                      <div 
                        key={req.discordId}
                        className="bg-black/20 hover:bg-white/[0.015] border border-white/[0.03] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                      >
                        {/* Avatar & ID */}
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center relative shrink-0">
                            {req.avatarUrl ? (
                              <img src={req.avatarUrl} alt="avatar" className="w-7 h-7 object-cover rounded-full" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">
                                {(req.displayName || '?')[0].toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="truncate">
                            <span className="text-[13px] font-bold text-white/95">{req.displayName}</span>
                            <span className="text-[11px] font-mono text-[#8E8E93] block mt-0.5">{req.discordId}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-wrap md:flex-nowrap justify-end">
                          {/* Selector */}
                          <select 
                            value={approveRole[req.discordId] || 'discord_destek_ekibi'}
                            onChange={e => setApproveRole(prev => ({ ...prev, [req.discordId]: e.target.value }))}
                            className="h-8.5 px-3 bg-black/45 border border-white/5 rounded-lg text-[12px] font-semibold text-white/80 shrink-0 select-none cursor-pointer outline-none focus:border-white/10 min-w-[130px]"
                          >
                            <option value="discord_destek_ekibi">Destek Ekibi</option>
                            <option value="discord_moderatoru">Moderator</option>
                            <option value="kidemli_discord_moderatoru">Kidemli Mod</option>
                            <option value="senior_moderator">Senior Mod</option>
                            <option value="discord_yoneticisi">Yonetici</option>
                            <option value="viewer">Viewer</option>
                          </select>

                          {/* Actions */}
                          <button 
                            onClick={() => handleAccessAction(req.discordId, 'approve')}
                            disabled={actionTarget === req.discordId}
                            className="h-8.5 px-3.5 bg-green-500/10 border border-green-500/20 text-[#32D74B] text-[11px] font-bold rounded-lg hover:bg-green-500/15 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                          >
                            <CheckCircle2 size={12} /> Onayla
                          </button>

                          <button 
                            onClick={() => handleAccessAction(req.discordId, 'reject')}
                            disabled={actionTarget === req.discordId}
                            className="h-8.5 px-3.5 bg-white/[0.02] border border-white/5 text-white/70 text-[11px] font-bold rounded-lg hover:bg-white/[0.04] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                          >
                            <X size={12} className="text-white/45" /> Reddet
                          </button>

                          <button 
                            onClick={() => handleAccessAction(req.discordId, 'block')}
                            disabled={actionTarget === req.discordId}
                            className="h-8.5 w-8.5 flex items-center justify-center rounded-lg border border-red-500/15 text-red-500 bg-red-400/5 hover:bg-red-400/15 transition-all cursor-pointer disabled:opacity-40"
                            title="Engelle"
                          >
                            <Ban size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Google Allowlist and Rol Cache row columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Google Allowlist */}
              <div className="bg-[#111112]/30 border border-white/[0.03] rounded-2.5xl p-5 space-y-4">
                <div className="border-b border-white/[0.04] pb-3 mb-1 flex items-center gap-2">
                  <span className="text-[#4285F4] font-bold text-[14px]">G</span>
                  <h3 className="text-[13.5px] font-black text-white tracking-wide">Google Allowlist</h3>
                </div>

                {canManage && (
                  <form onSubmit={addToAllowlist} className="flex gap-2.5 items-center">
                    <input 
                      type="email"
                      required
                      placeholder="Email adresi..."
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="flex-1 clean-input h-9 bg-black/25 border border-white/5 rounded-xl px-3.5 text-[12px] placeholder-white/20 focus:border-white/10"
                    />
                    <select
                      value={newEmailRole}
                      onChange={(e) => setNewEmailRole(e.target.value)}
                      className="h-9 px-3 bg-[#111112] border border-white/5 rounded-xl text-[12px] font-bold text-white/70 outline-none cursor-pointer"
                    >
                      <option value="discord_moderatoru">Mod</option>
                      <option value="kidemli_discord_moderatoru">Senior</option>
                      <option value="yonetici">Yönetici</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button 
                      type="submit"
                      disabled={saving || !newEmail}
                      className="h-9 w-9 bg-white/[0.04] border border-white/5 hover:bg-white/[0.08] text-white/80 rounded-xl transition-all flex items-center justify-center cursor-pointer font-bold"
                    >
                      <Plus size={14} />
                    </button>
                  </form>
                )}

                <div className="space-y-1.5 divide-y divide-white/[0.02] max-h-[290px] overflow-y-auto pr-1 hide-scrollbar">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-xl bg-white/5" />)
                  ) : filteredAllowlist.length === 0 ? (
                    <div className="py-8 text-center text-white/20 text-[11px] font-medium">Allowlist bulunmuyor.</div>
                  ) : (
                    filteredAllowlist.map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-2.5 first:pt-1">
                        <div className="space-y-0.5">
                          <span className="text-[12.5px] font-bold text-white/95 block">{item.email}</span>
                          <span className="text-[9.5px] font-mono font-extrabold text-[#8E8E93] uppercase tracking-wider">{item.role}</span>
                        </div>
                        {canManage && (
                          <button 
                            onClick={() => setDeleteTarget({ type: 'allow', id: item.email })}
                            className="p-1.5 rounded-lg border border-transparent hover:border-white/[0.05] hover:bg-white/[0.03] text-white/40 hover:text-red-500 transition-colors cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Rol Cache */}
              <div className="bg-[#111112]/30 border border-white/[0.03] rounded-2.5xl p-5 space-y-4">
                <div className="border-b border-white/[0.04] pb-3 mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield size={13} className="text-white/40" />
                    <h3 className="text-[13.5px] font-black text-white tracking-wide">Rol Cache</h3>
                  </div>
                  <span className="text-[10px] font-mono text-white/25">Üye Yetki Önbellekleri</span>
                </div>

                {canAssignRole && (
                  <form onSubmit={addToRoleCache} className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      <input 
                        type="text"
                        placeholder="discord:ID"
                        value={newIdentity}
                        onChange={(e) => setNewIdentity(e.target.value)}
                        className="clean-input h-9 bg-black/25 border border-white/5 rounded-xl px-3.5 text-[12px] placeholder-white/20 focus:border-white/10"
                      />
                      <input 
                        type="text"
                        placeholder="Üye adı..."
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="clean-input h-9 bg-black/25 border border-white/5 rounded-xl px-3.5 text-[12px] placeholder-white/20 focus:border-white/10"
                      />
                    </div>
                    <div className="flex gap-2.5 items-center">
                      <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)}
                        className="flex-1 h-9 px-3 bg-[#111112] border border-white/5 rounded-xl text-[12px] font-bold text-white/70 outline-none cursor-pointer"
                      >
                        <option value="discord_moderatoru">Mod</option>
                        <option value="kidemli_discord_moderatoru">Senior</option>
                        <option value="yonetici">Yönetici</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button 
                        type="submit"
                        disabled={saving || !newIdentity || !newName}
                        className="h-9 px-4.5 bg-white/[0.04] border border-white/5 hover:bg-white/[0.08] text-white/80 text-[11.5px] font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                      >
                        + Ekle
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-1.5 divide-y divide-white/[0.02] max-h-[190px] overflow-y-auto pr-1 hide-scrollbar">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-xl bg-white/5" />)
                  ) : filteredRoleCache.length === 0 ? (
                    <div className="py-8 text-center text-white/20 text-[11px] font-medium">Önbellek kaydı bulunmuyor.</div>
                  ) : (
                    filteredRoleCache.map((item) => (
                      <div key={item.identity} className="flex items-center justify-between py-2.5 first:pt-1">
                        <div className="space-y-0.5 truncate pr-3">
                          <span className="text-[12.5px] font-bold text-white/95 block truncate">{item.display_name}</span>
                          <span className="text-[9.5px] font-mono text-[#8E8E93] block truncate">
                            {item.identity} – <span className="text-white/40">{item.role}</span>
                          </span>
                        </div>
                        {canAssignRole && (
                          <button 
                            onClick={() => setDeleteTarget({ type: 'cache', id: item.identity })}
                            className="p-1.5 rounded-lg border border-transparent hover:border-white/[0.05] hover:bg-white/[0.03] text-white/40 hover:text-red-500 transition-colors cursor-pointer shrink-0"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Audit Log */}
            <div className="bg-[#111112]/30 border border-white/[0.03] rounded-2.5xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.04] pb-3 mb-1">
                <div className="flex items-center gap-2">
                  <MonitorDot size={13} className="text-white/40" />
                  <h3 className="text-[13.5px] font-black text-white tracking-wide">Audit Log</h3>
                </div>
                <button 
                  onClick={loadData}
                  className="p-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/5 text-white/40 hover:text-white transition-all cursor-pointer"
                >
                  <RefreshCw size={12} />
                </button>
              </div>

              <div className="space-y-2 divide-y divide-white/[0.02] max-h-[160px] overflow-y-auto pr-1 hide-scrollbar">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-xl bg-white/5" />)
                ) : logs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Log yok</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-2.5 first:pt-2">
                      <div className="flex items-start sm:items-center gap-2">
                        <span className="font-mono text-[10px] text-[#5E5CE6] font-bold px-1.5 py-0.5 rounded bg-[#5E5CE6]/5 shrink-0 select-none">
                          {log.actor_discord_id || 'System'}
                        </span>
                        <span className="text-[12px] text-white/70 leading-normal">{log.action}</span>
                      </div>
                      <span className="text-[9.5px] font-mono text-[#8E8E93] shrink-0 mt-1 sm:mt-0 uppercase tracking-wider">{formatDateTime(log.created_at)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Database Healer & Repair */}
            {canRepair && (
              <div className="bg-[#111112]/30 border border-white/[0.03] rounded-2.5xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCw className={`w-4.5 h-4.5 text-primary ${repairing ? 'animate-spin' : ''}`} />
                    <h3 className="font-bold text-[14.5px] text-white">Veritabanı Onarıcı (Database Healer)</h3>
                  </div>
                  {repairing && <Badge variant="secondary">Onarılıyor...</Badge>}
                </div>
                <p className="text-xs text-white/50 leading-relaxed">
                  Bu araç geçmişte gün/ay değerleri ters kaydedilen hatalı ceza tarihlerini, "Kalıcı" olarak kilitlenmiş yanlış ceza sürelerini ve aktif/pasif durumlarını otomatik olarak tarayıp düzeltir.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRepair}
                  disabled={repairing}
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-2 ${repairing ? 'animate-spin' : ''}`} />
                  Veritabanını Onar (Healer)
                </Button>
              </div>
            )}

            {/* SRE Panel */}
            <div className="bg-[#111112]/30 border border-[#FF453A]/20 rounded-2.5xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4.5 h-4.5 text-[#FF453A]" />
                  <h3 className="font-bold text-[14.5px] text-white">Acil Durum Kilidi</h3>
                </div>
                {lockdown && <Badge variant="destructive">LOCKDOWN AKTİF</Badge>}
              </div>
              <p className="text-xs text-white/50 leading-relaxed">
                Bu butona basıldığında sistem tüm kritik operasyonları kilitler. Sadece acil durumlarda kullanın.
              </p>
              <Button
                variant={lockdown ? 'outline' : 'destructive'}
                size="sm"
                onClick={() => setLockdownConfirm(true)}
              >
                <AlertTriangle className="w-3.5 h-3.5 mr-2" />
                {lockdown ? 'Kilidi Kaldır' : 'ACİL DURUM KİLİDİ (LOCKDOWN)'}
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="matrix-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
            className="space-y-6"
          >
            {/* ROLE PERMISSION MATRIX */}
            <div className="bg-[#111112]/30 border border-white/[0.03] rounded-2.5xl p-6 space-y-4 overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/[0.04] pb-4 mb-2 flex-wrap gap-2">
                <div>
                  <h3 className="text-[15.5px] font-black text-white tracking-tight">Yetki ve Rol İzin Matrisi</h3>
                  <p className="text-[12.5px] text-[#8E8E93] mt-1">Moderatör hiyerarşi kurallarına gore kilitli veya esnek rol izinlerini denetleyin</p>
                </div>
                
                {/* Visual Legend indicator */}
                <div className="flex items-center gap-4 text-[10.5px] font-mono text-[#8E8E93]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded bg-white/[0.04] border border-white/[0.1] flex items-center justify-center text-[#32D74B]">
                      <Check size={11} />
                    </div>
                    <span>Aktif</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded bg-white/[0.01] border border-white/[0.03] flex items-center justify-center text-white/10">
                      <Slash size={9} />
                    </div>
                    <span>Kapalı</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded bg-white/[0.02] border border-white/[0.04] flex items-center justify-center text-amber-500">
                      <Lock size={10} />
                    </div>
                    <span>Sistem Kısıtılı (Locked)</span>
                  </div>
                </div>
              </div>

              {policyLoading ? (
                <div className="py-12 flex justify-center items-center">
                  <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : (
                /* The Matrix Table container */
                <div className="overflow-x-auto border border-white/[0.03] rounded-xl bg-black/20">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/[0.05] bg-black/40">
                        <th className="py-3 px-4 text-[10px] font-bold text-white/40 uppercase tracking-widest font-mono">Yetkili Rolleri</th>
                        {matrixPermissions.map((perm) => (
                          <th 
                            key={perm.id} 
                            className="py-3 px-4 text-center w-28 group relative"
                          >
                            <span className="text-[10px] font-mono font-black text-white/50 group-hover:text-white cursor-help transition-colors select-none block">
                              {perm.label}
                            </span>
                            
                            {/* Tooltip on header */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-[#0E0E10] border border-white/10 rounded-lg shadow-2xl text-[10px] text-white/80 w-44 font-semibold text-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10 select-none">
                              <span className="text-[#5E5CE6] font-bold block mb-0.5">{perm.category}</span>
                              {perm.description}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    
                    <tbody className="divide-y divide-white/[0.02]">
                      {roleConfigs.map((role) => {
                        return (
                          <tr key={role.id} className="hover:bg-white/[0.01] transition-colors">
                            {/* Role name row header */}
                            <td className="py-4 px-4 font-semibold">
                              <div className="flex items-center gap-2.5">
                                <span className={`w-2 h-2 rounded-full bg-gradient-to-tr ${role.color}`} />
                                <div>
                                  <span className="text-[13px] font-bold text-white">{role.name}</span>
                                  <span className="text-[9px] font-mono text-white/30 block mt-0.5">Seviye: {role.level}</span>
                                </div>
                              </div>
                            </td>
                            
                            {/* Loop through each permission checkbox */}
                            {matrixPermissions.map((perm) => {
                              const isActive = !!permissionsMatrix[role.id]?.[perm.id];
                              
                              // Check if permission editing is locked for this cell:
                              // 1. Master roles (Owner) have everything pre-enabled and locked.
                              // 2. Restricted roles (support / trials) can only receive their allowed permission IDs.
                              const cellIsLockedByHiearchy = 
                                role.isMaster || 
                                (role.maxAllowedPermissionIds && !role.maxAllowedPermissionIds.includes(perm.id));
                              
                              return (
                                <td key={perm.id} className="py-4 px-4 text-center">
                                  <div className="flex items-center justify-center">
                                    <button
                                      onClick={() => handleTogglePermission(role.id, perm.id)}
                                      className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all cursor-pointer relative group/btn ${
                                        isActive 
                                          ? cellIsLockedByHiearchy
                                            ? 'bg-[#32D74B]/5 border-[#32D74B]/20 text-[#32D74B]/65'
                                            : 'bg-[#32D74B]/10 border-[#32D74B]/35 text-[#32D74B] hover:scale-105 active:scale-95'
                                          : cellIsLockedByHiearchy
                                            ? 'bg-white/[0.01] border-white/[0.03] text-white/5 cursor-not-allowed'
                                            : 'bg-white/[0.02] border-white/5 text-white/10 hover:border-white/10 hover:text-white/30 hover:scale-105 active:scale-95'
                                      }`}
                                    >
                                      {isActive ? (
                                        cellIsLockedByHiearchy ? (
                                          <Lock size={12} className="text-[#32D74B]/50" />
                                        ) : (
                                          <Check size={14} className="stroke-[3]" />
                                        )
                                      ) : (
                                        cellIsLockedByHiearchy ? (
                                          <Slash size={10} className="text-white/5" />
                                        ) : (
                                          <div className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover/btn:bg-white/40 transition-colors" />
                                        )
                                      )}

                                      {/* Inline cell tooltip */}
                                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 py-1 px-2.5 bg-black/95 rounded border border-white/10 shadow-xl opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap pointer-events-none text-[9.5px] font-bold z-10">
                                        {cellIsLockedByHiearchy ? (
                                          <span className="text-amber-500 font-bold flex items-center gap-1">
                                            <Lock size={10} /> Hiyerarşi Kilidi (Locked)
                                          </span>
                                        ) : isActive ? (
                                          <span className="text-[#32D74B]">Yetkilendirildi (Açık)</span>
                                        ) : (
                                          <span className="text-white/40">Yetersiz Yetki (Kapalı)</span>
                                        )}
                                      </div>
                                    </button>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Warning guidance notes conforming to strict moderation rules */}
              <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-start gap-3 mt-2 text-left">
                <ShieldAlert size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-[12.5px] font-bold text-white tracking-tight">Hiyerarşik Erişim Sınırlandırması ve CUK Güvenlik Kodu</h4>
                  <p className="text-[11.5px] text-[#8E8E93] leading-relaxed">
                    Güvenlik ilkeleri kapsamında <strong>Kurucu / Yönetici</strong> yetkileri sabittir, devre dışı bırakılamaz. <strong>Destek</strong> ve <strong>Deneme Destek</strong> gibi stajyer/deneme ekibi rolleri yetki sınırlandırmalarına tabidir. Bu seviyelere CUK doğrulaması, allowlist müdahalesi veya anons kanalları yönetimi yetkilendirilmesi sistem tarafından kilitlenmiştir.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <ConfirmationModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Kaydı Sil"
        description="Bu işlem geri alınamaz."
        confirmText="Sil"
        danger
        loading={saving}
      />

      {/* Lockdown confirm */}
      <ConfirmationModal
        isOpen={lockdownConfirm}
        onClose={() => setLockdownConfirm(false)}
        onConfirm={() => { setLockdown((v) => !v); setLockdownConfirm(false); }}
        title={lockdown ? 'Kilidi Kaldır' : 'Acil Durum Kilidi Aktifleştir'}
        description="Bu işlemi onaylıyor musunuz?"
        confirmText="Onayla"
        danger={!lockdown}
      />
    </div>
  );
}

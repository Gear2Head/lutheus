import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '../lib/auth';
import { getAuditLogs, AuditLog, supabaseFetch } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import { Badge } from '../components/ui/Badge';
import { RefreshCw, Plus, Trash2, Shield, AlertTriangle } from 'lucide-react';
import { formatDateTime } from '../lib/utils';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { useToast } from '../contexts/ToastContext';

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

export default function Access() {
  const { session } = useAuth();
  const { showToast } = useToast();
  const canManage = hasPermission(session?.role || '', 'google_allowlist:update');
  const canAssignRole = hasPermission(session?.role || '', 'staff:assign_role');
  const canRepair = ['kurucu', 'admin'].includes(session?.role?.toLowerCase() || '');

  const [allowlist, setAllowlist] = useState<AllowlistEntry[]>([]);
  const [roleCache, setRoleCache] = useState<RoleCacheEntry[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [newEmail, setNewEmail] = useState('');
  const [newEmailRole, setNewEmailRole] = useState('discord_moderatoru');
  const [newIdentity, setNewIdentity] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('discord_moderatoru');

  const [deleteTarget, setDeleteTarget] = useState<{ type: 'allow' | 'cache'; id: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [lockdown, setLockdown] = useState(false);
  const [lockdownConfirm, setLockdownConfirm] = useState(false);
  const [repairing, setRepairing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [al, rc, lg] = await Promise.all([
        supabaseFetch<AllowlistEntry[]>('google_allowlist', 'GET', 'order=created_at.desc').catch(() => []),
        supabaseFetch<any[]>('role_cache', 'GET', 'order=updated_at.desc').catch(() => []),
        getAuditLogs(30).catch(() => []),
      ]);
      setAllowlist(al || []);
      
      const mappedRoleCache = (rc || []).map((r) => {
        const payload = r.raw_payload || {};
        return {
          identity: `discord:${r.discord_id}`,
          display_name: r.display_name || payload.displayName || payload.name || `User ${r.discord_id}`,
          role: r.staff_rank || 'discord_moderatoru',
          created_at: r.updated_at || r.last_synced_at || new Date().toISOString()
        };
      });
      setRoleCache(mappedRoleCache);
      setLogs(lg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const addToAllowlist = async () => {
    if (!newEmail.trim()) return;
    setSaving(true);
    try {
      await supabaseFetch('google_allowlist', 'POST', '', {
        email: newEmail.trim().toLowerCase(),
        dashboard_access_role: newEmailRole,
        active: true,
      });
      setNewEmail('');
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const addToRoleCache = async () => {
    if (!newIdentity.trim() || !newName.trim()) return;
    setSaving(true);
    try {
      const discordId = newIdentity.trim().replace(/^discord:/, '');
      
      // Upsert profile in staff_profiles first to satisfy the FK constraint on role_cache
      await supabaseFetch('staff_profiles', 'POST', '', {
        discord_id: discordId,
        display_name: newName.trim(),
        staff_rank: newRole,
        is_active_staff: true,
        updated_at: new Date().toISOString()
      }).catch(err => console.warn('staff_profile create failed/exists:', err));

      await supabaseFetch('role_cache', 'POST', '', {
        discord_id: discordId,
        staff_rank: newRole,
        active: true,
        source: 'manual_or_cache',
        raw_payload: {
          identityKey: newIdentity.trim(),
          discordId,
          displayName: newName.trim(),
          role: newRole,
          isActiveStaff: true,
          updatedAt: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      });
      setNewIdentity('');
      setNewName('');
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      if (deleteTarget.type === 'allow') {
        await supabaseFetch('google_allowlist', 'DELETE', `email=eq.${encodeURIComponent(deleteTarget.id)}`);
      } else {
        const discordId = deleteTarget.id.replace(/^discord:/, '');
        await supabaseFetch('role_cache', 'DELETE', `discord_id=eq.${encodeURIComponent(discordId)}`);
      }
      setDeleteTarget(null);
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleRepair = async () => {
    setRepairing(true);
    showToast('Veritabanı onarım işlemi başlatıldı...', 'info');
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
        showToast(`Veritabanı başarıyla onarıldı! ${data.count} adet ceza düzeltildi.`, 'success');
      } else {
        showToast('Onarım tamamlandı ancak beklenen yanıt alınamadı.', 'info');
      }
    } catch (err: any) {
      console.error('[Access] Repair failed:', err);
      showToast('Onarım işlemi sırasında bir hata oluştu.', 'error');
    } finally {
      setRepairing(false);
    }
  };

  return (
    <div className="space-y-5 animate-in pb-6">
      <div className="pt-2">
        <h2 className="text-2xl font-bold tracking-tight">Erisim Yönetimi</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Google izin listesi, rol önbelleği ve audit log.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Google Allowlist */}
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-border/50 flex items-center gap-2">
            <div className="w-6 h-6 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4 h-4"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            </div>
            <h3 className="font-semibold text-sm text-foreground">Google Allowlist</h3>
          </div>
          <div className="p-4">
            {canManage && (
              <div className="flex gap-2 mb-3">
                <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email..." className="flex-1 h-9" />
                <select value={newEmailRole} onChange={(e) => setNewEmailRole(e.target.value)} className="h-9 px-2 rounded-[12px] bg-secondary/50 border border-border/50 text-xs text-foreground">
                  <option value="discord_moderatoru">Mod</option>
                  <option value="kidemli_discord_moderatoru">Senior</option>
                  <option value="yonetici">Yönetici</option>
                  <option value="admin">Admin</option>
                </select>
                <Button size="sm" onClick={addToAllowlist} disabled={saving || !newEmail}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
            <div className="space-y-1.5 max-h-64 overflow-y-auto soft-scroll">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-xl" />)
              ) : allowlist.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Kayıt yok</p>
              ) : allowlist.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-secondary/30 border border-border/40">
                  <div>
                    <div className="text-xs font-medium text-foreground">{a.email}</div>
                    <div className="text-[10px] text-muted-foreground">{a.role}</div>
                  </div>
                  {canManage && (
                    <button onClick={() => setDeleteTarget({ type: 'allow', id: a.id })} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Role Cache */}
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-border/50 flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Rol Cache</h3>
          </div>
          <div className="p-4">
            {canAssignRole && (
              <div className="space-y-2 mb-3">
                <div className="flex gap-2">
                  <Input value={newIdentity} onChange={(e) => setNewIdentity(e.target.value)} placeholder="discord:ID" className="flex-1 h-9" />
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Görünen Ad" className="flex-1 h-9" />
                </div>
                <div className="flex gap-2">
                  <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="flex-1 h-9 px-2 rounded-[12px] bg-secondary/50 border border-border/50 text-xs text-foreground">
                    <option value="discord_moderatoru">Mod</option>
                    <option value="kidemli_discord_moderatoru">Senior</option>
                    <option value="yonetici">Yönetici</option>
                    <option value="admin">Admin</option>
                  </select>
                  <Button size="sm" onClick={addToRoleCache} disabled={saving || !newIdentity || !newName}>
                    <Plus className="w-3.5 h-3.5" /> Ekle
                  </Button>
                </div>
              </div>
            )}
            <div className="space-y-1.5 max-h-64 overflow-y-auto soft-scroll">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-xl" />)
              ) : roleCache.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Kayıt yok</p>
              ) : roleCache.map((r) => (
                <div key={r.identity} className="flex items-center justify-between px-3 py-2 rounded-xl bg-secondary/30 border border-border/40">
                  <div>
                    <div className="text-xs font-medium text-foreground">{r.display_name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{r.identity} — {r.role}</div>
                  </div>
                  {canAssignRole && (
                    <button onClick={() => setDeleteTarget({ type: 'cache', id: r.identity })} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Audit Log */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
          <h3 className="font-semibold text-sm text-foreground">Audit Log</h3>
          <button onClick={loadData} className="text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="p-4 space-y-1.5 max-h-64 overflow-y-auto soft-scroll">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-xl" />)
          ) : logs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Log yok</p>
          ) : logs.map((l) => (
            <div key={l.id} className="flex items-start justify-between gap-3 px-3 py-2 rounded-xl bg-secondary/30 border border-border/40">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-foreground">{l.action}</div>
                <div className="text-[10px] text-muted-foreground font-mono truncate">{l.actor_discord_id} → {l.target_id}</div>
              </div>
              <div className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">{formatDateTime(l.created_at)}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Database Healer & Repair */}
      {canRepair && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 text-primary ${repairing ? 'animate-spin' : ''}`} />
              <h3 className="font-semibold text-sm text-foreground">Veritabanı Onarıcı (Database Healer)</h3>
            </div>
            {repairing && <Badge variant="secondary">Onarılıyor...</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mb-4">
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
        </Card>
      )}

      {/* SRE Panel */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <h3 className="font-semibold text-sm text-foreground">Acil Durum Kilidi</h3>
          </div>
          {lockdown && <Badge variant="destructive">LOCKDOWN AKTİF</Badge>}
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Bu butona basıldığında sistem tüm kritik operasyonları kilitler. Sadece acil durumlarda kullanın.
        </p>
        <Button
          variant={lockdown ? 'outline' : 'destructive'}
          size="sm"
          onClick={() => setLockdownConfirm(true)}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          {lockdown ? 'Kilidi Kaldır' : 'ACİL DURUM KİLİDİ (LOCKDOWN)'}
        </Button>
      </Card>

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

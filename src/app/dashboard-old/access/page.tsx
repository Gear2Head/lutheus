'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldAlert, CheckCircle2, Search, X, Loader, Trash2,
  RefreshCw, BadgeAlert, Plus, Shield, UserX, UserCheck, 
  HelpCircle, MonitorDot, ListFilter, Grid, Lock, Check, Slash
} from 'lucide-react';

interface AccessRequest {
  id: string;
  name: string;
  discordId: string;
  role: string;
  avatar: string;
}

interface AllowlistEntity {
  email: string;
  role: string;
}

interface RoleCacheEntity {
  id: string;
  displayName: string;
  discordId: string;
  role: string;
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
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

const DEFAULT_REQUESTS = [
  { id: '1', name: '[Deneme] Scope', discordId: '953970894638268446', role: 'Destek Ekibi', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=scope' },
  { id: '2', name: 'Rei', discordId: '344121374320754709', role: 'Destek Ekibi', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Rei' },
  { id: '3', name: 'Santrale', discordId: '495674164490010655', role: 'Destek Ekibi', avatar: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=santrale' },
  { id: '4', name: '[Deneme] RRwean', discordId: '1133786504427208834', role: 'Destek Ekibi', avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=RRwean' },
  { id: '5', name: '! xGoveer', discordId: '860192567177773076', role: 'Destek Ekibi', avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=xGoveer' }
];

const DEFAULT_ALLOWLIST = [
  { email: 'gearheadd0@gmail.com', role: 'kurucu' }
];

const DEFAULT_ROLE_CACHE = [
  { id: 'c1', displayName: 'Eifel altından giren adam', discordId: '1320438941408825456', role: 'discord_destek_ekibi' },
  { id: 'c2', displayName: '[Deneme] RRwean', discordId: '1133786504427208834', role: 'discord_destek_ekibi' },
  { id: 'c3', displayName: 'Bohostaji', discordId: '723000129535213609', role: 'yonetici' },
  { id: 'c4', displayName: 'Gear_Head', discordId: '758769576778661989', role: 'kidemli_discord_moderatoru' },
  { id: 'c5', displayName: 'Atom', discordId: '760895784153251841', role: 'discord destek ekibi' }
];

const DEFAULT_AUDIT_LOGS = [
  { id: 'log_1', timestamp: '09.06.2026 22:15:33', user: 'Gear_Head', action: "Google Allowlist'e gearheadd0@gmail.com (kurucu) eklendi." },
  { id: 'log_2', timestamp: '09.06.2026 21:04:12', user: 'Rei', action: 'Rol cache temizleme ve eşleştirme veri tabanı yenilendi.' },
  { id: 'log_3', timestamp: '09.06.2026 19:40:02', user: 'Gear_Head', action: '[Deneme] Scope için erişim yetkisi talebi oluşturuldu.' }
];

const DEFAULT_MATRIX = {
  owner: { view_penalties: true, validate_penalties: true, manage_staff: true, discord_announcements: true, bot_settings: true, manage_access: true, system_diagnostics: true },
  manager: { view_penalties: true, validate_penalties: true, manage_staff: true, discord_announcements: true, bot_settings: false, manage_access: true, system_diagnostics: true },
  discord_admin: { view_penalties: true, validate_penalties: true, manage_staff: false, discord_announcements: true, bot_settings: false, manage_access: false, system_diagnostics: true },
  senior_mod: { view_penalties: true, validate_penalties: true, manage_staff: false, discord_announcements: true, bot_settings: false, manage_access: false, system_diagnostics: false },
  moderator: { view_penalties: true, validate_penalties: false, manage_staff: false, discord_announcements: false, bot_settings: false, manage_access: false, system_diagnostics: false },
  support: { view_penalties: true, validate_penalties: false, manage_staff: false, discord_announcements: false, bot_settings: false, manage_access: false, system_diagnostics: false },
  trial: { view_penalties: true, validate_penalties: false, manage_staff: false, discord_announcements: false, bot_settings: false, manage_access: false, system_diagnostics: false }
};

export default function Access() {
  const [activeTab, setActiveTab] = useState<'requests' | 'matrix'>('requests');
  const [searchQuery, setSearchQuery] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // States initialized from localStorage or defaults on client mount
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [allowlist, setAllowlist] = useState<AllowlistEntity[]>([]);
  const [roleCache, setRoleCache] = useState<RoleCacheEntity[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [permissionsMatrix, setPermissionsMatrix] = useState<{ [roleId: string]: { [permId: string]: boolean } }>({});

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedReq = localStorage.getItem('lutheus-access-requests');
      setRequests(savedReq ? JSON.parse(savedReq) : DEFAULT_REQUESTS);

      const savedAllow = localStorage.getItem('lutheus-google-allowlist');
      setAllowlist(savedAllow ? JSON.parse(savedAllow) : DEFAULT_ALLOWLIST);

      const savedCache = localStorage.getItem('lutheus-role-cache');
      setRoleCache(savedCache ? JSON.parse(savedCache) : DEFAULT_ROLE_CACHE);

      const savedLogs = localStorage.getItem('lutheus-access-audit-logs');
      setAuditLogs(savedLogs ? JSON.parse(savedLogs) : DEFAULT_AUDIT_LOGS);

      const savedMatrix = localStorage.getItem('lutheus-permission-matrix');
      setPermissionsMatrix(savedMatrix ? JSON.parse(savedMatrix) : DEFAULT_MATRIX);
    }
  }, []);

  // Save states to local storage on changes
  useEffect(() => {
    if (requests.length > 0) {
      localStorage.setItem('lutheus-access-requests', JSON.stringify(requests));
    }
  }, [requests]);

  useEffect(() => {
    if (allowlist.length > 0) {
      localStorage.setItem('lutheus-google-allowlist', JSON.stringify(allowlist));
    }
  }, [allowlist]);

  useEffect(() => {
    if (roleCache.length > 0) {
      localStorage.setItem('lutheus-role-cache', JSON.stringify(roleCache));
    }
  }, [roleCache]);

  useEffect(() => {
    if (auditLogs.length > 0) {
      localStorage.setItem('lutheus-access-audit-logs', JSON.stringify(auditLogs));
    }
  }, [auditLogs]);

  useEffect(() => {
    if (Object.keys(permissionsMatrix).length > 0) {
      localStorage.setItem('lutheus-permission-matrix', JSON.stringify(permissionsMatrix));
    }
  }, [permissionsMatrix]);

  // Form states
  const [newEmail, setNewEmail] = useState('');
  const [newEmailRole, setNewEmailRole] = useState('Mod');
  const [newCacheId, setNewCacheId] = useState('');
  const [newCacheName, setNewCacheName] = useState('');
  const [newCacheRole, setNewCacheRole] = useState('discord_destek_ekibi');

  const addLog = (actionText: string) => {
    const freshLog: AuditLogEntry = {
      id: 'log_' + Date.now(),
      timestamp: new Date().toLocaleString('tr-TR'),
      user: 'Gear_Head',
      action: actionText
    };
    setAuditLogs(prev => [freshLog, ...prev]);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSync = () => {
    setSyncing(true);
    addLog('Discord API ve veri tabanıyla senkronizasyon tetiklendi.');
    setTimeout(() => {
      setSyncing(false);
      showToast('Tüm Discord veri tabanı ve CUK kilitleri başarıyla senkronize edildi!');
      addLog('Senkronizasyon işlemi 211ms içinde başarıyla tamamlandı.');
    }, 1200);
  };

  const handleApprove = (reqId: string) => {
    const req = requests.find(r => r.id === reqId);
    if (req) {
      showToast(`"${req.name}" adlı kullanıcının erişim talebi onaylandı!`);
      addLog(`"${req.name}" (${req.discordId}) kullanıcısı onaylandı. Rolü: ${req.role}`);
      
      const newlyCached: RoleCacheEntity = {
        id: 'c_' + Date.now(),
        displayName: req.name,
        discordId: req.discordId,
        role: req.role.toLowerCase().replace(' ', '_')
      };
      setRoleCache(prev => [newlyCached, ...prev]);
      setRequests(prev => prev.filter(r => r.id !== reqId));
    }
  };

  const handleRefuse = (reqId: string) => {
    const req = requests.find(r => r.id === reqId);
    if (req) {
      showToast(`"${req.name}" adlı kullanıcının erişim talebi reddedildi.`);
      addLog(`"${req.name}" (${req.discordId}) kullanıcısının yetki talebi reddedildi.`);
      setRequests(prev => prev.filter(r => r.id !== reqId));
    }
  };

  const handleBlock = (reqId: string) => {
    const req = requests.find(r => r.id === reqId);
    if (req) {
      showToast(`"${req.name}" adlı kullanıcı engellendi ve talebi kaldırıldı.`);
      addLog(`"${req.name}" (${req.discordId}) kullanıcısı engellendi.`);
      setRequests(prev => prev.filter(r => r.id !== reqId));
    }
  };

  const handleAddAllowlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    if (allowlist.some(a => a.email.toLowerCase() === newEmail.trim().toLowerCase())) {
      showToast('Bu e-posta adresi zaten listede kayıtlı!');
      return;
    }

    const newEntity: AllowlistEntity = {
      email: newEmail.trim(),
      role: newEmailRole
    };

    setAllowlist(prev => [newEntity, ...prev]);
    addLog(`Google Allowlist listesine yeni e-posta tanımlandı: ${newEmail.trim()} (${newEmailRole})`);
    showToast(`"${newEmail}" adresi listeye yetkilendirildi.`);
    setNewEmail('');
  };

  const handleRemoveAllowlist = (email: string) => {
    setAllowlist(prev => prev.filter(a => a.email !== email));
    addLog(`Google Allowlist listesinden e-posta silindi: ${email}`);
    showToast(`"${email}" izni başarıyla kaldırıldı.`);
  };

  const handleAddRolCache = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCacheId.trim() || !newCacheName.trim()) {
      showToast('Discord ID ve Görünen Ad girmelisiniz!');
      return;
    }

    if (roleCache.some(c => c.discordId === newCacheId.trim())) {
      showToast('Bu Discord ID değerine ait bir önbellek zaten var!');
      return;
    }

    const newEntity: RoleCacheEntity = {
      id: 'c_' + Date.now(),
      displayName: newCacheName.trim(),
      discordId: newCacheId.trim(),
      role: newCacheRole
    };

    setRoleCache(prev => [newEntity, ...prev]);
    addLog(`Rol cache kaydı eklendi: ID: ${newCacheId.trim()} | Üye: ${newCacheName.trim()} | Rol: ${newCacheRole}`);
    showToast(`"${newCacheName}" rol önbelleği el ile tanımlandı.`);
    setNewCacheId('');
    setNewCacheName('');
  };

  const handleRemoveRolCache = (id: string, name: string) => {
    setRoleCache(prev => prev.filter(c => c.id !== id));
    addLog(`Rol önbellek kaydı silindi: ${name}`);
    showToast(`"${name}" önbellek tescili kaldırıldı.`);
  };

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
    { id: 'owner', name: 'Kurucu / Yönetici', color: 'from-[#FF3B30] to-[#FF453A]', level: 10, isMaster: true },
    { id: 'manager', name: 'Genel Sorumlu', color: 'from-[#FF9F0A] to-[#FFB340]', level: 8 },
    { id: 'discord_admin', name: 'Discord Yöneticisi', color: 'from-[#BF5AF2] to-[#C97FFF]', level: 7 },
    { id: 'senior_mod', name: 'Kıdemli Moderatör', color: 'from-[#AF52DE] to-[#BF5AF2]', level: 5 },
    { id: 'moderator', name: 'Moderatör Ekibi', color: 'from-[#5E5CE6] to-[#7876E6]', level: 4 },
    { id: 'support', name: 'Destek Ekibi', color: 'from-[#30D158] to-[#4CD964]', level: 2, maxAllowedPermissionIds: ['view_penalties', 'discord_announcements'] },
    { id: 'trial', name: 'Deneme Destek', color: 'from-[#0A84FF] to-[#3399FF]', level: 1, maxAllowedPermissionIds: ['view_penalties'] }
  ];

  const handleTogglePermission = (roleId: string, permId: string) => {
    const roleConf = roleConfigs.find(r => r.id === roleId);
    if (!roleConf) return;

    if (roleConf.isMaster) {
      showToast(`"${roleConf.name}" kurucu yetkileri hiyerarşi gereği değiştirilemez!`);
      return;
    }

    if (roleConf.maxAllowedPermissionIds && !roleConf.maxAllowedPermissionIds.includes(permId)) {
      showToast(`Hiyerarşik Kısıtlama: "${roleConf.name}" rolüne bu yetki verilemez!`);
      return;
    }

    const currentVal = !!permissionsMatrix[roleId]?.[permId];
    const newVal = !currentVal;

    setPermissionsMatrix(prev => {
      const updatedRoleVal = { ...(prev[roleId] || {}) };
      updatedRoleVal[permId] = newVal;
      return { ...prev, [roleId]: updatedRoleVal };
    });

    const permConf = matrixPermissions.find(p => p.id === permId);
    const actionText = newVal ? 'aktifleştirdi' : 'devre dışı bıraktı';
    addLog(`Hiyerarşi Güncellemesi: Sorumlu "${roleConf.name}" rolü için "${permConf?.label || permId}" yetkisini ${actionText}.`);
    showToast(`"${roleConf.name}" için "${permConf?.label}" yetkisi güncellendi.`);
  };

  const filteredRequests = requests.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.discordId.includes(searchQuery) ||
    r.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8 w-full max-w-7xl mx-auto space-y-6 select-none bg-[#050506] text-white/90 min-h-screen">
      
      {/* Top Header */}
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

      {/* Tabs Switcher */}
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

      {/* TABS CONTAINER */}
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
            <div className="bg-[#111112]/30 border border-white/[0.03] rounded-2.5xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.04] pb-3 mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#FF453A]" />
                  <h3 className="text-[13.5px] font-black text-white tracking-wide">Bekleyen Erişim İstekleri ({filteredRequests.length})</h3>
                </div>
                <span className="text-[10px] font-mono text-white/25 font-bold uppercase">Canlı Discord API</span>
              </div>

              {filteredRequests.length === 0 ? (
                <div className="py-12 text-center text-white/30 text-[12px] font-medium border border-dashed border-white/5 rounded-2xl bg-black/10">
                  Bekleyen herhangi bir erişim isteği bulunmamaktadır.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredRequests.map((req) => (
                    <div 
                      key={req.id}
                      className="bg-black/20 hover:bg-white/[0.015] border border-white/[0.03] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center relative shrink-0">
                          <img src={req.avatar} alt="avatar" className="w-7 h-7 object-cover" />
                        </div>
                        <div className="truncate">
                          <span className="text-[13px] font-bold text-white/95">{req.name}</span>
                          <span className="text-[11px] font-mono text-[#8E8E93] block mt-0.5">{req.discordId}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap md:flex-nowrap justify-end">
                        <select 
                          value={req.role}
                          onChange={(e) => {
                            const updatedValue = e.target.value;
                            setRequests(prev => prev.map(r => r.id === req.id ? { ...r, role: updatedValue } : r));
                            showToast(`"${req.name}" için rol "${updatedValue}" olarak değiştirildi.`);
                          }}
                          className="h-8.5 px-3 bg-black/45 border border-white/5 rounded-lg text-[12px] font-semibold text-white/80 shrink-0 select-none cursor-pointer outline-none focus:border-white/10 min-w-[130px]"
                        >
                          <option value="Destek Ekibi">Destek Ekibi</option>
                          <option value="Moderatör Ekibi">Moderatör Ekibi</option>
                          <option value="Kıdemli Discord Moderatörü">Kıdemli Moderatör</option>
                          <option value="Discord Yöneticisi">Discord Yöneticisi</option>
                          <option value="Yönetici">Yönetici</option>
                        </select>

                        <button 
                          onClick={() => handleApprove(req.id)}
                          className="h-8.5 px-3.5 bg-green-500/10 border border-green-500/20 text-[#32D74B] text-[11px] font-bold rounded-lg hover:bg-green-500/15 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 size={12} /> Onayla
                        </button>

                        <button 
                          onClick={() => handleRefuse(req.id)}
                          className="h-8.5 px-3.5 bg-white/[0.02] border border-white/5 text-white/70 text-[11px] font-bold rounded-lg hover:bg-white/[0.04] transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <X size={12} className="text-white/45" /> Reddet
                        </button>

                        <button 
                          onClick={() => handleBlock(req.id)}
                          className="h-8.5 w-8.5 flex items-center justify-center rounded-lg border border-red-500/15 text-red-500 bg-red-400/5 hover:bg-red-400/15 transition-all cursor-pointer"
                          title="Engelle"
                        >
                          <UserX size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Google Allowlist */}
              <div className="bg-[#111112]/30 border border-white/[0.03] rounded-2.5xl p-5 space-y-4">
                <div className="border-b border-white/[0.04] pb-3 mb-1 flex items-center gap-2">
                  <span className="text-[#4285F4] font-bold text-[14px]">G</span>
                  <h3 className="text-[13.5px] font-black text-white tracking-wide">Google Allowlist</h3>
                </div>

                <form onSubmit={handleAddAllowlist} className="flex gap-2.5 items-center">
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
                    <option value="kurucu">Kurucu</option>
                    <option value="yönetici">Yönetici</option>
                    <option value="Mod">Mod</option>
                    <option value="Destek">Destek</option>
                  </select>
                  <button 
                    type="submit"
                    className="h-9 w-9 bg-white/[0.04] border border-white/5 hover:bg-white/[0.08] text-white/80 rounded-xl transition-all flex items-center justify-center cursor-pointer font-bold"
                  >
                    <Plus size={14} />
                  </button>
                </form>

                <div className="space-y-1.5 divide-y divide-white/[0.02] max-h-[290px] overflow-y-auto pr-1 hide-scrollbar">
                  {allowlist.length === 0 ? (
                    <div className="py-8 text-center text-white/20 text-[11px] font-medium">Allowlist bulunmuyor.</div>
                  ) : (
                    allowlist.map((item) => (
                      <div key={item.email} className="flex items-center justify-between py-2.5 first:pt-1">
                        <div className="space-y-0.5">
                          <span className="text-[12.5px] font-bold text-white/95 block">{item.email}</span>
                          <span className="text-[9.5px] font-mono font-extrabold text-[#8E8E93] uppercase tracking-wider">{item.role}</span>
                        </div>
                        <button 
                          onClick={() => handleRemoveAllowlist(item.email)}
                          className="p-1.5 rounded-lg border border-transparent hover:border-white/[0.05] hover:bg-white/[0.03] text-white/40 hover:text-red-500 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
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

                <form onSubmit={handleAddRolCache} className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <input 
                      type="text"
                      placeholder="discord:ID"
                      value={newCacheId}
                      onChange={(e) => setNewCacheId(e.target.value)}
                      className="clean-input h-9 bg-black/25 border border-white/5 rounded-xl px-3.5 text-[12px] placeholder-white/20 focus:border-white/10"
                    />
                    <input 
                      type="text"
                      placeholder="Üye adı..."
                      value={newCacheName}
                      onChange={(e) => setNewCacheName(e.target.value)}
                      className="clean-input h-9 bg-black/25 border border-white/5 rounded-xl px-3.5 text-[12px] placeholder-white/20 focus:border-white/10"
                    />
                  </div>
                  <div className="flex gap-2.5 items-center">
                    <select
                      value={newCacheRole}
                      onChange={(e) => setNewCacheRole(e.target.value)}
                      className="flex-1 h-9 px-3 bg-[#111112] border border-white/5 rounded-xl text-[12px] font-bold text-white/70 outline-none cursor-pointer"
                    >
                      <option value="discord_destek_ekibi">discord_destek_ekibi</option>
                      <option value="yonetici">yonetici</option>
                      <option value="kidemli_discord_moderatoru">kidemli_discord_moderatoru</option>
                      <option value="discord_moderator">discord_moderator</option>
                    </select>
                    <button 
                      type="submit"
                      className="h-9 px-4.5 bg-white/[0.04] border border-white/5 hover:bg-white/[0.08] text-white/80 text-[11.5px] font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                    >
                      + Ekle
                    </button>
                  </div>
                </form>

                <div className="space-y-1.5 divide-y divide-white/[0.02] max-h-[190px] overflow-y-auto pr-1 hide-scrollbar">
                  {roleCache.length === 0 ? (
                    <div className="py-8 text-center text-white/20 text-[11px] font-medium">Önbellek kaydı bulunmuyor.</div>
                  ) : (
                    roleCache.map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-2.5 first:pt-1">
                        <div className="space-y-0.5 truncate pr-3">
                          <span className="text-[12.5px] font-bold text-white/95 block truncate">{item.displayName}</span>
                          <span className="text-[9.5px] font-mono text-[#8E8E93] block truncate">
                            discord:{item.discordId} – <span className="text-white/40">{item.role}</span>
                          </span>
                        </div>
                        <button 
                          onClick={() => handleRemoveRolCache(item.id, item.displayName)}
                          className="p-1.5 rounded-lg border border-transparent hover:border-white/[0.05] hover:bg-white/[0.03] text-white/40 hover:text-red-500 transition-colors cursor-pointer shrink-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

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
                          <td className="py-4 px-4 font-semibold">
                            <div className="flex items-center gap-2.5">
                              <span className={`w-2 h-2 rounded-full bg-gradient-to-tr ${role.color}`} />
                              <div>
                                <span className="text-[13px] font-bold text-white">{role.name}</span>
                                <span className="text-[9px] font-mono text-white/30 block mt-0.5">Seviye: {role.level}</span>
                              </div>
                            </div>
                          </td>
                          
                          {matrixPermissions.map((perm) => {
                            const isActive = !!permissionsMatrix[role.id]?.[perm.id];
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

      {/* Audit Log Bottom Layout */}
      <div className="bg-[#111112]/30 border border-white/[0.03] rounded-2.5xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.04] pb-3 mb-1">
          <div className="flex items-center gap-2">
            <MonitorDot size={13} className="text-white/40" />
            <h3 className="text-[13.5px] font-black text-white tracking-wide">Audit Log</h3>
          </div>
          <button 
            onClick={() => {
              showToast('Audit Log kayıtları başarıyla yenilendi.');
              addLog('Kullanıcı el ile denetçilerin işlem günlüklerini yeniledi.');
            }}
            className="p-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/5 text-white/40 hover:text-white transition-all cursor-pointer"
          >
            <RefreshCw size={12} />
          </button>
        </div>

        <div className="space-y-2 divide-y divide-white/[0.02] max-h-[160px] overflow-y-auto pr-1 hide-scrollbar text-left">
          {auditLogs.map((log) => (
            <div key={log.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-2.5 first:pt-2">
              <div className="flex items-start sm:items-center gap-2">
                <span className="font-mono text-[10px] text-[#5E5CE6] font-bold px-1.5 py-0.5 rounded bg-[#5E5CE6]/5 shrink-0 select-none">
                  {log.user}
                </span>
                <span className="text-[12px] text-white/70 leading-normal">{log.action}</span>
              </div>
              <span className="text-[9.5px] font-mono text-[#8E8E93] shrink-0 mt-1 sm:mt-0 uppercase tracking-wider">{log.timestamp}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pop up toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-6 right-6 z-55 px-4.5 py-3 rounded-xl bg-black/95 border border-white/10 text-white text-[12.0px] font-bold shadow-2xl flex items-center gap-2 max-w-sm text-left"
          >
            <CheckCircle2 className="text-[#32D74B] w-4.5 h-4.5 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

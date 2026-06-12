import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '../lib/auth';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../contexts/ToastContext';
import { motion, AnimatePresence } from 'motion/react';
import { getGlassClass } from '../lib/theme';
import {
  Bot, RefreshCw, AlertTriangle, Shield, Check, X,
  Terminal, Settings, Play, Radio, Users, MessageSquare,
  Activity, Zap, Info, Clock, CheckCircle2, Sliders, Bell, Save,
  ChevronDown, ChevronRight
} from 'lucide-react';
import { formatDateTime } from '../lib/utils';

// SECTION: BOT_SETUP_PAGE
// PURPOSE: Management page for Discord bot configuration, diagnostics, actions queue, and live heartbeat monitoring.
// Actions route through /api/admin/discord-bot-* endpoints.

interface Guild {
  id: string;
  name: string;
  memberCount: number;
  botInstalled: boolean;
  manageable: boolean;
  iconUrl: string | null;
}

interface Command {
  name: string;
  description: string;
}

interface BotActionAudit {
  id: string;
  action: string;
  status: 'pending' | 'completed' | 'failed';
  requested_by_discord_id: string | null;
  payload: unknown;
  result: unknown;
  created_at: string;
  processed_at: string | null;
}

interface RuntimeStatus {
  is_alive?: boolean;
  latency_ms?: number;
  memory_usage_mb?: number;
  uptime_seconds?: number;
  last_heartbeat_at?: string;
}

interface AdminApiClientType {
  listDiscordBotGuilds(): Promise<Guild[]>;
  getDiscordBotDashboard(guildId: string): Promise<{
    config?: BotConfig | null;
    channels?: { id: string; name: string; type: number }[];
    roles?: { id: string; name: string; color: number }[];
    commands?: Command[];
    runtime?: RuntimeStatus | null;
    recentActions?: BotActionAudit[];
    caseCounts?: number;
    invalidCases?: number;
  }>;
  saveDiscordBotConfig(guildId: string, config: BotConfig): Promise<void>;
  triggerDiscordBotAction(guildId: string, action: string, payload: unknown): Promise<{ success: boolean; message?: string }>;
}

interface BotConfig {
  guildId: string;
  logChannelId: string;
  alertChannelId: string;
  statsChannelId: string;
  prefix: string;
  isActive: boolean;
  welcomeSettings: {
    channelId: string;
    welcomeMessage: string;
    goodbyeMessage: string;
    sendDm: boolean;
    embedEnabled: boolean;
  };
  loggingSettings: {
    channelId: string;
    events: Record<string, boolean>;
  };
}

export default function BotSetup() {
  const { session } = useAuth();
  const { showToast } = useToast();

  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState<string>('');
  const [loadingGuilds, setLoadingGuilds] = useState(true);
  
  // Dashboard details state
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null);
  const [channels, setChannels] = useState<{ id: string; name: string; type: number }[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string; color: number }[]>([]);
  const [commands, setCommands] = useState<Command[]>([]);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null);
  const [recentActions, setRecentActions] = useState<BotActionAudit[]>([]);
  const [caseCounts, setCaseCounts] = useState<number>(0);
  const [invalidCases, setInvalidCases] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Accordion open/close state
  const [sections, setSections] = useState({
    status: true,
    channels: true,
    welcome: true,
    diagnostics: true,
    history: true,
    commands: false
  });

  const toggleSection = (key: keyof typeof sections) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const [intensity, setIntensity] = useState<string>(() => {
    return localStorage.getItem('lutheus-intensity') || 'frosted';
  });
  const [theme, setTheme] = useState<string>(() => {
    for (const cls of ['dark', 'light', 'lavender', 'corporate']) {
      if (document.documentElement.classList.contains(cls)) return cls;
    }
    return 'dark';
  });

  useEffect(() => {
    const handleIntensityChange = () => {
      setIntensity(localStorage.getItem('lutheus-intensity') || 'frosted');
    };
    window.addEventListener('storage', handleIntensityChange);
    window.addEventListener('lutheus-intensity-change', handleIntensityChange);
    return () => {
      window.removeEventListener('storage', handleIntensityChange);
      window.removeEventListener('lutheus-intensity-change', handleIntensityChange);
    };
  }, []);

  const canManage = session ? hasPermission(session.role, 'discord_bot:update') : false;

  // Load user's bot-installed guilds
  const loadGuilds = async () => {
    setLoadingGuilds(true);
    try {
      const { AdminApiClient } = await import('../../../lib/adminApiClient.js') as unknown as { AdminApiClient: AdminApiClientType };
      const data = await AdminApiClient.listDiscordBotGuilds();
      setGuilds(data || []);
      if (data && data.length > 0) {
        setSelectedGuildId(data[0].id);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      showToast(`Discord sunuculari yuklenemedi: ${errMsg}`, 'error');
    } finally {
      setLoadingGuilds(false);
    }
  };

  // Load dashboard details for the selected guild
  const loadDashboardDetails = async (guildId: string) => {
    if (!guildId) return;
    setLoadingDetails(true);
    try {
      const { AdminApiClient } = await import('../../../lib/adminApiClient.js') as unknown as { AdminApiClient: AdminApiClientType };
      const data = await AdminApiClient.getDiscordBotDashboard(guildId);
      setBotConfig(data.config || null);
      setChannels(data.channels || []);
      setRoles(data.roles || []);
      setCommands(data.commands || []);
      setRuntimeStatus(data.runtime || null);
      setRecentActions(data.recentActions || []);
      setCaseCounts(data.caseCounts || 0);
      setInvalidCases(data.invalidCases || 0);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      showToast(`Sunucu detaylari yuklenemedi: ${errMsg}`, 'error');
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    loadGuilds();
  }, []);

  useEffect(() => {
    if (selectedGuildId) {
      loadDashboardDetails(selectedGuildId);
    } else {
      setBotConfig(null);
    }
  }, [selectedGuildId]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGuildId || !botConfig) return;
    setSaving(true);
    try {
      const { AdminApiClient } = await import('../../../lib/adminApiClient.js') as unknown as { AdminApiClient: AdminApiClientType };
      await AdminApiClient.saveDiscordBotConfig(selectedGuildId, botConfig);
      showToast('Bot yapilandirmasi basariyla kaydedildi.', 'success');
      await loadDashboardDetails(selectedGuildId);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      showToast(`Yapilandirma kaydedilemedi: ${errMsg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerAction = async (action: string, payload: unknown = {}) => {
    if (!selectedGuildId) return;
    setActionLoading(action);
    try {
      const { AdminApiClient } = await import('../../../lib/adminApiClient.js') as unknown as { AdminApiClient: AdminApiClientType };
      const res = await AdminApiClient.triggerDiscordBotAction(selectedGuildId, action, payload);
      if (res.success) {
        showToast(res.message || 'Islem tetiklendi.', 'success');
      }
      // Refresh dashboard details to show updated queue / actions list
      setTimeout(() => loadDashboardDetails(selectedGuildId), 1500);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      showToast(`Islem basarisiz: ${errMsg}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Channel helper to get text channels
  const textChannels = channels.filter(c => c.type === 0 || c.type === 4 || c.type === 5); // 0: Text, 4: Category, 5: News

  return (
    <div className="p-6 md:p-8 w-full min-h-screen flex flex-col relative select-none bg-[#050506] text-white/90">
      
      {/* Header */}
      <div className="pb-6 mb-6 border-b border-white/[0.04] text-left max-w-[850px] w-full mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-black text-white tracking-tight">Discord Bot Yönetimi</h2>
          <p className="text-[13px] text-[#8E8E93] mt-1 font-medium">Log kanalları, karşılama mesajları, acil durum kontrolleri ve bot tanılama</p>
        </div>
        <button
          onClick={() => selectedGuildId ? loadDashboardDetails(selectedGuildId) : loadGuilds()}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] text-[12px] font-bold text-white transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Yenile
        </button>
      </div>

      <div className="max-w-[850px] w-full space-y-6 text-left mx-auto">
        
        {/* Guild Selector */}
        <div className={`p-5 rounded-2xl ${getGlassClass(intensity, theme)} overflow-hidden`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#B19CD9]">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-white/40 block">AKTİF DISCORD SUNUCUSU</span>
                <span className="text-[13.5px] font-bold text-white mt-1 block">Yapılandırmak istediğiniz Discord sunucusunu seçin</span>
              </div>
            </div>
            <div className="w-full sm:w-64">
              {loadingGuilds ? (
                <Skeleton className="h-10 w-full rounded-xl bg-white/5" />
              ) : guilds.length === 0 ? (
                <select disabled className="w-full h-10 px-3.5 rounded-xl bg-[#111112] border border-white/10 text-xs text-white/40">
                  <option>Bot yüklü sunucu bulunamadı</option>
                </select>
              ) : (
                <select
                  value={selectedGuildId}
                  onChange={e => setSelectedGuildId(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl bg-[#111112] border border-white/10 text-sm text-white/95 focus:outline-none focus:border-[#B19CD9]/40 cursor-pointer"
                >
                  {guilds.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Main dashboard content */}
        {!selectedGuildId ? (
          <EmptyState
            icon={<Bot className="w-8 h-8" />}
            title="Lütfen bir sunucu seçin"
          />
        ) : loadingDetails ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-5 bg-white/5 border border-white/10 space-y-4">
                <Skeleton className="h-6 w-48 bg-white/5" />
                <Skeleton className="h-10 w-full bg-white/5" />
                <Skeleton className="h-10 w-full bg-white/5" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            
            {/* Accordion 1: Bot Çalışma Durumu (Heartbeat) */}
            <div className={`rounded-xl border border-white/[0.04] overflow-hidden ${getGlassClass(intensity, theme)}`}>
              <button
                onClick={() => toggleSection('status')}
                className="w-full px-5 py-4 flex items-center justify-between bg-black/10 hover:bg-black/20 transition-all text-left border-none cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Radio size={15} className={`text-[#32D74B] ${runtimeStatus?.is_alive !== false ? 'animate-pulse' : ''}`} />
                  <span className="text-[13.5px] font-bold text-white">Bot Çalışma Durumu (Heartbeat)</span>
                </div>
                <div className="flex items-center gap-3">
                  {runtimeStatus?.is_alive !== false ? (
                    <Badge className="bg-[#30D158]/10 border border-[#30D158]/25 text-[#30D158] text-[9.5px] font-extrabold uppercase font-mono px-2 py-0.5 rounded">ONLINE</Badge>
                  ) : (
                    <Badge className="bg-[#FF453A]/10 border border-[#FF453A]/25 text-[#FF453A] text-[9.5px] font-extrabold uppercase font-mono px-2 py-0.5 rounded">OFFLINE</Badge>
                  )}
                  {sections.status ? <ChevronDown size={14} className="text-white/40" /> : <ChevronRight size={14} className="text-white/40" />}
                </div>
              </button>

              <AnimatePresence initial={false}>
                {sections.status && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-white/[0.04] bg-[#0E0E10]/15"
                  >
                    <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="p-4 rounded-xl bg-black/20 border border-white/5 text-center">
                        <span className="text-[9px] font-mono font-bold text-white/35 uppercase tracking-wider block">Gecikme (Ping)</span>
                        <span className="text-lg font-black mt-1.5 block text-white">
                          {runtimeStatus?.latency_ms ? `${runtimeStatus.latency_ms} ms` : 'N/A'}
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-black/20 border border-white/5 text-center">
                        <span className="text-[9px] font-mono font-bold text-white/35 uppercase tracking-wider block">Bellek Kullanımı</span>
                        <span className="text-lg font-black mt-1.5 block text-white">
                          {runtimeStatus?.memory_usage_mb ? `${runtimeStatus.memory_usage_mb} MB` : 'N/A'}
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-black/20 border border-white/5 text-center">
                        <span className="text-[9px] font-mono font-bold text-white/35 uppercase tracking-wider block">Uptime</span>
                        <span className="text-sm font-bold mt-2.5 truncate block text-white/90">
                          {runtimeStatus?.uptime_seconds ? `${Math.floor(runtimeStatus.uptime_seconds / 3600)}s ${Math.floor((runtimeStatus.uptime_seconds % 3600) / 60)}d` : 'N/A'}
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-black/20 border border-white/5 text-center">
                        <span className="text-[9px] font-mono font-bold text-white/35 uppercase tracking-wider block">Son Sinyal (Heartbeat)</span>
                        <span className="text-[11.5px] font-semibold mt-3 block text-white/80">
                          {runtimeStatus?.last_heartbeat_at ? formatDateTime(runtimeStatus.last_heartbeat_at) : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Accordion 2: Bot Kanalları & Ayarları */}
            {botConfig && (
              <div className={`rounded-xl border border-white/[0.04] overflow-hidden ${getGlassClass(intensity, theme)}`}>
                <button
                  onClick={() => toggleSection('channels')}
                  className="w-full px-5 py-4 flex items-center justify-between bg-black/10 hover:bg-black/20 transition-all text-left border-none cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Settings size={15} className="text-[#0A84FF]" />
                    <span className="text-[13.5px] font-bold text-white">Bot Kanalları & Ayarları</span>
                  </div>
                  {sections.channels ? <ChevronDown size={14} className="text-white/40" /> : <ChevronRight size={14} className="text-white/40" />}
                </button>

                <AnimatePresence initial={false}>
                  {sections.channels && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-white/[0.04] bg-[#0E0E10]/15"
                    >
                      <form onSubmit={handleSaveConfig} className="p-5 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          
                          {/* Log Channel */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-widest block">Log Kanalı</label>
                            <select
                              value={botConfig.logChannelId}
                              onChange={e => setBotConfig(prev => prev ? ({ ...prev, logChannelId: e.target.value }) : null)}
                              disabled={!canManage}
                              className="w-full h-10 px-3.5 rounded-xl bg-[#111112] border border-white/10 text-sm text-white/95 focus:outline-none focus:border-[#B19CD9]/40 cursor-pointer disabled:opacity-50"
                            >
                              <option value="">Seçilmedi</option>
                              {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                            </select>
                          </div>

                          {/* Alert Channel */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-widest block">CUK Hataları / Uyarılar Kanalı</label>
                            <select
                              value={botConfig.alertChannelId}
                              onChange={e => setBotConfig(prev => prev ? ({ ...prev, alertChannelId: e.target.value }) : null)}
                              disabled={!canManage}
                              className="w-full h-10 px-3.5 rounded-xl bg-[#111112] border border-white/10 text-sm text-white/95 focus:outline-none focus:border-[#B19CD9]/40 cursor-pointer disabled:opacity-50"
                            >
                              <option value="">Seçilmedi</option>
                              {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                            </select>
                          </div>

                          {/* Stats Channel */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-widest block">Haftalık İstatistik Kanalı</label>
                            <select
                              value={botConfig.statsChannelId}
                              onChange={e => setBotConfig(prev => prev ? ({ ...prev, statsChannelId: e.target.value }) : null)}
                              disabled={!canManage}
                              className="w-full h-10 px-3.5 rounded-xl bg-[#111112] border border-white/10 text-sm text-white/95 focus:outline-none focus:border-[#B19CD9]/40 cursor-pointer disabled:opacity-50"
                            >
                              <option value="">Seçilmedi</option>
                              {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                            </select>
                          </div>

                          {/* Bot Prefix */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-widest block">Bot Komut Prefixi</label>
                            <input
                              value={botConfig.prefix || '!'}
                              onChange={e => setBotConfig(prev => prev ? ({ ...prev, prefix: e.target.value }) : null)}
                              disabled={!canManage}
                              placeholder="!"
                              required
                              className="w-full h-10 px-3.5 rounded-xl bg-[#111112] border border-white/10 text-sm text-white/95 focus:outline-none focus:border-[#B19CD9]/40 disabled:opacity-50"
                            />
                          </div>
                        </div>

                        {canManage && (
                          <div className="flex justify-end pt-2">
                            <Button type="submit" size="sm" disabled={saving} className="bg-[#B19CD9] hover:bg-[#B19CD9]/90 text-black font-extrabold flex items-center gap-1.5 h-8.5 rounded-lg border-none shadow-sm cursor-pointer">
                              <Save className="w-3.5 h-3.5" />
                              {saving ? 'Kaydediliyor...' : 'Yapılandırmayı Kaydet'}
                            </Button>
                          </div>
                        )}
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Accordion 3: Yeni Gelen Karşılama Ayarları */}
            {botConfig && (
              <div className={`rounded-xl border border-white/[0.04] overflow-hidden ${getGlassClass(intensity, theme)}`}>
                <button
                  onClick={() => toggleSection('welcome')}
                  className="w-full px-5 py-4 flex items-center justify-between bg-black/10 hover:bg-black/20 transition-all text-left border-none cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <MessageSquare size={15} className="text-[#BF5AF2]" />
                    <span className="text-[13.5px] font-bold text-white">Yeni Gelen Karşılama Ayarları</span>
                  </div>
                  {sections.welcome ? <ChevronDown size={14} className="text-white/40" /> : <ChevronRight size={14} className="text-white/40" />}
                </button>

                <AnimatePresence initial={false}>
                  {sections.welcome && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-white/[0.04] bg-[#0E0E10]/15"
                    >
                      <form onSubmit={handleSaveConfig} className="p-5 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          
                          {/* Welcome Channel */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-widest block">Karşılama Kanalı</label>
                            <select
                              value={botConfig.welcomeSettings?.channelId || ''}
                              onChange={e => setBotConfig(prev => {
                                if (!prev) return null;
                                return {
                                  ...prev,
                                  welcomeSettings: {
                                    ...prev.welcomeSettings,
                                    channelId: e.target.value
                                  }
                                };
                              })}
                              disabled={!canManage}
                              className="w-full h-10 px-3.5 rounded-xl bg-[#111112] border border-white/10 text-sm text-white/95 focus:outline-none focus:border-[#B19CD9]/40 cursor-pointer disabled:opacity-50"
                            >
                              <option value="">Seçilmedi</option>
                              {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                            </select>
                          </div>

                          {/* Welcome Embed Checkbox */}
                          <div className="flex items-center gap-2.5 pt-6">
                            <input
                              type="checkbox"
                              id="welcome-embed"
                              checked={botConfig.welcomeSettings?.embedEnabled || false}
                              onChange={e => setBotConfig(prev => {
                                if (!prev) return null;
                                return {
                                  ...prev,
                                  welcomeSettings: {
                                    ...prev.welcomeSettings,
                                    embedEnabled: e.target.checked
                                  }
                                };
                              })}
                              disabled={!canManage}
                              className="w-4.5 h-4.5 rounded border-white/10 bg-[#111112] text-[#B19CD9] focus:ring-transparent cursor-pointer"
                            />
                            <label htmlFor="welcome-embed" className="text-[12.5px] font-bold text-white/80 cursor-pointer select-none">
                              Mesajı Embed Tasarımıyla Gönder
                            </label>
                          </div>
                        </div>

                        {/* Welcome Message Text */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-widest block">Karşılama Metni</label>
                          <textarea
                            value={botConfig.welcomeSettings?.welcomeMessage || ''}
                            onChange={e => setBotConfig(prev => {
                              if (!prev) return null;
                              return {
                                ...prev,
                                welcomeSettings: {
                                  ...prev.welcomeSettings,
                                  welcomeMessage: e.target.value
                                }
                              };
                            })}
                            disabled={!canManage}
                            rows={3}
                            placeholder="Hos geldin {user}!"
                            className="w-full px-3.5 py-3 rounded-xl bg-[#111112] border border-white/10 text-sm text-white/95 focus:outline-none focus:border-[#B19CD9]/40 disabled:opacity-50 resize-none font-medium"
                          />
                          <span className="text-[10px] text-white/35 font-medium block mt-1">Desteklenen değişkenler: {"{user}"} (Etiket), {"{username}"} (İsim), {"{server}"} (Sunucu İsmi)</span>
                        </div>

                        {canManage && (
                          <div className="flex justify-end pt-2">
                            <Button type="submit" size="sm" disabled={saving} className="bg-[#B19CD9] hover:bg-[#B19CD9]/90 text-black font-extrabold flex items-center gap-1.5 h-8.5 rounded-lg border-none shadow-sm cursor-pointer">
                              <Save className="w-3.5 h-3.5" />
                              {saving ? 'Kaydediliyor...' : 'Yapılandırmayı Kaydet'}
                            </Button>
                          </div>
                        )}
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Accordion 4: Bot Tanılama Araçları */}
            <div className={`rounded-xl border border-white/[0.04] overflow-hidden ${getGlassClass(intensity, theme)}`}>
              <button
                onClick={() => toggleSection('diagnostics')}
                className="w-full px-5 py-4 flex items-center justify-between bg-black/10 hover:bg-black/20 transition-all text-left border-none cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Zap size={15} className="text-[#FF9F0A]" />
                  <span className="text-[13.5px] font-bold text-white">Bot Tanılama & Hızlı Araçlar</span>
                </div>
                {sections.diagnostics ? <ChevronDown size={14} className="text-white/40" /> : <ChevronRight size={14} className="text-white/40" />}
              </button>

              <AnimatePresence initial={false}>
                {sections.diagnostics && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-white/[0.04] bg-[#0E0E10]/15"
                  >
                    <div className="p-5 space-y-4">
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        
                        {/* Test Alert */}
                        <button
                          onClick={() => handleTriggerAction('test_alert')}
                          disabled={actionLoading !== null || !canManage}
                          className="flex items-center justify-between p-4 rounded-xl bg-black/20 border border-white/5 hover:bg-white/[0.02] hover:border-white/10 transition-all disabled:opacity-50 text-left cursor-pointer"
                        >
                          <div className="space-y-0.5">
                            <span className="text-[12.5px] font-bold text-white block">Test Alert Gönder</span>
                            <span className="text-[10px] text-white/35 font-medium block">Alarm kanalına örnek CUK hatası iletir.</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-white/30" />
                        </button>

                        {/* Test Welcome */}
                        <button
                          onClick={() => handleTriggerAction('test_welcome')}
                          disabled={actionLoading !== null || !canManage}
                          className="flex items-center justify-between p-4 rounded-xl bg-black/20 border border-white/5 hover:bg-white/[0.02] hover:border-white/10 transition-all disabled:opacity-50 text-left cursor-pointer"
                        >
                          <div className="space-y-0.5">
                            <span className="text-[12.5px] font-bold text-white block">Test Karşılama Gönder</span>
                            <span className="text-[10px] text-white/35 font-medium block">Karşılama kanalına test mesajı iletir.</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-white/30" />
                        </button>

                        {/* Sync Commands */}
                        <button
                          onClick={() => handleTriggerAction('sync_commands')}
                          disabled={actionLoading !== null || !canManage}
                          className="flex items-center justify-between p-4 rounded-xl bg-black/20 border border-white/5 hover:bg-white/[0.02] hover:border-white/10 transition-all disabled:opacity-50 text-left cursor-pointer"
                        >
                          <div className="space-y-0.5">
                            <span className="text-[12.5px] font-bold text-white block">Slash Komutlarını Eşitle</span>
                            <span className="text-[10px] text-white/35 font-medium block">Slash komutlarını Discord API ile senkronize eder.</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-white/30" />
                        </button>

                        {/* Metadata force sync */}
                        <button
                          onClick={() => handleTriggerAction('force_sync')}
                          disabled={actionLoading !== null || !canManage}
                          className="flex items-center justify-between p-4 rounded-xl bg-black/20 border border-white/5 hover:bg-white/[0.02] hover:border-white/10 transition-all disabled:opacity-50 text-left cursor-pointer"
                        >
                          <div className="space-y-0.5">
                            <span className="text-[12.5px] font-bold text-white block">Kanalları & Rolleri Eşitle</span>
                            <span className="text-[10px] text-white/35 font-medium block">Discord sunucu verilerini zorla bota çeker.</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-white/30" />
                        </button>
                      </div>

                      {/* Emergency Lockdown */}
                      <div className="border-t border-white/[0.04] pt-4 mt-2">
                        <span className="text-[11px] font-mono font-bold text-[#FF453A] uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4" /> Acil Durum Kanalları Kilitleme (Lockdown)
                        </span>
                        <p className="text-[11.5px] text-white/40 leading-relaxed mb-4">
                          Acil bir durumda, sunucudaki tüm kritik operasyonları ve komutları askıya alarak kanalları kilitler veya kilidi açar.
                        </p>
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleTriggerAction('lockdown')}
                            disabled={actionLoading !== null || !canManage}
                            className="flex-1 h-9 bg-[#FF453A]/10 hover:bg-[#FF453A]/20 border border-[#FF453A]/20 text-[#FF453A] text-[12px] font-bold rounded-lg cursor-pointer transition-all disabled:opacity-40"
                          >
                            ACİL KİLİT (LOCKDOWN)
                          </button>
                          <button
                            onClick={() => handleTriggerAction('unlockdown')}
                            disabled={actionLoading !== null || !canManage}
                            className="flex-1 h-9 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-[12px] font-bold rounded-lg cursor-pointer transition-all disabled:opacity-40"
                          >
                            KİLİDİ AÇ (UNLOCK)
                          </button>
                        </div>
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Accordion 5: Bot Aksiyon Geçmişi & Sırası */}
            <div className={`rounded-xl border border-white/[0.04] overflow-hidden ${getGlassClass(intensity, theme)}`}>
              <button
                onClick={() => toggleSection('history')}
                className="w-full px-5 py-4 flex items-center justify-between bg-black/10 hover:bg-black/20 transition-all text-left border-none cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Terminal size={15} className="text-[#FF3B30]" />
                  <span className="text-[13.5px] font-bold text-white">Bot Aksiyon Geçmişi & Sırası</span>
                </div>
                {sections.history ? <ChevronDown size={14} className="text-white/40" /> : <ChevronRight size={14} className="text-white/40" />}
              </button>

              <AnimatePresence initial={false}>
                {sections.history && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-white/[0.04] bg-[#0E0E10]/15"
                  >
                    <div className="p-5 space-y-3.5 max-h-80 overflow-y-auto soft-scroll">
                      {recentActions.length === 0 ? (
                        <p className="text-[12px] text-white/30 text-center py-6 font-medium">Henüz aksiyon audit log kaydı bulunmuyor.</p>
                      ) : (
                        recentActions.map(action => {
                          const statusColors = {
                            pending: 'warning' as const,
                            completed: 'success' as const,
                            failed: 'destructive' as const
                          };
                          const statusLabels = {
                            pending: 'Bekliyor',
                            completed: 'Başarılı',
                            failed: 'Hata'
                          };
                          return (
                            <div key={action.id} className="flex items-start justify-between gap-3 p-4 rounded-xl bg-black/20 border border-white/5 hover:border-white/10 transition-all">
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <span className="font-extrabold text-[12.5px] text-white font-mono">{action.action}</span>
                                  {action.status === 'completed' && (
                                    <Badge className="bg-[#30D158]/10 border border-[#30D158]/20 text-[#30D158] text-[9px] px-1.5 py-0.5 rounded font-bold font-mono">Başarılı</Badge>
                                  )}
                                  {action.status === 'failed' && (
                                    <Badge className="bg-[#FF453A]/10 border border-[#FF453A]/20 text-[#FF453A] text-[9px] px-1.5 py-0.5 rounded font-bold font-mono">Hata</Badge>
                                  )}
                                  {action.status === 'pending' && (
                                    <Badge className="bg-[#FF9F0A]/10 border border-[#FF9F0A]/20 text-[#FF9F0A] text-[9px] px-1.5 py-0.5 rounded font-bold font-mono">Bekliyor</Badge>
                                  )}
                                </div>
                                {action.payload && Object.keys(action.payload).length > 0 && (
                                  <div className="text-[10.5px] text-white/40 font-mono truncate bg-black/10 p-1.5 rounded border border-white/[0.02] mt-2">
                                    Payload: {JSON.stringify(action.payload)}
                                  </div>
                                )}
                                {action.result && Object.keys(action.result).length > 0 && (
                                  <div className="text-[10.5px] text-[#30D158]/85 font-mono truncate bg-[#30D158]/5 p-1.5 rounded border border-[#30D158]/10 mt-1">
                                    Result: {JSON.stringify(action.result)}
                                  </div>
                                )}
                                <div className="text-[9.5px] text-white/25 pt-1">
                                  Tetikleyen: {action.requested_by_discord_id ? `<@${action.requested_by_discord_id}>` : 'Sistem'} • {formatDateTime(action.created_at)}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Accordion 6: Kayıtlı Slash Komutları */}
            <div className={`rounded-xl border border-white/[0.04] overflow-hidden ${getGlassClass(intensity, theme)}`}>
              <button
                onClick={() => toggleSection('commands')}
                className="w-full px-5 py-4 flex items-center justify-between bg-black/10 hover:bg-black/20 transition-all text-left border-none cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Sliders size={15} className="text-[#30D158]" />
                  <span className="text-[13.5px] font-bold text-white">Kayıtlı Slash Komutları</span>
                </div>
                {sections.commands ? <ChevronDown size={14} className="text-white/40" /> : <ChevronRight size={14} className="text-white/40" />}
              </button>

              <AnimatePresence initial={false}>
                {sections.commands && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-white/[0.04] bg-[#0E0E10]/15"
                  >
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-80 overflow-y-auto soft-scroll pr-1">
                      {commands.length === 0 ? (
                        <p className="text-[12px] text-white/30 text-center py-6 font-medium">Komut bulunamadı.</p>
                      ) : (
                        commands.map(cmd => (
                          <div key={cmd.name} className="p-3.5 rounded-xl bg-black/20 border border-white/5 hover:border-white/10 transition-all">
                            <span className="font-extrabold text-[12.5px] text-[#B19CD9] font-mono block">/{cmd.name}</span>
                            <span className="text-[11.5px] text-white/45 block mt-1 leading-normal font-medium">{cmd.description}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

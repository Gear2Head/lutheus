import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '../lib/auth';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../contexts/ToastContext';
import {
  Bot, RefreshCw, AlertTriangle, Shield, Check, X,
  Terminal, Settings, Play, Radio, Users, MessageSquare,
  Activity, Zap, Info, Clock, CheckCircle2, Sliders, Bell, Save
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
  payload: any;
  result: any;
  created_at: string;
  processed_at: string | null;
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
  const [runtimeStatus, setRuntimeStatus] = useState<any | null>(null);
  const [recentActions, setRecentActions] = useState<BotActionAudit[]>([]);
  const [caseCounts, setCaseCounts] = useState<number>(0);
  const [invalidCases, setInvalidCases] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const canManage = session ? hasPermission(session.role, 'discord_bot:update') : false;

  // Load user's bot-installed guilds
  const loadGuilds = async () => {
    setLoadingGuilds(true);
    try {
      const { AdminApiClient } = await import('../../../lib/adminApiClient.js') as any;
      const data = await AdminApiClient.listDiscordBotGuilds();
      setGuilds(data || []);
      if (data && data.length > 0) {
        setSelectedGuildId(data[0].id);
      }
    } catch (err: any) {
      showToast(`Discord sunuculari yuklenemedi: ${err?.message || err}`, 'error');
    } finally {
      setLoadingGuilds(false);
    }
  };

  // Load dashboard details for the selected guild
  const loadDashboardDetails = async (guildId: string) => {
    if (!guildId) return;
    setLoadingDetails(true);
    try {
      const { AdminApiClient } = await import('../../../lib/adminApiClient.js') as any;
      const data = await AdminApiClient.getDiscordBotDashboard(guildId);
      setBotConfig(data.config || null);
      setChannels(data.channels || []);
      setRoles(data.roles || []);
      setCommands(data.commands || []);
      setRuntimeStatus(data.runtime || null);
      setRecentActions(data.recentActions || []);
      setCaseCounts(data.caseCounts || 0);
      setInvalidCases(data.invalidCases || 0);
    } catch (err: any) {
      showToast(`Sunucu detaylari yuklenemedi: ${err?.message || err}`, 'error');
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
      const { AdminApiClient } = await import('../../../lib/adminApiClient.js') as any;
      await AdminApiClient.saveDiscordBotConfig(selectedGuildId, botConfig);
      showToast('Bot yapilandirmasi basariyla kaydedildi.', 'success');
      await loadDashboardDetails(selectedGuildId);
    } catch (err: any) {
      showToast(`Yapilandirma kaydedilemedi: ${err?.message || err}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerAction = async (action: string, payload: any = {}) => {
    if (!selectedGuildId) return;
    setActionLoading(action);
    try {
      const { AdminApiClient } = await import('../../../lib/adminApiClient.js') as any;
      const res = await AdminApiClient.triggerDiscordBotAction(selectedGuildId, action, payload);
      if (res.success) {
        showToast(res.message || 'Islem tetiklendi.', 'success');
      }
      // Refresh dashboard details to show updated queue / actions list
      setTimeout(() => loadDashboardDetails(selectedGuildId), 1500);
    } catch (err: any) {
      showToast(`Islem basarisiz: ${err?.message || err}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Channel helper to get text channels
  const textChannels = channels.filter(c => c.type === 0 || c.type === 4 || c.type === 5); // 0: Text, 4: Category (just in case), 5: News

  return (
    <div className="space-y-5 animate-in pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Discord Bot Yonetimi</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Sunucu log kanallari, acil durum kontrolleri ve bot tanilama</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => selectedGuildId ? loadDashboardDetails(selectedGuildId) : loadGuilds()}
            className="flex items-center gap-2 px-3 py-2 rounded-[12px] bg-secondary/50 border border-border/50 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Yenile
          </button>
        </div>
      </div>

      {/* Guild Selector */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm">Aktif Discord Sunucusu</div>
              <div className="text-xs text-muted-foreground">Yapilandirmak istediginiz Discord sunucusunu secin.</div>
            </div>
          </div>
          <div className="w-full sm:w-64">
            {loadingGuilds ? (
              <Skeleton className="h-9 w-full rounded-xl" />
            ) : guilds.length === 0 ? (
              <select disabled className="w-full h-9 px-3 rounded-xl bg-secondary/50 border border-border/50 text-xs text-muted-foreground">
                <option>Bot yuklu sunucu bulunamadi</option>
              </select>
            ) : (
              <select
                value={selectedGuildId}
                onChange={e => setSelectedGuildId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-border/50 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
      </Card>

      {/* Main dashboard content */}
      {!selectedGuildId ? (
        <EmptyState
          icon={<Bot className="w-8 h-8" />}
          title="Lutfen bir sunucu secin"
        />
      ) : loadingDetails ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="p-5 lg:col-span-2 space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
          </Card>
          <Card className="p-5 space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {/* Config & status panel */}
          <div className="lg:col-span-2 space-y-5">
            {/* Heartbeat Status */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-primary animate-pulse" />
                  <h3 className="font-bold text-sm">Bot Calisme Durumu (Heartbeat)</h3>
                </div>
                {runtimeStatus?.is_alive !== false ? (
                  <Badge variant="success">ONLINE</Badge>
                ) : (
                  <Badge variant="destructive">OFFLINE</Badge>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 rounded-xl bg-secondary/20 border border-border/40 text-center">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">Gecikme (Ping)</div>
                  <div className="text-lg font-bold mt-1 text-foreground">
                    {runtimeStatus?.latency_ms ? `${runtimeStatus.latency_ms} ms` : 'N/A'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-secondary/20 border border-border/40 text-center">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">Bellek Kullanim</div>
                  <div className="text-lg font-bold mt-1 text-foreground">
                    {runtimeStatus?.memory_usage_mb ? `${runtimeStatus.memory_usage_mb} MB` : 'N/A'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-secondary/20 border border-border/40 text-center">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">Uptime</div>
                  <div className="text-sm font-semibold mt-2 truncate text-foreground">
                    {runtimeStatus?.uptime_seconds ? `${Math.floor(runtimeStatus.uptime_seconds / 3600)}s ${Math.floor((runtimeStatus.uptime_seconds % 3600) / 60)}d` : 'N/A'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-secondary/20 border border-border/40 text-center">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">Son Sinyal (Heartbeat)</div>
                  <div className="text-sm font-semibold mt-2 text-foreground">
                    {runtimeStatus?.last_heartbeat_at ? formatDateTime(runtimeStatus.last_heartbeat_at) : 'N/A'}
                  </div>
                </div>
              </div>
            </Card>

            {/* Main Config Form */}
            {botConfig && (
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="w-4 h-4 text-primary" />
                  <h3 className="font-bold text-sm">Bot Kanallari & Ayarlari</h3>
                </div>

                <form onSubmit={handleSaveConfig} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Log Channel */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Log Kanali</label>
                      <select
                        value={botConfig.logChannelId}
                        onChange={e => setBotConfig(prev => prev ? ({ ...prev, logChannelId: e.target.value }) : null)}
                        disabled={!canManage}
                        className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-border/50 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                      >
                        <option value="">Secilmedi</option>
                        {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                      </select>
                    </div>

                    {/* Alert Channel */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-semibold">CUK Hatalari / Uyarilar Kanali</label>
                      <select
                        value={botConfig.alertChannelId}
                        onChange={e => setBotConfig(prev => prev ? ({ ...prev, alertChannelId: e.target.value }) : null)}
                        disabled={!canManage}
                        className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-border/50 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                      >
                        <option value="">Secilmedi</option>
                        {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                      </select>
                    </div>

                    {/* Stats Channel */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Haftalik Istatistik Kanali</label>
                      <select
                        value={botConfig.statsChannelId}
                        onChange={e => setBotConfig(prev => prev ? ({ ...prev, statsChannelId: e.target.value }) : null)}
                        disabled={!canManage}
                        className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-border/50 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                      >
                        <option value="">Secilmedi</option>
                        {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                      </select>
                    </div>

                    {/* Bot Prefix */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Bot Komut Prefixi</label>
                      <input
                        value={botConfig.prefix || '!'}
                        onChange={e => setBotConfig(prev => prev ? ({ ...prev, prefix: e.target.value }) : null)}
                        disabled={!canManage}
                        placeholder="!"
                        required
                        className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-border/50 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div className="border-t border-border/30 my-4 pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <MessageSquare className="w-4 h-4 text-primary" />
                      <h4 className="font-bold text-xs">Yeni Gelen Karsilama Mesajlari</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Welcome Channel */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Karsilama Kanali</label>
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
                          className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-border/50 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                        >
                          <option value="">Secilmedi</option>
                          {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                        </select>
                      </div>

                      {/* Welcome Embed Checkbox */}
                      <div className="flex items-center gap-2 pt-6">
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
                          className="rounded border-border/50 text-primary focus:ring-primary/40"
                        />
                        <label htmlFor="welcome-embed" className="text-xs font-semibold text-foreground">
                          Mesaji Embed Tasarimiyla Gonder
                        </label>
                      </div>
                    </div>

                    {/* Welcome Message Text */}
                    <div className="space-y-1.5 mt-3">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Karsilama Metni</label>
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
                        rows={2}
                        placeholder="Hos geldin {user}!"
                        className="w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 resize-none"
                      />
                      <span className="text-[10px] text-muted-foreground">Desteklenen degiskenler: {"{user}"} (Etiket), {"{username}"} (Isim), {"{server}"} (Sunucu Ismi)</span>
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex justify-end pt-2">
                      <Button type="submit" size="sm" disabled={saving} className="bg-primary hover:bg-primary/95 text-primary-foreground font-bold">
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? 'Kaydediliyor...' : 'Yapilandirmayi Kaydet'}
                      </Button>
                    </div>
                  )}
                </form>
              </Card>
            )}

            {/* Audit Log / Action Queue */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Terminal className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm">Bot Aksiyon Gecmisi & Sirasi</h3>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto soft-scroll">
                {recentActions.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">Henuz aksiyon audit log kaydi bulunmuyor.</p>
                ) : (
                  recentActions.map(action => {
                    const statusColors = {
                      pending: 'warning' as const,
                      completed: 'success' as const,
                      failed: 'destructive' as const
                    };
                    const statusLabels = {
                      pending: 'Bekliyor',
                      completed: 'Basarili',
                      failed: 'Hata'
                    };
                    return (
                      <div key={action.id} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-secondary/20 border border-border/40">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-xs text-foreground font-mono">{action.action}</span>
                            <Badge variant={statusColors[action.status]} className="text-[9px] px-1.5 py-0">
                              {statusLabels[action.status]}
                            </Badge>
                          </div>
                          {action.payload && Object.keys(action.payload).length > 0 && (
                            <div className="text-[10px] text-muted-foreground/80 mt-1 font-mono truncate">
                              Payload: {JSON.stringify(action.payload)}
                            </div>
                          )}
                          {action.result && Object.keys(action.result).length > 0 && (
                            <div className="text-[10px] text-emerald-500/90 mt-0.5 font-mono truncate">
                              Result: {JSON.stringify(action.result)}
                            </div>
                          )}
                          <div className="text-[9px] text-muted-foreground/60 mt-1">
                            Tetikleyen: {action.requested_by_discord_id || 'Sistem'} • {formatDateTime(action.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>

          {/* Diagnostics sidebar */}
          <div className="space-y-5">
            {/* Quick Stats */}
            <Card className="p-5">
              <h3 className="font-bold text-sm mb-4">Sunucu Istatistikleri</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/10 border border-border/50">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-muted-foreground">Aktif Sapphire Cezalari</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">{caseCounts}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/10 border border-border/50">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span className="text-xs font-semibold text-muted-foreground">Hatalı / Sapma Cezaları</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">{invalidCases}</span>
                </div>
              </div>
            </Card>

            {/* Diagnostic Actions */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm">Bot Tanilama Araclari</h3>
              </div>

              <div className="space-y-2">
                {/* Test Alert */}
                <button
                  onClick={() => handleTriggerAction('test_alert')}
                  disabled={actionLoading !== null || !canManage}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-secondary/20 border border-border/40 hover:bg-secondary/40 transition-colors disabled:opacity-50 text-left"
                >
                  <div>
                    <div className="text-xs font-bold text-foreground">Test Alert</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Uyari kanalina ornek CUK hatasi gonderir.</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>

                {/* Test Welcome */}
                <button
                  onClick={() => handleTriggerAction('test_welcome')}
                  disabled={actionLoading !== null || !canManage}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-secondary/20 border border-border/40 hover:bg-secondary/40 transition-colors disabled:opacity-50 text-left"
                >
                  <div>
                    <div className="text-xs font-bold text-foreground">Test Welcome Message</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Karsilama kanalina test mesaji gonderir.</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>

                {/* Sync Commands */}
                <button
                  onClick={() => handleTriggerAction('sync_commands')}
                  disabled={actionLoading !== null || !canManage}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-secondary/20 border border-border/40 hover:bg-secondary/40 transition-colors disabled:opacity-50 text-left"
                >
                  <div>
                    <div className="text-xs font-bold text-foreground">Slash Komutlarini Eşitle</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Bot slash komutlarini Discord API ile senkronize eder.</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>

                {/* Metadata force sync */}
                <button
                  onClick={() => handleTriggerAction('force_sync')}
                  disabled={actionLoading !== null || !canManage}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-secondary/20 border border-border/40 hover:bg-secondary/40 transition-colors disabled:opacity-50 text-left"
                >
                  <div>
                    <div className="text-xs font-bold text-foreground">Kanallari & Rolleri Eşitle</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Discord sunucu verilerini bot bellegine cekmeye zorlar.</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>

                {/* Emergency Lockdown */}
                <div className="border-t border-border/30 pt-3 mt-3">
                  <div className="text-xs font-bold text-destructive mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Acil Durum Kanallari Kilitleme
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleTriggerAction('lockdown')}
                      disabled={actionLoading !== null || !canManage}
                      className="flex-1 text-[11px]"
                    >
                      LOCKDOWN
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTriggerAction('unlockdown')}
                      disabled={actionLoading !== null || !canManage}
                      className="flex-1 text-[11px]"
                    >
                      KILIDI AC
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Slash Commands */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Terminal className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm">Kayitli Slash Komutlari</h3>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto soft-scroll">
                {commands.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Komut bulunamadi.</p>
                ) : (
                  commands.map(cmd => (
                    <div key={cmd.name} className="p-2.5 rounded-xl bg-secondary/15 border border-border/40">
                      <div className="font-bold text-xs text-foreground font-mono">/{cmd.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">{cmd.description}</div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// ChevronRight helper component inline replacement
function ChevronRight({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

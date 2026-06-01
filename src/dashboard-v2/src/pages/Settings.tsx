import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getRoleLabel, getRoleColor, getAvatarUrl } from '../lib/auth';
import { Card } from '../components/ui/Card';
import { Accordion } from '../components/ui/Accordion';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Moon, Monitor, User, Key, Settings2, Bot, AlertTriangle, Bell } from 'lucide-react';

const THEMES = [
  { id: 'dark', name: 'Apple Dark', preview: 'bg-zinc-900 border-zinc-700' },
  { id: 'light', name: 'Apple Light', preview: 'bg-white border-border/50' },
  { id: 'lavender', name: 'Lavender Glass', preview: 'bg-purple-900/50 border-purple-500/30' },
  { id: 'corporate', name: 'Corporate Clean', preview: 'bg-slate-100 border-slate-300' },
];

function getLocal(key: string, def: string): string {
  return localStorage.getItem(key) || def;
}
function setLocal(key: string, val: string) {
  localStorage.setItem(key, val);
}

function getChromeLocal<T>(key: string): Promise<T | null> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) => chrome.storage.local.get([key], (r) => resolve(r[key] || null)));
  }
  try {
    const raw = localStorage.getItem(key);
    return Promise.resolve(raw ? JSON.parse(raw) : null);
  } catch { return Promise.resolve(null); }
}

function setChromeLocal(key: string, val: string | object): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) => chrome.storage.local.set({ [key]: val }, resolve));
  }
  localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
  return Promise.resolve();
}

export default function Settings() {
  const { session, logout } = useAuth();

  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    for (const cls of ['dark', 'light', 'lavender', 'corporate']) {
      if (document.documentElement.classList.contains(cls)) return cls;
    }
    return 'dark';
  });

  const [panelStyle, setPanelStyle] = useState<string>(() => getLocal('panelStyle', 'side'));
  const [settings, setSettings] = useState({
    guildId: '', scanDelay: 2000, cukEnabled: true, autoValidate: false,
  });

  const [webhookUrl, setWebhookUrl] = useState('');
  const [botChannelId, setBotChannelId] = useState('');

  useEffect(() => {
    getChromeLocal<typeof settings>('settings').then((s) => {
      if (s) setSettings((prev) => ({ ...prev, ...s }));
    });
    getChromeLocal<string>('webhookUrl').then((v) => v && setWebhookUrl(v));
    getChromeLocal<string>('botLogChannelId').then((v) => v && setBotChannelId(v));
  }, []);

  const applyTheme = (theme: string) => {
    document.documentElement.classList.remove('dark', 'light', 'lavender', 'corporate');
    document.documentElement.classList.add(theme);
    setCurrentTheme(theme);
    setLocal('theme', theme);
  };

  const savePanelStyle = (style: string) => {
    setPanelStyle(style);
    setLocal('panelStyle', style);
    window.dispatchEvent(new Event('storage'));
  };

  const saveSettings = () => {
    setChromeLocal('settings', settings);
  };

  const saveBotConfig = () => {
    setChromeLocal('webhookUrl', webhookUrl);
    setChromeLocal('botLogChannelId', botChannelId);
  };

  const syncProfiles = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ action: 'SYNC_PROFILES' });
    }
  };

  const avatarUrl = getAvatarUrl(session);
  const roleColor = session ? getRoleColor(session.role) : '#64748b';
  const roleLabel = session ? getRoleLabel(session.role) : '';
  const displayName = session?.profile?.displayName || session?.profile?.username || '—';

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in pb-6 pt-2">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Ayarlar</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Sistem tercihleri, entegrasyonlar ve erişim kontrolü.</p>
      </div>

      {/* General */}
      <div className="space-y-4">
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Genel</div>

        <Accordion title={<span className="flex items-center gap-3 text-sm"><User className="w-4 h-4 text-emerald-500" /> Hesap ve Erisim</span>} defaultOpen>
          <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-2xl border border-border/50 mt-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-muted overflow-hidden">
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              </div>
              <div>
                <div className="font-semibold text-sm text-foreground">{displayName}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: roleColor }}>{roleLabel} • {session?.provider?.toUpperCase()}</div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={logout}>Cikis Yap</Button>
          </div>
        </Accordion>

        <Accordion title={<span className="flex items-center gap-3 text-sm"><Monitor className="w-4 h-4 text-blue-500" /> Gorünüm</span>}>
          <div className="space-y-5 pt-3">
            {/* Theme picker */}
            <div>
              <div className="text-xs font-semibold text-foreground mb-3">Tema</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => applyTheme(t.id)}
                    className={`h-20 rounded-2xl border flex flex-col justify-end p-3 cursor-pointer transition-all ${t.preview} ${currentTheme === t.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-background opacity-100' : 'opacity-70 hover:opacity-100'}`}
                  >
                    <span className="text-xs font-semibold text-left">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Panel layout */}
            <div>
              <div className="text-xs font-semibold text-foreground mb-3">Panel Yerlasimi</div>
              <div className="grid grid-cols-2 gap-3">
                {[['side', 'Sag Panel (Side)'], ['center', 'Orta Modal (Center)']].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => savePanelStyle(val)}
                    className={`h-16 rounded-2xl border flex items-center justify-center text-xs font-semibold transition-all ${panelStyle === val ? 'ring-2 ring-primary ring-offset-2 ring-offset-background bg-secondary' : 'bg-background hover:bg-secondary border-border/50 text-muted-foreground'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Accordion>
      </div>

      {/* System */}
      <div className="space-y-4">
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Sistem</div>

        <Accordion title={<span className="flex items-center gap-3 text-sm"><Settings2 className="w-4 h-4 text-slate-500" /> Genel Ayarlar</span>}>
          <div className="space-y-4 pt-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Sunucu ID</label>
                <Input
                  value={settings.guildId}
                  onChange={(e) => setSettings((s) => ({ ...s, guildId: e.target.value }))}
                  placeholder="Guild ID"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Tarama Gecikmesi (ms)</label>
                <Input
                  type="number"
                  value={settings.scanDelay}
                  onChange={(e) => setSettings((s) => ({ ...s, scanDelay: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              {[
                ['cukEnabled', 'CUK Dogrulama Aktif'],
                ['autoValidate', 'Otomatik Ceza Dogrulama'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(settings as any)[key]}
                    onChange={(e) => setSettings((s: any) => ({ ...s, [key]: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-muted-foreground">{label}</span>
                </label>
              ))}
            </div>
            <Button size="sm" onClick={saveSettings}>Kaydet</Button>
          </div>
        </Accordion>
      </div>

      {/* Integrations */}
      <div className="space-y-4">
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Entegrasyonlar</div>

        <Accordion title={<span className="flex items-center gap-3 text-sm"><Key className="w-4 h-4 text-amber-600" /> Webhook ve API</span>}>
          <div className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Discord Webhook URL</label>
              <p className="text-[11px] text-muted-foreground">Botun tarama raporlarını göndereceği kanal.</p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="flex-1 bg-background border border-border/50 rounded-[12px] px-3 py-2 text-sm font-mono text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <Button size="sm" onClick={saveBotConfig}>Güncelle</Button>
              </div>
            </div>
            <div className="space-y-1.5 border-t border-border/50 pt-4">
              <label className="text-xs font-medium text-foreground">Bot Log Kanal ID</label>
              <div className="flex gap-2">
                <Input value={botChannelId} onChange={(e) => setBotChannelId(e.target.value)} placeholder="Kanal ID girin..." />
                <Button size="sm" onClick={syncProfiles} variant="ghost">Profilleri Esitle</Button>
              </div>
            </div>
          </div>
        </Accordion>
      </div>

      {/* Danger zone */}
      <div className="space-y-4">
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Tehlikeli Bölge</div>
        <div className="p-5 rounded-2xl border border-destructive/20 bg-destructive/5">
          <h4 className="font-semibold text-destructive mb-1">Fabrika Ayarlarına Sıfırla</h4>
          <p className="text-xs text-destructive/80 mb-4">Tüm case geçmişi, yetkili profilleri ve loglar silinir. Bu işlem geri alınamaz.</p>
          <Button variant="destructive" size="sm">Sistemi Sıfırla</Button>
        </div>
      </div>
    </div>
  );
}

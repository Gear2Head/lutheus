import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getRoleLabel, getRoleColor, getAvatarUrl, isManagementRole } from '../lib/auth';
import { Card } from '../components/ui/Card';
import { Accordion } from '../components/ui/Accordion';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';
import { clearAllCasesFromDbAndLocal } from '../lib/supabase';
import { Moon, Monitor, User, Key, Settings2, Bot, AlertTriangle, Bell, Info } from 'lucide-react';

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
  const { showToast } = useToast();
  const { language, setLanguage, t } = useLanguage();

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
  const [purging, setPurging] = useState(false);

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
    showToast(t('settings.subtitle'), 'success');
  };

  const saveBotConfig = () => {
    setChromeLocal('webhookUrl', webhookUrl);
    setChromeLocal('botLogChannelId', botChannelId);
    showToast(t('settings.subtitle'), 'success');
  };

  const syncProfiles = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ action: 'SYNC_PROFILES' });
    }
  };

  const handlePurgeCases = async () => {
    if (!confirm(language === 'tr' ? 'Sadece cezalarÄ± silmek istediÄŸinize emin misiniz? Yetkili detaylarÄ± korunacaktÄ±r.' : 'Are you sure you want to delete cases only? Staff details will be preserved.')) {
      return;
    }
    setPurging(true);
    try {
      await clearAllCasesFromDbAndLocal();
      showToast(language === 'tr' ? 'Cezalar baÅŸarÄ±yla temizlendi.' : 'Cases successfully purged.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setPurging(false);
    }
  };

  const avatarUrl = getAvatarUrl(session);
  const roleColor = session ? getRoleColor(session.role) : '#64748b';
  const roleLabel = session ? getRoleLabel(session.role) : '';
  const displayName = session?.profile?.displayName || session?.profile?.username || 'â€”';

  // State helper for checkboxes info popovers
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const InfoIconTooltip = ({ id, text }: { id: string; text: string }) => {
    const isVisible = activeTooltip === id;
    return (
      <div className="relative inline-flex items-center ml-2">
        <button
          type="button"
          onMouseEnter={() => setActiveTooltip(id)}
          onMouseLeave={() => setActiveTooltip(null)}
          onClick={(e) => { e.preventDefault(); setActiveTooltip(isVisible ? null : id); }}
          className="text-muted-foreground hover:text-primary transition-colors p-0.5 focus:outline-none"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
        {isVisible && (
          <div className="absolute left-6 top-1/2 -translate-y-1/2 w-64 p-2.5 text-xs text-foreground bg-card border border-border/80 rounded-xl shadow-2xl z-50 animate-in fade-in slide-in-from-left-2">
            {text}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in pb-6 pt-2">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t('settings.title')}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{t('settings.subtitle')}</p>
      </div>

      {/* SECTION: LANGUAGE_SETTINGS */}
      {/* PURPOSE: Dashboard-v2 ve extension sidepanel ortak dil seçimini yönetir. */}
      <div className="space-y-4">
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('settings.langSelect')}</div>
        <Card className="p-4 flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">{t('settings.langLabel')}</span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => { setLanguage('en'); showToast(t('settings.langChangedEn'), 'info'); }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all ${language === 'en' ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'border-border/50 bg-background/50 hover:bg-secondary'}`}
            >
              EN · {t('settings.langEnglish')}
            </button>
            <button
              onClick={() => { setLanguage('tr'); showToast(t('settings.langChangedTr'), 'info'); }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all ${language === 'tr' ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20' : 'border-border/50 bg-background/50 hover:bg-secondary'}`}
            >
              TR · {t('settings.langTurkish')}
            </button>
          </div>
        </Card>
      </div>

      {/* General */}
      <div className="space-y-4">
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('settings.general')}</div>

        <Accordion title={<span className="flex items-center gap-3 text-sm"><User className="w-4 h-4 text-emerald-500" /> {t('settings.account')}</span>} defaultOpen>
          <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-2xl border border-border/50 mt-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-muted overflow-hidden">
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              </div>
              <div>
                <div className="font-semibold text-sm text-foreground">{displayName}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: roleColor }}>{roleLabel} - {session?.provider?.toUpperCase()}</div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={logout}>{t('nav.logout')}</Button>
          </div>
        </Accordion>

        <Accordion title={<span className="flex items-center gap-3 text-sm"><Monitor className="w-4 h-4 text-blue-500" /> {t('settings.appearance')}</span>}>
          <div className="space-y-5 pt-3">
            {/* Theme picker */}
            <div>
              <div className="text-xs font-semibold text-foreground mb-3">{t('settings.theme')}</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {THEMES.map((tTheme) => (
                  <button
                    key={tTheme.id}
                    onClick={() => applyTheme(tTheme.id)}
                    className={`h-20 rounded-2xl border flex flex-col justify-end p-3 cursor-pointer transition-all ${tTheme.preview} ${currentTheme === tTheme.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-background opacity-100' : 'opacity-70 hover:opacity-100'}`}
                  >
                    <span className="text-xs font-semibold text-left">{tTheme.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Panel layout */}
            <div>
              <div className="text-xs font-semibold text-foreground mb-3">{t('settings.layout')}</div>
              <div className="grid grid-cols-2 gap-3">
                {[['side', t('settings.layoutSide')], ['center', t('settings.layoutCenter')]].map(([val, label]) => (
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
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('settings.system')}</div>

        <Accordion title={<span className="flex items-center gap-3 text-sm"><Settings2 className="w-4 h-4 text-slate-500" /> {t('settings.generalSettings')}</span>}>
          <div className="space-y-4 pt-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t('settings.guildId')}</label>
                <Input
                  value={settings.guildId}
                  onChange={(e) => setSettings((s) => ({ ...s, guildId: e.target.value }))}
                  placeholder="Guild ID"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t('settings.scanDelay')}</label>
                <Input
                  type="number"
                  value={settings.scanDelay}
                  onChange={(e) => setSettings((s) => ({ ...s, scanDelay: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="space-y-3 pt-1">
              {[
                ['cukEnabled', t('settings.cukEnabled'), t(`tooltip.cukEnabled.${settings.cukEnabled}`)] as const,
                ['autoValidate', t('settings.autoValidate'), t(`tooltip.autoValidate.${settings.autoValidate}`)] as const,
              ].map(([key, label, tooltip]) => (
                <div key={key} className="flex items-center">
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={settings[key]}
                      onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.checked }))}
                      className="rounded accent-primary"
                    />
                    <span className="text-muted-foreground">{label}</span>
                  </label>
                  <InfoIconTooltip id={key} text={tooltip} />
                </div>
              ))}
            </div>
            <Button size="sm" onClick={saveSettings}>{t('settings.save')}</Button>
          </div>
        </Accordion>
      </div>

      {/* Integrations */}
      <div className="space-y-4">
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('settings.integrations')}</div>

        <Accordion title={<span className="flex items-center gap-3 text-sm"><Key className="w-4 h-4 text-amber-600" /> {t('settings.webhookApi')}</span>}>
          <div className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">{t('settings.webhookUrl')}</label>
              <p className="text-[11px] text-muted-foreground">{t('settings.webhookUrlDesc')}</p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="flex-1 bg-background border border-border/50 rounded-[12px] px-3 py-2 text-sm font-mono text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <Button size="sm" onClick={saveBotConfig}>{t('settings.update')}</Button>
              </div>
            </div>
            <div className="space-y-1.5 border-t border-border/50 pt-4">
              <label className="text-xs font-medium text-foreground">{t('settings.botLogChannel')}</label>
              <div className="flex gap-2">
                <Input value={botChannelId} onChange={(e) => setBotChannelId(e.target.value)} placeholder="Channel ID..." />
                <Button size="sm" onClick={syncProfiles} variant="ghost">{t('settings.syncProfiles')}</Button>
              </div>
            </div>
          </div>
        </Accordion>
      </div>

      {/* Danger zone — Management only */}
      <div className="space-y-4">
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t('settings.dangerZone')}</div>
        {isManagementRole(session?.role ?? '') ? (
          <Card className="p-5 border-destructive/20 bg-destructive/5 space-y-6">
            <div>
              <h4 className="font-semibold text-destructive mb-1">{t('settings.purgeCasesTitle')}</h4>
              <p className="text-xs text-destructive/80 mb-3">{t('settings.purgeCasesDesc')}</p>
              <Button variant="destructive" size="sm" onClick={handlePurgeCases} disabled={purging}>
                {purging ? t('nav.syncing') : t('settings.purgeCasesBtn')}
              </Button>
            </div>
            <div className="border-t border-destructive/10 pt-5">
              <h4 className="font-semibold text-destructive mb-1">{t('settings.resetTitle')}</h4>
              <p className="text-xs text-destructive/80 mb-3">{t('settings.resetDesc')}</p>
              <Button variant="destructive" size="sm" disabled>{t('settings.resetBtn')}</Button>
            </div>
          </Card>
        ) : (
          <Card className="p-5 border-border/30 bg-secondary/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <h4 className="font-semibold text-foreground mb-1">
                  {language === 'tr' ? 'Erişim Kısıtlı' : 'Access Restricted'}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {language === 'tr'
                    ? 'Bu bölgedeki veritabanı işlemleri (ceza silme, sistem sıfırlama) yalnızca Yönetim ekibi tarafından gerçekleştirilebilir. Kurucu, Admin, Yönetici, Genel Sorumlu veya Discord Yöneticisi rolüne sahip olmanız gerekmektedir.'
                    : 'Database operations in this section (purging cases, system reset) can only be performed by the Management team. You must have the Founder, Admin, Manager, General Director, or Discord Manager role.'}
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

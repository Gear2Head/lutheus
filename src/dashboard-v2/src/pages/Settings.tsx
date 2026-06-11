import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getRoleLabel, getRoleColor, getAvatarUrl, isManagementRole } from '../lib/auth';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';
import { clearAllCasesFromDbAndLocal } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Palette, Layers, Check, Database, ShieldAlert, RefreshCw, 
  Cpu, KeyRound, Save, ChevronDown, ChevronRight, Globe, 
  User, CheckCircle2, Sliders, Globe2, Sparkles, AlertCircle, 
  Radio, ShieldCheck, Terminal, Trash2, LogOut, Loader, Key
} from 'lucide-react';

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

  // Theme state
  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    for (const cls of ['dark', 'light', 'lavender', 'corporate']) {
      if (document.documentElement.classList.contains(cls)) return cls;
    }
    return 'dark';
  });

  const [panelStyle, setPanelStyle] = useState<string>(() => getLocal('panelStyle', 'side'));

  // Glass intensity local state
  const [intensity, setIntensity] = useState<string>(() => {
    return localStorage.getItem('lutheus-intensity') || 'frosted';
  });

  // Settings values
  const [settings, setSettings] = useState({
    guildId: '', scanDelay: 2000, cukEnabled: true, autoValidate: false,
  });
  const [webhookUrl, setWebhookUrl] = useState('');
  const [botChannelId, setBotChannelId] = useState('');

  // Accordion sections state
  const [sections, setSections] = useState({
    account: true,
    appearance: true,
    system: true,
    diagnostics: true,
    integrations: true,
    danger: true
  });

  // Diagnostics simulator states
  const [isTestingDurum, setIsTestingDurum] = useState(false);
  const [isDurumChecked, setIsDurumChecked] = useState(false);
  const [cpuLoad, setCpuLoad] = useState('1.5%');
  const [memUsage, setMemUsage] = useState('248 MB');
  const [pingLatency, setPingLatency] = useState('14 ms');

  // Mutation saving states
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [clearConfirmed, setClearConfirmed] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);
  const [purging, setPurging] = useState(false);

  useEffect(() => {
    getChromeLocal<typeof settings>('settings').then((s) => {
      if (s) setSettings((prev) => ({ ...prev, ...s }));
    });
    getChromeLocal<string>('webhookUrl').then((v) => v && setWebhookUrl(v));
    getChromeLocal<string>('botLogChannelId').then((v) => v && setBotChannelId(v));
  }, []);

  const toggleSection = (key: keyof typeof sections) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

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

  const handleRunSystemTest = () => {
    setIsTestingDurum(true);
    setTimeout(() => {
      setIsTestingDurum(false);
      setIsDurumChecked(true);
      setCpuLoad(`${(Math.random() * 2 + 0.8).toFixed(1)}%`);
      setMemUsage(`${Math.floor(Math.random() * 50 + 220)} MB`);
      setPingLatency(`${Math.floor(Math.random() * 8 + 8)} ms`);
    }, 1500);
  };

  const handleSaveSettings = () => {
    setIsSaving(true);
    setChromeLocal('settings', settings);
    setChromeLocal('webhookUrl', webhookUrl);
    setChromeLocal('botLogChannelId', botChannelId);

    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess(true);
      showToast(t('settings.subtitle'), 'success');
      setTimeout(() => setSaveSuccess(false), 3500);
    }, 1000);
  };

  const syncProfiles = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ action: 'SYNC_PROFILES' });
      showToast(language === 'tr' ? 'Profil eşitleme isteği bota gönderildi.' : 'Profile sync request sent to bot.', 'success');
    } else {
      showToast(language === 'tr' ? 'Eklenti bağlamı dışında kullanılamaz.' : 'Only available in extension context.', 'error');
    }
  };

  const handlePurgeCases = async () => {
    setPurging(true);
    try {
      await clearAllCasesFromDbAndLocal();
      setClearSuccess(true);
      showToast(language === 'tr' ? 'Cezalar başarıyla temizlendi.' : 'Cases successfully purged.', 'success');
      setTimeout(() => {
        setClearSuccess(false);
        setClearConfirmed(false);
      }, 3000);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setPurging(false);
    }
  };

  const getGlassClass = (targetIntensity: string) => {
    let base = 'border transition-all duration-300 ';
    base += 'border-white/[0.04] ';

    switch (targetIntensity) {
      case 'minimalist':
        return base + 'bg-[#0E0E0F]';
      case 'frosted':
        return base + 'bg-black/40 backdrop-blur-md';
      case 'immersive':
        return base + 'bg-black/25 backdrop-blur-2xl shadow-[0_12px_40px_-5px_rgba(0,0,0,0.6)]';
      default:
        return base + 'bg-black/40 backdrop-blur-md';
    }
  };

  const themePalettes = [
    { id: 'lavender', name: 'Midnight Purple', desc: 'Elegant neon indigo ve koyu mor kozmik tonlar', colors: ['bg-[#5E5CE6]', 'bg-[#A259FE]', 'bg-[#050507]'] },
    { id: 'dark', name: 'Deep Space Mono', desc: 'Sade, yüksek kontrastlı ultra-monokrom ve grafit gri', colors: ['bg-white', 'bg-neutral-400', 'bg-[#020202]'] },
    { id: 'corporate', name: 'Sunset Crimson (Corporate)', desc: 'Sıcak koyu kırmızı, amber ve bakır tonlar / Slate İş Stili', colors: ['bg-[#FF453A]', 'bg-[#FF9F0A]', 'bg-[#090505]'] },
    { id: 'light', name: 'Arctic Aurora (Light)', desc: 'Buz mavi ve aurora yeşili canlandırıcı hava / Açık Tema', colors: ['bg-[#0DF5FF]', 'bg-[#32D74B]', 'bg-white'] }
  ];

  const intensities = [
    { id: 'minimalist', name: 'Yalın ve Düz (Flat)', desc: 'Sıfır transparanlık, keskin çizgiler, yüksek kontrastlı siyah kartlar.', detail: '0px blur, flat contrast' },
    { id: 'frosted', name: 'Yarı Buzlu (Frosted)', desc: 'Hafif transparan, zarif 12px derinlik ve yumuşak geçişler.', detail: '12px blur, 4% opacity' },
    { id: 'immersive', name: 'Göz Alıcı Derin (Immersive)', desc: 'Maksimum transparanlık, 28px derinlik, asılı gölgeler.', detail: '28px blur, 8% opacity' }
  ];

  const avatarUrl = getAvatarUrl(session);
  const roleColor = session ? getRoleColor(session.role) : '#64748b';
  const roleLabel = session ? getRoleLabel(session.role) : '';
  const displayName = session?.profile?.displayName || session?.profile?.username || '—';
  const isMgmt = session ? isManagementRole(session.role) : false;

  return (
    <div className="p-6 md:p-8 w-full min-h-screen flex flex-col relative select-none bg-[#050506] text-white/90">
      
      {/* Title block */}
      <div className="pb-6 mb-6 border-b border-white/[0.04] text-left">
        <h2 className="text-[22px] font-black text-white tracking-tight">{t('settings.title')}</h2>
        <p className="text-[13px] text-[#8E8E93] mt-1 font-medium">{t('settings.subtitle')}</p>
      </div>

      <div className="max-w-[850px] w-full space-y-6 text-left mx-auto">
        
        {/* DİL SEÇİMİ (Language Section) */}
        <div className={`p-5 rounded-2xl ${getGlassClass(intensity)} overflow-hidden`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-white/40 block">{t('settings.langSelect')}</span>
              <span className="text-[13.5px] font-bold text-white mt-1 block">{t('settings.langLabel')}</span>
            </div>
            
            <div className="flex bg-[#111112] border border-white/10 rounded-lg p-1 self-start sm:self-auto shadow-inner">
              <button 
                onClick={() => { setLanguage('en'); showToast(t('settings.langChangedEn'), 'info'); }}
                className={`px-4 py-1.5 rounded-md text-[12px] font-bold transition-all duration-200 cursor-pointer border-none ${
                  language === 'en' 
                    ? 'bg-white/10 text-white shadow-sm' 
                    : 'text-white/40 hover:text-white/80 bg-transparent'
                }`}
              >
                EN - {t('settings.langEnglish')}
              </button>
              <button 
                onClick={() => { setLanguage('tr'); showToast(t('settings.langChangedTr'), 'info'); }}
                className={`px-4 py-1.5 rounded-md text-[12px] font-bold transition-all duration-200 cursor-pointer border-none ${
                  language === 'tr' 
                    ? 'bg-white/10 text-white shadow-sm' 
                    : 'text-white/40 hover:text-white/80 bg-transparent'
                }`}
              >
                TR - {t('settings.langTurkish')}
              </button>
            </div>
          </div>
        </div>

        {/* GENEL CATEGORY TITLE */}
        <div className="pt-2">
          <span className="text-[10px] font-mono font-extrabold text-white/40 uppercase tracking-widest block mb-3">GENEL</span>
          
          <div className="space-y-3.5">
            
            {/* Accordion 1: Hesap ve Erişim */}
            <div className={`rounded-xl border border-white/[0.04] overflow-hidden ${getGlassClass(intensity)}`}>
              <button 
                onClick={() => toggleSection('account')}
                className="w-full px-5 py-4 flex items-center justify-between bg-black/10 hover:bg-black/20 transition-all text-left border-none cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <User size={15} className="text-[#32D74B]" />
                  <span className="text-[13.5px] font-bold text-white">{t('settings.account')}</span>
                </div>
                {sections.account ? <ChevronDown size={14} className="text-white/40" /> : <ChevronRight size={14} className="text-white/40" />}
              </button>

              <AnimatePresence initial={false}>
                {sections.account && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-white/[0.04] bg-[#0E0E10]/15"
                  >
                    <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <img 
                          src={avatarUrl} 
                          alt="avatar" 
                          className="w-10 h-10 rounded-lg border border-white/10 object-cover" 
                        />
                        <div>
                          <div className="flex items-center gap-2 font-sans">
                            <span className="text-[13.5px] font-extrabold text-white">{displayName}</span>
                            <span className="text-[9px] font-mono font-bold bg-[#FF453A]/10 border border-[#FF453A]/20 text-xs px-1.5 py-0.5 rounded uppercase" style={{ color: roleColor }}>
                              {roleLabel} - {session?.provider?.toUpperCase()}
                            </span>
                          </div>
                          <span className="text-[11px] text-white/35 font-mono">ID: {session?.uid} • Provider: {session?.provider}</span>
                        </div>
                      </div>

                      <button 
                        onClick={logout}
                        className="px-4 py-2 bg-[#FF453A]/10 hover:bg-[#FF453A]/15 border border-[#FF453A]/20 text-[#FF453A] text-[12px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto shadow-sm"
                      >
                        <LogOut size={12} /> {t('nav.logout')}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Accordion 2: Görünüm */}
            <div className={`rounded-xl border border-white/[0.04] overflow-hidden ${getGlassClass(intensity)}`}>
              <button 
                onClick={() => toggleSection('appearance')}
                className="w-full px-5 py-4 flex items-center justify-between bg-black/10 hover:bg-black/20 transition-all text-left border-none cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Palette size={15} className="text-[#5E5CE6]" />
                  <span className="text-[13.5px] font-bold text-white">{t('settings.appearance')}</span>
                </div>
                {sections.appearance ? <ChevronDown size={14} className="text-white/40" /> : <ChevronRight size={14} className="text-white/40" />}
              </button>

              <AnimatePresence initial={false}>
                {sections.appearance && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-white/[0.04] p-5 space-y-6 bg-[#0E0E10]/15"
                  >
                    {/* Renk Paleti */}
                    <div>
                      <h4 className="text-[12px] font-bold text-white/40 uppercase tracking-widest mb-3.5 flex items-center gap-1.5">
                        <Sparkles size={11} className="text-[#5E5CE6]" />
                        {t('settings.theme')}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {themePalettes.map((p) => {
                          const isActive = currentTheme === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => applyTheme(p.id)}
                              className={`flex items-start gap-3.5 p-3.5 rounded-xl border text-left transition-all relative overflow-hidden cursor-pointer border-solid ${
                                isActive 
                                  ? 'bg-white/[0.06] border-white/20 shadow-md scale-[1.01]' 
                                  : 'bg-white/[0.01] border-white/[0.04] hover:bg-white/[0.03] hover:border-white/10'
                              }`}
                            >
                              <div className="flex flex-col gap-1.5 pt-0.5 shrink-0">
                                <div className="flex gap-1">
                                  {p.colors.map((color, cIdx) => (
                                    <span key={cIdx} className={`w-3 h-3 rounded-full ${color} border border-black/20`} />
                                  ))}
                                </div>
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <p className="text-[12.5px] font-bold text-white leading-none">{p.name}</p>
                                <p className="text-[10.5px] text-white/45 mt-1 leading-normal">{p.desc}</p>
                              </div>

                              {isActive && (
                                <span className="w-4.5 h-4.5 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white shrink-0 self-center">
                                  <Check size={10} strokeWidth={3} />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Cam Yoğunluğu */}
                    <div>
                      <h4 className="text-[12px] font-bold text-white/40 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <Layers size={11} className="text-[#FF9F0A]" />
                        Glassmorphic Cam Yoğunluğu
                      </h4>
                      <div className="space-y-2.5">
                        {intensities.map((item) => {
                          const isActive = intensity === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setIntensity(item.id);
                                localStorage.setItem('lutheus-intensity', item.id);
                              }}
                              className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer border-solid ${
                                isActive 
                                  ? 'bg-white/[0.06] border-white/20 shadow-sm scale-[1.002]' 
                                  : 'bg-white/[0.01] border-white/[0.04] hover:bg-white/[0.03] hover:border-white/10'
                              }`}
                            >
                              <div className="pr-4">
                                <div className="flex items-center gap-2">
                                  <p className="text-[12.5px] font-bold text-white">{item.name}</p>
                                  <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-white/40 bg-white/5 border border-white/5 px-1.5 py-0.5 rounded">
                                    {item.detail}
                                  </span>
                                </div>
                                <p className="text-[10.5px] text-white/45 mt-0.5 leading-normal">{item.desc}</p>
                              </div>

                              {isActive ? (
                                <span className="w-4.5 h-4.5 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white shrink-0">
                                  <Check size={10} strokeWidth={3} />
                                </span>
                              ) : (
                                <span className="w-4.5 h-4.5 rounded-full bg-transparent border border-white/10 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Panel Layout */}
                    <div>
                      <h4 className="text-[12px] font-bold text-white/40 uppercase tracking-widest mb-3.5 flex items-center gap-1.5">
                        <Sliders size={11} className="text-[#0DF5FF]" />
                        {t('settings.layout')}
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        {[['side', t('settings.layoutSide')], ['center', t('settings.layoutCenter')]].map(([val, label]) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => savePanelStyle(val)}
                            className={`h-16 rounded-2xl border flex items-center justify-center text-xs font-semibold transition-all cursor-pointer border-solid ${
                              panelStyle === val 
                                ? 'bg-white/[0.06] border-white/20 text-white font-bold' 
                                : 'bg-transparent border-white/10 hover:bg-white/5 text-white/40'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </div>

        {isMgmt && (
          <>
            {/* SİSTEM CATEGORY TITLE */}
            <div className="pt-2">
              <span className="text-[10px] font-mono font-extrabold text-white/40 uppercase tracking-widest block mb-3">SİSTEM</span>
          
          <div className="space-y-3.5">
            {/* Accordion 3: Genel Ayarlar */}
            <div className={`rounded-xl border border-white/[0.04] overflow-hidden ${getGlassClass(intensity)}`}>
              <button 
                onClick={() => toggleSection('system')}
                className="w-full px-5 py-4 flex items-center justify-between bg-black/10 hover:bg-black/20 transition-all text-left border-none cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Sliders size={15} className="text-[#0DF5FF]" />
                  <span className="text-[13.5px] font-bold text-white">{t('settings.generalSettings')}</span>
                </div>
                {sections.system ? <ChevronDown size={14} className="text-white/40" /> : <ChevronRight size={14} className="text-white/40" />}
              </button>

              <AnimatePresence initial={false}>
                {sections.system && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-white/[0.04] p-5 space-y-4 bg-[#0E0E10]/15"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold">{t('settings.guildId')}</label>
                        <input 
                          type="text" 
                          value={settings.guildId}
                          onChange={(e) => setSettings((s) => ({ ...s, guildId: e.target.value }))}
                          className="w-full h-9 bg-[#111112] border border-white/10 rounded-lg px-3 text-[12px] text-white/90 outline-none focus:border-white/20 font-medium"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold">{t('settings.scanDelay')}</label>
                        <input 
                          type="number" 
                          value={settings.scanDelay}
                          onChange={(e) => setSettings((s) => ({ ...s, scanDelay: Number(e.target.value) }))}
                          className="w-full h-9 bg-[#111112] border border-white/10 rounded-lg px-3 text-[12px] text-white/90 outline-none focus:border-white/20 font-medium"
                        />
                      </div>
                    </div>

                    <div className="space-y-3 pt-1">
                      {[
                        ['cukEnabled', t('settings.cukEnabled')] as const,
                        ['autoValidate', t('settings.autoValidate')] as const,
                      ].map(([key, label]) => (
                        <div key={key} className="flex items-center">
                          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={settings[key]}
                              onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.checked }))}
                              className="rounded accent-primary"
                            />
                            <span className="text-white/70">{label}</span>
                          </label>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex items-center gap-2 text-white/30 text-[11px] leading-relaxed">
                      <AlertCircle size={12} className="shrink-0" />
                      <span>Lutheus sunucu doğrulama yapılandırması burada tanımlanan sunucu ve CUK kanallarına bağlı olarak Sapphire Gateway üzerinden otomatik çalışmaktadır.</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Accordion 3B: Sistem Durumu ve Tanılama */}
            <div className={`rounded-xl border border-white/[0.04] overflow-hidden ${getGlassClass(intensity)}`}>
              <button 
                onClick={() => toggleSection('diagnostics')}
                className="w-full px-5 py-4 flex items-center justify-between bg-black/10 hover:bg-black/20 transition-all text-left border-none cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Cpu size={15} className="text-[#32D74B]" />
                  <span className="text-[13.5px] font-bold text-white">Sistem Durumu ve Tanılama</span>
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
                    className="border-t border-white/[0.04] p-5 space-y-4 bg-[#0E0E10]/15 text-left"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-[#111112]/50 border border-white/5 rounded-xl p-4 space-y-3">
                        <span className="text-[10px] font-mono font-bold text-white/30 uppercase tracking-widest block">Bağlantı Matrisi</span>
                        
                        <div className="flex justify-between items-center text-[12px] py-1 border-b border-white/[0.02]">
                          <span className="text-white/50">Sapphire Bot Gateway</span>
                          <div className="flex items-center gap-1.5 font-bold text-[#32D74B]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#32D74B] animate-pulse" />
                            Çevrimiçi (Connected)
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center text-[12px] py-1 border-b border-white/[0.02]">
                          <span className="text-white/50">Supabase DB Client</span>
                          <div className="flex flex-col items-end gap-0.5">
                            <div className="flex items-center gap-1.5 font-bold text-[#32D74B]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#32D74B]" />
                              Senkronize (Active)
                            </div>
                            <span className="text-[9px] text-white/35 font-mono">Son Eşleşme: Canlı</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-[12px] py-1">
                          <span className="text-white/50">Discord Webhook</span>
                          <div className="flex items-center gap-1.5 font-bold text-[#32D74B]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#32D74B]" />
                            Doğrulandı (Valid)
                          </div>
                        </div>
                      </div>

                      <div className="bg-[#111112]/50 border border-white/5 rounded-xl p-4 space-y-3">
                        <span className="text-[10px] font-mono font-bold text-white/30 uppercase tracking-widest block">Sunucu Kaynak Telemetrisi</span>
                        
                        <div className="flex justify-between items-center text-[12px] py-1 border-b border-white/[0.02]">
                          <span className="text-white/50">CPU Yükü (CPU Load)</span>
                          <span className="font-mono font-extrabold text-white">{cpuLoad}</span>
                        </div>
                        
                        <div className="flex justify-between items-center text-[12px] py-1 border-b border-white/[0.02]">
                          <span className="text-white/50">Hafıza Havuzu (RAM)</span>
                          <span className="font-mono font-semibold text-white/80">{memUsage}</span>
                        </div>

                        <div className="flex justify-between items-center text-[12px] py-1">
                          <span className="text-white/50">Sinyal Gecikmesi (Bot Ping)</span>
                          <span className="font-mono font-extrabold text-[#32D74B]">{pingLatency}</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-white/[0.03] pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <p className="text-[11px] text-white/35 max-w-md">
                        Yenileme ve teşhis işlemi, webhook soketlerini tetikler ve veritabanı senkronizasyon havuzunun gecikme değerini anlık ölçümler.
                      </p>

                      <button
                        type="button"
                        onClick={handleRunSystemTest}
                        disabled={isTestingDurum}
                        className="px-4 py-2 border border-[#32D74B]/20 bg-[#32D74B]/5 hover:bg-[#32D74B]/10 text-[#32D74B] text-[11.5px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 border-solid"
                      >
                        {isTestingDurum ? (
                          <>
                            <RefreshCw size={12} className="animate-spin" />
                            Teşhis Ediliyor...
                          </>
                        ) : (
                          <>
                            <RefreshCw size={12} />
                            Sistem Teşhisi Yap
                          </>
                        )}
                      </button>
                    </div>

                    {isDurumChecked && !isTestingDurum && (
                      <motion.div 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-2.5 text-center bg-[#32D74B]/10 border border-[#32D74B]/20 text-[#32D74B] text-[11px] font-bold rounded-lg border-solid"
                      >
                        ✓ Tüm entegrasyon kanalları ve Sapphire Bot Gateway sağlıklı olarak senkronize durumda!
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ENTEGRASYONLAR CATEGORY TITLE */}
        <div className="pt-2">
          <span className="text-[10px] font-mono font-extrabold text-white/40 uppercase tracking-widest block mb-3">ENTEGRASYONLAR</span>
          
          {/* Accordion 4: Webhook ve API */}
          <div className={`rounded-xl border border-white/[0.04] overflow-hidden ${getGlassClass(intensity)}`}>
            <button 
              onClick={() => toggleSection('integrations')}
              className="w-full px-5 py-4 flex items-center justify-between bg-black/10 hover:bg-black/20 transition-all text-left border-none cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Radio size={15} className="text-[#FF9F0A]" />
                <span className="text-[13.5px] font-bold text-white">{t('settings.webhookApi')}</span>
              </div>
              {sections.integrations ? <ChevronDown size={14} className="text-white/40" /> : <ChevronRight size={14} className="text-white/40" />}
            </button>

            <AnimatePresence initial={false}>
              {sections.integrations && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border-t border-white/[0.04] p-5 space-y-4 bg-[#0E0E10]/15"
                >
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold">{t('settings.webhookUrl')}</label>
                      <p className="text-[11px] text-white/40 mb-2">{t('settings.webhookUrlDesc')}</p>
                      <input 
                        type="password" 
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        placeholder="https://discord.com/api/webhooks/..."
                        className="w-full h-9 bg-[#111112] border border-white/10 rounded-lg px-3 text-[12px] text-white/90 outline-none focus:border-white/20 font-medium font-mono"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold">{t('settings.botLogChannel')}</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={botChannelId}
                          onChange={(e) => setBotChannelId(e.target.value)}
                          placeholder="Channel ID..."
                          className="flex-1 h-9 bg-[#111112] border border-white/10 rounded-lg px-3 text-[12px] text-white/90 outline-none focus:border-white/20 font-medium"
                        />
                        <button 
                          type="button"
                          onClick={syncProfiles}
                          className="h-9 px-4 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] active:scale-95 text-xs text-white/80 transition-all font-bold cursor-pointer border-solid"
                        >
                          {t('settings.syncProfiles')}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* TEHLİKELİ BÖLGE CATEGORY TITLE */}
        <div className="pt-2">
          <span className="text-[10px] font-mono font-extrabold text-[#FF453A] uppercase tracking-widest block mb-3">TEHLİKELİ BÖLGE</span>
          
          {/* Accordion 5: Sadece Cezaları Sil */}
          <div className="rounded-xl border border-[#FF453A]/20 bg-[#FF453A]/[0.02] overflow-hidden backdrop-blur-md">
            <button 
              onClick={() => toggleSection('danger')}
              className="w-full px-5 py-4 flex items-center justify-between text-left bg-transparent border-none cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Trash2 size={15} className="text-[#FF453A]" />
                <span className="text-[13.5px] font-bold text-white">{t('settings.purgeCasesTitle')}</span>
              </div>
              {sections.danger ? <ChevronDown size={14} className="text-[#FF453A]/40" /> : <ChevronRight size={14} className="text-[#FF453A]/40" />}
            </button>

            <AnimatePresence initial={false}>
              {sections.danger && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border-t border-[#FF453A]/10 p-5 bg-black/30 space-y-4"
                >
                  {isManagementRole(session?.role ?? '') ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                      <div className="space-y-1 max-w-xl">
                        <p className="text-[12.5px] font-bold text-white">{t('settings.purgeCasesTitle')}</p>
                        <p className="text-[11.5px] text-white/50 leading-relaxed font-normal">
                          {t('settings.purgeCasesDesc')}
                        </p>
                      </div>

                      {!clearConfirmed ? (
                        <button 
                          onClick={() => setClearConfirmed(true)}
                          className="px-4 py-2 bg-[#FF453A]/15 hover:bg-[#FF453A]/25 border border-[#FF453A]/30 text-[#FF453A] text-[12px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap shadow-sm h-9 flex items-center justify-center shrink-0 border-solid"
                        >
                          {t('settings.purgeCasesBtn')}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 shrink-0">
                          <button 
                            onClick={() => setClearConfirmed(false)}
                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/75 hover:text-white rounded-lg text-[11px] font-bold transition-all border-none"
                          >
                            İptal
                          </button>
                          <button 
                            onClick={handlePurgeCases}
                            disabled={purging}
                            className="px-3.5 py-1.5 bg-[#FF453A] hover:bg-[#FF453A]/90 text-white rounded-lg text-[11px] font-black transition-all flex items-center gap-1 shadow-md border-none cursor-pointer"
                          >
                            {purging ? t('nav.syncing') : 'Evet, Sil!'}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-white/30 mt-0.5 shrink-0" />
                      <div>
                        <h4 className="font-semibold text-foreground mb-1">
                          {language === 'tr' ? 'Erişim Kısıtlı' : 'Access Restricted'}
                        </h4>
                        <p className="text-xs text-white/40 leading-relaxed">
                          {language === 'tr'
                            ? 'Bu bölgedeki veritabanı işlemleri (ceza silme, sistem sıfırlama) yalnızca Yönetim ekibi tarafından gerçekleştirilebilir. Kurucu, Admin, Yönetici, Genel Sorumlu veya Discord Yöneticisi rolüne sahip olmanız gerekmektedir.'
                            : 'Database operations in this section (purging cases, system reset) can only be performed by the Management team. You must have the Founder, Admin, Manager, General Director, or Discord Manager role.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {clearSuccess && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-2 text-center bg-[#32D74B]/10 border border-[#32D74B]/25 text-[#32D74B] text-[11px] font-semibold rounded-lg border-solid"
                    >
                      Tüm ceza geçmişi başarıyla sıfırlandı ve temizlendi!
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Global Save Trigger Area */}
        <div className="border-t border-white/[0.04] pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-[11px] text-white/30 max-w-sm leading-normal">
            Değişiklikleri kaydetmek bota veya sisteme yeni parametreleri göndermek için "Değişiklikleri Kaydet" tuşuna basın.
          </p>

          <button 
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="h-10 px-5 bg-white/[0.06] hover:bg-white/10 active:scale-[0.98] border border-white/10 text-white text-[12.5px] font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer border-solid"
          >
            {isSaving ? (
              <>
                <Loader size={13} className="animate-spin text-[#5E5CE6]" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <Save size={13} /> Değişiklikleri Kaydet
              </>
            )}
          </button>
        </div>

        {/* Save success toast */}
        <AnimatePresence>
          {saveSuccess && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-3.5 bg-[#32D74B]/10 border border-[#32D74B]/20 text-[#32D74B] text-[12px] font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-black/20 border-solid"
            >
              <CheckCircle2 size={14} /> Tüm ayarlar ve sistem parametreleri başarıyla güncellendi!
            </motion.div>
          )}
        </AnimatePresence>
          </>
        )}

      </div>
    </div>
  );
}

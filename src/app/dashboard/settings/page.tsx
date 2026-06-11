'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Palette, Layers, Check, Database, ShieldAlert, RefreshCw, 
  Cpu, KeyRound, Save, ChevronDown, ChevronRight, Globe, 
  User, CheckCircle2, Sliders, Globe2, Sparkles, AlertCircle, 
  Radio, ShieldCheck, Terminal, Trash2, LogOut, Loader2
} from 'lucide-react';
import { useTheme, ThemeType, IntensityType } from '@/context/ThemeContext';
import Tooltip from '@/components/ui/Tooltip';

export default function Settings() {
  const { theme, intensity, setTheme, setIntensity, getGlassClass } = useTheme();
  const [lang, setLang] = useState<'EN' | 'TR'>('TR');
  
  const [sections, setSections] = useState({
    account: true,
    appearance: true,
    system: true,
    diagnostics: true,
    integrations: true,
    danger: true
  });

  const toggleSection = (key: keyof typeof sections) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Diagnostics simulator states
  const [isTestingDurum, setIsTestingDurum] = useState(false);
  const [isDurumChecked, setIsDurumChecked] = useState(false);
  const [cpuLoad, setCpuLoad] = useState('1.5%');
  const [memUsage, setMemUsage] = useState('248 MB');
  const [pingLatency, setPingLatency] = useState('14 ms');

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

  // Input states & saves simulations
  const [serverID, setServerID] = useState('1223431616081166336');
  const [cukChannelID, setCukChannelID] = useState('1223431818290335805');
  const [webhookUrl, setWebhookUrl] = useState('https://discord.com/api/webhooks/1223431616081166336/lutheus-incoming');
  const [apiToken, setApiToken] = useState('s_g_live_9xNnLn1F83jD74B_secure_token');
  const [showApiToken, setShowApiToken] = useState(false);
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [clearConfirmed, setClearConfirmed] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);

  const themePalettes: { id: ThemeType; name: string; desc: string; colors: string[] }[] = [
    { 
      id: 'midnight', 
      name: 'Midnight Purple', 
      desc: 'Elegant neon indigo ve koyu mor kozmik tonlar', 
      colors: ['bg-[#5E5CE6]', 'bg-[#A259FE]', 'bg-[#050507]'] 
    },
    { 
      id: 'deepspace', 
      name: 'Deep Space Mono', 
      desc: 'Sade, yüksek kontrastlı ultra-monokrom ve grafit gri', 
      colors: ['bg-white', 'bg-neutral-400', 'bg-[#020202]'] 
    },
    { 
      id: 'sunset', 
      name: 'Sunset Crimson', 
      desc: 'Sıcak koyu kırmızı, amber ve bakır tonlar', 
      colors: ['bg-[#FF453A]', 'bg-[#FF9F0A]', 'bg-[#090505]'] 
    },
    { 
      id: 'arctic', 
      name: 'Arctic Aurora', 
      desc: 'Buz mavi ve aurora yeşili canlandırıcı hava', 
      colors: ['bg-[#0DF5FF]', 'bg-[#32D74B]', 'bg-[#030608]'] 
    }
  ];

  const intensities: { id: IntensityType; name: string; desc: string; detail: string }[] = [
    { 
      id: 'minimalist', 
      name: 'Yalın ve Düz (Flat)', 
      desc: 'Sıfır transparanlık, keskin çizgiler, yüksek kontrastlı siyah kartlar.',
      detail: '0px blur, flat contrast'
    },
    { 
      id: 'frosted', 
      name: 'Yarı Buzlu (Frosted)', 
      desc: 'Hafif transparan, zarif 12px derinlik ve yumuşak geçişler.',
      detail: '12px blur, 4% opacity'
    },
    { 
      id: 'immersive', 
      name: 'Göz Alıcı Derin (Immersive)', 
      desc: 'Maksimum transparanlık, 28px derinlik, asılı gölgeler.',
      detail: '28px blur, 8% opacity'
    }
  ];

  const handleSaveSettings = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    }, 1000);
  };

  const handleClearPenalties = () => {
    setClearSuccess(true);
    setTimeout(() => {
      setClearSuccess(false);
      setClearConfirmed(false);
    }, 3000);
  };

  return (
    <div className="p-6 md:p-8 w-full min-h-screen flex flex-col relative select-none">
      
      {/* Title block */}
      <div className="pb-6 mb-6 border-b border-white/[0.04] text-left">
        <h2 className="text-[22px] font-black text-white tracking-tight">Ayarlar</h2>
        <p className="text-[13px] text-[#8E8E93] mt-1 font-medium">Sistem tercihleri, entegrasyonlar ve erişim kontrolü.</p>
      </div>

      <div className="max-w-[850px] w-full space-y-6">
        
        {/* DİL SEÇİMİ */}
        <div className={`p-5 rounded-2xl ${getGlassClass()} overflow-hidden text-left`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-white/40 block">DİL SEÇİMİ</span>
              <span className="text-[13.5px] font-bold text-white mt-1 block">Dashboard Dili</span>
            </div>
            
            <div className="flex bg-[#111112] border border-white/10 rounded-lg p-1 self-start sm:self-auto shadow-inner">
              <button 
                onClick={() => setLang('EN')}
                className={`px-4 py-1.5 rounded-md text-[12px] font-bold transition-all duration-200 cursor-pointer ${
                  lang === 'EN' 
                    ? 'bg-white/10 text-white shadow-sm' 
                    : 'text-white/40 hover:text-white/80'
                }`}
              >
                EN - İngilizce
              </button>
              <button 
                onClick={() => setLang('TR')}
                className={`px-4 py-1.5 rounded-md text-[12px] font-bold transition-all duration-200 cursor-pointer ${
                  lang === 'TR' 
                    ? 'bg-white/10 text-white shadow-sm' 
                    : 'text-white/40 hover:text-white/80'
                }`}
              >
                TR - Türkçe
              </button>
            </div>
          </div>
        </div>

        {/* GENEL CATEGORY */}
        <div className="pt-2 text-left">
          <span className="text-[10px] font-mono font-extrabold text-white/40 uppercase tracking-widest block mb-3">GENEL</span>
          
          <div className="space-y-3.5">
            
            {/* Accordion 1: Hesap ve Erişim */}
            <div className={`rounded-xl border border-white/[0.04] overflow-hidden ${getGlassClass()}`}>
              <button 
                onClick={() => toggleSection('account')}
                className="w-full px-5 py-4 flex items-center justify-between bg-black/10 hover:bg-black/20 transition-all text-left"
              >
                <div className="flex items-center gap-2.5">
                  <User size={15} className="text-[#32D74B]" />
                  <span className="text-[13.5px] font-bold text-white">Hesap ve Erişim</span>
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
                          src="https://i.ibb.co/3sS1wsh/gearhead-avatar.png" 
                          onError={(e) => { e.currentTarget.src = "https://i.pravatar.cc/150?img=11"; }}
                          alt="avatar" 
                          className="w-10 h-10 rounded-lg border border-white/10 object-cover" 
                        />
                        <div>
                          <div className="flex items-center gap-2 font-sans">
                            <span className="text-[13.5px] font-extrabold text-white">Gear_Head</span>
                            <span className="text-[9px] font-mono font-bold bg-[#FF453A]/10 border border-[#FF453A]/20 text-[#FF453A] px-1.5 py-0.5 rounded uppercase">KURUCU - DISCORD</span>
                          </div>
                          <span className="text-[11px] text-white/35 font-mono">ID: 758769576778661989 • Aktif Yetki Seviyesi: Max</span>
                        </div>
                      </div>

                      <button 
                        onClick={() => alert('Oturum kapatma similatörü tetiklendi!')}
                        className="px-4 py-2 bg-[#FF453A]/10 hover:bg-[#FF453A]/15 border border-[#FF453A]/20 text-[#FF453A] text-[12px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto shadow-sm"
                      >
                        <LogOut size={12} /> Çıkış Yap
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Accordion 2: Görünüm */}
            <div className={`rounded-xl border border-white/[0.04] overflow-hidden ${getGlassClass()}`}>
              <button 
                onClick={() => toggleSection('appearance')}
                className="w-full px-5 py-4 flex items-center justify-between bg-black/10 hover:bg-black/20 transition-all text-left"
              >
                <div className="flex items-center gap-2.5">
                  <Palette size={15} className="text-[#5E5CE6]" />
                  <span className="text-[13.5px] font-bold text-white">Görünüm</span>
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
                    <div>
                      <h4 className="text-[12px] font-bold text-white/40 uppercase tracking-widest mb-3.5 flex items-center gap-1.5">
                        <Sparkles size={11} className="text-[#5E5CE6]" />
                        Renk Paleti ve Tema
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {themePalettes.map((p) => {
                          const isActive = theme === p.id;
                          return (
                            <button
                              key={p.id}
                              onClick={() => setTheme(p.id)}
                              className={`flex items-start gap-3.5 p-3.5 rounded-xl border text-left transition-all relative overflow-hidden cursor-pointer ${
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
                              onClick={() => setIntensity(item.id)}
                              className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </div>

        {/* SİSTEM CATEGORY */}
        <div className="pt-2 text-left">
          <span className="text-[10px] font-mono font-extrabold text-white/40 uppercase tracking-widest block mb-3">SİSTEM</span>
          
          {/* Accordion 3: Genel Ayarlar */}
          <div className={`rounded-xl border border-white/[0.04] overflow-hidden ${getGlassClass()}`}>
            <button 
              onClick={() => toggleSection('system')}
              className="w-full px-5 py-4 flex items-center justify-between bg-black/10 hover:bg-black/20 transition-all text-left"
            >
              <div className="flex items-center gap-2.5">
                <Sliders size={15} className="text-[#0DF5FF]" />
                <span className="text-[13.5px] font-bold text-white">Genel Ayarlar</span>
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
                      <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Discord Sunucu ID (Guild ID)</label>
                      <input 
                        type="text" 
                        value={serverID}
                        onChange={(e) => setServerID(e.target.value)}
                        className="w-full h-9 bg-[#111112] border border-white/10 rounded-lg px-3 text-[12px] text-white/90 outline-none focus:border-white/20 font-medium"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold">CUK Doğrulama Kanalı ID</label>
                      <input 
                        type="text" 
                        value={cukChannelID}
                        onChange={(e) => setCukChannelID(e.target.value)}
                        className="w-full h-9 bg-[#111112] border border-white/10 rounded-lg px-3 text-[12px] text-white/90 outline-none focus:border-white/20 font-medium"
                      />
                    </div>
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
          <div className={`mt-3.5 rounded-xl border border-white/[0.04] overflow-hidden ${getGlassClass()}`}>
            <button 
              onClick={() => toggleSection('diagnostics')}
              className="w-full px-5 py-4 flex items-center justify-between bg-black/10 hover:bg-black/20 transition-all text-left"
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
                  className="border-t border-white/[0.04] p-5 space-y-4 bg-[#0E0E10]/15"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#111112]/50 border border-white/5 rounded-xl p-4 space-y-3">
                      <span className="text-[10px] font-mono font-bold text-white/30 uppercase tracking-widest block">Bağlantı Matrisi</span>
                      
                      <div className="flex justify-between items-center text-[12px] py-1 border-b border-white/[0.02]">
                        <span className="text-white/55">Sapphire Bot Gateway</span>
                        <div className="flex items-center gap-1.5 font-bold text-[#32D74B]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#32D74B] animate-pulse" />
                          Çevrimiçi (Connected)
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center text-[12px] py-1 border-b border-white/[0.02]">
                        <span className="text-white/55">Supabase DB Client</span>
                        <div className="flex items-center gap-1.5 font-bold text-[#32D74B]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#32D74B]" />
                          Senkronize (Active)
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[12px] py-1">
                        <span className="text-white/55">Discord Webhook</span>
                        <div className="flex items-center gap-1.5 font-bold text-[#32D74B]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#32D74B]" />
                          Doğrulandı (Valid)
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#111112]/50 border border-white/5 rounded-xl p-4 space-y-3">
                      <span className="text-[10px] font-mono font-bold text-white/30 uppercase tracking-widest block">Sunucu Kaynak Telemetrisi</span>
                      
                      <div className="flex justify-between items-center text-[12px] py-1 border-b border-white/[0.02]">
                        <span className="text-white/55">Yük Devretme (CPU Load)</span>
                        <span className="font-mono font-extrabold text-white">{cpuLoad}</span>
                      </div>
                      
                      <div className="flex justify-between items-center text-[12px] py-1 border-b border-white/[0.02]">
                        <span className="text-white/55">Hafıza Havuzu (RAM)</span>
                        <span className="font-mono font-semibold text-white/80">{memUsage}</span>
                      </div>

                      <div className="flex justify-between items-center text-[12px] py-1">
                        <span className="text-white/55">Sinyal Gecikmesi (Bot Ping)</span>
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
                      className="px-4 py-2 border border-[#32D74B]/20 bg-[#32D74B]/5 hover:bg-[#32D74B]/10 text-[#32D74B] text-[11.5px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
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
                      className="p-2.5 text-center bg-[#32D74B]/10 border border-[#32D74B]/20 text-[#32D74B] text-[11px] font-bold rounded-lg"
                    >
                      ✓ Tüm entegrasyon kanalları ve Sapphire Bot Gateway sağlıklı olarak senkronize durumda!
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ENTEGRASYONLAR CATEGORY */}
        <div className="pt-2 text-left">
          <span className="text-[10px] font-mono font-extrabold text-white/40 uppercase tracking-widest block mb-3">ENTEGRASYONLAR</span>
          
          {/* Accordion 4: Webhook ve API */}
          <div className={`rounded-xl border border-white/[0.04] overflow-hidden ${getGlassClass()}`}>
            <button 
              onClick={() => toggleSection('integrations')}
              className="w-full px-5 py-4 flex items-center justify-between bg-black/10 hover:bg-black/20 transition-all text-left"
            >
              <div className="flex items-center gap-2.5">
                <Radio size={15} className="text-[#FF9F0A]" />
                <span className="text-[13.5px] font-bold text-white">Webhook ve API</span>
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
                      <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Webhook Bildirim Adresi (Discord)</label>
                      <input 
                        type="text" 
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        className="w-full h-9 bg-[#111112] border border-white/10 rounded-lg px-3 text-[12px] text-white/90 outline-none focus:border-white/20 font-medium"
                      />
                    </div>
                    
                    <div className="space-y-1.5 relative font-sans">
                      <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Sapphire API Key (CUK Doğrulama Yetkisi)</label>
                      <div className="relative">
                        <input 
                          type={showApiToken ? "text" : "password"}
                          value={apiToken}
                          onChange={(e) => setApiToken(e.target.value)}
                          className="w-full h-9 bg-[#111112] border border-white/10 rounded-lg pl-3 pr-16 text-[12px] text-white/90 outline-none focus:border-white/20 font-mono"
                        />
                        <button 
                          type="button"
                          onClick={() => setShowApiToken(!showApiToken)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-[11px] font-bold px-1.5 py-0.5 rounded hover:bg-white/5 transition-all"
                        >
                          {showApiToken ? "Gizle" : "Göster"}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* TEHLİKELİ BÖLGE CATEGORY */}
        <div className="pt-2 text-left">
          <span className="text-[10px] font-mono font-extrabold text-[#FF453A] uppercase tracking-widest block mb-3">TEHLİKELİ BÖLGE</span>
          
          <div className="rounded-xl border border-[#FF453A]/20 bg-[#FF453A]/[0.02] overflow-hidden backdrop-blur-md">
            <button 
              onClick={() => toggleSection('danger')}
              className="w-full px-5 py-4 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2.5">
                <Trash2 size={15} className="text-[#FF453A]" />
                <span className="text-[13.5px] font-bold text-white">Sadece Cezaları Sil</span>
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
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                    <div className="space-y-1 max-w-xl">
                      <p className="text-[12.5px] font-bold text-white">Cezaları Temizle</p>
                      <p className="text-[11.5px] text-white/50 leading-relaxed font-normal">
                        Tüm ceza detaylarını yerel hafızadan ve veritabanından siler, ancak yetkili ID, profil resmi ve roller gibi yetkili detaylarını korur.
                      </p>
                    </div>

                    {!clearConfirmed ? (
                      <button 
                        onClick={() => setClearConfirmed(true)}
                        className="px-4 py-2 bg-[#FF453A]/15 hover:bg-[#FF453A]/25 border border-[#FF453A]/30 text-[#FF453A] text-[12px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap shadow-sm h-9 flex items-center justify-center shrink-0"
                      >
                        Sadece Cezaları Temizle
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        <button 
                          onClick={() => setClearConfirmed(false)}
                          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/75 hover:text-white rounded-lg text-[11px] font-bold transition-all"
                        >
                          İptal
                        </button>
                        <button 
                          onClick={handleClearPenalties}
                          className="px-3.5 py-1.5 bg-[#FF453A] hover:bg-[#FF453A]/90 text-white rounded-lg text-[11px] font-black transition-all flex items-center gap-1 shadow-md"
                        >
                          Evet, Sil!
                        </button>
                      </div>
                    )}
                  </div>

                  {clearSuccess && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-2 text-center bg-[#32D74B]/10 border border-[#32D74B]/25 text-[#32D74B] text-[11px] font-semibold rounded-lg"
                    >
                      Tüm ceza geçmişi başarıyla sıfırlandı ve temizlendi! (Simülatör Temizliği Yapıldı)
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Global Save Trigger Area */}
        <div className="border-t border-white/[0.04] pt-6 flex items-center justify-between gap-4 text-left">
          <p className="text-[11px] text-white/30 max-w-sm leading-normal font-semibold">
            Değişiklikleri kaydetmek bota veya sisteme yeni parametreleri göndermek için "Değişiklikleri Kaydet" tuşuna basın.
          </p>

          <Tooltip content="Değişiklikleri Sisteme Kaydet">
            <button 
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="h-10 px-5 bg-white/[0.06] hover:bg-white/10 active:scale-[0.98] border border-white/10 text-white text-[12.5px] font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 size={13} className="animate-spin text-[#5E5CE6]" />
                  Kaydediliyor...
                </>
              ) : (
                <>
                  <Save size={13} /> Değişiklikleri Kaydet
                </>
              )}
            </button>
          </Tooltip>
        </div>

        {/* Save success toast */}
        <AnimatePresence>
          {saveSuccess && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-3.5 bg-[#32D74B]/10 border border-[#32D74B]/20 text-[#32D74B] text-[12px] font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-black/20"
            >
              <CheckCircle2 size={14} /> Tüm ayarlar ve sistem parametreleri başarıyla güncellendi!
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, CheckCircle2, ShieldAlert, RefreshCw, Copy, 
  Activity, Award, ArrowRight, Zap, Bot, ShieldCheck, 
  AlertCircle, Info, TrendingUp
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip as ChartTooltip, ResponsiveContainer 
} from 'recharts';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { getCases, getStaffProfiles, SapphireCase, StaffProfile, updateCaseVerdict } from '../lib/supabase';
import { getReliabilityStatus } from '../lib/cukEngine';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { isManagementRole, isManagementKadrosu, getRoleColor, getRoleLabel } from '../lib/auth';
import { resolveStaffAvatar, resolveStaffName } from '../lib/staffDisplay';
import { useLanguage } from '../contexts/LanguageContext';
import { getGlassClass } from '../lib/theme';
import Tooltip from '../components/Tooltip';
import RoleBadge from '../components/RoleBadge';

interface StaffStat {
  discordId: string;
  name: string;
  avatar: string;
  role: string;
  total: number;
  valid: number;
  invalid: number;
  pending: number;
  accuracy: number;
  trend: number[];
}

function buildStaffStats(cases: SapphireCase[], staffProfiles: StaffProfile[], t: (key: string) => string): StaffStat[] {
  const map = new Map<string, StaffStat>();
  const staffMap = new Map(staffProfiles.map(s => [s.discord_id, s]));

  for (const c of cases) {
    const id = c.author_discord_id;
    const profile = staffMap.get(id);
    const role = profile?.role || 'discord_moderatoru';
    if (role === 'eski_yetkili') continue; // Exclude former staff from rankings

    if (!map.has(id)) {
      map.set(id, {
        discordId: id,
        name: resolveStaffName(profile, c, t('home.moderator')),
        avatar: resolveStaffAvatar(profile, c, id),
        role: role,
        total: 0, valid: 0, invalid: 0, pending: 0, accuracy: 0, trend: [],
      });
    }
    const s = map.get(id)!;
    s.total++;
    if (c.cuk_verdict === 'valid') s.valid++;
    else if (c.cuk_verdict === 'invalid') s.invalid++;
    else s.pending++;
  }
  for (const s of map.values()) {
    s.accuracy = s.total > 0 ? Math.round((s.valid / s.total) * 100) : 0;
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function buildWeeklyChart(cases: SapphireCase[]) {
  const now = Date.now();
  const days: Record<string, { valid: number; invalid: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    days[key] = { valid: 0, invalid: 0 };
  }
  for (const c of cases) {
    const key = (c.created_at_sapphire || '').slice(0, 10);
    if (days[key]) {
      if (c.cuk_verdict === 'valid') days[key].valid++;
      else if (c.cuk_verdict === 'invalid') days[key].invalid++;
    }
  }
  return Object.entries(days).map(([date, d]) => ({
    name: new Date(date).toLocaleDateString('tr-TR', { weekday: 'short' }),
    success: d.valid,
    error: d.invalid,
  }));
}

function translateReliability(status: string, t: (key: string) => string): string {
  if (status === 'Guvenilir') return t('status.reliable') || 'Güvenilir';
  if (status === 'Riskli') return t('status.risky') || 'Riskli';
  return t('status.monitoring') || 'İzleniyor';
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 110, damping: 16 }
  }
};

export default function Home() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { showToast } = useToast();
  
  const [cases, setCases] = useState<SapphireCase[]>([]);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Theme states
  const [theme, setTheme] = useState<'midnight' | 'deepspace' | 'sunset' | 'arctic'>(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'lavender') return 'midnight';
    if (stored === 'corporate') return 'sunset';
    if (stored === 'light') return 'arctic';
    return 'deepspace';
  });

  const [intensity, setIntensity] = useState<string>(() => {
    return localStorage.getItem('lutheus-intensity') || 'frosted';
  });

  useEffect(() => {
    const handleThemeChange = () => {
      const stored = localStorage.getItem('theme');
      if (stored === 'lavender') setTheme('midnight');
      else if (stored === 'corporate') setTheme('sunset');
      else if (stored === 'light') setTheme('arctic');
      else setTheme('deepspace');
    };
    const handleIntensityChange = () => {
      setIntensity(localStorage.getItem('lutheus-intensity') || 'frosted');
    };
    window.addEventListener('storage', handleThemeChange);
    window.addEventListener('storage', handleIntensityChange);
    window.addEventListener('lutheus-theme-change', handleThemeChange);
    window.addEventListener('lutheus-intensity-change', handleIntensityChange);
    return () => {
      window.removeEventListener('storage', handleThemeChange);
      window.removeEventListener('storage', handleIntensityChange);
      window.removeEventListener('lutheus-theme-change', handleThemeChange);
      window.removeEventListener('lutheus-intensity-change', handleIntensityChange);
    };
  }, []);

  const isMgmtOrSenior = session
    ? ['kurucu', 'admin', 'yonetici', 'genel_sorumlu', 'discord_yoneticisi', 'kidemli', 'kidemli_discord_moderatoru', 'senior_moderator'].includes(session.role?.toLowerCase())
    : false;

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [casesData, staffData] = await Promise.all([
        getCases(200),
        getStaffProfiles()
      ]);
      setCases(casesData);
      setStaffProfiles(staffData);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleDashboardUpdateStatus = async (caseId: string, verdict: 'valid' | 'invalid') => {
    setUpdatingId(caseId);
    try {
      await updateCaseVerdict(caseId, verdict);
      showToast(t('cases.verdictUpdated') || 'Karar güncellendi', 'success');
      loadData(true);
    } catch (err) {
      console.error(err);
      showToast('Karar güncellenirken bir hata oluştu', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const total = Math.max(cases.length, 0);
  const valid = Math.max(cases.filter((c) => c.cuk_verdict === 'valid').length, 0);
  const invalid = Math.max(cases.filter((c) => c.cuk_verdict === 'invalid').length, 0);
  const pending = Math.max(total - valid - invalid, 0);
  const accuracy = total > 0 ? ((valid / total) * 100).toFixed(1) : '-';
  
  const staffStats = buildStaffStats(cases, staffProfiles, t);
  const isTopMgmt = session ? isManagementRole(session.role) : false;

  const managementStats = staffStats.filter(s => isManagementKadrosu(s.role));
  const regularStaffStats = staffStats.filter(s => !isManagementKadrosu(s.role));

  const weeklyData = buildWeeklyChart(cases);
  const uniqueMods = isTopMgmt ? staffStats.length : regularStaffStats.length;

  const generateReport = () => {
    const targetStats = isTopMgmt ? staffStats : regularStaffStats;
    const lines = targetStats.map((s, i) => {
      const status = getReliabilityStatus(s.valid, s.invalid);
      return `${i + 1}. ${s.name} — ${t('home.total')}: ${s.total} | ${t('pt.valid')}: ${s.valid} | ${t('pt.invalid')}: ${s.invalid} | ${t('home.accuracy')}: %${s.accuracy} | ${translateReliability(status, t)}`;
    });
    const text = `Lutheus CezaRapor — Report\n${'='.repeat(40)}\n${t('home.total')}: ${total} | ${t('pt.valid')}: ${valid} | ${t('pt.invalid')}: ${invalid} | ${t('pt.pending')}: ${pending}\n\n${lines.join('\n')}`;
    navigator.clipboard.writeText(text).then(() => {
      showToast('Detaylı özet rapor panoya kopyalandı!', 'success');
    }).catch(() => {});
  };

  const getChartColors = () => {
    switch (theme) {
      case 'deepspace':
        return { stroke: '#E5E5EA', fill: 'rgba(255, 255, 255, 0.05)' };
      case 'sunset':
        return { stroke: '#FF453A', fill: 'rgba(255, 69, 58, 0.08)' };
      case 'arctic':
        return { stroke: '#0DF5FF', fill: 'rgba(13, 245, 255, 0.08)' };
      default: // midnight
        return { stroke: '#5E5CE6', fill: 'rgba(94, 92, 230, 0.08)' };
    }
  };

  const currentColors = getChartColors();
  const recentModerations = cases.slice(0, 5);
  const staffMap = new Map(staffProfiles.map(s => [s.discord_id, s]));

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-6 md:p-8 w-full space-y-6 md:space-y-8 select-none text-left"
    >
      {/* Header Info Block */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/[0.04] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5E5CE6] animate-pulse" />
            <span className="text-[10px] font-mono tracking-widest text-white/40 uppercase font-semibold">GÖSTERGE PANELİ</span>
          </div>
          <h2 className="text-[22px] font-black text-white tracking-tight mt-1">Lutheus Hub</h2>
          <p className="text-[13px] text-[#8E8E93] mt-1 font-medium">
            Gerçek zamanlı veri akışı • <span className="text-white/60 font-semibold">{total} kayıt analiz edildi</span>
          </p>
        </div>
        
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {refreshing && (
            <span className="text-[11px] font-mono text-[#5E5CE6] mr-2">Veriler eşitleniyor...</span>
          )}
          {isMgmtOrSenior && (
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={generateReport}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-[12.5px] font-semibold text-white/95 transition-colors cursor-pointer disabled:opacity-50"
            >
              Özet Rapor Kopyala
            </motion.button>
          )}
          
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white hover:bg-white/[0.08] text-[12.5px] font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-55"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin text-[#5E5CE6]' : ''} /> Yenile
          </motion.button>
        </div>
      </div>

      {error && (
        <Card className="p-4 border-destructive/30 bg-destructive/5">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}

      {/* Main Grid Structure */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN (8 cols): Curved Weekly Trend & Recent Moderations */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Curved Trend Chart Card */}
          <motion.div 
            variants={itemVariants}
            className={`rounded-2xl p-5 ${getGlassClass(intensity, theme)}`}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-white/5 border border-white/5 text-[#32D74B]">
                  <Activity size={14} />
                </div>
                <div>
                  <h4 className="text-[13.5px] font-black text-white">{t('home.weeklyTrend') || 'Yaptırım Güvenlik Çizelgesi'}</h4>
                  <p className="text-[11px] text-[#8E8E93] font-medium">Haftalık doğrulama ve hata frekans oranı</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 text-[10px] font-bold text-white/40 uppercase tracking-wider font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentColors.stroke }} />
                  <span>Doğru</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#FF453A]" />
                  <span>Hatalı</span>
                </div>
              </div>
            </div>

            <div className="w-full h-[350px] relative">
              {loading ? (
                <Skeleton className="h-full w-full rounded-xl" />
              ) : (
                <ResponsiveContainer width="100%" height={350} debounce={100}>
                  <AreaChart data={weeklyData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="successGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={currentColors.stroke} stopOpacity={0.12}/>
                        <stop offset="100%" stopColor={currentColors.stroke} stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="errorGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FF453A" stopOpacity={0.08}/>
                        <stop offset="100%" stopColor="#FF453A" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontWeight: 'bold' }} 
                      dy={10} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} 
                    />
                    <ChartTooltip 
                      contentStyle={{ 
                        background: 'rgba(10,10,12,0.96)', 
                        border: '1px solid rgba(255,255,255,0.06)', 
                        borderRadius: '12px', 
                        fontSize: '11.5px', 
                        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(8px)'
                      }}
                      itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                      labelStyle={{ color: 'rgba(255,255,255,0.4)', marginBottom: '3px', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'black' }}
                    />
                    <Area type="monotone" dataKey="success" stroke={currentColors.stroke} strokeWidth={2.2} fill="url(#successGrad)" />
                    <Area type="monotone" dataKey="error" stroke="#FF453A" strokeWidth={1.5} fill="url(#errorGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </motion.div>



        </div>

        {/* RIGHT COLUMN (4 cols): Bento Links, Metrics, top 5 leadership standing */}
        <div className="lg:col-span-4 space-y-6">

          {/* Quick Shortcuts */}
          <div className="grid grid-cols-1 gap-3">
            <motion.div 
              onClick={() => navigate('/announcements')}
              whileHover={{ y: -2, borderColor: 'rgba(162, 89, 254, 0.20)' }}
              className="p-4 rounded-xl bg-[#111112]/30 border border-white/[0.03] cursor-pointer hover:bg-white/[0.01] transition-all relative overflow-hidden group shadow-lg flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#A259FE]/10 border border-[#A259FE]/20 flex items-center justify-center text-[#A259FE]">
                  <Bot size={15} />
                </div>
                <div>
                  <h4 className="text-[12.5px] font-bold text-white tracking-tight leading-tight">Sapphire Discord Duyuru</h4>
                  <p className="text-[11px] text-[#8E8E93]">Hızlı anons yayını yapma sistemi</p>
                </div>
              </div>
              <ArrowRight size={13} className="text-white/20 group-hover:text-white/50 group-hover:translate-x-1 transition-all shrink-0" />
            </motion.div>

            <motion.div 
              onClick={() => navigate('/cases')}
              whileHover={{ y: -2, borderColor: 'rgba(94, 92, 230, 0.20)' }}
              className="p-4 rounded-xl bg-[#111112]/30 border border-white/[0.03] cursor-pointer hover:bg-white/[0.01] transition-all relative overflow-hidden group shadow-lg flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#5E5CE6]/10 border border-[#5E5CE6]/20 flex items-center justify-center text-[#5E5CE6]">
                  <Zap size={15} />
                </div>
                <div>
                  <h4 className="text-[12.5px] font-bold text-white tracking-tight leading-tight">CUK Kurallar Kontrolü</h4>
                  <p className="text-[11px] text-[#8E8E93]">Ceza süreleri uygunluk denetimi</p>
                </div>
              </div>
              <ArrowRight size={13} className="text-white/20 group-hover:text-white/50 group-hover:translate-x-1 transition-all shrink-0" />
            </motion.div>
          </div>

          {/* Metric Stats Cards (2x2 Grid) */}
          <div className="grid grid-cols-2 gap-3.5">
            <CompactMetricCard 
              label={t('home.statTotal')} 
              value={loading ? '...' : String(total)} 
              subtext="+%12 bu hafta"
              icon={Activity} 
            />
            <CompactMetricCard 
              label={t('home.statValid')} 
              value={loading ? '...' : String(valid)} 
              subtext={`%${accuracy} ${t('pt.valid').toLowerCase()}`}
              icon={CheckCircle2}
              color="text-[#32D74B]"
            />
            <CompactMetricCard 
              label={t('home.statInvalid')} 
              value={loading ? '...' : String(invalid)} 
              subtext={`%${total > 0 ? ((invalid / total) * 100).toFixed(0) : 0} hata oranı`}
              icon={ShieldAlert}
              color="text-[#FF453A]"
            />
            <CompactMetricCard 
              label={t('home.statActiveStaff')} 
              value={loading ? '...' : String(uniqueMods)} 
              subtext="Aktif yetkili"
              icon={Award}
              color="text-[#FF9F0A]"
            />
          </div>



        </div>

      </div>

      {/* BOTTOM SECTION: Full Performans Tabloları */}
      <div className="space-y-6 pt-4">
        {/* Yönetim Performansı Table */}
        {isTopMgmt && (
          <motion.div 
            variants={itemVariants}
            className={`rounded-2xl overflow-hidden ${getGlassClass(intensity, theme)} border-primary/20 bg-primary/[0.01]`}
          >
            <div className="px-5 py-4 border-b border-white/[0.04] flex items-center justify-between">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-[#A259FE]" /> Yönetim Performansı
              </h3>
              <span className="text-xs text-white/50">{managementStats.length} yönetici</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    <th className="py-3 px-5 text-[11px] font-semibold text-white/40 uppercase tracking-wider">#</th>
                    <th className="py-3 px-3 text-[11px] font-semibold text-white/40 uppercase tracking-wider">{t('home.moderator')}</th>
                    <th className="py-3 px-3 text-center text-[11px] font-semibold text-white/40 uppercase tracking-wider">{t('home.total')}</th>
                    <th className="py-3 px-3 text-center text-[11px] font-semibold text-white/40 uppercase tracking-wider">{t('pt.valid')}</th>
                    <th className="py-3 px-3 text-center text-[11px] font-semibold text-white/40 uppercase tracking-wider">{t('pt.invalid')}</th>
                    <th className="py-3 px-3 text-center text-[11px] font-semibold text-white/40 uppercase tracking-wider">{t('home.accuracy')}</th>
                    <th className="py-3 px-5 text-center text-[11px] font-semibold text-white/40 uppercase tracking-wider">{t('home.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} className="border-b border-white/[0.02]">
                        <td className="py-3 px-5"><Skeleton className="h-4 w-4" /></td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <Skeleton className="w-8 h-8 rounded-full" />
                            <Skeleton className="h-4 w-24" />
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center"><Skeleton className="h-4 w-8 mx-auto" /></td>
                        <td colSpan={4} />
                      </tr>
                    ))
                  ) : managementStats.length === 0 ? (
                    <tr><td colSpan={7} className="py-12 text-center text-white/40 text-sm">{t('home.noData')}</td></tr>
                  ) : managementStats.map((s, i) => {
                    const status = getReliabilityStatus(s.valid, s.invalid);
                    const statusVariant: 'success' | 'destructive' | 'warning' | 'default' = status === 'Guvenilir' ? 'success' : status === 'Riskli' ? 'destructive' : 'warning';
                    return (
                      <tr
                        key={s.discordId}
                        className="border-b border-white/[0.02] hover:bg-white/[0.02] cursor-pointer transition-colors"
                        onClick={() => navigate('/cases', { state: { search: s.name } })}
                      >
                        <td className="py-3 px-5 text-white/30 text-xs font-mono">{i + 1}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <img src={s.avatar} alt="" className="w-8 h-8 rounded-lg bg-secondary shrink-0 object-cover" />
                            <div className="flex flex-col">
                              <span
                                className="font-semibold text-sm text-white hover:text-[#A259FE] hover:underline cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate('/staff', { state: { discordId: s.discordId } });
                                }}
                              >
                                {s.name}
                              </span>
                              <span className="text-[10px] text-white/40">{getRoleLabel(s.role)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-white">{s.total}</td>
                        <td className="py-3 px-3 text-center text-emerald-400 font-bold">{s.valid}</td>
                        <td className="py-3 px-3 text-center text-destructive font-bold">{s.invalid}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`font-black text-sm ${s.accuracy >= 70 ? 'text-[#32D74B]' : s.accuracy >= 50 ? 'text-[#FF9F0A]' : 'text-[#FF453A]'}`}>
                            %{s.accuracy}
                          </span>
                        </td>
                        <td className="py-3 px-5 text-center">
                          <RoleBadge role={s.role} staffName={s.name} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Staff Table */}
        <motion.div 
          variants={itemVariants}
          className={`rounded-2xl overflow-hidden ${getGlassClass(intensity, theme)}`}
        >
          <div className="px-5 py-4 border-b border-white/[0.04] flex items-center justify-between">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-[#5E5CE6]" /> {t('home.staffPerf')}
            </h3>
            <span className="text-xs text-white/50">{regularStaffStats.length} {t('home.moderator').toLowerCase()}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <th className="py-3 px-5 text-white/40 text-[11px] font-semibold uppercase tracking-wider">#</th>
                  <th className="py-3 px-3 text-white/40 text-[11px] font-semibold uppercase tracking-wider">{t('home.moderator')}</th>
                  <th className="py-3 px-3 text-center text-white/40 text-[11px] font-semibold uppercase tracking-wider">{t('home.total')}</th>
                  <th className="py-3 px-3 text-center text-white/40 text-[11px] font-semibold uppercase tracking-wider">{t('pt.valid')}</th>
                  <th className="py-3 px-3 text-center text-white/40 text-[11px] font-semibold uppercase tracking-wider">{t('pt.invalid')}</th>
                  <th className="py-3 px-3 text-center text-white/40 text-[11px] font-semibold uppercase tracking-wider">{t('home.accuracy')}</th>
                  <th className="py-3 px-5 text-center text-white/40 text-[11px] font-semibold uppercase tracking-wider">{t('home.status')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-white/[0.02]">
                      <td className="py-3 px-5"><Skeleton className="h-4 w-4" /></td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <Skeleton className="w-8 h-8 rounded-full" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center"><Skeleton className="h-4 w-8 mx-auto" /></td>
                      <td colSpan={4} />
                    </tr>
                  ))
                ) : regularStaffStats.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-white/40 text-sm">{t('home.noData')}</td></tr>
                ) : regularStaffStats.map((s, i) => {
                  const status = getReliabilityStatus(s.valid, s.invalid);
                  return (
                    <tr
                      key={s.discordId}
                      className="border-b border-white/[0.02] hover:bg-white/[0.02] cursor-pointer transition-colors"
                      onClick={() => navigate('/cases', { state: { search: s.name } })}
                    >
                      <td className="py-3 px-5 text-white/30 text-xs font-mono">{i + 1}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <img src={s.avatar} alt="" className="w-8 h-8 rounded-lg bg-secondary shrink-0 object-cover" />
                          <div className="flex flex-col">
                            <span
                              className="font-semibold text-sm text-white hover:text-[#5E5CE6] hover:underline cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate('/staff', { state: { discordId: s.discordId } });
                              }}
                            >
                              {s.name}
                            </span>
                            <span className="text-[10px] text-white/40">{getRoleLabel(s.role)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-white">{s.total}</td>
                      <td className="py-3 px-3 text-center text-emerald-400 font-bold">{s.valid}</td>
                      <td className="py-3 px-3 text-center text-destructive font-bold">{s.invalid}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`font-black text-sm ${s.accuracy >= 70 ? 'text-[#32D74B]' : s.accuracy >= 50 ? 'text-[#FF9F0A]' : 'text-[#FF453A]'}`}>
                          %{s.accuracy}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-center">
                        <RoleBadge role={s.role} staffName={s.name} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

    </motion.div>
  );
}

// Compact helper metric box component
interface CompactMetricProps {
  label: string;
  value: string;
  subtext?: string;
  icon: React.ComponentType<any>;
  color?: string;
}

function CompactMetricCard({ label, value, subtext, icon: Icon, color = "text-white" }: CompactMetricProps) {
  return (
    <div className="rounded-xl p-4 border border-white/[0.04] bg-[#0c0c0e]/30 relative overflow-hidden group shadow-lg">
      <div className="text-white/30 group-hover:text-white/50 transition-colors mb-2 shrink-0">
        <Icon size={14} />
      </div>
      <div>
        <span className={`text-[20px] font-black tracking-tight leading-none ${color}`}>{value}</span>
        <h5 className="text-[11.5px] font-bold text-white/50 mt-1">{label}</h5>
        {subtext && <p className="text-[9px] text-white/30 mt-0.5 font-medium">{subtext}</p>}
      </div>
    </div>
  );
}

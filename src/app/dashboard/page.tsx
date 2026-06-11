'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip as ChartTooltip, ResponsiveContainer } from 'recharts';
import { 
  Activity, ShieldAlert, CheckCircle, Award, RotateCw, 
  Bot, Zap, ArrowRight, CheckCircle2, AlertCircle, ShieldCheck
} from 'lucide-react';
import { chartData, performanceData as fallbackPerformanceData, penaltiesLog as fallbackPenaltiesData } from '@/data/mockData';
import { useTheme } from '@/context/ThemeContext';
import { supabase, getStaffData, getPenaltiesData } from '@/lib/supabase';
import { updatePenaltyStatusService } from '@/services/penaltyService';
import Tooltip from '@/components/ui/Tooltip';

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

export default function Dashboard() {
  const router = useRouter();
  const { theme, getGlassClass } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  const [staffList, setStaffList] = useState<any[]>(fallbackPerformanceData);
  const [penaltiesList, setPenaltiesList] = useState<any[]>(fallbackPenaltiesData);
  const [isLoading, setIsLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    fetchDatabaseData();

    // Subscribe to real-time changes in both tables for cross-page live sync
    const staffChannel = supabase
      .channel('realtime-staff-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, () => {
        fetchDatabaseData();
      })
      .subscribe();

    const penaltiesChannel = supabase
      .channel('realtime-penalties-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'penalties' }, () => {
        fetchDatabaseData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(staffChannel);
      supabase.removeChannel(penaltiesChannel);
    };
  }, []);

  const fetchDatabaseData = async () => {
    setIsLoading(true);
    try {
      const sData = await getStaffData(fallbackPerformanceData);
      const pData = await getPenaltiesData(fallbackPenaltiesData);
      setStaffList(sData || fallbackPerformanceData);
      setPenaltiesList(pData || fallbackPenaltiesData);
    } catch (e) {
      console.warn("Supabase fetch failed on Dashboard, utilizing fallbacks", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDashboardUpdateStatus = async (id: string, status: 'DOĞRU' | 'HATALI') => {
    setUpdatingId(id);
    try {
      const success = await updatePenaltyStatusService(id, status);
      if (success) {
        // Optimistic locally updated state
        setPenaltiesList(prev => prev.map(p => p.id === id ? { ...p, status } : p));
        // Recalculate everything by refreshing
        fetchDatabaseData();
      }
    } catch (err) {
      console.warn("Failed to update status directly from Dashboard", err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Derived live metrics
  const totalPenalties = penaltiesList.length || 156;
  const correctCount = penaltiesList.filter(p => p.status === 'DOĞRU').length || 134;
  const incorrectCount = penaltiesList.filter(p => p.status === 'HATALI').length || 22;
  const activeStaffCount = staffList.filter(s => s.roleGroup === 'ACTIVE').length || 11;
  const accuracyPercentage = totalPenalties > 0 ? Math.round((correctCount / totalPenalties) * 100) : 85.9;

  // Get active color accents based on the theme
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

  // Pick top 5 most recent penalties to display
  const recentModerations = [...penaltiesList]
    .slice(0, 5);

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-6 md:p-8 w-full space-y-6 md:space-y-8 select-none bg-gradient-to-b from-[#0f172e] to-[#1a1f3a]"
    >
      
      {/* Header Info Block - Enhanced with Purple Theme */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-purple-500/20 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-[10px] font-mono tracking-widest text-purple-400/60 uppercase font-semibold">YÖNETİM PANELİ</span>
          </div>
          <h2 className="text-[28px] font-black text-white tracking-tight mt-2 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">Lutheus Hub</h2>
          <p className="text-[13px] text-purple-200/70 mt-2 font-medium">
            Gerçek zamanlı veri akışı • <span className="text-white/80 font-semibold">{totalPenalties} kayıt</span>
          </p>
        </div>
        
        <div className="flex items-center gap-3 self-start sm:self-auto">
          {isLoading && (
            <span className="text-[11px] font-mono text-purple-400 mr-2">Veriler eşitleniyor...</span>
          )}
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              const textToCopy = `Lutheus Genel Rapor: Toplam Ceza ${totalPenalties}, Doğru: ${correctCount}, Hatalı: ${incorrectCount}, Doğruluk Oranı: %${accuracyPercentage}`;
              navigator.clipboard.writeText(textToCopy);
              alert('İskelet özet verileri panoya kopyalandı!');
            }}
            className="px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 text-[12.5px] font-semibold text-purple-200 transition-all cursor-pointer"
          >
            Rapor Kopyala
          </motion.button>
          
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={fetchDatabaseData}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 border border-purple-500/50 text-white text-[12.5px] font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-55"
          >
            <RotateCw size={14} className={isLoading ? 'animate-spin' : ''} /> Yenile
          </motion.button>
        </div>
      </div>

      {/* Main Grid Structure: Priorities Moderations on Left (8 cols) and Widgets on Right (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: 8 columns on large screens - Dedicated strictly to Moderation records & Analytics */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Recent Moderations Section (Highest priority element) */}
          <motion.div 
            variants={itemVariants}
            className="premium-card"
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-purple-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-white">Son Moderasyon Kararları</h3>
                  <p className="text-[12px] text-purple-200/60 mt-0.5">Gerçek zamanlı doğrulama ve denetleme</p>
                </div>
              </div>
              
              <button 
                onClick={() => router.push('/dashboard/penalties')}
                className="text-[12px] font-bold text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
              >
                Tümünü Gör <ArrowRight size={14} />
              </button>
            </div>

            {/* Moderations Feed List */}
            <div className="space-y-3">
              {recentModerations.map((log, index) => {
                const isUpdating = updatingId === log.id;
                return (
                  <div 
                    key={log.id + index}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-purple-900/10 border border-purple-500/15 hover:bg-purple-900/20 hover:border-purple-500/30 transition-all gap-4"
                  >
                    {/* User and Staff Details */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="relative shrink-0">
                        <img src={log.avatar} alt="avatar" className="w-10 h-10 rounded-lg border border-purple-500/30 object-cover" />
                        <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#0f172e] ${
                          log.status === 'DOĞRU' ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                      </div>
                      
                      <div className="truncate space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-bold text-white">{log.staff}</span>
                          <span className="text-[11px] font-mono font-semibold text-purple-300 px-2 py-0.5 rounded bg-purple-500/15">
                            {log.id}
                          </span>
                        </div>
                        <p className="text-[12px] text-purple-200/60 truncate font-medium">
                          {log.reason}
                        </p>
                      </div>
                    </div>

                    {/* Metadata duration and Date */}
                    <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
                      <div className="text-left sm:text-right">
                        <span className="text-[12px] font-mono font-bold text-purple-300 block">
                          {log.duration || 'Belirsiz'}
                        </span>
                        <span className="text-[11px] text-purple-200/50 block mt-1 font-medium">
                          {log.date}
                        </span>
                      </div>

                      {/* Micro inline action toggles */}
                      <div className="flex gap-2">
                        <Tooltip content="Doğru Olarak İşaretle">
                          <button
                            disabled={isUpdating}
                            onClick={() => handleDashboardUpdateStatus(log.id, 'DOĞRU')}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                              log.status === 'DOĞRU'
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-purple-500/10 text-purple-200/60 border border-transparent hover:bg-purple-500/20 hover:text-purple-200'
                            } cursor-pointer`}
                          >
                            <CheckCircle2 size={12} />
                            <span>Doğru</span>
                          </button>
                        </Tooltip>

                        <Tooltip content="Hata Olarak İşaretle">
                          <button
                            disabled={isUpdating}
                            onClick={() => handleDashboardUpdateStatus(log.id, 'HATALI')}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                              log.status === 'HATALI'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : 'bg-purple-500/10 text-purple-200/60 border border-transparent hover:bg-purple-500/20 hover:text-purple-200'
                            } cursor-pointer`}
                          >
                            <AlertCircle size={12} />
                            <span>Hatalı</span>
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Trend Chart Area (Flattened & low-profile UI) */}
          <motion.div 
            variants={itemVariants}
            className={`compact-glass rounded-2xl p-5 border border-white/[0.04] ${getGlassClass()}`}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-white/5 border border-white/5 text-[#32D74B]">
                  <Activity size={14} />
                </div>
                <div>
                  <h4 className="text-[13.5px] font-black text-white">Yaptırım Güvenlik Çizelgesi</h4>
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

            {/* Recharts Curved Chart Area */}
            <div className="w-full h-[170px] relative">
              {isMounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
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

        {/* RIGHT COLUMN: 4 columns on large screens - Dashboard Metrics, Team Performers and Modules */}
        <div className="lg:col-span-4 space-y-6">

          {/* Clean Apple-style Bento Link shortcuts (Discord Bot Controller & CUK Module) */}
          <div className="grid grid-cols-1 gap-3">
            
            <motion.div 
              onClick={() => router.push('/announcements')}
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
              onClick={() => router.push('/penalties')}
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

          {/* Metric Stats Cards (2x2 Grid, Clean & Minimal) */}
          <div className="grid grid-cols-2 gap-3.5">
            <CompactMetricCard 
              label="Toplam Karar" 
              value={String(totalPenalties)} 
              subtext="+%12 bu hafta"
              icon={Activity} 
            />
            <CompactMetricCard 
              label="Doğrulanmış" 
              value={String(correctCount)} 
              subtext={`%${accuracyPercentage} başarı`}
              icon={CheckCircle}
              color="text-[#32D74B]"
            />
            <CompactMetricCard 
              label="Hatalı Ceza" 
              value={String(incorrectCount)} 
              subtext={`%${(100 - accuracyPercentage).toFixed(0)} marjinal hata`}
              icon={ShieldAlert}
              color="text-[#FF453A]"
            />
            <CompactMetricCard 
              label="Aktif Kadro" 
              value={String(activeStaffCount)} 
              subtext="Aktif yetkili"
              icon={Award}
              color="text-[#FF9F0A]"
            />
          </div>

          {/* Quick Leadership Board (Active Team Standings) */}
          <motion.div 
            variants={itemVariants}
            className={`compact-glass rounded-2xl p-4 border border-white/[0.04] ${getGlassClass()}`}
          >
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/[0.03]">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#FF9F0A]" />
                <h4 className="text-[13px] font-bold text-white tracking-tight">Kadro Başarı Sıralaması</h4>
              </div>
              <span className="text-[9px] font-mono text-white/35 font-bold uppercase">DOĞRULUK</span>
            </div>

            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1 select-none hide-scrollbar">
              {staffList
                .filter(s => s.roleGroup === 'ACTIVE')
                .sort((a, b) => b.accuracy - a.accuracy || b.total - a.total)
                .slice(0, 5)
                .map((staff, idx) => (
                  <div key={staff.id || idx} className="flex items-center justify-between py-1 border-b border-white/[0.015] last:border-0 last:pb-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] font-mono text-white/35 font-black w-3.5 shrink-0">#{idx + 1}</span>
                      <img src={staff.avatar} className="w-6 h-6 rounded-md object-cover border border-white/5 shrink-0" alt="avatar" />
                      <div className="truncate shrink-0">
                        <span className="text-[12.5px] font-bold text-white/90 block leading-none">{staff.user}</span>
                        <span className="text-[9.5px] text-white/45 font-semibold mt-0.5 block">{staff.role}</span>
                      </div>
                    </div>
                    
                    <div className="text-right flex items-center gap-2 shrink-0">
                      <div className="text-[10px] text-[#8E8E93] text-right font-medium">
                        {staff.correct}/{staff.total}
                      </div>
                      <span className={`text-[12px] font-black ${
                        staff.accuracy >= 85 ? 'text-[#32D74B]' : staff.accuracy >= 65 ? 'text-[#FF9F0A]' : 'text-[#FF453A]'
                      }`}>
                        %{staff.accuracy}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </motion.div>

        </div>

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
    <div className="compact-glass rounded-xl p-4 border border-white/[0.04] bg-[#0c0c0e]/30 relative overflow-hidden group shadow-lg">
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

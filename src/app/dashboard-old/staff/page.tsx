'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, RefreshCw, Plus, X, ShieldAlert, CheckCircle2, 
  ChevronRight, ArrowDownLeft, ArrowUpRight, Copy, Shield,
  Award, TrendingUp, HelpCircle, Activity, ExternalLink, Calendar,
  UserCheck, AlertTriangle, Users
} from 'lucide-react';
import { performanceData, penaltiesLog } from '@/data/mockData';
import { useTheme } from '@/context/ThemeContext';
import Tooltip from '@/components/ui/Tooltip';
import { getStaffData, supabase } from '@/lib/supabase';
import RoleBadge from '@/components/ui/RoleBadge';

function getRoleColorAndInfo(role: string) {
  const norm = (role || '').toUpperCase();
  if (norm === 'KURUCU' || norm.includes('YÖNETİCİSİ') || norm === 'YÖNETİCİ' || norm.includes('YAGI') || norm.includes('REI') || norm.includes('BARIS')) {
    if (norm.includes('DISCORD YÖNETİCİ') || norm === 'DISCORD YÖNETİCİSİ') {
      return {
        level: 60,
        label: "Discord Yöneticisi",
        colorClass: "text-[#BF5AF2]",
        bgClass: "bg-[#BF5AF2]/10 border-[#BF5AF2]/20",
        badgeColor: "#BF5AF2"
      };
    }
    return {
      level: 100,
      label: "Yönetici",
      colorClass: "text-[#FF453A]",
      bgClass: "bg-[#FF453A]/10 border-[#FF453A]/20",
      badgeColor: "#FF453A"
    };
  }
  if (norm.includes('GENEL') || norm.includes('SORUMLU')) {
    return {
      level: 80,
      label: "Genel Sorumlu",
      colorClass: "text-[#34C759]",
      bgClass: "bg-[#34C759]/10 border-[#34C759]/20",
      badgeColor: "#34C759"
    };
  }
  if (norm.includes('KIDEMLİ') || norm.includes('SENIOR')) {
    return {
      level: 40,
      label: "Kıdemli Moderatör",
      colorClass: "text-[#FF9F0A]",
      bgClass: "bg-[#FF9F0A]/10 border-[#FF9F0A]/20",
      badgeColor: "#FF9F0A"
    };
  }
  if (norm.includes('MODERATÖR')) {
    return {
      level: 30,
      label: "Moderatör Ekibi",
      colorClass: "text-[#5E5CE6]",
      bgClass: "bg-[#5E5CE6]/10 border-[#5E5CE6]/20",
      badgeColor: "#5E5CE6"
    };
  }
  if (norm.includes('DENEME') || norm.includes('TRAINEE')) {
    return {
      level: 10,
      label: "Deneme Destek Ekibi",
      colorClass: "text-[#8E8E93]",
      bgClass: "bg-[#8E8E93]/10 border-[#8E8E93]/20",
      badgeColor: "#8E8E93"
    };
  }
  return {
    level: 25,
    label: "Destek Ekibi",
    colorClass: "text-[#0DF5FF]",
    bgClass: "bg-[#0DF5FF]/10 border-[#0DF5FF]/20",
    badgeColor: "#0DF5FF"
  };
}

export default function Staff() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { getGlassClass } = useTheme();

  // Add staff modal variables
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserId, setNewUserId] = useState('');
  const [newUserRole, setNewUserRole] = useState('DISCORD MODERATÖR');
  const [newUserStatus, setNewUserStatus] = useState('GÜVENİLİR');

  // Real state
  const [staffList, setStaffList] = useState<any[]>(performanceData);

  // Filter list by searchQuery
  const filteredStaff = staffList.filter(staff => 
    staff.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
    staff.id.includes(searchQuery)
  );

  const activeStaff = filteredStaff.filter(s => s.roleGroup === 'ACTIVE');
  const oldStaff = filteredStaff.filter(s => s.roleGroup === 'OLD');

  useEffect(() => {
    fetchStaff();

    // Subscribe to real-time changes in the 'staff' table
    const channel = supabase
      .channel('realtime-staff-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'staff' },
        () => {
          fetchStaff();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchStaff = async () => {
    setIsLoading(true);
    try {
      const dbData = await getStaffData(performanceData);
      setStaffList(dbData);
    } catch (e) {
      console.warn("Supabase fetch error, fallback to mockData.", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    await fetchStaff();
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserId.trim()) return;

    const newStaff = {
      id: newUserId,
      user: newUserName,
      avatar: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70) + 1}`,
      total: 0,
      correct: 0,
      incorrect: 0,
      accuracy: 100,
      status: newUserStatus,
      role: newUserRole,
      roleGroup: 'ACTIVE'
    };

    setStaffList(prev => [newStaff, ...prev]);

    try {
      await supabase.from('staff').insert([newStaff]);
    } catch (err) {
      console.warn("Db write failure, local update completed.", err);
    }

    setNewUserName('');
    setNewUserId('');
    setShowAddModal(false);
  };

  return (
    <div className="p-4 md:p-8 w-full min-h-screen flex flex-col relative select-none">
      
      {/* Header bar matching exact screenshot */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-6 border-b border-white/[0.04] gap-4">
        <div>
          <h2 className="text-[22px] font-bold text-white tracking-tight leading-none">Yetkili Listesi</h2>
          <p className="text-[12px] text-white/40 mt-1.5 font-medium">
            {staffList.length} yetkili kayıtlı • <span className="text-[#32D74B] font-semibold">{staffList.filter(s => s.roleGroup === 'ACTIVE').length} Aktif</span> • <span className="text-white/30">{staffList.filter(s => s.roleGroup === 'OLD').length} Eski</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowAddModal(true)}
            className="h-9 px-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white hover:bg-[#5E5CE6]/10 hover:border-[#5E5CE6]/20 hover:text-[#5E5CE6] text-[12.5px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg"
          >
            <Plus size={14} /> Yetkili Ekle
          </motion.button>
          <Tooltip content="Yetkili Listesini Yenile">
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleRefresh}
              className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer shadow-lg"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin text-[#5E5CE6]' : ''} />
            </motion.button>
          </Tooltip>
        </div>
      </div>

      {/* Search Input Filter Controls */}
      <div className="mb-8 max-w-sm relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
        <input 
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Yetkili ara..."
          className="clean-input w-full h-9 bg-[#111112] border border-white/10 rounded-lg pl-10 pr-4 text-[12px] transition-all focus:bg-[#151517] focus:border-white/20 font-medium"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
            <X size={12} />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 flex-1">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-44 rounded-2xl bg-white/[0.02] border border-white/[0.04] p-5 animate-pulse flex flex-col justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/[0.04]" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-1/3 bg-white/[0.04] rounded" />
                  <div className="h-3 w-1/2 bg-white/[0.04] rounded" />
                </div>
              </div>
              <div className="h-10 bg-white/[0.02] rounded-lg" />
              <div className="h-2 w-full bg-white/[0.04] rounded" />
            </div>
          ))}
        </div>
      ) : filteredStaff.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="compact-glass rounded-2xl border border-white/[0.04] p-16 text-center max-w-xl mx-auto relative overflow-hidden bg-[#0c0c0e]/35 shadow-2xl my-6"
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#5E5CE6]/5 blur-[70px] rounded-full pointer-events-none" />
          
          <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-center mx-auto mb-6 relative group shadow-lg">
            <div className="absolute inset-0 bg-[#5E5CE6]/10 rounded-2xl blur-md opacity-25 group-hover:opacity-60 transition-opacity" />
            <Users className="text-white/30 relative z-10" size={26} />
          </div>
          
          <h3 className="text-[16px] font-bold text-white tracking-tight leading-none">Arama Sonucu Bulunamadı</h3>
          <p className="text-[12.5px] text-[#8E8E93] mt-3 mb-6 max-w-xs mx-auto leading-relaxed font-medium">
            "<span className="text-white/85 font-semibold">{searchQuery}</span>" araması ile eşleşen aktif veya eski herhangi bir yetkili kaydı bulunmamaktadır.
          </p>
          
          <motion.button 
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setSearchQuery('')}
            className="px-4 py-2.5 text-[11.5px] font-bold text-white bg-white/[0.05] border border-white/[0.08] rounded-lg hover:bg-white/[0.09] hover:border-white/[0.15] cursor-pointer shadow-md transition-colors"
          >
            Arama Sorgusunu Sıfırla
          </motion.button>
        </motion.div>
      ) : (
        <div className="space-y-10">
          
          {/* Active Staff Personnel */}
          <div className="space-y-4">
            <h3 className="text-[11px] font-mono font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#32D74B]" />
              Aktif Yetkililer ({activeStaff.length})
            </h3>
            
            {activeStaff.length === 0 ? (
              <div className="compact-glass rounded-2xl border border-white/[0.04] p-12 text-center relative overflow-hidden bg-[#0c0c0e]/30">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-[#5E5CE6]/3 blur-[50px] rounded-full pointer-events-none" />
                <div className="w-12 h-12 rounded-2xl bg-white/[0.01] border border-white/10 flex items-center justify-center mx-auto mb-4 text-white/20">
                  <UserCheck size={18} className="opacity-70" />
                </div>
                <h4 className="text-[13px] font-bold text-white/90 tracking-tight">Aktif Yetkili Bulunmamaktadır</h4>
                <p className="text-[11px] text-[#8E8E93] max-w-xs mx-auto mt-2 leading-relaxed">
                  Şu anda aktif kadroda kayıtlı yetkili bulunmuyor. Yeni bir yetkili kaydı ekleyebilirsiniz.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-5">
                {activeStaff.map((staff) => (
                  <StaffCard key={staff.id} staff={staff} onClick={() => setSelectedStaff(staff)} />
                ))}
              </div>
            )}
          </div>

          {/* Retired/Old Staff Personnel */}
          <div className="space-y-4">
            <h3 className="text-[11px] font-mono font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-white/35" />
              Eski Yetkililer ({oldStaff.length})
            </h3>
            
            {oldStaff.length === 0 ? (
              <div className="compact-glass rounded-2xl border border-white/[0.03] p-12 text-center relative overflow-hidden bg-black/15">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.01] border border-white/[0.06] flex items-center justify-center mx-auto mb-4 text-white/15">
                  <Activity size={18} className="opacity-60" />
                </div>
                <h4 className="text-[13px] font-bold text-white/80 tracking-tight">Eski Yetkli Kaydı Yok</h4>
                <p className="text-[11px] text-[#8E8E93]/80 max-w-xs mx-auto mt-2 leading-relaxed">
                  Sunucu bünyesinde emekliye ayrılmış veya eski grupta listelenen bir yetkili kaydı bulunmuyor.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-5">
                {oldStaff.map((staff) => (
                  <StaffCard key={staff.id} staff={staff} onClick={() => setSelectedStaff(staff)} />
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Slid-in sliding side drawer of detailed staff information */}
      <AnimatePresence>
        {selectedStaff && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedStaff(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 cursor-pointer"
            />

            {/* Slider container */}
            <motion.div 
              initial={{ x: '100%', opacity: 0.9 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0.9 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.8 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:w-[500px] bg-[#0A0A0C]/95 backdrop-blur-3xl z-50 border-l border-white/[0.08] shadow-[20px_0_60px_-15px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden text-left"
            >
              {/* Header profile details */}
              <div className="p-6 border-b border-white/[0.05] flex items-center justify-between bg-black/20">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-lg bg-white/5 border border-white/5 text-[#5E5CE6]">
                    <Shield size={16} />
                  </span>
                  <div>
                    <h2 className="text-[15px] font-bold text-white tracking-tight">{selectedStaff.user}</h2>
                    <p className="text-[10px] text-[#A259FE] font-bold uppercase tracking-widest font-mono mt-0.5">Yetkili Detayları</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedStaff(null)}
                  className="w-8 h-8 rounded-full hover:bg-white/5 border border-transparent hover:border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Scrollable details view */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Visual profile header card */}
                {(() => {
                  return (
                    <div className="bg-[#141416]/70 border border-white/5 rounded-xl p-4 flex items-center gap-4 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[#5E5CE6]/3 rounded-full filter blur-xl pointer-events-none" />
                      <img src={selectedStaff.avatar} alt="staff avatar" className="w-14 h-14 rounded-lg border border-white/10 object-cover shadow-md" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold text-white truncate">{selectedStaff.user}</p>
                        <div className="mt-1">
                          <RoleBadge role={selectedStaff.role} staffName={selectedStaff.user} />
                        </div>
                        <div className="flex items-center gap-1.5 text-white/40 mt-1.5">
                          <span className="text-[11px] font-mono leading-none">{selectedStaff.id}</span>
                          <button 
                            onClick={() => handleCopy(selectedStaff.id)}
                            className="p-1 rounded text-white/30 hover:text-white hover:bg-white/5 transition-all outline-none"
                          >
                            <Copy size={11} className={copiedId === selectedStaff.id ? 'text-[#32D74B]' : ''} />
                          </button>
                        </div>
                      </div>
                      <span className={`status-badge ${selectedStaff.status === 'GÜVENİLİR' ? 'success' : selectedStaff.status === 'İZLEMEDE' ? 'warning' : selectedStaff.status === 'RİSKLİ' ? 'danger' : 'neutral'} self-start mt-1`}>
                        {selectedStaff.status}
                      </span>
                    </div>
                  );
                })()}

                {/* YETKİLİ YÖNETİMİ SECTION */}
                <div className="space-y-3">
                  <span className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-widest block">🛡️ YETKİLİ YÖNETİMİ</span>
                  
                  <div className="bg-[#141416]/50 border border-white/5 rounded-xl p-4 space-y-4">
                    {/* Görev Durumu */}
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-white/80">Görev Durumu</span>
                      
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF453A]/10 border border-[#FF453A]/20 text-[#FF453A] text-[11px] font-bold hover:bg-[#FF453A]/15 transition-all">
                        <UserCheck size={12} />
                        Yetki Al (Pasif)
                      </button>
                    </div>

                    {/* Promotion Demotion Row */}
                    <div className="grid grid-cols-2 gap-2">
                      <button className="py-2 px-3 bg-white/[0.02] border border-white/[0.05] rounded-lg text-[11px] text-white/80 hover:bg-white/[0.05] font-semibold transition-all flex items-center justify-center gap-1">
                        <ArrowDownLeft size={13} className="text-[#FF453A]" /> Rütbe Kıs
                      </button>
                      <button className="py-2 px-3 bg-white/[0.02] border border-white/[0.05] rounded-lg text-[11px] text-white/85 hover:bg-white/[0.05] font-semibold transition-all flex items-center justify-center gap-1">
                        <ArrowUpRight size={13} className="text-[#32D74B]" /> Terfi Ettir (Promote)
                      </button>
                    </div>

                    {/* Direct Role Setter selection list */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Doğrudan Rol Belirle</label>
                      <select 
                        defaultValue={selectedStaff.role}
                        className="w-full h-9 bg-[#111112] border border-white/10 rounded-lg px-3 text-[12px] text-white/90 outline-none appearance-none font-medium hover:border-white/20 transition-colors"
                      >
                        <option>DISCORD MODERATÖR</option>
                        <option>DISCORD DESTEK EKİBİ</option>
                        <option>KIDEMLİ DISCORD MODERATÖRÜ</option>
                        <option>DISCORD YÖNETİCİSİ</option>
                        <option>SENIOR MODERATÖR</option>
                        <option>YÖNETİCİ</option>
                        <option>ESKİ YETKİLİ</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* DETAIED METADATA STATISTICS ROW GRID */}
                <div className="space-y-2">
                  <span className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-widest block">📊 İSTATİSTİKLER</span>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#141416]/50 border border-white/5 rounded-xl p-3 flex flex-col justify-between h-20">
                      <span className="text-[10px] text-white/40 uppercase font-semibold">Toplam Ceza</span>
                      <span className="text-2xl font-extrabold text-white">{selectedStaff.total}</span>
                    </div>
                    <div className="bg-[#141416]/50 border border-white/5 rounded-xl p-3 flex flex-col justify-between h-20">
                      <span className="text-[10px] text-[#32D74B] uppercase font-semibold">Doğru</span>
                      <span className="text-2xl font-extrabold text-[#32D74B]">{selectedStaff.correct}</span>
                    </div>
                    <div className="bg-[#141416]/50 border border-white/5 rounded-xl p-3 flex flex-col justify-between h-20">
                      <span className="text-[10px] text-white/30 uppercase font-semibold">Hatalı</span>
                      <span className="text-2xl font-extrabold text-white/70">{selectedStaff.incorrect}</span>
                    </div>
                    <div className="bg-[#141416]/50 border border-white/5 rounded-xl p-3 flex flex-col justify-between h-20">
                      <span className="text-[10px] text-white/30 uppercase font-semibold font-mono">Doğruluk</span>
                      <span className="text-2xl font-extrabold text-[#32D74B] font-mono">%{selectedStaff.accuracy}</span>
                    </div>
                    <div className="bg-[#141416]/50 border border-white/5 rounded-xl p-3 flex flex-col justify-between h-20 col-span-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/40 uppercase font-semibold">CUK Skoru</span>
                        <span className="text-[10px] text-white/30 uppercase">Güvenilirlik</span>
                      </div>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className={`text-2xl font-black ${selectedStaff.cukScore && selectedStaff.cukScore < 0 ? 'text-[#FF453A]' : 'text-white'}`}>
                          {selectedStaff.cukScore ?? (selectedStaff.correct * 2 - selectedStaff.incorrect * 3)}
                        </span>
                        <span className={`text-[12px] font-bold uppercase tracking-wider ${
                          selectedStaff.status === 'GÜVENİLİR' ? 'text-[#32D74B]' : selectedStaff.status === 'İZLEMEDE' ? 'text-[#FF9F0A]' : 'text-[#FF453A]'
                        }`}>
                          {selectedStaff.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RECENT PENALTIES LOG BY THIS USER */}
                <div className="space-y-3">
                  <span className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-widest block">🧾 Son Cezalar</span>
                  
                  <div className="divide-y divide-white/[0.02] bg-[#141416]/40 border border-white/5 rounded-xl px-4 py-1.5">
                    {(() => {
                      const staffPenalties = penaltiesLog.filter(log => log.staff.toLowerCase().includes(selectedStaff.user.toLowerCase()));
                      if (staffPenalties.length === 0) {
                        return <div className="py-4 text-center text-[12px] text-white/30 font-medium">Bu yetkiliye ait kayıt bulunamadı.</div>;
                      }
                      return staffPenalties.slice(0, 4).map((log, index) => (
                        <div key={index} className="flex items-center justify-between py-3">
                          <button 
                            onClick={() => window.open(`https://dashboard.sapph.xyz/1223431616081166336/moderation/cases/${log.id.replace('#', '')}`, '_blank')}
                            className="flex items-center gap-2 hover:underline text-left cursor-pointer transition-all"
                          >
                            <span className="text-[12px] font-mono text-[#5E5CE6] font-bold">{log.id}</span>
                            <span className="text-[12px] text-white/60 truncate max-w-[220px]">{log.reason}</span>
                          </button>
                          <span className={`status-badge ${log.status === 'DOĞRU' ? 'success' : 'danger'} scale-90`}>
                            {log.status}
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {copiedId && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-2.5 text-center rounded-lg bg-[#32D74B]/10 border border-[#32D74B]/20 text-[#32D74B] text-[11px] font-semibold"
                  >
                    ID panoya başarıyla kopyalandı!
                  </motion.div>
                )}

              </div>

              {/* Bottom footer button rules */}
              <div className="p-6 border-t border-white/[0.05] bg-black/40 space-y-2 shrink-0">
                <button 
                  onClick={() => window.open(`https://dashboard.sapph.xyz/1223431616081166336/moderation/cases/`, '_blank')}
                  className="w-full py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center gap-2 text-[12px] text-white/90 font-semibold transition-all"
                >
                  <ExternalLink size={13} className="text-white/40" /> Yetkilinin Sapphire Profilini Aç
                </button>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add Staff Modal Form */}
      <AnimatePresence>
        {showAddModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm z-45 cursor-pointer"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.8 }}
              className="fixed inset-x-4 top-[10%] md:top-[12%] md:mx-auto max-w-sm bg-[#0E0E11]/95 border border-white/[0.08] backdrop-blur-3xl rounded-2xl shadow-[0_25px_50px_rgba(0,0,0,0.7)] z-50 overflow-hidden text-left"
            >
              <div className="p-5 border-b border-white/[0.05] bg-black/20 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-lg bg-white/5 border border-white/5 text-[#5E5CE6]">
                    <UserCheck size={16} />
                  </span>
                  <div>
                    <h3 className="text-[13.5px] font-bold text-white tracking-tight">Yeni Yetkili Ekle</h3>
                    <p className="text-[9.5px] text-[#8E8E93] leading-none mt-1">Sisteme yeni kadro kaydı ekle</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-white/5 border border-transparent hover:border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleAddStaff} className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Yetkili Kullanıcı Adı</label>
                  <input
                    type="text"
                    required
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="Örn: dadlukedi"
                    className="w-full h-9 bg-[#141416] border border-white/10 focus:border-[#5E5CE6]/30 rounded-lg px-3 text-[12px] text-white outline-none font-medium transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Discord Kullanıcı ID</label>
                  <input
                    type="text"
                    required
                    value={newUserId}
                    onChange={(e) => setNewUserId(e.target.value)}
                    placeholder="Örn: 90624355291726354"
                    className="w-full h-9 bg-[#141416] border border-white/10 focus:border-[#5E5CE6]/30 rounded-lg px-3 text-[12px] text-white outline-none font-medium transition-colors font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Yetki Rolü</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value)}
                    className="w-full h-9 bg-[#141416] border border-white/10 focus:border-[#5E5CE6]/30 rounded-lg px-2 text-[12px] text-white outline-none appearance-none"
                  >
                    <option>DISCORD MODERATÖR</option>
                    <option>DISCORD DESTEK EKİBİ</option>
                    <option>KIDEMLİ DISCORD MODERATÖRÜ</option>
                    <option>DISCORD YÖNETİCİSİ</option>
                    <option>SENIOR MODERATÖR</option>
                    <option>YÖNETİCİ</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Güvenilirlik Durumu</label>
                  <select
                    value={newUserStatus}
                    onChange={(e) => setNewUserStatus(e.target.value)}
                    className="w-full h-9 bg-[#141416] border border-white/10 focus:border-[#5E5CE6]/30 rounded-lg px-2 text-[12px] text-[#32D74B] font-bold outline-none"
                  >
                    <option value="GÜVENİLİR">GÜVENİLİR</option>
                    <option value="İZLEMEDE">İZLEMEDE</option>
                    <option value="RİSKLİ">RİSKLİ</option>
                  </select>
                </div>

                <div className="pt-3 border-t border-white/[0.04] flex items-center justify-end gap-2 text-[12px]">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3.5 py-1.5 border border-white/5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 font-semibold transition-colors"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#5E5CE6] border border-[#5E5CE6] hover:bg-[#4E4CD6] rounded-lg text-white font-bold transition-all shadow-md"
                  >
                    Kadroya Kaydet
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}

const StaffCard: React.FC<{ staff: any; onClick: () => void }> = ({ staff, onClick }) => {
  const statusColor = staff.status === 'GÜVENİLİR' ? 'success' : staff.status === 'İZLEMEDE' ? 'warning' : staff.status === 'RİSKLİ' ? 'danger' : 'neutral';
  
  return (
    <motion.div 
      whileHover={{ y: -3, scale: 1.015, transition: { duration: 0.15 } }}
      onClick={onClick}
      className="compact-glass rounded-2xl border border-white/[0.04] p-5 flex flex-col justify-between bg-black/30 backdrop-blur-2xl cursor-pointer relative overflow-hidden group shadow-lg"
    >
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#5E5CE6]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 animate-none">
          <img src={staff.avatar} alt={staff.user} className="w-11 h-11 rounded-lg border border-white/10 object-cover" />
          <div className="min-w-0">
            <h4 className="text-[13px] font-bold text-white truncate group-hover:text-[#5E5CE6] transition-colors">{staff.user}</h4>
            <p className="text-[10px] text-white/40 font-mono mt-0.5 truncate leading-none">ID: {staff.id}</p>
            <div className="mt-1.5">
              <RoleBadge role={staff.role} staffName={staff.user} />
            </div>
          </div>
        </div>
        
        <span className={`status-badge ${statusColor} scale-90`}>
          {staff.status}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1 bg-black/30 border border-white/5 rounded-lg py-1.5 px-2 text-center my-1.5">
        <div>
          <span className="text-[14px] font-black text-white">{staff.total}</span>
          <p className="text-[9px] font-medium text-white/30 uppercase tracking-wider">Toplam</p>
        </div>
        <div>
          <span className="text-[14px] font-black text-[#32D74B]">{staff.correct}</span>
          <p className="text-[9px] font-medium text-white/30 uppercase tracking-wider">Doğru</p>
        </div>
        <div>
          <span className="text-[14px] font-black text-[#FF453A]/80">{staff.incorrect}</span>
          <p className="text-[9px] font-medium text-white/30 uppercase tracking-wider">Hatalı</p>
        </div>
      </div>

      <div className="space-y-1.5 mt-2.5">
        <div className="flex items-center justify-between text-[11px] font-semibold text-white/50">
          <span>Doğruluk</span>
          <span className="text-[#32D74B] font-bold">%{staff.accuracy}</span>
        </div>
        
        <div className="w-full h-1 bg-white/[0.04] rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${staff.accuracy}%` }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className={`h-full ${
              staff.accuracy >= 90 ? 'bg-gradient-to-r from-emerald-500 to-[#32D74B]' :
              staff.accuracy >= 60 ? 'bg-gradient-to-r from-amber-500 to-[#FF9F0A]' :
              'bg-gradient-to-r from-red-500 to-[#FF453A]'
            }`}
          />
        </div>
      </div>

    </motion.div>
  );
}

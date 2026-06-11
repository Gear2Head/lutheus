'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, RefreshCw, X, CheckCircle2, ShieldAlert, Copy, 
  ExternalLink, MessageSquare, AlertCircle, Calendar, Info, 
  Check, User, ShieldCheck, Clock, Share2, CornerUpRight
} from 'lucide-react';
import Tooltip from '@/components/ui/Tooltip';
import { usePenalties } from '@/hooks/usePenalties';
import { validatePenaltyRecord, matchCukRule } from '@/utils/cukValidator';

export default function Penalties() {
  const [selectedCase, setSelectedCase] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('Tümü');
  const [penaltyTypeFilter, setPenaltyTypeFilter] = useState('Tümü');
  const [timeFilter, setTimeFilter] = useState('Tüm Zamanlar');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [repeatTabIdx, setRepeatTabIdx] = useState<number>(0);

  useEffect(() => {
    setRepeatTabIdx(0);
  }, [selectedCase]);

  const { penalties: penaltiesList, isLoading, refetch: handleRefresh, updateStatus } = usePenalties();

  const handleUpdateStatus = async (status: 'DOĞRU' | 'HATALI') => {
    if (!selectedCase) return;
    const success = await updateStatus(selectedCase.id, status);
    if (success) {
      setSelectedCase(prev => prev ? { ...prev, status } : null);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Live filter, search, status AND penalty type logic
  const filteredPenalties = penaltiesList.filter((log) => {
    // Search Case ID, staff name, or reason
    const matchesSearch = 
      log.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.staff.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.reason.toLowerCase().includes(searchQuery.toLowerCase());
      
    // Filter status (DOĞRU / HATALI)
    const matchesStatus = filterType === 'Tümü' || log.status === filterType;
    
    // Filter penalty type (MUTE / BAN / WARN)
    const matchesType = penaltyTypeFilter === 'Tümü' || log.icon === penaltyTypeFilter.toUpperCase();
    
    // Filter time duration (Bugün, Bu Hafta, Bu Ay, Tüm Zamanlar)
    let matchesTime = true;
    if (timeFilter !== 'Tüm Zamanlar') {
      const dateStr = (log.date || '').toLowerCase();
      if (timeFilter === 'Bugün') {
        matchesTime = dateStr.includes('sa önce') || dateStr.includes('dk önce') || dateStr.includes('bugün') || dateStr.includes('saniye') || dateStr === '—';
      } else if (timeFilter === 'Bu Hafta') {
        matchesTime = dateStr.includes('sa önce') || dateStr.includes('dk önce') || dateStr.includes('gün önce') || dateStr.includes('bu hafta') || dateStr === '—';
      } else if (timeFilter === 'Bu Ay') {
        matchesTime = !dateStr.includes('yıl') && !dateStr.includes('yıl önce');
      }
    }
    
    return matchesSearch && matchesStatus && matchesType && matchesTime;
  });

  return (
    <div className="p-6 md:p-8 w-full min-h-screen flex flex-col relative select-none">
      
      {/* Top Section Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-white/[0.04] pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5E5CE6]" />
            <span className="text-[11px] font-mono tracking-widest text-[#5E5CE6] font-semibold uppercase">Lutheus Ceza Raporlama</span>
          </div>
          <h2 className="text-[22px] font-bold text-white tracking-tight leading-none mt-2">Cezalar</h2>
          <p className="text-[12px] text-white/40 mt-1.5 font-medium flex items-center gap-1.5">
            <Info size={12} className="text-white/30" />
            Sapphire ile entegre gerçek zamanlı işlem paneli • <span className="font-semibold text-white/50">{penaltiesList.length} kayıt listelendi</span>
          </p>
        </div>
        
        {/* Top bar status indicator with removed "Senkronize" text */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.05] px-3.5 py-1.5 rounded-full backdrop-blur-md">
            <div className="w-1.5 h-1.5 rounded-full bg-[#32D74B]" />
            <span className="text-[10px] font-bold text-white/40 tracking-wider">AKTİF</span>
          </div>
        </div>
      </div>

      {/* Modern Control Board: Search & Filters matching screenshot */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Main search bar */}
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Case ID, yetkili veya sebep..." 
              className="clean-input w-full md:w-[250px] h-9 bg-[#111112] border border-white/10 rounded-lg pl-10 pr-4 text-[12px] transition-colors focus:bg-[#151517] focus:border-white/20 font-medium"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white p-1"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Period selector */}
          <div className="relative">
            <select 
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="h-9 bg-[#111112] border border-white/10 rounded-lg px-3.5 pr-8 text-[12px] text-white/80 outline-none appearance-none hover:border-white/20 transition-colors font-medium cursor-pointer"
            >
              <option value="Tüm Zamanlar">Tüm Zamanlar</option>
              <option value="Bu Hafta">Bu Hafta</option>
              <option value="Bugün">Bugün</option>
              <option value="Bu Ay">Bu Ay</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/40 text-[9px]">▼</div>
          </div>

          {/* Quick tab filters for validation status */}
          <div className="flex bg-[#111112] border border-white/10 rounded-lg p-1">
            {['Tümü', 'DOĞRU', 'HATALI'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3.5 py-1 rounded-md text-[12px] font-semibold transition-all duration-200 cursor-pointer ${
                  filterType === type 
                    ? 'bg-white/10 text-white shadow-sm' 
                    : 'text-white/40 hover:text-white/80'
                }`}
              >
                {type === 'DOĞRU' ? 'Doğru' : type === 'HATALI' ? 'Hatalı' : type}
              </button>
            ))}
            <button className="px-3.5 py-1 rounded-md text-white/20 hover:text-white/40 text-[12px] font-semibold cursor-not-allowed">
              Bekleyen
            </button>
          </div>

          {/* Quick tab filters for Penalty Type */}
          <div className="flex bg-[#111112] border border-white/10 rounded-lg p-1">
            {['Tümü', 'MUTE', 'BAN', 'WARN'].map((type) => (
              <button
                key={type}
                onClick={() => setPenaltyTypeFilter(type)}
                className={`px-3 py-1 rounded-md text-[12px] font-bold transition-all duration-200 cursor-pointer ${
                  penaltyTypeFilter === type 
                    ? 'bg-white/10 text-white shadow-sm' 
                    : 'text-white/40 hover:text-white/80'
                }`}
              >
                {type === 'Tümü' ? 'Her Tür' : type === 'MUTE' ? 'Mute' : type === 'BAN' ? 'Ban' : 'Warn'}
              </button>
            ))}
          </div>

        </div>

        {/* Refresh Actions */}
        <div className="flex items-center gap-2">
          {isLoading && (
            <span className="text-[11px] font-mono text-[#5E5CE6]">Veriler güncelleniyor...</span>
          )}
          <Tooltip content="Ceza Listesini Yenile">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleRefresh}
              className="w-9 h-9 rounded-full bg-[#111112] border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/5 transition-all shadow-lg"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin text-[#5E5CE6]' : ''} />
            </motion.button>
          </Tooltip>
        </div>
      </div>

      {/* Main Table and Layout Grid */}
      <div className="flex-1 min-w-0 compact-glass rounded-2xl border border-white/[0.04] overflow-hidden flex flex-col relative bg-black/10 backdrop-blur-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.05] bg-black/40">
                <th className="py-4 px-4 w-12 text-[10px] font-bold text-white/40 tracking-wider uppercase font-mono">
                  #
                </th>
                <th className="py-4 px-2 text-[10px] font-bold text-white/40 tracking-wider uppercase font-mono">ID</th>
                <th className="py-4 px-4 text-[11px] font-bold text-white/40 tracking-wider uppercase">Yetkili</th>
                <th className="py-4 px-4 text-[11px] font-bold text-white/40 tracking-wider uppercase">Sebep</th>
                <th className="py-4 px-4 text-[11px] font-bold text-white/40 tracking-wider uppercase text-center w-28">Süre</th>
                <th className="py-4 px-4 text-[11px] font-bold text-white/40 tracking-wider uppercase text-center w-28">Tarih</th>
                <th className="py-4 px-4 text-[11px] font-bold text-white/40 tracking-wider uppercase text-right w-28">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {isLoading ? (
                /* Shimmering gray skeleton feedback to prevent layouts shift */
                <TableSkeleton />
              ) : filteredPenalties.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 px-4 text-center relative overflow-hidden">
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center justify-center max-w-md mx-auto"
                    >
                      {/* Ambient glowing backdrop */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-[#5E5CE6]/5 blur-[60px] rounded-full pointer-events-none" />
                      
                      {/* Icon wrapper badge */}
                      <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-center mb-5 relative group shadow-2xl">
                        <div className="absolute inset-0 rounded-2xl bg-[#5E5CE6]/10 blur-md opacity-35 group-hover:opacity-75 transition-opacity" />
                        <span className="text-white/30 group-hover:text-white/50 transition-colors">
                          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                          </svg>
                        </span>
                      </div>
                      
                      <h3 className="text-[14.5px] font-bold text-white/90 tracking-tight">Kayıt Bulunamadı</h3>
                      <p className="text-[12px] text-[#8E8E93] mt-2 mb-6 leading-relaxed max-w-xs font-medium">
                        Aradığınız kriterlere uygun işlem geçmişi veya ceza kaydı bulunmamaktadır. Lütfen filtrelerinizi sıfırlayın.
                      </p>
                      
                      <motion.button 
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => { setSearchQuery(''); setFilterType('Tümü'); setPenaltyTypeFilter('Tümü'); }}
                        className="px-4 py-2.5 text-[11.5px] font-bold text-white bg-white/[0.05] border border-white/[0.08] rounded-lg hover:bg-white/[0.08] hover:border-white/[0.15] cursor-pointer shadow-md transition-colors"
                      >
                        Aramayı ve Filtreleri Sıfırla
                      </motion.button>
                    </motion.div>
                  </td>
                </tr>
              ) : (
                /* Animate list items smoothly */
                <AnimatePresence mode="popLayout">
                  {filteredPenalties.map((log, index) => {
                    const isSelected = selectedCase?.id === log.id;
                    return (
                      <motion.tr 
                        key={log.id + index}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25, delay: index * 0.03, ease: 'easeOut' }}
                        whileHover={{ 
                          scale: 1.002, 
                          backgroundColor: 'rgba(255, 255, 255, 0.03)',
                          transition: { duration: 0.1 }
                        }}
                        onClick={() => setSelectedCase(log)}
                        className={`transition-colors cursor-pointer relative group ${
                          isSelected ? 'bg-white/[0.04]' : ''
                        } ${
                          log.status === 'HATALI' ? 'bg-[#FF453A]/[0.01] hover:bg-[#FF453A]/[0.03]' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4 w-12 text-[12px] font-mono text-white/40 font-bold">
                          {index + 1}
                        </td>
                        
                        {/* Case ID and Link */}
                        <td className="py-3.5 px-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-mono font-semibold text-[#5E5CE6] flex items-center gap-1.5 group-hover:text-[#A259FE] transition-colors">
                              <span className="opacity-40">#</span>{log.id.replace('#', '')}
                            </span>
                            <Tooltip content="Sapphire Panelinde Göster">
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  window.open(`https://dashboard.sapph.xyz/1223431616081166336/moderation/cases/${log.id.replace('#', '')}`, '_blank'); 
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-all cursor-pointer"
                              >
                                <ExternalLink size={11} />
                              </button>
                            </Tooltip>
                          </div>
                        </td>

                        {/* Staff */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="relative">
                              <img src={log.avatar} alt="avatar" className="w-6 h-6 rounded-md object-cover border border-white/10" />
                              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#111112] flex items-center justify-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#32D74B]" />
                              </div>
                            </div>
                            <span className="text-[13px] font-medium text-white/90 group-hover:text-white transition-colors">
                              {log.staff}
                            </span>
                          </div>
                        </td>

                        {/* Reason */}
                        <td className="py-3.5 px-4 text-[13px] text-white/70 max-w-[340px] truncate">
                          {log.reason}
                        </td>

                        {/* Duration */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex w-[92px] items-center justify-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.02] border border-white/[0.05]">
                            {log.isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#32D74B] animate-pulse" />}
                            <span className={`text-[12px] font-medium font-mono ${log.duration === 'Kalıcı' ? 'text-[#FF453A]' : 'text-white/60'}`}>
                              {log.duration}
                            </span>
                          </div>
                        </td>

                        {/* Date */}
                        <td className="py-3.5 px-4 text-center text-[12px] text-white/50 font-medium">
                          {log.date}
                        </td>

                        {/* Status badge */}
                        <td className="py-3.5 px-4 text-right">
                          <span className={`status-badge ${log.status === 'DOĞRU' ? 'success' : 'danger'}`}>
                            {log.status}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Compact Footer */}
        <div className="h-11 mt-auto border-t border-white/[0.05] flex items-center justify-between px-5 bg-black/20 text-[#8E8E93]">
          <span className="text-[11px] font-mono">
            Toplam <span className="text-white font-semibold">{filteredPenalties.length}</span> kayıttan 1-{filteredPenalties.length} arası gösteriliyor
          </span>
          <div className="flex gap-1.5">
            <button className="px-2.5 py-1 rounded text-[11px] text-white/30 cursor-not-allowed font-medium">Önceki</button>
            <div className="w-[1px] h-3 bg-white/10 self-center"></div>
            <button className="px-2.5 py-1 rounded text-[11px] text-white/40 hover:text-white transition-colors font-medium">Sonraki</button>
          </div>
        </div>
      </div>

      {/* Side-Drawer Component replacing popup modal */}
      <AnimatePresence>
        {selectedCase && (
          <>
            {/* Drawer Backdrop Overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCase(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 transition-all cursor-pointer"
            />
            
            {/* Slide-in glassmorphic drawer from right side of viewport */}
            <motion.div 
              initial={{ x: '100%', opacity: 0.9 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0.9 }}
              transition={{ type: 'spring', stiffness: 380, damping: 34, mass: 0.9 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:w-[500px] bg-[#0A0A0C]/90 backdrop-blur-3xl z-50 border-l border-white/[0.08] shadow-[20px_0_60px_-15px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden"
            >
              {/* Header Details */}
              <div className="p-6 border-b border-white/[0.05] flex items-center justify-between bg-black/20">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-white/5 border border-white/5 text-[#5E5CE6]">
                    <MessageSquare size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => window.open(`https://dashboard.sapph.xyz/1223431616081166336/moderation/cases/${selectedCase.id.replace('#', '')}`, '_blank')}
                        className="text-[13px] font-mono font-bold text-[#5E5CE6] hover:text-[#A259FE] hover:underline cursor-pointer flex items-center gap-1"
                        title="Sapphire Panelinde Göster"
                      >
                        {selectedCase.id}
                        <ExternalLink size={10} className="opacity-60" />
                      </button>
                      <span className={`status-badge ${selectedCase.status === 'DOĞRU' ? 'success' : 'danger'} scale-90`}>
                        {selectedCase.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/40 mt-0.5 tracking-wider font-mono">MUTE • DETAYLAR</p>
                  </div>
                </div>
                
                <button 
                  onClick={() => setSelectedCase(null)} 
                  className="w-8 h-8 rounded-full hover:bg-white/5 border border-transparent hover:border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Scrollable details container */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Users list info */}
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block">Kullanıcı İlişkileri</span>
                  
                  {/* Target User Info card */}
                  <div className="bg-[#141416]/60 border border-white/5 rounded-xl p-3 flex flex-col gap-2 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#5E5CE6]/3 rounded-full filter blur-xl pointer-events-none" />
                    <span className="text-[9px] font-bold text-white/30 uppercase tracking-wider block">Cezalı Kullanıcı</span>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#3A38B8] to-[#5E5CE6] flex items-center justify-center text-white font-bold text-sm shadow-inner">
                          U
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-white">Unknown User (906243551988)</p>
                          <div className="flex items-center gap-1 text-white/40 mt-0.5">
                            <span className="text-[11px] font-mono">906243551988432907</span>
                            <button 
                              onClick={() => handleCopy('906243551988432907')}
                              className="p-1 rounded text-white/30 hover:text-white hover:bg-white/5 transition-all outline-none"
                            >
                              <Copy size={11} className={copiedId === '906243551988432907' ? 'text-[#32D74B]' : ''} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Staff Info card */}
                  <div className="bg-[#141416]/60 border border-white/5 rounded-xl p-3 flex flex-col gap-2 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#A259FE]/3 rounded-full filter blur-xl pointer-events-none" />
                    <span className="text-[9px] font-bold text-white/30 uppercase tracking-wider block">Cezalandıran Yetkili</span>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <img src={selectedCase.avatar} alt="staff" className="w-10 h-10 rounded-lg border border-white/10 object-cover" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] font-bold text-white">{selectedCase.staff}</p>
                            <span className="text-[9px] font-extrabold text-white/50 bg-white/5 border border-white/5 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Yetkili
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-white/40 mt-0.5">
                            <span className="text-[11px] font-mono">1133786504427288834</span>
                            <button 
                              onClick={() => handleCopy('1133786504427288834')}
                              className="p-1 rounded text-white/30 hover:text-white hover:bg-white/5 transition-all outline-none"
                            >
                              <Copy size={11} className={copiedId === '1133786504427288834' ? 'text-[#32D74B]' : ''} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Duration Limitations list matching mockup */}
                {(() => {
                  const ruleMatch = matchCukRule(selectedCase.reason);
                  const vResult = validatePenaltyRecord(selectedCase.reason, selectedCase.duration, repeatTabIdx);
                  const currentExpected = vResult.expectedDuration;
                  
                  return (
                    <div className="bg-[#141416]/60 border border-white/5 rounded-xl p-4 space-y-4">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest block mb-1">CUK Otomatik Doğrulama</span>
                          <span className="text-[9px] font-mono text-white/20">Tekrar sayısına göre süre sınırları</span>
                        </div>
                        <p className="text-[12.5px] font-bold text-white truncate">
                          {ruleMatch ? ruleMatch.rule.subCategory : selectedCase.reason}
                        </p>
                      </div>

                      {/* Repetition Selector Chips */}
                      {ruleMatch && (
                        <div>
                          <span className="text-[10px] text-white/40 block mb-2 font-semibold">Cezalı Tekrar Geçmişi:</span>
                          <div className="flex bg-[#111112] border border-white/5 rounded-lg p-1 gap-1">
                            {ruleMatch.rule.durations.map((dur, idx) => (
                              <button
                                key={idx}
                                onClick={() => setRepeatTabIdx(idx)}
                                className={`flex-1 py-1 rounded-md text-[10.5px] font-bold transition-all text-center cursor-pointer ${
                                  repeatTabIdx === idx
                                    ? 'bg-[#5E5CE6] text-white shadow-md'
                                    : 'text-white/40 hover:text-white/80 hover:bg-white/5'
                                }`}
                              >
                                {idx + 1}x ({dur.split(' ')[0] === 'Sınırsız' ? 'perma' : dur})
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2.5">
                          <span className="text-[11px] text-[#8E8E93] block font-medium">Uygulanan Süre</span>
                          <span className={`text-[13px] font-bold mt-1 block ${vResult.isValid ? 'text-[#32D74B]' : 'text-[#FF453A]'}`}>
                            {selectedCase.duration}
                          </span>
                        </div>
                        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2.5">
                          <span className="text-[11px] text-[#8E8E93] block font-medium">CUK Gerekliliği</span>
                          <span className="text-[13px] font-bold text-white mt-1 block font-mono">
                            {currentExpected}
                          </span>
                        </div>
                      </div>

                      <div className="border-t border-white/[0.04] pt-3 flex items-center justify-between">
                        <div>
                          <span className="text-[9px] font-extrabold text-[#8E8E93] uppercase tracking-widest block mb-0.5">Yaptırım Analizi</span>
                          <div className="flex items-center gap-1.5 mt-1">
                            {vResult.isValid ? (
                              <div className="flex items-center gap-1 text-[#32D74B]">
                                <CheckCircle2 size={12} />
                                <span className="text-[11px] font-semibold">Yaptırım ve süre CUK kurallarıyla tam olarak uyumlu.</span>
                              </div>
                            ) : (
                              <div className="flex items-start gap-1 text-[#FF453A]">
                                <AlertCircle size={12} className="mt-0.5 shrink-0" />
                                <span className="text-[11px] font-semibold leading-tight">
                                  Hatalı süre tespiti! Tam olarak <span className="underline font-bold">{currentExpected}</span> olmalıydı.
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          vResult.isValid 
                            ? 'bg-[#32D74B]/10 border border-[#32D74B]/20 text-[#32D74B]' 
                            : 'bg-[#FF453A]/10 border border-[#FF453A]/20 text-[#FF453A]'
                        }`}>
                          {vResult.isValid ? 'Geçerli' : 'Hatalı'}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Detail Data grid rows layout */}
                {(() => {
                  const ruleMatch = matchCukRule(selectedCase.reason);
                  const vResult = validatePenaltyRecord(selectedCase.reason, selectedCase.duration, repeatTabIdx);
                  return (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-2.5">Ek Bilgiler</span>
                      <div className="divide-y divide-white/[0.03] bg-[#141416]/40 border border-white/5 rounded-xl px-4 py-2">
                        <DetailMetadataRow label="Sebep" value={selectedCase.reason} />
                        <DetailMetadataRow label="Süre" value={selectedCase.duration} isHighlight />
                         <DetailMetadataRow label="Tarih" value={selectedCase.date || "08.06.2026"} />
                        <DetailMetadataRow label="CUK Kategori" value={ruleMatch ? ruleMatch.rule.subCategory || "—" : "Genel İhlal"} />
                        <DetailMetadataRow 
                          label="CUK Mesajı" 
                          value={vResult.isValid ? "Süre ve tür kurallarla tam uyumlu." : `Yetersiz/Hatalı süre tespiti! (${vResult.expectedDuration} olmalıdır)`} 
                          isSuccess={vResult.isValid}
                          isHighlight={!vResult.isValid}
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* Copy success bubble toast status */}
                {copiedId && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-2 text-center rounded-lg bg-[#32D74B]/10 border border-[#32D74B]/20 text-[#32D74B] text-[11px] font-semibold flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={12} /> ID panoya başarıyla kopyalandı!
                  </motion.div>
                )}

              </div>

              {/* Bottom Action buttons */}
              <div className="p-6 border-t border-white/[0.05] bg-black/40 space-y-2 shrink-0">
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => handleUpdateStatus('DOĞRU')}
                    className={`py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                      selectedCase.status === 'DOĞRU' 
                        ? 'bg-[#32D74B] text-black border border-[#32D74B]' 
                        : 'bg-[#32D74B]/10 border border-[#32D74B]/20 text-[#32D74B] hover:bg-[#32D74B]/15'
                    }`}
                  >
                    <CheckCircle2 size={13} /> Doğru
                  </button>
                  <button 
                    onClick={() => handleUpdateStatus('HATALI')}
                    className={`py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                      selectedCase.status === 'HATALI' 
                        ? 'bg-[#FF453A] text-white border border-[#FF453A]' 
                        : 'bg-[#FF453A]/10 border border-[#FF453A]/20 text-[#FF453A] hover:bg-[#FF453A]/15'
                    }`}
                  >
                    <AlertCircle size={13} /> Hatalı
                  </button>
                </div>
                
                <button 
                  onClick={() => window.open(`https://dashboard.sapph.xyz/1223431616081166336/moderation/cases/${selectedCase.id.replace('#', '')}`, '_blank')}
                  className="w-full py-2.5 rounded-xl bg-[#5E5CE6]/10 hover:bg-[#5E5CE6]/20 border border-[#5E5CE6]/20 flex items-center justify-center gap-2 text-[12px] text-white/95 font-bold transition-all"
                >
                  <ExternalLink size={13} className="text-white/40" /> Case Dashboard'da Aç (Sapphire)
                </button>
                <button 
                  className="w-full py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center gap-2 text-[12px] text-white/90 font-semibold transition-all"
                >
                  <Share2 size={13} className="text-white/40" /> Lutheus Raporu Paylaş
                </button>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}

// Subcomponents for Table loadings
function TableSkeleton() {
  return (
    <>
      {[...Array(6)].map((_, i) => (
        <tr key={i} className="border-b border-white/[0.02]">
          <td className="py-4 px-4 w-10">
            <div className="w-3.5 h-3.5 rounded bg-white/[0.04] animate-pulse"></div>
          </td>
          <td className="py-4 px-2">
            <div className="h-4 w-16 bg-white/[0.05] rounded-md animate-pulse"></div>
          </td>
          <td className="py-4 px-4">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded bg-white/[0.05] animate-pulse"></div>
              <div className="h-4 w-28 bg-white/[0.05] rounded-md animate-pulse"></div>
            </div>
          </td>
          <td className="py-4 px-4">
            <div className="h-4 w-52 bg-white/[0.05] rounded-md animate-pulse"></div>
          </td>
          <td className="py-4 px-4 text-center">
            <div className="inline-block h-5 w-14 bg-white/[0.05] rounded-md animate-pulse"></div>
          </td>
          <td className="py-4 px-4 text-center">
            <div className="inline-block h-4 w-16 bg-white/[0.05] rounded-md animate-pulse"></div>
          </td>
          <td className="py-4 px-4 text-right">
            <div className="inline-block h-5 w-14 bg-white/[0.04] rounded-md animate-pulse"></div>
          </td>
        </tr>
      ))}
    </>
  );
}

// Subcomponent for Drawer Metadata row
function DetailMetadataRow({ label, value, isHighlight, isSuccess }: { label: string, value: string, isHighlight?: boolean, isSuccess?: boolean }) {
  return (
    <div className="flex justify-between items-center py-3">
      <span className="text-[12px] text-white/40 font-medium">{label}</span>
      <span className={`text-[12px] font-mono font-medium ${
        isHighlight ? 'text-[#32D74B] font-bold' : isSuccess ? 'text-[#32D74B]' : 'text-white/80'
      }`}>
        {value}
      </span>
    </div>
  );
}

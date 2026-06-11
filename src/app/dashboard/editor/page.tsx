'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, Search, Plus, Save, RotateCcw, Edit, X, Trash2, CheckCircle2,
  AlertTriangle, Shield, Settings2, FileText, HelpCircle
} from 'lucide-react';
import Tooltip from '@/components/ui/Tooltip';

interface Rule {
  id: string; // e.g. CUK-01
  category: string;
  subCategory: string;
  minPenalty: string;
  maxPenalty: string;
  points: number;
  description: string;
  keywords: string[];
}

const DEFAULT_RULES: Rule[] = [
  {
    id: "CUK-01",
    category: "Reklam / Tanıtım",
    subCategory: "Davet Linki Paylaşma",
    minPenalty: "Kalıcı Engel (Ban)",
    maxPenalty: "Süresiz Ban",
    points: 15,
    description: "Sunucu üyelerine veya kanallara doğrudan veya dolaylı olarak başka sunucu davet linki gönderilmesi.",
    keywords: ["discord.gg", "davet", "sunucu", "gelin", "sunucuma"]
  },
  {
    id: "CUK-02",
    category: "Küfür / Hakaret",
    subCategory: "Şahsi ve Ağır Hakaretler",
    minPenalty: "6 saat Mute",
    maxPenalty: "24 saat Mute",
    points: 10,
    description: "Kullanıcılara veya şahıslara yönelik ailevi, dini, ırki veya ağır şahsi argo, küfür ve hakaretlerin sarf edilmesi.",
    keywords: ["oç", "piç", "şerefsiz", "amk", "salak"]
  },
  {
    id: "CUK-03",
    category: "Dini / Milli Değerlere Saygısızlık",
    subCategory: "Değerlere Küfür / Saygısızlık",
    minPenalty: "Kalıcı Engel (Ban)",
    maxPenalty: "Süresiz Ban",
    points: 20,
    description: "Dini, milli ya da kutsal kabul edilen bütün insani değerlere, inançlara hakaret, küfür veya provokasyon girişimi.",
    keywords: ["din", "allah", "atatürk", "bayrak", "milli", "kuran"]
  },
  {
    id: "CUK-04",
    category: "Spam / Flood",
    subCategory: "Hızlı Mesaj Gönderme / Spam",
    minPenalty: "30 dakika Mute",
    maxPenalty: "3 saat Mute",
    points: 3,
    description: "Sohbet akışını bozacak şekilde ardı ardına hızlıca anlamsız metin ya da görsel gönderilmesi.",
    keywords: ["spam", "flood", "asdasd", "uyarı", "harf"]
  },
  {
    id: "CUK-05",
    category: "Kışkırtma / Provokasyon",
    subCategory: "Kargaşa Çıkarma",
    minPenalty: "2 saat Mute",
    maxPenalty: "12 saat Mute",
    points: 7,
    description: "Sorgu kanallarını sabote etme, üyeleri manipüle ederek sunucu düzenini karıştırma, kavga başlatma.",
    keywords: ["kavga", "olay", "kargaşa", "yönetim", "haksızlık"]
  }
];

export default function Editor() {
  const [rules, setRules] = useState<Rule[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lutheus-cuk-rules');
      setRules(saved ? JSON.parse(saved) : DEFAULT_RULES);
    }
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tümü');
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRule, setNewRule] = useState<Partial<Rule>>({
    id: '',
    category: 'Spam / Flood',
    subCategory: '',
    minPenalty: '',
    maxPenalty: '',
    points: 5,
    description: '',
    keywords: []
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const saveRules = (updatedRules: Rule[]) => {
    setRules(updatedRules);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lutheus-cuk-rules', JSON.stringify(updatedRules));
    }
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const categories = ['Tümü', ...Array.from(new Set(rules.map(r => r.category)))];

  const filteredRules = rules.filter(r => {
    const matchesSearch = 
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.subCategory.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'Tümü' || r.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Handle Edit Save
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;

    const updated = rules.map(r => r.id === editingRule.id ? editingRule : r);
    saveRules(updated);
    setEditingRule(null);
    triggerToast("Kural başarıyla güncellendi.");
  };

  // Handle Add Rule
  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.id || !newRule.subCategory) {
      triggerToast("Yetersiz kural tanımlaması!");
      return;
    }

    if (rules.some(r => r.id.toLowerCase() === newRule.id?.toLowerCase())) {
      triggerToast("Bu Kural ID zaten mevcut!");
      return;
    }

    const created: Rule = {
      id: newRule.id.toUpperCase(),
      category: newRule.category || 'Spam / Flood',
      subCategory: newRule.subCategory,
      minPenalty: newRule.minPenalty || '30 dk Mute',
      maxPenalty: newRule.maxPenalty || '24 saat Mute',
      points: Number(newRule.points) || 5,
      description: newRule.description || '',
      keywords: newRule.keywords || []
    };

    const updated = [...rules, created];
    saveRules(updated);
    setShowAddModal(false);
    setNewRule({
      id: '',
      category: 'Spam / Flood',
      subCategory: '',
      minPenalty: '',
      maxPenalty: '',
      points: 5,
      description: '',
      keywords: []
    });
    triggerToast("Yeni kural başarıyla eklendi.");
  };

  // Handle Delete Rule
  const handleDeleteRule = (id: string) => {
    if (confirm("Bu kuralı silmek istediğinizden emin misiniz? Silme işlemi geri alınamaz.")) {
      const updated = rules.filter(r => r.id !== id);
      saveRules(updated);
      triggerToast("Kural veritabanından silindi.");
    }
  };

  // Reset to default dataset
  const handleResetDefaults = () => {
    if (confirm("Tüm kural değişikliklerini sıfırlayıp fabrika ayarlarına dönmek istiyor musunuz?")) {
      saveRules(DEFAULT_RULES);
      triggerToast("Kurallar varsayılana sıfırlandı.");
    }
  };

  return (
    <div className="p-6 md:p-8 w-full max-w-7xl mx-auto space-y-8 select-none">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/[0.04] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5E5CE6]" />
            <span className="text-[10px] font-mono tracking-widest text-[#5E5CE6] uppercase font-bold">Veri & Kural Yönetimi</span>
          </div>
          <h2 className="text-[22px] font-bold text-white tracking-tight mt-1">CUK Editör Paneli</h2>
          <p className="text-[13px] text-[#8E8E93] mt-1 font-medium">Ceza Uygulama Kurallarını arayabilir, silebilir veya yeni dinamik kurallar ekleyebilirsiniz.</p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleResetDefaults}
            className="px-4 py-2 text-[11.5px] font-bold text-white bg-white/[0.02] border border-white/[0.08] hover:bg-white/[0.05] rounded-lg cursor-pointer transition-colors flex items-center gap-1.5"
          >
            <RotateCcw size={12} className="text-white/40" /> Varsayılana Dön
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 text-[11.5px] font-bold text-white bg-[#5E5CE6] hover:bg-[#4E4CD6] rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 shadow-md"
          >
            <Plus size={12} /> Yeni Kural Ekle
          </button>
        </div>
      </div>

      {/* Filter and search controls */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:w-80 relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="CUK Kodu veya detay ara..."
            className="clean-input w-full h-9 bg-[#111112] border border-white/10 rounded-lg pl-10 pr-4 text-[12px] transition-all focus:bg-[#151517] focus:border-white/20 font-medium"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          {categories.map((cat, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all shrink-0 cursor-pointer border ${
                selectedCategory === cat 
                  ? 'bg-white/10 border-white/15 text-white' 
                  : 'bg-transparent border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Rules list layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredRules.map((rule, index) => (
          <motion.div 
            key={rule.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.04 }}
            className="compact-glass rounded-2xl border border-white/[0.04] p-5 flex flex-col justify-between bg-[#101012]/35 backdrop-blur-2xl relative overflow-hidden shadow-lg group hover:border-white/[0.08]"
          >
            {/* Visual accent top */}
            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#5E5CE6]/20 to-transparent" />
            
            <div>
              <div className="flex items-center justify-between gap-2.5 mb-3">
                <span className="font-mono text-[11.5px] font-black text-white bg-white/5 border border-white/[0.08] px-2.5 py-0.5 rounded-md text-center">
                  {rule.id}
                </span>
                
                <span className="text-[10px] uppercase font-mono font-extrabold text-[#5E5CE6]">
                  {rule.category}
                </span>
              </div>

              <h4 className="text-[13.5px] font-bold text-white tracking-tight line-clamp-1">{rule.subCategory}</h4>
              <p className="text-[12px] text-white/50 mt-2 leading-relaxed min-h-[48px] line-clamp-3">{rule.description}</p>
              
              {/* Penalty detail card limits */}
              <div className="bg-black/25 border border-white/5 rounded-lg p-3 space-y-1.5 mt-4 text-[11px] font-medium text-white/70">
                <div className="flex justify-between">
                  <span className="text-white/40">Minimum Limit</span>
                  <span className="text-white/90 font-semibold">{rule.minPenalty}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Maksimum Limit</span>
                  <span className="text-white/90 font-semibold">{rule.maxPenalty}</span>
                </div>
                <div className="flex justify-between border-t border-white/[0.04] pt-1.5 mt-0.5">
                  <span className="text-[#A259FE] font-bold">CUK Puan Yükü</span>
                  <span className="text-[#A259FE] font-black">{rule.points} CUK</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-white/[0.03]">
              <button 
                onClick={() => setEditingRule(rule)}
                className="w-8 h-8 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.06] flex items-center justify-center text-white/50 hover:text-white cursor-pointer transition-colors"
                title="Kuralı Düzenle"
              >
                <Edit size={12} />
              </button>
              <button 
                onClick={() => handleDeleteRule(rule.id)}
                className="w-8 h-8 rounded-lg bg-[#FF453A]/5 border border-[#FF453A]/10 hover:bg-[#FF453A]/15 flex items-center justify-center text-[#FF453A]/60 hover:text-[#FF453A] cursor-pointer transition-colors"
                title="Kuralı Sil"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Edit Rule overlay Modal */}
      <AnimatePresence>
        {editingRule && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingRule(null)}
              className="fixed inset-0 bg-black/70 backdrop-blur-xs z-45 cursor-pointer"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="fixed inset-x-4 top-[15%] md:mx-auto max-w-sm bg-[#0E0E11]/95 border border-white/[0.08] backdrop-blur-3xl rounded-2xl shadow-[0_25px_50px_rgba(0,0,0,0.7)] z-50 overflow-hidden text-left"
            >
              <div className="p-5 border-b border-white/[0.05] bg-black/20 flex items-center justify-between">
                <h3 className="text-[13.5px] font-bold text-white tracking-tight">Kural Düzenle ({editingRule.id})</h3>
                <button onClick={() => setEditingRule(null)} className="text-white/40 hover:text-white cursor-pointer"><X size={15} /></button>
              </div>

              <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Kural Alt Başlığı</label>
                  <input 
                    type="text" 
                    value={editingRule.subCategory}
                    required
                    onChange={(e) => setEditingRule({ ...editingRule, subCategory: e.target.value })}
                    className="w-full h-9 bg-[#141416] border border-white/10 focus:border-[#5E5CE6]/30 rounded-lg px-3 text-[12px] text-white outline-none font-medium transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold">CUK Ceza Puanı</label>
                  <input 
                    type="number" 
                    value={editingRule.points}
                    required
                    onChange={(e) => setEditingRule({ ...editingRule, points: Number(e.target.value) })}
                    className="w-full h-9 bg-[#141416] border border-white/10 focus:border-[#5E5CE6]/30 rounded-lg px-3 text-[12px] text-white outline-none font-medium transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Tetikleyici Açıklama</label>
                  <textarea 
                    value={editingRule.description}
                    onChange={(e) => setEditingRule({ ...editingRule, description: e.target.value })}
                    className="w-full h-20 bg-[#141416] border border-white/10 focus:border-[#5E5CE6]/30 rounded-lg p-3 text-[11px] text-white outline-none font-medium transition-colors resize-none"
                  />
                </div>

                <div className="pt-3 border-t border-white/[0.04] flex items-center justify-end gap-2 text-[12.5px]">
                  <button type="button" onClick={() => setEditingRule(null)} className="px-3 py-1.5 border border-white/5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 font-semibold">İptal</button>
                  <button type="submit" className="px-4 py-1.5 bg-[#5E5CE6] hover:bg-[#4E4CD6] rounded-lg text-white font-bold transition-all shadow-md">Kaydet</button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add New Rule Modal */}
      <AnimatePresence>
        {showAddModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-xs z-45 cursor-pointer"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="fixed inset-x-4 top-[10%] md:mx-auto max-w-sm bg-[#0E0E11]/95 border border-white/[0.08] backdrop-blur-3xl rounded-2xl shadow-[0_25px_50px_rgba(0,0,0,0.7)] z-50 overflow-hidden text-left"
            >
              <div className="p-5 border-b border-white/[0.05] bg-black/20 flex items-center justify-between">
                <h3 className="text-[13.5px] font-bold text-white tracking-tight">Yeni CUK Kuralı Tanımla</h3>
                <button onClick={() => setShowAddModal(false)} className="text-white/40 hover:text-white cursor-pointer"><X size={15} /></button>
              </div>

              <form onSubmit={handleAddRule} className="p-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Kural Kodu (ID)</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Örn: CUK-06"
                    value={newRule.id}
                    onChange={(e) => setNewRule({ ...newRule, id: e.target.value })}
                    className="w-full h-9 bg-[#141416] border border-white/10 focus:border-[#5E5CE6]/30 rounded-lg px-3 text-[12px] text-white outline-none font-medium transition-colors font-mono uppercase"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold">CUK Kategori Grubu</label>
                  <select 
                    value={newRule.category}
                    onChange={(e) => setNewRule({ ...newRule, category: e.target.value })}
                    className="w-full h-9 bg-[#141416] border border-white/10 rounded-lg px-2 text-[12px] text-white"
                  >
                    <option>Spam / Flood</option>
                    <option>Küfür / Hakaret</option>
                    <option>Reklam / Tanıtım</option>
                    <option>Kışkırtma / Provokasyon</option>
                    <option>Dini / Milli Değerlere Saygısızlık</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Kural Alt Başlığı</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Örn: Spam ve Tekrarlı Yazışma"
                    value={newRule.subCategory}
                    onChange={(e) => setNewRule({ ...newRule, subCategory: e.target.value })}
                    className="w-full h-9 bg-[#141416] border border-white/10 focus:border-[#5E5CE6]/30 rounded-lg px-3 text-[12px] text-white outline-none font-medium transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Puan Yükü</label>
                  <input 
                    type="number" 
                    required
                    value={newRule.points}
                    onChange={(e) => setNewRule({ ...newRule, points: Number(e.target.value) })}
                    className="w-full h-9 bg-[#141416] border border-white/10 focus:border-[#5E5CE6]/30 rounded-lg px-3 text-[12px] text-white outline-none font-medium transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Açıklama / Tanım</label>
                  <textarea 
                    placeholder="Kural tetiklenme koşulunu tanımlayın..."
                    value={newRule.description}
                    onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                    className="w-full h-16 bg-[#141416] border border-white/10 focus:border-[#5E5CE6]/30 rounded-lg p-3 text-[11px] text-white outline-none font-medium transition-colors resize-none"
                  />
                </div>

                <div className="pt-3 border-t border-white/[0.04] flex items-center justify-end gap-2 text-[12.5px]">
                  <button type="button" onClick={() => setShowAddModal(false)} className="px-3 py-1.5 border border-white/5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 font-semibold">Vazgeç</button>
                  <button type="submit" className="px-4 py-1.5 bg-[#5E5CE6] hover:bg-[#4E4CD6] rounded-lg text-white font-bold transition-all shadow-md">Kaydet</button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Custom float toast alerts */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-55 px-4 py-3 rounded-xl bg-black/90 border border-white/10 text-white text-[12px] font-bold shadow-2xl flex items-center gap-2"
          >
            <CheckCircle2 className="text-[#32D74B] w-4 h-4" /> {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Award, CheckCircle2, AlertCircle, RefreshCw, 
  ChevronRight, Sparkles, BookOpen, Clock, Play, Dumbbell
} from 'lucide-react';
import Tooltip from '@/components/ui/Tooltip';

interface Scenario {
  id: number;
  category: string;
  scenarioText: string;
  options: {
    text: string;
    isCorrect: boolean;
    cukPoints: number;
    explanation: string;
  }[];
}

const SCENARIOS: Scenario[] = [
  {
    id: 1,
    category: "Reklam / Tanıtım",
    scenarioText: "Bir üye sunucudaki genel sohbette 'Gençler yeni açtığım sunucuma gelin, ses kanalları aktif: discord.gg/ornekdavet' yazdı. Bu kullanıcıya hangi ceza verilmeli ve CUK kurallarına göre işlem puanı nedir?",
    options: [
      {
        text: "Kalıcı Engel (Ban) uygulanmalı ve reklam kategorisinden 15 CUK Puanı verilir.",
        isCorrect: true,
        cukPoints: 15,
        explanation: "Doğru! Sunucu içi doğrudan davet paylaşımı reklam kapsamında değerlendirilip kalıcı erişim engeli (Ban) cezası gerektirir."
      },
      {
        text: "3 saat Susturma (Mute) uygulanmalı ve reklam kategorisinden 5 CUK Puanı verilir.",
        isCorrect: false,
        cukPoints: 5,
        explanation: "Yanlış! Davet bağlantıları susturma değil, doğrudan koruma amacıyla kalıcı engelleme gerektirir."
      },
      {
        text: "Yalnızca sözlü uyarı verilmeli, puan verilmemeli.",
        isCorrect: false,
        cukPoints: 0,
        explanation: "Yanlış! Sunucuda reklam yapmak doğrudan ihlaldir, sözlü uyarıyla geçiştirilemez."
      }
    ]
  },
  {
    id: 2,
    category: "Küfür / Hakaret",
    scenarioText: "Destek kanalında bir kullanıcı moderatöre hitaben doğrudan ailevi ve ağır hakaretler içeren mesajlar gönderdi. Bu duruma verilmesi gereken ceza ve CUK kural grubu hangisidir?",
    options: [
      {
        text: "12 saat Mute uygulanmalı ve Ağır Hakaret kategorisinden 10 CUK Puanı verilir.",
        isCorrect: true,
        cukPoints: 10,
        explanation: "Harika! Doğrudan yetkiliye ya da üyelere yönelik ailevi/şahsi ağır hakaretler 12 saat susturma ile cezalandırılır."
      },
      {
        text: "3 saat Mute uygulanmalı ve Küçük Çaplı Argo kategorisinden 3 CUK Puanı verilir.",
        isCorrect: false,
        cukPoints: 3,
        explanation: "Yanlış! Ailevi ve ağır küfürler küçük çaplı argo sınırlarını aşar, bu nedenle daha yüksek ceza gerektirir."
      },
      {
        text: "Sunucudan doğrudan atılmalı (Kick).",
        isCorrect: false,
        cukPoints: 5,
        explanation: "Yanlış! Küfür durumlarında susturma (Mute) verilerek kanıt korunmalıdır. Atma (Kick) işlemi kalıcı çözüm sunmaz."
      }
    ]
  },
  {
    id: 3,
    category: "Dini / Milli Değerlere Saygısızlık",
    scenarioText: "Bir kullanıcı genel sohbette dini veya milli hassas sembollere hakaret barındıran provokatif bir görsel paylaştı. Bu durumda izlenmesi gereken doğru prosedür hangisidir?",
    options: [
      {
        text: "Kullanıcıya kalıcı engel (Ban) uygulanmalı ve Dini/Milli Değerler kategorisinden 20 CUK Puanı verilir.",
        isCorrect: true,
        cukPoints: 20,
        explanation: "Doğru! Dini, milli ve kutsal değerlere yönelik saygısızlık, sıfır tolerans gerektirir ve doğrudan kalıcı engel ile sonuçlanır."
      },
      {
        text: "24 saat susturma (Mute) uygulanmalı.",
        isCorrect: false,
        cukPoints: 10,
        explanation: "Yanlış! Bu ihlal susturma ile geçiştirilemeyecek düzeyde ağırdır, doğrudan kalıcı uzaklaştırma uygulanmalıdır."
      },
      {
        text: "Görsel silinmeli ve uyarı rolü verilmeli.",
        isCorrect: false,
        cukPoints: 2,
        explanation: "Yanlış! Basit bir uyarı bu derecede büyük bir ihlale karşı kesinlikle yetersizdir."
      }
    ]
  }
];

export default function PointTrain() {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [totalPointsEarned, setTotalPointsEarned] = useState<number>(0);
  const [completed, setCompleted] = useState<boolean>(false);

  const scenario = SCENARIOS[currentStep];

  const handleOptionSelect = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
  };

  const handleSubmit = () => {
    if (selectedOption === null || isAnswered) return;
    setIsAnswered(true);
    const chosen = scenario.options[selectedOption];
    if (chosen.isCorrect) {
      setScore(prev => prev + 1);
      setTotalPointsEarned(prev => prev + chosen.cukPoints);
    }
  };

  const handleNext = () => {
    setSelectedOption(null);
    setIsAnswered(false);
    if (currentStep < SCENARIOS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      setCompleted(true);
    }
  };

  const handleReset = () => {
    setCurrentStep(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setTotalPointsEarned(0);
    setCompleted(false);
  };

  return (
    <div className="p-6 md:p-8 w-full max-w-5xl mx-auto space-y-8 select-none">
      {/* Header */}
      <div className="border-b border-white/[0.04] pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#A259FE]" />
            <span className="text-[10px] font-mono tracking-widest text-[#A259FE] uppercase font-bold">Lutheus Akademi</span>
          </div>
          <h2 className="text-[22px] font-bold text-white tracking-tight mt-1">CUK Pointtrain Sistemi</h2>
          <p className="text-[13px] text-[#8E8E93] mt-1">Ceza Uygulama Kuralları pratik eğitim ve simülatör paneli.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-white/[0.02] border border-white/[0.08] rounded-xl px-4 py-2">
          <div className="text-center border-r border-white/5 pr-4">
            <span className="text-[10px] text-white/40 block font-bold uppercase tracking-wider">Doğru Sayısı</span>
            <span className="text-[16px] font-black text-[#32D74B]">{score} / {SCENARIOS.length}</span>
          </div>
          <div className="text-center">
            <span className="text-[10px] text-white/40 block font-bold uppercase tracking-wider">Kazanılan CUK</span>
            <span className="text-[16px] font-black text-[#A259FE] font-mono">{totalPointsEarned} Puan</span>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!completed ? (
          <motion.div 
            key={currentStep}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="compact-glass rounded-2xl border border-white/[0.06] p-6 md:p-8 bg-black/35 backdrop-blur-3xl relative overflow-hidden"
          >
            {/* Ambient subtle glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#5E5CE6]/3 rounded-full filter blur-[80px] pointer-events-none" />
            
            {/* Category tag */}
            <div className="flex items-center justify-between mb-6">
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[11px] font-bold text-[#A259FE]">
                {scenario.category}
              </span>
              <span className="text-[11px] font-mono text-white/30 font-semibold">
                Soru {currentStep + 1} / {SCENARIOS.length}
              </span>
            </div>

            {/* Scenario block */}
            <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.04] mb-8">
              <span className="text-[10px] font-mono font-extrabold text-white/30 uppercase tracking-widest block mb-2">Simüle Vaka Senaryosu</span>
              <p className="text-[14px] text-white/90 leading-relaxed font-semibold">
                {scenario.scenarioText}
              </p>
            </div>

            {/* Answer Options */}
            <div className="space-y-3 mb-8">
              <span className="text-[10px] font-mono font-extrabold text-white/30 uppercase tracking-widest block mb-1">Kararınızı Seçin</span>
              
              {scenario.options.map((option, idx) => {
                let borderStyle = "border-white/10 hover:bg-white/[0.02]";
                let bgStyle = "bg-black/10";
                let textStyle = "text-white/80";

                if (selectedOption === idx) {
                  borderStyle = "border-[#5E5CE6] bg-[#5E5CE6]/10";
                  textStyle = "text-white font-semibold";
                }

                if (isAnswered) {
                  if (option.isCorrect) {
                    borderStyle = "border-[#32D74B] bg-[#32D74B]/5";
                    textStyle = "text-[#32D74B] font-semibold";
                  } else if (selectedOption === idx) {
                    borderStyle = "border-[#FF453A] bg-[#FF453A]/5";
                    textStyle = "text-[#FF453A] font-semibold";
                  } else {
                    borderStyle = "border-white/[0.03] opacity-45";
                  }
                }

                return (
                  <button
                    key={idx}
                    disabled={isAnswered}
                    onClick={() => handleOptionSelect(idx)}
                    className={`w-full p-4 rounded-xl border text-left transition-all ${borderStyle} ${bgStyle} ${textStyle} relative flex items-center gap-3`}
                  >
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold transition-all ${
                      selectedOption === idx 
                        ? 'border-[#5E5CE6] bg-[#5E5CE6] text-white' 
                        : 'border-white/20'
                    }`}>
                      {String.fromCharCode(65 + idx)}
                    </div>
                    <span className="text-[12.5px] leading-relaxed flex-1">{option.text}</span>
                    
                    {isAnswered && option.isCorrect && (
                      <CheckCircle2 size={16} className="text-[#32D74B] shrink-0" />
                    )}
                    {isAnswered && selectedOption === idx && !option.isCorrect && (
                      <AlertCircle size={16} className="text-[#FF453A] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between border-t border-white/[0.05] pt-6">
              <div>
                {isAnswered && (
                  <motion.p 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-[12.5px] text-white/70 font-medium leading-relaxed max-w-lg"
                  >
                    <span className="font-bold block text-white mb-0.5">Sistem Geri Bildirimi:</span>
                    {scenario.options[selectedOption!].explanation}
                  </motion.p>
                )}
              </div>

              <div className="flex items-center gap-3">
                {!isAnswered ? (
                  <button
                    disabled={selectedOption === null}
                    onClick={handleSubmit}
                    className="px-5 py-2.5 bg-[#5E5CE6] hover:bg-[#4E4CD6] disabled:opacity-40 disabled:hover:bg-[#5E5CE6] text-white font-bold rounded-lg text-[12px] transition-all cursor-pointer shadow-lg"
                  >
                    Kararı Onayla
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    className="px-5 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-lg text-[12px] transition-all cursor-pointer flex items-center gap-1.5 shadow-md"
                  >
                    {currentStep < SCENARIOS.length - 1 ? (
                      <>Sonraki Senaryo <ChevronRight size={14} /></>
                    ) : (
                      <>Simülasyonu Bitir <Award size={14} /></>
                    )}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="compact-glass rounded-2xl border border-white/[0.06] p-8 text-center bg-black/35 backdrop-blur-3xl relative overflow-hidden flex flex-col items-center justify-center max-w-xl mx-auto shadow-2xl"
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#A259FE]/5 blur-[70px] rounded-full pointer-events-none" />
            
            <div className="w-16 h-16 rounded-2xl bg-[#A259FE]/10 border border-[#A259FE]/20 flex items-center justify-center text-[#A259FE] mb-6 relative group">
              <div className="absolute inset-0 bg-[#A259FE]/20 rounded-2xl blur-md opacity-40 group-hover:opacity-75 transition-opacity" />
              <Award className="relative z-10" size={28} />
            </div>

            <h3 className="text-[17px] font-bold text-white tracking-tight">Tebrikler, Eğitim Tamamlandı!</h3>
            <p className="text-[12px] text-[#8E8E93] mt-2 mb-6 max-w-sm leading-relaxed">
              Tüm simülasyon adımlarını başarıyla geçtiniz. CUK veri doğrusal uyum beceriniz ölçüldü ve kayıt altına alındı.
            </p>

            <div className="grid grid-cols-2 gap-4 w-full bg-white/[0.02] border border-white/[0.04] rounded-xl p-4 mb-8 text-center">
              <div>
                <span className="text-[10px] text-white/40 block font-semibold uppercase">Doğruluk Oranı</span>
                <span className="text-[20px] font-black text-[#32D74B] mt-1 block">%{Math.round((score / SCENARIOS.length) * 100)}</span>
              </div>
              <div>
                <span className="text-[10px] text-white/40 block font-semibold uppercase">Toplam Tecrübe</span>
                <span className="text-[20px] font-black text-[#A259FE] mt-1 block">+{totalPointsEarned} CUK XP</span>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="px-5 py-2.5 bg-[#5E5CE6] hover:bg-[#4E4CD6] text-white font-bold rounded-lg text-[12px] transition-all cursor-pointer shadow-lg flex items-center gap-1.5"
            >
              <RefreshCw size={13} /> Simülasyonu Yeniden Başlat
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

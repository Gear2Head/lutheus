'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, MessageSquare, AlertCircle, CheckCircle2, ChevronRight, 
  Send, HelpCircle, Activity, ShieldCheck, Clock, Settings2, Shield
} from 'lucide-react';

interface Assessment {
  hasViolation: boolean;
  score: number;
  violationType?: string;
  suggestedAction?: string;
  matchingCukRule?: string;
  points: number;
  unmaskedVulnerabilities: string[];
  justification: string;
}

export default function Agent() {
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<Assessment | null>(null);

  const handleQuickTemplate = (text: string) => {
    setInputText(text);
  };

  const handleAnalyze = () => {
    if (!inputText.trim()) return;
    setIsAnalyzing(true);
    setResult(null);

    setTimeout(() => {
      const text = inputText.toLowerCase();
      let assessment: Assessment = {
        hasViolation: false,
        score: 100,
        points: 0,
        unmaskedVulnerabilities: [],
        justification: "İncelenen metinde herhangi bir CUK (Ceza Uygulama Kuralları) ihlaline rastlanmamıştır. Genel sohbet akışına uygundur."
      };

      if (text.includes("discord.gg/") || text.includes("discordlink") || text.includes("server invitation") || text.includes("instagram.com/")) {
        assessment = {
          hasViolation: true,
          score: 10,
          violationType: "Reklam ve Davet Bağlantısı Paylaşımı",
          suggestedAction: "Kalıcı Uzaklaştırma (Ban)",
          matchingCukRule: "CUK-01 (Reklam / Davet)",
          points: 15,
          unmaskedVulnerabilities: ["discord.gg link", "reklam tespiti"],
          justification: "Metinde açık bir şekilde harici Discord sunucu davet adresi veya sosyal medya hesabı tanıtımı saptanmıştır. CUK-01 kuralı gereği sunucu bütünlüğünü korumak adına doğrudan 'Ban' cezası uygulanmalıdır."
        };
      } else if (text.includes("oç") || text.includes("amk") || text.includes("piç") || text.includes("amına") || text.includes("orospu")) {
        assessment = {
          hasViolation: true,
          score: 30,
          violationType: "Ağır Şahsi ve Ailevi Hakaret",
          suggestedAction: "12 saat Susturma (Mute)",
          matchingCukRule: "CUK-02 (Küfür & Hakaret)",
          points: 10,
          unmaskedVulnerabilities: ["ağır küfür", "şahsi hakaret"],
          justification: "Metin içerisinde şahıslara yönelik ağır hakaret ve ailevi değerleri aşağılayan küfürlü ifadeler tespit edilmiştir. CUK-02 gereği ilgili yetkili tarafından kanıt alınmalı ve kullanıcı 12 saat susturulmalıdır."
        };
      } else if (text.includes("allah") || text.includes("din") || text.includes("kuran") || text.includes("muhammed") || text.includes("peygamber")) {
        // Checking for negative context matching values
        if (text.includes("söve") || text.includes("küf") || text.includes("dalga") || text.includes("saygısız")) {
          assessment = {
            hasViolation: true,
            score: 0,
            violationType: "Dini / Milli Değerlere Saygısızlık",
            suggestedAction: "Süresiz Engel (Ban)",
            matchingCukRule: "CUK-03 (Değerlere Saygısızlık)",
            points: 20,
            unmaskedVulnerabilities: ["kutsala hakaret", "dini istismar"],
            justification: "Kullanıcının kutsal, dini veya milli sembollere doğrudan hakaret ettiği ve provokasyon yarattığı saptanmıştır. Toleranssız kural (CUK-03) doğrultusunda sunucu erişiminin kalıcı olarak engellenmesi gerekir."
          };
        }
      } else if (inputText.length > 50 && (inputText.match(/[A-ZĞÜŞİÖÇ]/g) || []).length / inputText.length > 0.65) {
        assessment = {
          hasViolation: true,
          score: 60,
          violationType: "Yoğun Caps / Harf Suiistimali",
          suggestedAction: "Uyarı / 15 dk Mute (Tekrarda)",
          matchingCukRule: "CUK-04 (Sohbet Akışını Bozma)",
          points: 3,
          unmaskedVulnerabilities: ["Caps-Lock Abuze", "Sohbet Sabotesi"],
          justification: "Yoğun büyük harf (CAPS) kullanımı tespit edilmiştir. Bu durum genel sohbet akışını bozmakta ve kirlilik yaratmaktadır. Öncelikle sözlü uyarı verilmeli, eylemin devamında 15 dakika mute süresi uygulanmalıdır."
        };
      } else if (text.includes("spam") || text.split(" ").length < 4 && text.repeat(3).includes(text)) {
        assessment = {
          hasViolation: true,
          score: 75,
          violationType: "Metinsel Spam / Flood Girişimi",
          suggestedAction: "30 dakika Susturma (Mute)",
          matchingCukRule: "CUK-04 (Sohbet Düzeni)",
          points: 3,
          unmaskedVulnerabilities: ["Hızlı mesaj", "tekrarlı yazım"],
          justification: "Sohbet kanalında akışı sabote edecek şekilde anlamsız flood karakter dizileri veya çok kısa sürede aşırı tekrarlı gönderim gözlemlendi. CUK-04 uyarınca 30 dakika mute cezası verilebilir."
        };
      }

      setResult(assessment);
      setIsAnalyzing(false);
    }, 1200);
  };

  return (
    <div className="p-6 md:p-8 w-full max-w-5xl mx-auto space-y-8 select-none">
      {/* Header */}
      <div className="border-b border-white/[0.04] pb-6">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#5E5CE6]" />
          <span className="text-[10px] font-mono tracking-widest text-[#5E5CE6] uppercase font-bold">Lutheus AI Modülü</span>
        </div>
        <h2 className="text-[22px] font-bold text-white tracking-tight mt-1">AI Moderasyon Asistanı</h2>
        <p className="text-[13px] text-[#8E8E93] mt-1">Şüpheli mesajları, kanıt loglarını veya şikayet metinlerini buraya yapıştırarak yapay zeka tabanlı uyumluluk incelemesi yapın.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Input box section */}
        <div className="lg:col-span-7 space-y-5">
          <div className="compact-glass rounded-2xl border border-white/[0.04] p-5 bg-[#0C0C0E]/40 backdrop-blur-3xl relative overflow-hidden flex flex-col h-[400px]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-widest">İnceleme Veri Girişi</span>
              <span className="text-[10px] text-white/30 font-semibold font-mono">{inputText.length} karakter</span>
            </div>

            <textarea 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Kanıt olarak sunulan sohbet mesajını buraya yapıştırın veya aşağıdaki hızlı senaryolardan birini seçin..."
              className="flex-1 w-full bg-transparent text-[13px] text-white/90 outline-none resize-none font-medium placeholder-white/20 leading-relaxed scrollbar-thin"
            />

            <div className="pt-4 border-t border-white/[0.04] flex justify-end">
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !inputText.trim()}
                className="px-5 py-2.5 bg-[#5E5CE6] hover:bg-[#4E4CD6] disabled:opacity-40 disabled:hover:bg-[#5E5CE6] text-white font-bold rounded-lg text-[12px] cursor-pointer transition-all flex items-center gap-1.5 shadow-lg"
              >
                {isAnalyzing ? (
                  <>Analiz Ediliyor <Clock size={13} className="animate-spin" /></>
                ) : (
                  <>Sohbet Kuralını Çözümle <Send size={13} /></>
                )}
              </button>
            </div>
          </div>

          {/* Quick template cases */}
          <div className="space-y-2.5">
            <span className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-widest block">Örnek Şüpheli Senaryolar</span>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button 
                onClick={() => handleQuickTemplate("Herkes gelsin beyler çok efsane rol serverı açtık: discord.gg/sapphire-roleplay")}
                className="p-3 rounded-xl bg-white/[0.01] border border-white/5 text-left text-[11.5px] text-white/60 hover:text-white hover:bg-white/[0.03] transition-all cursor-pointer font-medium"
              >
                "beyler server açtık davet..." (CUK-01 Reklam)
              </button>
              <button 
                onClick={() => handleQuickTemplate("ne diyorsun sen lan amk piçi herif salak salak konuşma senin kafanı kırarım")}
                className="p-3 rounded-xl bg-white/[0.01] border border-white/5 text-left text-[11.5px] text-white/60 hover:text-white hover:bg-white/[0.03] transition-all cursor-pointer font-medium"
              >
                "amk piçi salak salak..." (CUK-02 Küfür)
              </button>
              <button 
                onClick={() => handleQuickTemplate("SİZE YÜZ KERE SÖYLEDİK OYUN KANALLARINI BOŞ YERE KULLANMAYIN LAN BİZİ SİNİR ETMEYİN")}
                className="p-3 rounded-xl bg-white/[0.01] border border-white/5 text-left text-[11.5px] text-white/60 hover:text-white hover:bg-white/[0.03] transition-all cursor-pointer font-medium"
              >
                "SİZE YÜZ KERE SÖYLEDİK CAPS..." (CUK-04 CAPS)
              </button>
              <button 
                onClick={() => handleQuickTemplate("allahın belaları sizin dininizle dalga geçiyorum ne yapabilirsiniz ki bana")}
                className="p-3 rounded-xl bg-white/[0.01] border border-white/5 text-left text-[11.5px] text-white/60 hover:text-white hover:bg-white/[0.03] transition-all cursor-pointer font-medium"
              >
                "dininizle dalga geçiyorum..." (CUK-03 İnanç)
              </button>
            </div>
          </div>
        </div>

        {/* Results assessment section */}
        <div className="lg:col-span-5">
          <AnimatePresence mode="wait">
            {isAnalyzing ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="compact-glass rounded-2xl border border-white/[0.04] p-8 text-center h-[400px] flex flex-col items-center justify-center bg-[#0C0C0E]/20"
              >
                <div className="relative w-16 h-16 mb-4">
                  <div className="absolute inset-0 rounded-full border-2 border-white/5 border-t-[#5E5CE6] animate-spin" />
                  <div className="absolute inset-2 rounded-full border border-white/5 border-b-[#A259FE] animate-spin" style={{ animationDirection: 'reverse' }} />
                  <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/30 w-5 h-5" />
                </div>
                <h4 className="text-[13.5px] font-bold text-white tracking-tight">CUK Algoritması Çalışıyor</h4>
                <p className="text-[11.5px] text-[#8E8E93] mt-2 max-w-xs leading-relaxed">
                  İfade söz dizimi, küfür eşleşme kütüphaneleri ve caps oranları denetleniyor...
                </p>
              </motion.div>
            ) : result ? (
              <motion.div
                key="results"
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="compact-glass rounded-2xl border border-white/[0.04] p-6 bg-[#0E0E11]/45 backdrop-blur-3xl relative overflow-hidden space-y-6 shadow-2xl min-h-[400px]"
              >
                {/* Visual Accent */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#5E5CE6]/30 to-transparent" />

                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-widest">Çözümleme Bulguları</span>
                  
                  <span className={`status-badge ${result.hasViolation ? 'danger' : 'success'} scale-95`}>
                    {result.hasViolation ? 'İHLAL TESPİT EDİLDİ' : 'TEMİZ GÜVENLİ'}
                  </span>
                </div>

                {/* Score donut bar visual */}
                <div className="bg-[#141416]/60 border border-white/5 rounded-xl p-4 flex items-center justify-between group">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-white/30 uppercase tracking-wider block">Güvenilirlik Puanı</span>
                    <span className={`text-[24px] font-black leading-none ${result.score > 80 ? 'text-[#32D74B]' : result.score > 40 ? 'text-[#FF9F0A]' : 'text-[#FF453A]'}`}>
                      {result.score} / 100
                    </span>
                  </div>
                  <ShieldCheck className={result.hasViolation ? "text-[#FF453A] w-8 h-8 opacity-70" : "text-[#32D74B] w-8 h-8 opacity-95"} />
                </div>

                {result.hasViolation && (
                  <div className="space-y-4">
                    {/* Violation type info */}
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest block">İhlal Türü</span>
                      <p className="text-[13.5px] font-bold text-white">{result.violationType}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-white/[0.01] border border-white/5 text-center">
                        <span className="text-[9.5px] text-white/30 uppercase block font-semibold">Tavsiye Karar</span>
                        <span className="text-[12px] text-white font-black mt-1 block">{result.suggestedAction}</span>
                      </div>
                      <div className="p-3 rounded-lg bg-white/[0.01] border border-white/5 text-center">
                        <span className="text-[9.5px] text-white/30 uppercase block font-semibold">Ceza Yükü</span>
                        <span className="text-[12px] text-[#A259FE] font-black mt-1 block">+{result.points} CUK Puanı</span>
                      </div>
                    </div>

                    <div className="space-y-1 pt-1">
                      <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest block">CUK Uyumluluk Maddesi</span>
                      <p className="text-[12px] font-mono font-bold text-[#5E5CE6] bg-[#5E5CE6]/10 px-2.5 py-1.5 rounded border border-[#5E5CE6]/20 inline-block">
                        {result.matchingCukRule}
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 pt-1.5 border-t border-white/[0.04]">
                  <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest block">AI Çıkarımsal Karar Bilgisi</span>
                  <p className="text-[12px] text-white/70 leading-relaxed font-medium">
                    {result.justification}
                  </p>
                </div>

              </motion.div>
            ) : (
              <div className="compact-glass rounded-2xl border border-white/[0.04] p-8 text-center h-[400px] flex flex-col items-center justify-center bg-[#0C0C0E]/20 relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-[#5E5CE6]/3 blur-3xl rounded-full pointer-events-none" />
                <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/10 flex items-center justify-center text-white/20 mb-4 shadow-md">
                  <Shield size={20} className="opacity-60" />
                </div>
                <h4 className="text-[13.5px] font-bold text-white/90 tracking-tight leading-none">Analiz Raporu Hazır Değil</h4>
                <p className="text-[11.5px] text-[#8E8E93] max-w-xs mx-auto mt-2.5 leading-relaxed font-medium">
                  Karar analizlerinin ve CUK yaptırım tavsiyelerinin detaylı dökümünü listelemek için soldaki giriş alanına veri ekleyip analizi başlatın.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}

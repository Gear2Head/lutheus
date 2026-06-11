"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStoredSession, LutheusSession } from "@/lib/auth/session";
import { Shield, Bot, ClipboardList, LogIn, LogOut, ArrowRight, User } from "lucide-react";

export default function RootWelcomePage() {
  const [session, setSession] = useState<LutheusSession | null>(null);

  useEffect(() => {
    setSession(getStoredSession());
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("lutheusAuthSession");
    setSession(null);
    window.location.reload();
  };

  return (
    <div className="relative min-h-screen bg-[#050508] flex flex-col items-center justify-center p-6 overflow-hidden selection:bg-[#5E5CE6]/30 selection:text-white">
      
      {/* Premium Ambient Glows */}
      <div className="absolute top-[-30%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[#5E5CE6]/10 blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-30%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[#A259FE]/8 blur-[160px] pointer-events-none" />
      <div className="absolute top-[30%] left-[40%] w-[400px] h-[400px] rounded-full bg-indigo-500/5 blur-[130px] pointer-events-none" />

      {/* Elegant Header */}
      <header className="w-full max-w-6xl absolute top-0 flex items-center justify-between p-6 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-[30px] h-[30px] rounded-lg bg-[#5E5CE6]/10 border border-[#5E5CE6]/20 flex items-center justify-center text-[#5E5CE6] shadow-[0_0_15px_rgba(94,92,230,0.15)]">
            <Shield className="w-4.5 h-4.5" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-black tracking-widest text-white font-mono">
            LUTHEUS
          </span>
        </div>

        <div>
          {session ? (
            <div className="flex items-center gap-3.5 bg-black/45 backdrop-blur-2xl px-4 py-2 rounded-xl border border-white/[0.06] shadow-xl">
              {session.user?.photoURL ? (
                <img
                  src={session.user.photoURL}
                  alt="Avatar"
                  className="w-7 h-7 rounded-lg border border-white/10 object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                  <User className="w-4 h-4 text-white/50" />
                </div>
              )}
              <span className="text-xs font-bold text-white/90">
                {session.user?.displayName || "Kullanıcı"}
              </span>
              <button
                onClick={handleLogout}
                className="p-1 text-white/40 hover:text-red-400 transition-colors duration-200 cursor-pointer border-none bg-transparent"
                title="Çıkış Yap"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <a
              href="/auth/login.html"
              className="flex items-center gap-2 px-4.5 py-2 rounded-xl bg-[#5E5CE6]/10 hover:bg-[#5E5CE6]/20 border border-[#5E5CE6]/30 text-xs font-bold text-white transition-all duration-300 hover:shadow-[0_0_20px_rgba(94,92,230,0.25)]"
            >
              <LogIn className="w-3.5 h-3.5 text-[#5E5CE6]" />
              <span>Giriş Yap</span>
            </a>
          )}
        </div>
      </header>

      {/* Welcome Title and Hero Section */}
      <main className="w-full max-w-4xl text-center z-10 mt-20 md:mt-0 px-4">
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.02] border border-white/[0.06] mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5E5CE6] animate-pulse" />
            <span className="text-[10px] font-mono tracking-widest text-white/45 uppercase font-bold">YÖNETİM SİSTEMİ</span>
          </div>
          
          <h1 className="text-4xl md:text-[54px] font-black tracking-tight mb-4 text-white leading-tight">
            Lutheus Yönetim <span className="bg-gradient-to-r from-[#5E5CE6] to-[#A259FE] bg-clip-text text-transparent">Merkezi</span>
          </h1>
          
          <p className="text-sm md:text-base text-white/50 max-w-lg mx-auto font-medium leading-relaxed">
            Yapay zeka destekli moderasyon asistanınızı yönetin, ceza raporlarını anlık izleyin ve sunucu ayarlarını tek panelden kişiselleştirin.
          </p>
        </div>

        {/* Feature Bento Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Card 1: Bot Dashboard */}
          <Link href="/bot" className="group block no-underline">
            <div className="h-full bg-black/30 hover:bg-black/45 backdrop-blur-2xl p-7.5 rounded-2xl border border-white/[0.06] hover:border-[#5E5CE6]/40 transition-all duration-300 hover:shadow-[0_12px_40px_rgba(94,92,230,0.12)] flex flex-col text-left relative overflow-hidden group-hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#5E5CE6]/5 to-transparent rounded-bl-full pointer-events-none" />
              
              <div className="p-3 bg-white/[0.03] rounded-xl w-fit mb-5 border border-white/[0.06] group-hover:border-[#5E5CE6]/25 transition-colors duration-300 text-[#5E5CE6]">
                <Bot className="w-6 h-6" />
              </div>

              <h2 className="text-xl font-bold mb-2.5 text-white group-hover:text-[#5E5CE6] transition-colors duration-300 flex items-center gap-1.5">
                <span>Bot Dashboard</span>
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
              </h2>
              
              <p className="text-xs text-white/50 leading-relaxed mb-6 font-medium">
                Gelişmiş moderasyon araçları, otomatik mesajlaşma, karşılama şablonları ve Discord bot özelliklerini sunucu bazlı yönetin.
              </p>

              <div className="mt-auto pt-2 flex items-center gap-1.5 text-[10.5px] font-bold tracking-widest text-[#5E5CE6] uppercase font-mono">
                <span>PANELİ YÖNET</span>
              </div>
            </div>
          </Link>

          {/* Card 2: Ceza Rapor Sistemi */}
          <Link href="/dashboard" className="group block no-underline">
            <div className="h-full bg-black/30 hover:bg-black/45 backdrop-blur-2xl p-7.5 rounded-2xl border border-white/[0.06] hover:border-[#A259FE]/40 transition-all duration-300 hover:shadow-[0_12px_40px_rgba(162,89,254,0.1)] flex flex-col text-left relative overflow-hidden group-hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#A259FE]/5 to-transparent rounded-bl-full pointer-events-none" />
              
              <div className="p-3 bg-white/[0.03] rounded-xl w-fit mb-5 border border-white/[0.06] group-hover:border-[#A259FE]/25 transition-colors duration-300 text-[#A259FE]">
                <ClipboardList className="w-6 h-6" />
              </div>

              <h2 className="text-xl font-bold mb-2.5 text-white group-hover:text-[#A259FE] transition-colors duration-300 flex items-center gap-1.5">
                <span>Ceza Rapor Sistemi</span>
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
              </h2>
              
              <p className="text-xs text-white/50 leading-relaxed mb-6 font-medium">
                Sunucunuzda gerçekleşen cezai işlemleri, kullanıcı raporlarını, itirazları ve detaylı istatistikleri canlı izleyin.
              </p>

              <div className="mt-auto pt-2 flex items-center gap-1.5 text-[10.5px] font-bold tracking-widest text-[#A259FE] uppercase font-mono">
                <span>SİSTEME GİRİŞ</span>
              </div>
            </div>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="absolute bottom-6 text-[10px] text-white/20 tracking-wider font-mono">
        &copy; {new Date().getFullYear()} Lutheus System. Tüm hakları saklıdır.
      </footer>
    </div>
  );
}

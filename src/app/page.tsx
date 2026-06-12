"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStoredSession, LutheusSession } from "@/lib/auth/session";
import { ArrowRight, ExternalLink, LogOut, Bot, ClipboardList } from "lucide-react";

export default function RootWelcomePage() {
  const [session, setSession] = useState<LutheusSession | null>(null);
  const [userCount, setUserCount] = useState<number>(37);
  const [activeStaffCount, setActiveStaffCount] = useState<number>(16);
  const [onlineMemberCount, setOnlineMemberCount] = useState<number | null>(null);

  useEffect(() => {
    setSession(getStoredSession());

    // Fetch dynamic staff counts from Supabase via RPC to bypass RLS
    async function fetchCounts() {
      try {
        const res = await fetch("https://jxhzhaqqtlynbnntwpyu.supabase.co/rest/v1/rpc/get_staff_counts", {
          method: "POST",
          headers: {
            apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4aHpoYXFxdGx5bmJubnR3cHl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NjMyMTcsImV4cCI6MjA5NTIzOTIxN30.BrmuT-QX_BkgV6SSlpNThfqSGmUDw0UffUW11agaBzI",
            "Content-Type": "application/json"
          }
        });
        if (res.ok) {
          const counts = await res.json();
          if (counts && typeof counts.total === "number") {
            setUserCount(counts.total);
          }
          if (counts && typeof counts.active === "number") {
            setActiveStaffCount(counts.active);
          }
        }
      } catch (e) {
        console.warn("Failed to fetch dynamic staff counts via RPC:", e);
      }
    }

    // Fetch online member count from Discord widget
    async function fetchDiscordOnline() {
      try {
        const res = await fetch("https://discord.com/api/guilds/1223431616081166336/widget.json");
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data.presence_count === "number") {
            setOnlineMemberCount(data.presence_count);
          }
        }
      } catch (e) {
        console.warn("Failed to fetch Discord online presence:", e);
      }
    }

    fetchCounts();
    fetchDiscordOnline();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("lutheusAuthSession");
    setSession(null);
    window.location.reload();
  };

  const userRole = session?.role?.toLowerCase() || '';
  const isMgmt = ['kurucu', 'admin', 'yonetici', 'genel_sorumlu', 'discord_yoneticisi', 'kidemli', 'kidemli_discord_moderatoru', 'senior_moderator'].includes(userRole);

  // AUTHENTICATED STATE VIEW
  if (session) {
    const avatarUrl = session.user?.photoURL || "https://i.ibb.co/3sS1wsh/gearhead-avatar.png";
    const displayName = session.user?.displayName || "Kullanıcı";

    return (
      <div className="relative min-h-screen bg-[#050508] flex flex-col items-center justify-between p-6 overflow-hidden selection:bg-[#3B82F6]/30 selection:text-white">
        
        {/* Premium Ambient Glows */}
        <div className="absolute top-[-30%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[#3B82F6]/10 blur-[160px] pointer-events-none" />
        <div className="absolute bottom-[-30%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[#1D4ED8]/8 blur-[160px] pointer-events-none" />

        {/* Header Bar */}
        <header className="w-full max-w-6xl flex items-center justify-between z-20 py-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 flex items-center justify-center shrink-0">
              <img src="/dashboard/icon128.png" className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(59,130,246,0.4)]" alt="Lutheus Logo" />
            </div>
            <span className="text-sm font-black tracking-widest text-white/90 uppercase font-mono">
              LUTHEUS DISCORD MANAGE
            </span>
          </div>

          <div className="flex items-center gap-3.5 bg-white/[0.02] border border-white/[0.06] rounded-2xl px-4 py-2 backdrop-blur-md">
            <img src={avatarUrl} alt="Avatar" className="w-6 h-6 rounded-full border border-white/10" />
            <span className="text-xs font-bold text-white/80">{displayName}</span>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10 text-white/45 hover:text-red-400 transition-all cursor-pointer"
              title="Çıkış Yap"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Selection Center Grid */}
        <main className="w-full max-w-4xl text-center z-10 px-4 flex flex-col items-center justify-center my-auto space-y-12">
          <div className="space-y-4 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.02] border border-white/[0.06] mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] animate-pulse" />
              <span className="text-[10px] font-mono tracking-widest text-white/45 uppercase font-bold">YÖNETİM SİSTEMİ</span>
            </div>
            
            <h1 className="text-4xl md:text-[48px] font-black tracking-tight text-white leading-tight">
              Lutheus Yönetim <span className="bg-gradient-to-r from-[#3B82F6] to-[#1D4ED8] bg-clip-text text-transparent">Merkezi</span>
            </h1>
            
            <p className="text-xs md:text-sm text-white/50 max-w-md mx-auto font-semibold leading-relaxed">
              Yapay zeka destekli moderasyon asistanınızı yönetin, ceza raporlarını anlık izleyin ve sunucu ayarlarını tek panelden kişiselleştirin.
            </p>
          </div>

          {/* Service Cards */}
          <div className={`grid gap-6 w-full max-w-3xl mx-auto ${isMgmt ? "md:grid-cols-2" : "grid-cols-1 max-w-md"}`}>
            
            {/* Card 1: Bot Dashboard (Only for management) */}
            {isMgmt && (
              <Link href="/bot" className="group block no-underline">
                <div className="h-full bg-black/30 hover:bg-black/45 backdrop-blur-2xl p-7.5 rounded-2xl border border-white/[0.06] hover:border-[#3B82F6]/40 transition-all duration-300 hover:shadow-[0_12px_40px_rgba(59,130,246,0.12)] flex flex-col text-left relative overflow-hidden group-hover:-translate-y-1">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#3B82F6]/5 to-transparent rounded-bl-full pointer-events-none" />
                  
                  <div className="p-3 bg-white/[0.03] rounded-xl w-fit mb-5 border border-white/[0.06] group-hover:border-[#3B82F6]/25 transition-colors duration-300 text-[#3B82F6]">
                    <Bot className="w-6 h-6" />
                  </div>

                  <h2 className="text-xl font-bold mb-2.5 text-white group-hover:text-[#3B82F6] transition-colors duration-300 flex items-center gap-1.5">
                    <span>Lutheus Discord Manage</span>
                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
                  </h2>
                  
                  <p className="text-xs text-white/50 leading-relaxed mb-6 font-medium">
                    Gelişmiş moderasyon araçları, otomatik mesajlaşma, karşılama şablonları ve Discord bot özelliklerini sunucu bazlı yönetin.
                  </p>

                  <div className="mt-auto pt-2 flex items-center gap-1.5 text-[10.5px] font-bold tracking-widest text-[#3B82F6] uppercase font-mono">
                    <span>PANELİ YÖNET</span>
                  </div>
                </div>
              </Link>
            )}

            {/* Card 2: Ceza Rapor Sistemi (Aktif Yetkili Sayfası) */}
            <Link href="/dashboard" className="group block no-underline">
              <div className="h-full bg-black/30 hover:bg-black/45 backdrop-blur-2xl p-7.5 rounded-2xl border border-white/[0.06] hover:border-[#3B82F6]/40 transition-all duration-300 hover:shadow-[0_12px_40px_rgba(59,130,246,0.12)] flex flex-col text-left relative overflow-hidden group-hover:-translate-y-1">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#3B82F6]/5 to-transparent rounded-bl-full pointer-events-none" />
                
                <div className="p-3 bg-white/[0.03] rounded-xl w-fit mb-5 border border-white/[0.06] group-hover:border-[#3B82F6]/25 transition-colors duration-300 text-[#3B82F6]">
                  <ClipboardList className="w-6 h-6" />
                </div>

                <h2 className="text-xl font-bold mb-2.5 text-white group-hover:text-[#3B82F6] transition-colors duration-300 flex items-center gap-1.5">
                  <span>Aktif Yetkili Sayfası</span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
                </h2>
                
                <p className="text-xs text-white/50 leading-relaxed mb-6 font-medium">
                  Sunucunuzda gerçekleşen cezai işlemleri, kullanıcı raporlarını, itirazları ve detaylı istatistikleri canlı izleyin.
                </p>

                <div className="mt-auto pt-2 flex items-center gap-1.5 text-[10.5px] font-bold tracking-widest text-[#3B82F6] uppercase font-mono">
                  <span>SİSTEME GİRİŞ</span>
                </div>
              </div>
            </Link>
          </div>
        </main>

        {/* Footer */}
        <footer className="w-full text-center text-[10px] text-white/20 tracking-wider font-mono py-4 z-10">
          &copy; {new Date().getFullYear()} Lutheus System. Tüm hakları saklıdır.
        </footer>
      </div>
    );
  }

  // UNAUTHENTICATED SPLASH/LOGIN STATE VIEW
  return (
    <div className="relative min-h-screen bg-[#050508] flex flex-col items-center justify-center p-6 overflow-hidden selection:bg-[#3B82F6]/30 selection:text-white">
      
      {/* Premium Ambient Glows */}
      <div className="absolute top-[-30%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[#3B82F6]/10 blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-30%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[#1D4ED8]/8 blur-[160px] pointer-events-none" />

      {/* Welcome Title and Hero Section */}
      <main className="w-full max-w-4xl text-center z-10 px-4 flex flex-col items-center justify-center space-y-6">
        
        {/* Stylized Blue L Logo */}
        <div className="flex flex-col items-center space-y-2 mb-2">
          <img src="/dashboard/icon128.png" className="w-16 h-16 object-contain filter drop-shadow-[0_0_12px_rgba(59,130,246,0.5)]" alt="Lutheus Logo" />
          
          <span className="text-[11.5px] font-black tracking-[0.25em] text-white/90 font-mono">
            LUTHEUS DISCORD MANAGE
          </span>
        </div>
        
        {/* Hero Headings */}
        <div className="space-y-4 max-w-xl">
          <h1 className="text-4xl md:text-[46px] font-black tracking-tight text-white leading-tight">
            Lutheus'un omurgası.
          </h1>
          
          <p className="text-xs md:text-sm text-white/50 max-w-md mx-auto font-semibold leading-relaxed">
            Yetkililer için kapsamlı moderasyon paneli. Devam etmek için giriş yapın.
          </p>
        </div>

        {/* CTA Buttons Container */}
        <div className="flex flex-row items-center gap-3.5 pt-3">
          <a
            href="/auth/login.html"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-xs font-bold text-white transition-all duration-300 hover:shadow-[0_0_25px_rgba(59,130,246,0.4)] border-none"
          >
            <span>Giriş Yap</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>

          <a
            href="https://lutheus.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-xs font-bold text-white/70 hover:text-white transition-all duration-300"
          >
            <span>Ana site</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Dynamic Registered Users Count */}
        <div className="pt-8 border-t border-white/[0.04] w-48 mx-auto space-y-1">
          <div className="text-[11.5px] font-semibold text-white/35 font-mono">
            <strong className="text-white/80 font-black font-sans">{userCount}</strong> kayıtlı kullanıcı Lutheus'ta
          </div>
          <div className="text-[11.5px] font-semibold text-white/35 font-mono">
            <strong className="text-[#3B82F6] font-black font-sans">{activeStaffCount}</strong> aktif Discord yetkilisi
          </div>
          {onlineMemberCount !== null && (
            <div className="text-[11.5px] font-semibold text-white/35 font-mono">
              <strong className="text-emerald-500 font-black font-sans">{onlineMemberCount}</strong> aktif sunucu üyesi
            </div>
          )}
        </div>

      </main>

    </div>
  );
}

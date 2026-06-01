"use client";

// SECTION: DASHBOARD_VIEW
// PURPOSE: Root welcome page for Vercel deployment, providing beautiful, premium entry points to both the Discord Bot Dashboard and the Ceza Rapor admin panel.

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
    <div className="relative min-h-screen bg-[#0b0c10] flex flex-col items-center justify-center p-4 overflow-hidden selection:bg-[#66fcf1] selection:text-[#0b0c10]">
      {/* SECTION: AMBIENT_GLOW */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#66fcf1]/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[150px] pointer-events-none" />

      {/* Top Navbar */}
      <header className="w-full max-w-6xl absolute top-0 flex items-center justify-between p-6 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-[#66fcf1] to-purple-600 p-[1px]">
            <div className="bg-[#1f2833] p-2 rounded-[11px]">
              <Shield className="w-6 h-6 text-[#66fcf1]" />
            </div>
          </div>
          <span className="text-xl font-bold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white to-[#c5c6c7]">
            LUTHEUS
          </span>
        </div>

        <div>
          {session ? (
            <div className="flex items-center gap-4 bg-[#1f2833]/80 backdrop-blur-md px-4 py-2 rounded-xl border border-[#2f3e46]">
              {session.user?.photoURL ? (
                <img
                  src={session.user.photoURL}
                  alt="Avatar"
                  className="w-8 h-8 rounded-full border border-[#66fcf1]"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#1c2331] flex items-center justify-center border border-[#66fcf1]">
                  <User className="w-4 h-4 text-[#66fcf1]" />
                </div>
              )}
              <span className="text-sm font-medium text-[#f5f5f7]">
                {session.user?.displayName || "Kullanıcı"}
              </span>
              <button
                onClick={handleLogout}
                className="p-1.5 text-gray-400 hover:text-red-400 transition-colors duration-200"
                title="Çıkış Yap"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <a
              href="/auth/login.html"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1f2833] hover:bg-[#1f2833]/80 border border-[#2f3e46] text-sm font-medium text-[#66fcf1] transition-all duration-300 hover:border-[#66fcf1]/50 hover:shadow-[0_0_15px_rgba(102,252,241,0.15)]"
            >
              <LogIn className="w-4 h-4" />
              <span>Giriş Yap</span>
            </a>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-4xl text-center z-10 mt-16 md:mt-0">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-[#c5c6c7] to-gray-500">
            Lutheus Yönetim
          </span>{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#66fcf1] to-purple-500">
            Merkezi
          </span>
        </h1>
        <p className="text-base md:text-lg text-[#c5c6c7] max-w-xl mx-auto mb-12 font-light leading-relaxed">
          Yapay zeka destekli moderasyon asistanınızı yönetin, ceza raporlarını anlık izleyin ve sunucu ayarlarını tek panelden kişiselleştirin.
        </p>

        {/* Section Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Card 1: Bot Dashboard */}
          <Link href="/bot" className="group">
            <div className="h-full bg-[#1f2833]/40 hover:bg-[#1f2833]/80 backdrop-blur-md p-8 rounded-2xl border border-[#2f3e46] hover:border-[#66fcf1]/50 transition-all duration-500 hover:shadow-[0_0_30px_rgba(102,252,241,0.15)] flex flex-col text-left relative overflow-hidden group-hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#66fcf1]/5 to-transparent rounded-bl-full pointer-events-none" />
              
              <div className="p-3 bg-[#1c2331] rounded-xl w-fit mb-6 border border-[#2f3e46] group-hover:border-[#66fcf1]/40 transition-colors duration-500">
                <Bot className="w-8 h-8 text-[#66fcf1]" />
              </div>

              <h2 className="text-2xl font-bold mb-3 text-white group-hover:text-[#66fcf1] transition-colors duration-300 flex items-center gap-2">
                <span>Bot Dashboard</span>
                <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
              </h2>
              
              <p className="text-sm text-[#c5c6c7] leading-relaxed mb-6 font-light">
                Gelişmiş moderasyon araçları, otomatik mesajlaşma, karşılama şablonları ve Discord bot özelliklerini sunucu bazlı yönetin.
              </p>

              <div className="mt-auto pt-4 flex items-center gap-2 text-xs font-semibold tracking-wider text-[#66fcf1] uppercase">
                <span>Paneli Yönet</span>
              </div>
            </div>
          </Link>

          {/* Card 2: Ceza Rapor Sistemi */}
          <Link href="/dashboard" className="group">
            <div className="h-full bg-[#1f2833]/40 hover:bg-[#1f2833]/80 backdrop-blur-md p-8 rounded-2xl border border-[#2f3e46] hover:border-purple-500/50 transition-all duration-500 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)] flex flex-col text-left relative overflow-hidden group-hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-purple-500/5 to-transparent rounded-bl-full pointer-events-none" />
              
              <div className="p-3 bg-[#1c2331] rounded-xl w-fit mb-6 border border-[#2f3e46] group-hover:border-purple-500/40 transition-colors duration-500">
                <ClipboardList className="w-8 h-8 text-purple-400" />
              </div>

              <h2 className="text-2xl font-bold mb-3 text-white group-hover:text-purple-400 transition-colors duration-300 flex items-center gap-2">
                <span>Ceza Rapor Sistemi</span>
                <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
              </h2>
              
              <p className="text-sm text-[#c5c6c7] leading-relaxed mb-6 font-light">
                Sunucunuzda gerçekleşen cezai işlemleri, kullanıcı raporlarını, itirazları ve detaylı istatistikleri canlı izleyin.
              </p>

              <div className="mt-auto pt-4 flex items-center gap-2 text-xs font-semibold tracking-wider text-purple-400 uppercase">
                <span>Sisteme Giriş</span>
              </div>
            </div>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="absolute bottom-6 text-xs text-gray-500 tracking-wider">
        &copy; {new Date().getFullYear()} Lutheus System. Tüm hakları saklıdır.
      </footer>
    </div>
  );
}

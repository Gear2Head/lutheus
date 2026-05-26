"use client";

// SECTION: APP_BOOTSTRAP
// PURPOSE: Topbar header component incorporating the GuildSwitcher and user details, mimicking the Sapphire style layout.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useBotDashboardStore } from "@/store/bot-dashboard-store";
import { getStoredSession, LutheusSession } from "@/lib/auth/session";
import { GuildSwitcher } from "./guild-switcher";
import { Shield, User, LogOut } from "lucide-react";

export function GuildTopbar() {
  const [session, setSession] = useState<LutheusSession | null>(null);
  const { isMockMode } = useBotDashboardStore();

  useEffect(() => {
    setSession(getStoredSession());
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("lutheusAuthSession");
    window.location.href = "/";
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-[#0b0c10]/90 backdrop-blur-md border-b border-[#2f3e46] flex items-center justify-between px-6 z-40">
      <div className="flex items-center gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="p-1 rounded-lg bg-gradient-to-tr from-[#66fcf1] to-purple-600 p-[1px]">
            <div className="bg-[#1f2833] p-1.5 rounded-[7px]">
              <Shield className="w-5 h-5 text-[#66fcf1]" />
            </div>
          </div>
          <span className="text-base font-bold tracking-wider text-white hidden sm:block">
            LUTHEUS
          </span>
        </Link>

        {/* Guild Picker */}
        <GuildSwitcher />
      </div>

      <div className="flex items-center gap-4">
        {/* Mock Indicator */}
        {isMockMode && (
          <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold rounded-full">
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping" />
            Lokal / Mock Modu
          </span>
        )}

        {/* User Info / Profile */}
        {session ? (
          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <p className="text-xs font-semibold text-white">
                {session.user?.displayName || "Kullanıcı"}
              </p>
              <span className="text-[9px] text-[#66fcf1] font-medium uppercase tracking-wider">
                Yönetici
              </span>
            </div>
            
            <div className="relative group">
              <button className="flex items-center gap-2 focus:outline-none">
                {session.user?.photoURL ? (
                  <img
                    src={session.user.photoURL}
                    alt="Profile"
                    className="w-8 h-8 rounded-full border border-[#66fcf1]/30 hover:border-[#66fcf1] transition-all"
                  />
                ) : (
                  <div className="w-8 h-8 bg-[#1f2833] flex items-center justify-center rounded-full border border-[#66fcf1]/30 hover:border-[#66fcf1] transition-all">
                    <User className="w-4 h-4 text-[#66fcf1]" />
                  </div>
                )}
              </button>

              {/* Minimal hover dropdown */}
              <div className="absolute right-0 mt-2 w-48 bg-[#1f2833] border border-[#2f3e46] rounded-xl shadow-xl overflow-hidden hidden group-hover:block z-50">
                <div className="px-4 py-2.5 border-b border-[#2f3e46] text-xs text-[#c5c6c7]">
                  {session.user?.email || "oturum aktif"}
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold text-red-400 hover:bg-[#1c2331] transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Çıkış Yap</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <a
            href="/auth/login.html"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1f2833] text-xs font-semibold text-[#66fcf1] border border-[#2f3e46] hover:border-[#66fcf1]/40 transition-colors"
          >
            Giriş Yap
          </a>
        )}
      </div>
    </header>
  );
}

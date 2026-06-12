"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStoredSession, LutheusSession } from "@/lib/auth/session";
import { ArrowRight, ExternalLink, LogOut } from "lucide-react";

export default function RootWelcomePage() {
  const [session, setSession] = useState<LutheusSession | null>(null);
  const [userCount, setUserCount] = useState<number>(37);

  useEffect(() => {
    setSession(getStoredSession());

    // Fetch dynamic staff count from Supabase
    async function fetchCount() {
      try {
        const res = await fetch("https://jxhzhaqqtlynbnntwpyu.supabase.co/rest/v1/staff_profiles?select=id", {
          headers: {
            apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4aHpoYXFxdGx5bmJubnR3cHl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NjMyMTcsImV4cCI6MjA5NTIzOTIxN30.BrmuT-QX_BkgV6SSlpNThfqSGmUDw0UffUW11agaBzI"
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setUserCount(data.length);
          }
        }
      } catch (e) {
        console.warn("Failed to fetch dynamic staff count:", e);
      }
    }
    fetchCount();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("lutheusAuthSession");
    setSession(null);
    window.location.reload();
  };

  return (
    <div className="relative min-h-screen bg-[#050508] flex flex-col items-center justify-center p-6 overflow-hidden selection:bg-[#3B82F6]/30 selection:text-white">
      
      {/* Premium Ambient Glows */}
      <div className="absolute top-[-30%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[#3B82F6]/10 blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-30%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[#1D4ED8]/8 blur-[160px] pointer-events-none" />

      {/* Welcome Title and Hero Section */}
      <main className="w-full max-w-4xl text-center z-10 px-4 flex flex-col items-center justify-center space-y-6">
        
        {/* Stylized Blue L Logo */}
        <div className="flex flex-col items-center space-y-2 mb-2">
          <svg className="w-16 h-16 filter drop-shadow-[0_0_12px_rgba(59,130,246,0.5)]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M48 15 H58 L38 65 H65 L61 75 H25 Z" fill="url(#blue-gradient)" />
            <defs>
              <linearGradient id="blue-gradient" x1="25" y1="15" x2="65" y2="75" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#1D4ED8" />
              </linearGradient>
            </defs>
          </svg>
          
          <span className="text-[11.5px] font-black tracking-[0.25em] text-white/90 font-mono">
            LUTHEUS <span className="text-white/45">MANAGE</span>
          </span>
        </div>
        
        {/* Hero Headings */}
        <div className="space-y-4 max-w-xl">
          <h1 className="text-4xl md:text-[46px] font-black tracking-tight text-white leading-tight">
            Lutheus'un omurgası.
          </h1>
          
          <p className="text-xs md:text-sm text-white/50 max-w-md mx-auto font-semibold leading-relaxed">
            Kullanıcılar ve yetkililer için kapsamlı moderasyon paneli. Devam etmek için giriş yapın.
          </p>
        </div>

        {/* CTA Buttons Container */}
        <div className="flex flex-row items-center gap-3.5 pt-3">
          {session ? (
            <div className="flex flex-col sm:flex-row items-center gap-3.5">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-xs font-bold text-white transition-all duration-300 hover:shadow-[0_0_25px_rgba(59,130,246,0.4)] border-none"
              >
                <span>Paneli Yönet</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-xs font-bold text-white/70 hover:text-white transition-all duration-300 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Çıkış Yap</span>
              </button>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>

        {/* Dynamic Registered Users Count */}
        <div className="pt-8 border-t border-white/[0.04] w-48 mx-auto">
          <span className="text-[11.5px] font-semibold text-white/35 font-mono">
            <strong className="text-white/80 font-black font-sans">{userCount}</strong> kayıtlı kullanıcı Lutheus'ta
          </span>
        </div>

      </main>

    </div>
  );
}

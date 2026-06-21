"use client";

import React from "react";
import { Hammer, Shield, AlertTriangle } from "lucide-react";

export default function MaintenancePage() {
  return (
    <div className="relative min-h-screen bg-[#050508] flex flex-col items-center justify-center p-6 overflow-hidden selection:bg-[#FF453A]/30 selection:text-white">
      {/* Ambient Premium Glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#FF453A]/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[#FF9F0A]/5 blur-[130px] pointer-events-none" />

      {/* Main Content Container */}
      <div className="relative max-w-lg w-full bg-white/[0.02] border border-white/[0.06] rounded-3xl p-8 md:p-10 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center z-15">
        {/* Animated Icon Glow */}
        <div className="relative w-20 h-20 bg-gradient-to-tr from-[#FF453A]/20 to-[#FF9F0A]/20 rounded-2xl flex items-center justify-center mb-6 border border-white/10 shadow-[0_0_30px_rgba(255,69,58,0.2)]">
          <Hammer className="w-10 h-10 text-[#FF453A] animate-pulse" />
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#FF9F0A] rounded-full border-2 border-[#050508] flex items-center justify-center">
            <Shield className="w-3 h-3 text-black" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-3 uppercase font-mono">
          Bakım Modu Aktif
        </h1>

        {/* Subtitle */}
        <p className="text-sm text-[#8E8E93] leading-relaxed mb-6 max-w-sm">
          Lutheus siber güvenlik duvarları ve sistem altyapısı şu anda güncellenmektedir. Lütfen daha sonra tekrar deneyiniz.
        </p>

        {/* Info Grid */}
        <div className="w-full grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white/[0.01] border border-white/[0.04] rounded-2xl p-4 flex flex-col items-center justify-center">
            <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest font-bold mb-1">Durum</span>
            <span className="text-[12px] font-bold text-[#FF453A] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF453A] animate-ping" />
              Çevrimdışı
            </span>
          </div>
          <div className="bg-white/[0.01] border border-white/[0.04] rounded-2xl p-4 flex flex-col items-center justify-center">
            <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest font-bold mb-1">Kapsam</span>
            <span className="text-[12px] font-bold text-white/80">Monorepo & DB</span>
          </div>
        </div>

        {/* Warning Callout */}
        <div className="w-full bg-[#FF453A]/5 border border-[#FF453A]/15 rounded-2xl p-4 flex items-start gap-3 text-left">
          <AlertTriangle className="w-5 h-5 text-[#FF453A] shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-white">Siber Güvenlik Bildirimi</h4>
            <p className="text-[11px] text-[#8E8E93] leading-relaxed">
              Veri bütünlüğü ve erişim sınırlandırma protokolleri kapsamında tüm dashboard ve istemci erişimleri geçici olarak askıya alınmıştır.
            </p>
          </div>
        </div>
      </div>

      {/* Decorative footer */}
      <div className="mt-8 text-center z-10">
        <span className="text-[10px] font-mono tracking-widest text-white/20 uppercase">
          Lutheus Cyber Fortress &copy; {new Date().getFullYear()}
        </span>
      </div>
    </div>
  );
}

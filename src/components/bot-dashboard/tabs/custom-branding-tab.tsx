"use client";

// SECTION: THEME_SYSTEM
// PURPOSE: Custom bot identity controls, avatar replacements, and bot client naming settings.

import { useBotDashboardStore } from "@/store/bot-dashboard-store";
import { Sparkles, HelpCircle } from "lucide-react";

export default function CustomBrandingPage() {
  const { config } = useBotDashboardStore();

  if (!config) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="border-b border-[#2f3e46] pb-5">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-[#66fcf1]" />
          <span>Custom Branding (Özel Markalama)</span>
        </h1>
        <p className="text-xs text-[#c5c6c7] font-light mt-1">
          Lutheus botunun ismini, profil resmini ve sunucuya özel embed renk paletlerini özelleştirin.
        </p>
      </div>

      <div className="h-64 flex flex-col items-center justify-center p-8 bg-[#1f2833]/10 border border-[#2f3e46]/40 rounded-2xl text-center">
        <HelpCircle className="w-12 h-12 text-gray-600 mb-3" />
        <h3 className="text-sm font-bold text-gray-400">Branding Özellikleri Kurucu Paketine Dahildir</h3>
        <p className="text-xs text-gray-500 font-light mt-1 max-w-sm">
          Bu sunucu şu anda temel plandadır. Bot ismini ve avatarını değiştirmek için kurucu rolüne sahip olmanız gerekmektedir.
        </p>
      </div>
    </div>
  );
}

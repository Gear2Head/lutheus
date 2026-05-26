"use client";

// SECTION: STATE_STORE
// PURPOSE: Template list and text editors for custom bot messaging prompts.

import { useBotDashboardStore } from "@/store/bot-dashboard-store";
import { MessageSquare, HelpCircle, Plus } from "lucide-react";

export default function CustomMessagesPage() {
  const { config } = useBotDashboardStore();

  if (!config) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center justify-between border-b border-[#2f3e46] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-[#66fcf1]" />
            <span>Custom Messages (Otomatik Mesajlar)</span>
          </h1>
          <p className="text-xs text-[#c5c6c7] font-light mt-1">
            Sunucudaki belirli kelime veya tetikleyicilere botun vereceği otomatik özel yanıtları programlayın.
          </p>
        </div>

        <button className="flex items-center gap-1.5 px-4 py-2 bg-[#66fcf1] text-[#0b0c10] font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-[#45f3ff] transition-all">
          <Plus className="w-4 h-4" />
          <span>Yeni Yanıt Ekle</span>
        </button>
      </div>

      <div className="h-64 flex flex-col items-center justify-center p-8 bg-[#1f2833]/10 border border-[#2f3e46]/40 rounded-2xl text-center">
        <HelpCircle className="w-12 h-12 text-gray-600 mb-3" />
        <h3 className="text-sm font-bold text-gray-400">Otomatik Mesaj Şablonu Bulunmuyor</h3>
        <p className="text-xs text-gray-500 font-light mt-1 max-w-sm">
          Sağ üst köşedeki "Yeni Yanıt Ekle" butonuna basarak ilk otomatik mesaj tetikleyicinizi oluşturabilirsiniz.
        </p>
      </div>
    </div>
  );
}

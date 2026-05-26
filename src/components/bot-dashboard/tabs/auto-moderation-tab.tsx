"use client";

// SECTION: ROLE_GUARDS
// PURPOSE: Anti-spam, link protection, invite protection, bad words, and mention limit configurations.

import { useBotDashboardStore } from "@/store/bot-dashboard-store";
import { ShieldAlert, HelpCircle } from "lucide-react";

export default function AutoModerationPage() {
  const { config, updateConfig } = useBotDashboardStore();

  if (!config) return null;

  const handleToggle = () => {
    updateConfig((prev) => ({
      ...prev,
      modules: { ...prev.modules, autoModeration: !prev.modules.autoModeration },
    }));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center justify-between border-b border-[#2f3e46] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-[#66fcf1]" />
            <span>Yapay Zeka Destekli Otomatik Moderasyon</span>
          </h1>
          <p className="text-xs text-[#c5c6c7] font-light mt-1">
            Küfür, reklam, spam, link veya büyük harf spamlerini yapay zeka entegrasyonu ile otomatik engelleyin.
          </p>
        </div>

        <button
          onClick={handleToggle}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
            config.modules.autoModeration
              ? "bg-[#66fcf1]/10 text-[#66fcf1] border border-[#66fcf1]/30 shadow-[0_0_15px_rgba(102,252,241,0.05)]"
              : "bg-[#1f2833]/40 text-gray-500 border border-[#2f3e46]"
          }`}
        >
          {config.modules.autoModeration ? "Modül Aktif" : "Modül Devre Dışı"}
        </button>
      </div>

      {config.modules.autoModeration ? (
        <div className="bg-[#1f2833]/40 border border-[#2f3e46] p-6 rounded-2xl space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-4 bg-[#1c2331]/50 border border-[#2f3e46]/60 rounded-xl flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">Küfür & Hakaret Filtresi</h4>
                <p className="text-[10px] text-gray-500 font-light mt-0.5">Yapay zeka kelime haznesi ile küfürleri sansürler.</p>
              </div>
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded text-[#66fcf1]" />
            </div>

            <div className="p-4 bg-[#1c2331]/50 border border-[#2f3e46]/60 rounded-xl flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">Spam Engelleme</h4>
                <p className="text-[10px] text-gray-500 font-light mt-0.5">Arka arkaya hızlı mesaj gönderimlerini engeller.</p>
              </div>
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded text-[#66fcf1]" />
            </div>

            <div className="p-4 bg-[#1c2331]/50 border border-[#2f3e46]/60 rounded-xl flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">Link Engelleme</h4>
                <p className="text-[10px] text-gray-500 font-light mt-0.5">Yetkisiz üyelerin link paylaşmasını önler.</p>
              </div>
              <input type="checkbox" className="w-4 h-4 rounded text-[#66fcf1]" />
            </div>

            <div className="p-4 bg-[#1c2331]/50 border border-[#2f3e46]/60 rounded-xl flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">Büyük Harf Engeli (Caps Lock)</h4>
                <p className="text-[10px] text-gray-500 font-light mt-0.5">Aşırı büyük harf kullanımını otomatik siler.</p>
              </div>
              <input type="checkbox" className="w-4 h-4 rounded text-[#66fcf1]" />
            </div>
          </div>
        </div>
      ) : (
        <div className="h-64 flex flex-col items-center justify-center p-8 bg-[#1f2833]/10 border border-[#2f3e46]/40 rounded-2xl text-center">
          <HelpCircle className="w-12 h-12 text-gray-600 mb-3" />
          <h3 className="text-sm font-bold text-gray-400">Otomatik Moderasyon Modülü Kapalı</h3>
          <p className="text-xs text-gray-500 font-light mt-1 max-w-sm">
            Ayarları değiştirebilmek için sağ üst köşeden "Modülü Aktif" butonuna basarak aktifleştirin.
          </p>
        </div>
      )}
    </div>
  );
}

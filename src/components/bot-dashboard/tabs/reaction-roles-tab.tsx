"use client";

// SECTION: ROLE_GUARDS
// PURPOSE: Setup reaction-based role toggling panels and emojis mappings.

import { useBotDashboardStore } from "@/store/bot-dashboard-store";
import { Smile, HelpCircle, Plus } from "lucide-react";

export default function ReactionRolesPage() {
  const { config, updateConfig } = useBotDashboardStore();

  if (!config) return null;

  const handleToggle = () => {
    updateConfig((prev) => ({
      ...prev,
      modules: { ...prev.modules, reactionRoles: !prev.modules.reactionRoles },
    }));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center justify-between border-b border-[#2f3e46] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Smile className="w-6 h-6 text-[#66fcf1]" />
            <span>Reaction Roles (Tepki Rolleri)</span>
          </h1>
          <p className="text-xs text-[#c5c6c7] font-light mt-1">
            Kullanıcıların mesajlara reaksiyon (emoji) bırakarak kendi rollerini alıp bırakabilmelerini sağlayan paneller kurun.
          </p>
        </div>

        <button
          onClick={handleToggle}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
            config.modules.reactionRoles
              ? "bg-[#66fcf1]/10 text-[#66fcf1] border border-[#66fcf1]/30 shadow-[0_0_15px_rgba(102,252,241,0.05)]"
              : "bg-[#1f2833]/40 text-gray-500 border border-[#2f3e46]"
          }`}
        >
          {config.modules.reactionRoles ? "Modül Aktif" : "Modül Devre Dışı"}
        </button>
      </div>

      {config.modules.reactionRoles ? (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button className="flex items-center gap-1.5 px-4 py-2 bg-[#66fcf1] text-[#0b0c10] font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-[#45f3ff] transition-all">
              <Plus className="w-4 h-4" />
              <span>Yeni Reaksiyon Paneli Ekle</span>
            </button>
          </div>

          <div className="h-64 flex flex-col items-center justify-center p-8 bg-[#1f2833]/10 border border-[#2f3e46]/40 rounded-2xl text-center">
            <Smile className="w-12 h-12 text-gray-600 mb-3" />
            <h3 className="text-sm font-bold text-gray-400">Tepki Rolü Paneli Bulunmuyor</h3>
            <p className="text-xs text-gray-500 font-light mt-1 max-w-sm">
              İlk tepki rol paneli şablonunuzu oluşturmak için yukarıdaki "Yeni Reaksiyon Paneli Ekle" butonunu kullanabilirsiniz.
            </p>
          </div>
        </div>
      ) : (
        <div className="h-64 flex flex-col items-center justify-center p-8 bg-[#1f2833]/10 border border-[#2f3e46]/40 rounded-2xl text-center">
          <HelpCircle className="w-12 h-12 text-gray-600 mb-3" />
          <h3 className="text-sm font-bold text-gray-400">Reaction Roles Modülü Kapalı</h3>
          <p className="text-xs text-gray-500 font-light mt-1 max-w-sm">
            Ayarları değiştirebilmek için sağ üst köşeden "Modülü Aktif" butonuna basarak aktifleştirin.
          </p>
        </div>
      )}
    </div>
  );
}

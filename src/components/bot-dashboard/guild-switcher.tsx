"use client";

// SECTION: USER_PROFILE
// PURPOSE: Guild switcher dropdown mimicking the Sapphire dashboard server picker UI.

import { useState, useRef, useEffect } from "react";
import { useBotDashboardStore } from "@/store/bot-dashboard-store";
import { ChevronDown, Plus, Shield } from "lucide-react";

export function GuildSwitcher() {
  const { guilds, selectedGuild, selectGuild } = useBotDashboardStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const manageableGuilds = guilds.filter(g => g.manageable);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-64 px-4 py-3 bg-[#1c2331]/80 hover:bg-[#1c2331] rounded-xl border border-[#2f3e46] text-left transition-all duration-300 focus:outline-none focus:border-[#66fcf1]"
      >
        <div className="flex items-center gap-3">
          {selectedGuild?.iconUrl ? (
            <img
              src={selectedGuild.iconUrl}
              alt={selectedGuild.name}
              className="w-8 h-8 rounded-lg object-cover border border-[#66fcf1]/30"
            />
          ) : (
            <div className="w-8 h-8 bg-[#1f2833] flex items-center justify-center rounded-lg border border-[#66fcf1]/30">
              <Shield className="w-4 h-4 text-[#66fcf1]" />
            </div>
          )}
          <div className="truncate">
            <h4 className="text-sm font-semibold text-white truncate max-w-[150px]">
              {selectedGuild?.name || "Sunucu Seçin"}
            </h4>
            <span className="text-[10px] text-[#66fcf1] font-medium tracking-wider uppercase">
              {selectedGuild?.botInstalled ? "Aktif" : "Kurulum Gerekli"}
            </span>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-64 bg-[#1f2833] border border-[#2f3e46] rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in-50 slide-in-from-top-1 duration-200">
          <div className="px-3 py-2 border-b border-[#2f3e46] text-xs font-semibold text-gray-400">
            Sunucularınız
          </div>
          <div className="max-h-64 overflow-y-auto">
            {manageableGuilds.length === 0 ? (
              <div className="px-4 py-3 text-xs text-gray-400 italic">
                Yönetilebilir sunucu bulunamadı.
              </div>
            ) : (
              manageableGuilds.map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    selectGuild(g.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#1c2331] transition-colors duration-200 border-b border-[#2f3e46]/30 last:border-0 ${
                    selectedGuild?.id === g.id ? "bg-[#1c2331]/50 border-l-2 border-l-[#66fcf1]" : ""
                  }`}
                >
                  {g.iconUrl ? (
                    <img
                      src={g.iconUrl}
                      alt={g.name}
                      className="w-7 h-7 rounded-md object-cover"
                    />
                  ) : (
                    <div className="w-7 h-7 bg-[#1c2331] flex items-center justify-center rounded-md text-xs font-bold text-[#66fcf1]">
                      {g.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="truncate flex-1">
                    <p className="text-xs font-semibold text-white truncate">{g.name}</p>
                    <span className="text-[9px] text-[#c5c6c7] font-light">
                      {g.botInstalled ? "Bot Ekli" : "Kurulum Bekliyor"}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
          <a
            href={`https://discord.com/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || "1500551629768888542"}&permissions=8&scope=bot%20applications.commands`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#1c2331] text-xs font-semibold text-[#66fcf1] hover:text-white border-t border-[#2f3e46] transition-colors duration-200"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Sunucu Ekle</span>
          </a>
        </div>
      )}
    </div>
  );
}

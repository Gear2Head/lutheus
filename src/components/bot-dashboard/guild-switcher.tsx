"use client";

// SECTION: USER_PROFILE
// PURPOSE: Compact guild switcher with polished dropdown, refined borders and smooth transitions.

import { useState, useRef, useEffect } from "react";
import { useBotDashboardStore } from "@/store/bot-dashboard-store";
import { ChevronDown, Plus, Shield, Check } from "lucide-react";

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

  const manageableGuilds = guilds.filter((g) => g.manageable);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all duration-150 focus:outline-none"
        style={{
          background: isOpen ? "var(--surface-hover)" : "var(--surface-solid)",
          border: isOpen ? "1px solid var(--border-accent)" : "1px solid var(--border)",
          maxWidth: "210px",
        }}
      >
        {/* Guild Icon */}
        {selectedGuild?.iconUrl ? (
          <img
            src={selectedGuild.iconUrl}
            alt={selectedGuild.name}
            className="w-5 h-5 rounded-md object-cover shrink-0"
          />
        ) : (
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
            style={{ background: "var(--accent-dim)" }}
          >
            <Shield className="w-3 h-3" style={{ color: "var(--accent)" }} />
          </div>
        )}

        {/* Guild Name */}
        <div className="truncate flex-1 text-left hidden sm:block">
          <span
            className="text-[12px] font-semibold truncate block"
            style={{ color: "var(--text-main)" }}
          >
            {selectedGuild?.name || "Sunucu Seçin"}
          </span>
        </div>

        <ChevronDown
          className="w-3.5 h-3.5 shrink-0 transition-transform duration-200"
          style={{
            color: "var(--text-muted)",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="absolute left-0 mt-2 w-56 rounded-2xl overflow-hidden z-50 animate-fade-in"
            style={{
              background: "rgba(10, 14, 20, 0.96)",
              backdropFilter: "blur(20px)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            {/* Header */}
            <div
              className="px-3 py-2"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <p className="text-[10px] font-bold tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>
                Sunucularınız
              </p>
            </div>

            {/* Guild List */}
            <div className="max-h-60 overflow-y-auto hide-scrollbar">
              {manageableGuilds.length === 0 ? (
                <div className="px-4 py-4 text-[12px] text-center" style={{ color: "var(--text-muted)" }}>
                  Yönetilebilir sunucu bulunamadı.
                </div>
              ) : (
                manageableGuilds.map((g) => {
                  const isSelected = selectedGuild?.id === g.id;
                  return (
                    <button
                      key={g.id}
                      onClick={() => {
                        selectGuild(g.id);
                        setIsOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150"
                      style={{
                        background: isSelected ? "var(--accent-dim)" : "transparent",
                        borderBottom: "1px solid var(--border-soft)",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected)
                          (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-hover)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected)
                          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                      }}
                    >
                      {g.iconUrl ? (
                        <img
                          src={g.iconUrl}
                          alt={g.name}
                          className="w-7 h-7 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold"
                          style={{
                            background: "var(--surface-solid)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {g.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[12px] font-semibold truncate"
                          style={{ color: isSelected ? "var(--accent)" : "var(--text-main)" }}
                        >
                          {g.name}
                        </p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {g.botInstalled ? "Bot Ekli" : "Kurulum Bekliyor"}
                        </p>
                      </div>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent)" }} />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Add Server */}
            <a
              href={`https://discord.com/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || "1500551629768888542"}&permissions=8&scope=bot%20applications.commands`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-4 py-3 text-[12px] font-semibold transition-colors duration-150"
              style={{
                borderTop: "1px solid var(--border)",
                color: "var(--accent)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "var(--accent-dim)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Yeni Sunucu Ekle</span>
            </a>
          </div>
        </>
      )}
    </div>
  );
}

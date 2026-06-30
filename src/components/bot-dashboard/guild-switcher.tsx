"use client";

import { useState, useRef, useEffect } from "react";
import { useBotDashboardStore } from "@/store/bot-dashboard-store";
import { ChevronDown, Plus, Shield, Check } from "lucide-react";

export function GuildSwitcher() {
  const { guilds, selectedGuild, selectGuild } = useBotDashboardStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const manageableGuilds = guilds.filter((g) => g.manageable);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* ── Trigger ── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 focus:outline-none transition-all duration-150"
        style={{
          height: "34px",
          paddingInline: "10px",
          background: isOpen ? "var(--surface-active)" : "var(--surface-02)",
          border: `1px solid ${isOpen ? "var(--border-strong)" : "var(--border)"}`,
          borderRadius: "var(--radius-md)",
          maxWidth: "220px",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-hover)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-02)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
          }
        }}
      >
        {/* Guild icon */}
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

        {/* Name */}
        <span
          className="hidden sm:block truncate flex-1 text-left"
          style={{
            fontSize: "12.5px",
            fontWeight: 600,
            color: "var(--text-primary)",
            maxWidth: "140px",
          }}
        >
          {selectedGuild?.name || "Sunucu Seçin"}
        </span>

        <ChevronDown
          className="shrink-0 transition-transform duration-200"
          style={{
            width: "13px",
            height: "13px",
            color: "var(--text-muted)",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {/* ── Dropdown ── */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div
            className="absolute left-0 mt-2 overflow-hidden z-50 animate-fade-in"
            style={{
              width: "230px",
              background: "rgba(14,14,18,0.97)",
              backdropFilter: "blur(20px)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "10px 14px 8px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <p
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.7px",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  margin: 0,
                }}
              >
                Sunucularınız
              </p>
            </div>

            {/* List */}
            <div
              className="hide-scrollbar"
              style={{ maxHeight: "240px", overflowY: "auto" }}
            >
              {manageableGuilds.length === 0 ? (
                <div
                  style={{
                    padding: "18px 14px",
                    fontSize: "12.5px",
                    color: "var(--text-muted)",
                    textAlign: "center",
                  }}
                >
                  Yönetilebilir sunucu bulunamadı.
                </div>
              ) : (
                manageableGuilds.map((g) => {
                  const isSel = selectedGuild?.id === g.id;
                  return (
                    <button
                      key={g.id}
                      onClick={() => { selectGuild(g.id); setIsOpen(false); }}
                      className="w-full flex items-center gap-3 text-left transition-colors duration-120 focus:outline-none"
                      style={{
                        padding: "9px 14px",
                        background: isSel ? "var(--accent-dim)" : "transparent",
                        borderBottom: "1px solid var(--border-soft)",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSel)
                          (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-hover)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isSel)
                          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                      }}
                    >
                      {/* Icon */}
                      {g.iconUrl ? (
                        <img
                          src={g.iconUrl}
                          alt={g.name}
                          className="w-7 h-7 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            background: "var(--surface-02)",
                            fontSize: "11px",
                            fontWeight: 700,
                            color: "var(--text-secondary)",
                          }}
                        >
                          {g.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            fontSize: "12.5px",
                            fontWeight: 600,
                            color: isSel ? "var(--accent)" : "var(--text-primary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            margin: 0,
                          }}
                        >
                          {g.name}
                        </p>
                        <p
                          style={{
                            fontSize: "10.5px",
                            color: "var(--text-muted)",
                            marginTop: "1px",
                          }}
                        >
                          {g.botInstalled ? "Bot Ekli" : "Kurulum Bekliyor"}
                        </p>
                      </div>

                      {isSel && (
                        <Check
                          style={{ width: "13px", height: "13px", color: "var(--accent)", flexShrink: 0 }}
                        />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Add server */}
            <a
              href={`https://discord.com/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || "1500551629768888542"}&permissions=8&scope=bot%20applications.commands`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 transition-colors duration-120"
              style={{
                borderTop: "1px solid var(--border)",
                padding: "11px 14px",
                fontSize: "12.5px",
                fontWeight: 600,
                color: "var(--accent)",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "var(--accent-dim)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
              }}
            >
              <Plus style={{ width: "13px", height: "13px" }} />
              <span>Yeni Sunucu Ekle</span>
            </a>
          </div>
        </>
      )}
    </div>
  );
}

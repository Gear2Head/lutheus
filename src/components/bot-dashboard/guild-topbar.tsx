"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStoredSession, LutheusSession } from "@/lib/auth/session";
import { GuildSwitcher } from "./guild-switcher";
import { Bell, LogOut, User, ChevronDown, Settings } from "lucide-react";

export function GuildTopbar() {
  const [session, setSession] = useState<LutheusSession | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    setSession(getStoredSession());
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("lutheusAuthSession");
    window.location.href = "/";
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between"
      style={{
        height: "var(--topbar-h)",
        paddingInline: "20px",
        background: "rgba(9,9,11,0.92)",
        backdropFilter: "blur(24px) saturate(1.6)",
        WebkitBackdropFilter: "blur(24px) saturate(1.6)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* ── Left: wordmark + guild switcher ── */}
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-2.5 shrink-0 group"
          style={{ textDecoration: "none" }}
        >
          <div
            className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center shrink-0"
            style={{
              background: "var(--accent-dim)",
              border: "1px solid var(--accent-border)",
            }}
          >
            <img
              src="/dashboard/icon128.png"
              className="w-4.5 h-4.5 object-contain"
              alt="Lutheus"
            />
          </div>
          <span
            className="text-[13px] font-bold tracking-tight hidden sm:block"
            style={{ color: "var(--text-primary)" }}
          >
            Lutheus
          </span>
        </Link>

        {/* vertical rule */}
        <div
          className="hidden sm:block h-4 w-px"
          style={{ background: "var(--border-strong)" }}
        />

        <GuildSwitcher />
      </div>

      {/* ── Right: actions + user ── */}
      <div className="flex items-center gap-1.5">
        {/* Notifications bell */}
        <button
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = "var(--surface-hover)";
            el.style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = "transparent";
            el.style.color = "var(--text-muted)";
          }}
          aria-label="Bildirimler"
        >
          <Bell className="w-4 h-4" />
        </button>

        {session ? (
          <div className="relative">
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 transition-colors duration-150 focus:outline-none"
              style={{
                background: dropdownOpen ? "var(--surface-active)" : "transparent",
                border: `1px solid ${dropdownOpen ? "var(--border-strong)" : "transparent"}`,
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                if (!dropdownOpen) {
                  el.style.background = "var(--surface-hover)";
                  el.style.borderColor = "var(--border)";
                }
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                if (!dropdownOpen) {
                  el.style.background = "transparent";
                  el.style.borderColor = "transparent";
                }
              }}
            >
              {/* Avatar */}
              {session.user?.photoURL ? (
                <img
                  src={session.user.photoURL}
                  alt="Profil"
                  className="w-6 h-6 rounded-full object-cover shrink-0"
                  style={{ border: "1.5px solid var(--accent-border)" }}
                />
              ) : (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "var(--accent-dim)", border: "1.5px solid var(--accent-border)" }}
                >
                  <User className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                </div>
              )}

              <div className="hidden md:flex flex-col items-start leading-none">
                <span
                  className="text-[12px] font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {session.user?.displayName?.split(" ")[0] || "Kullanıcı"}
                </span>
                <span
                  className="text-[10px] font-medium mt-0.5"
                  style={{ color: "var(--accent)" }}
                >
                  Yönetici
                </span>
              </div>

              <ChevronDown
                className="w-3.5 h-3.5 transition-transform duration-200 hidden md:block"
                style={{
                  color: "var(--text-muted)",
                  transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </button>

            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                <div
                  className="absolute right-0 mt-2 w-56 overflow-hidden z-50 animate-fade-in"
                  style={{
                    background: "rgba(14,14,18,0.97)",
                    backdropFilter: "blur(20px)",
                    border: "1px solid var(--border-strong)",
                    borderRadius: "var(--radius-lg)",
                    boxShadow: "var(--shadow-lg)",
                  }}
                >
                  {/* User header */}
                  <div
                    className="flex items-center gap-3 px-4 py-3.5"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    {session.user?.photoURL ? (
                      <img
                        src={session.user.photoURL}
                        alt="Profil"
                        className="w-8 h-8 rounded-full object-cover shrink-0"
                        style={{ border: "1.5px solid var(--accent-border)" }}
                      />
                    ) : (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: "var(--accent-dim)" }}
                      >
                        <User className="w-4 h-4" style={{ color: "var(--accent)" }} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p
                        className="text-[12.5px] font-semibold truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {session.user?.displayName || "Kullanıcı"}
                      </p>
                      <p
                        className="text-[11px] truncate mt-0.5"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {session.user?.email || "oturum aktif"}
                      </p>
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="py-1">
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-120"
                      style={{ color: "var(--text-secondary)" }}
                      onMouseEnter={(e) => {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.background = "var(--surface-hover)";
                        el.style.color = "var(--text-primary)";
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.background = "transparent";
                        el.style.color = "var(--text-secondary)";
                      }}
                    >
                      <Settings className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-[12.5px] font-medium">Profil Ayarları</span>
                    </button>

                    <div style={{ height: "1px", background: "var(--border-soft)", margin: "4px 0" }} />

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-120"
                      style={{ color: "var(--danger)" }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = "var(--danger-dim)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                      }}
                    >
                      <LogOut className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-[12.5px] font-semibold">Oturumu Kapat</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <a
            href="/auth/login.html"
            className="btn btn-primary text-[12px] px-4 py-1.5"
            style={{ borderRadius: "var(--radius-md)" }}
          >
            Giriş Yap
          </a>
        )}
      </div>
    </header>
  );
}

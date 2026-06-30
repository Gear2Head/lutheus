"use client";

// SECTION: APP_BOOTSTRAP
// PURPOSE: Topbar header — modern soft design with refined typography and glass surface.

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStoredSession, LutheusSession } from "@/lib/auth/session";
import { GuildSwitcher } from "./guild-switcher";
import { User, LogOut, ChevronDown } from "lucide-react";

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
      className="fixed top-0 left-0 right-0 h-14 z-40 flex items-center justify-between px-5"
      style={{
        background: "rgba(8, 10, 14, 0.88)",
        backdropFilter: "blur(20px) saturate(1.5)",
        WebkitBackdropFilter: "blur(20px) saturate(1.5)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Left: Logo + Guild Switcher */}
      <div className="flex items-center gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center bg-[var(--accent-dim)] border border-[var(--border-accent)]">
            <img
              src="/dashboard/icon128.png"
              className="w-5 h-5 object-contain"
              alt="Lutheus"
            />
          </div>
          <span
            className="text-[13px] font-semibold tracking-wide hidden sm:block"
            style={{ color: "var(--text-main)" }}
          >
            Lutheus
          </span>
          <span
            className="text-[11px] font-medium hidden md:block"
            style={{ color: "var(--text-muted)" }}
          >
            / Manage
          </span>
        </Link>

        {/* Divider */}
        <div
          className="hidden sm:block w-px h-5"
          style={{ background: "var(--border)" }}
        />

        {/* Guild Picker */}
        <GuildSwitcher />
      </div>

      {/* Right: User */}
      <div className="flex items-center gap-3">
        {session ? (
          <div className="relative">
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all duration-150"
              style={{
                background: dropdownOpen ? "var(--surface-hover)" : "transparent",
                border: "1px solid transparent",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-hover)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
              }}
              onMouseLeave={(e) => {
                if (!dropdownOpen) {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent";
                }
              }}
            >
              {/* Avatar */}
              {session.user?.photoURL ? (
                <img
                  src={session.user.photoURL}
                  alt="Profil"
                  className="w-6 h-6 rounded-full object-cover"
                  style={{ border: "1.5px solid var(--border-accent)" }}
                />
              ) : (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{
                    background: "var(--accent-dim)",
                    border: "1.5px solid var(--border-accent)",
                  }}
                >
                  <User className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                </div>
              )}

              {/* Name */}
              <div className="text-left hidden md:block">
                <p className="text-[12px] font-semibold leading-tight" style={{ color: "var(--text-main)" }}>
                  {session.user?.displayName || "Kullanıcı"}
                </p>
                <p className="text-[10px] font-medium leading-tight" style={{ color: "var(--accent)" }}>
                  Yönetici
                </p>
              </div>

              <ChevronDown
                className="w-3.5 h-3.5 transition-transform duration-200 hidden md:block"
                style={{
                  color: "var(--text-muted)",
                  transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </button>

            {/* Dropdown */}
            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setDropdownOpen(false)}
                />
                <div
                  className="absolute right-0 mt-2 w-56 rounded-2xl overflow-hidden z-50 animate-fade-in"
                  style={{
                    background: "rgba(12, 16, 24, 0.95)",
                    backdropFilter: "blur(20px)",
                    border: "1px solid var(--border)",
                    boxShadow: "var(--shadow-lg)",
                  }}
                >
                  {/* User info */}
                  <div
                    className="px-4 py-3"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <p className="text-[12px] font-semibold" style={{ color: "var(--text-main)" }}>
                      {session.user?.displayName || "Kullanıcı"}
                    </p>
                    <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                      {session.user?.email || "oturum aktif"}
                    </p>
                  </div>

                  {/* Logout */}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors duration-150"
                    style={{ color: "var(--danger)" }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLButtonElement).style.background = "var(--danger-dim)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLButtonElement).style.background = "transparent")
                    }
                  >
                    <LogOut className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[12px] font-semibold">Oturumu Kapat</span>
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <a
            href="/auth/login.html"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold transition-all duration-150"
            style={{
              background: "var(--accent-dim)",
              color: "var(--accent)",
              border: "1px solid var(--border-accent)",
            }}
          >
            Giriş Yap
          </a>
        )}
      </div>
    </header>
  );
}

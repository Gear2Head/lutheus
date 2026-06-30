"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useBotDashboardStore } from "@/store/bot-dashboard-store";
import { GuildSidebar } from "./guild-sidebar";
import { GuildTopbar } from "./guild-topbar";
import { DirtySaveBar } from "./dirty-save-bar";
import { Loader2, AlertCircle, ServerOff, CheckCircle, Info } from "lucide-react";
import { getStoredSession } from "@/lib/auth/session";

interface ShellProps {
  children: React.ReactNode;
}

export function BotDashboardShell({ children }: ShellProps) {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    const session = getStoredSession();
    if (!session?.idToken) {
      router.push("/auth/login.html");
      return;
    }
    const role = session.role?.toLowerCase() || "";
    const isMgmt = [
      "kurucu", "admin", "yonetici", "genel_sorumlu",
      "discord_yoneticisi", "kidemli", "kidemli_discord_moderatoru", "senior_moderator",
    ].includes(role);
    if (!isMgmt) {
      router.push("/dashboard");
      return;
    }
  }, [router]);

  const {
    fetchGuilds,
    selectGuild,
    selectedGuild,
    isGuildsLoading,
    isConfigLoading,
    loadError,
    sidebarCollapsed,
    toast,
  } = useBotDashboardStore();

  const guildId = params.guildId as string;

  useEffect(() => {
    fetchGuilds();
  }, [fetchGuilds]);

  useEffect(() => {
    if (guildId && guildId !== "default" && selectedGuild?.id !== guildId) {
      selectGuild(guildId);
    }
  }, [guildId, selectedGuild, selectGuild]);

  const isLoading = isGuildsLoading || isConfigLoading;
  const sidebarWidth = sidebarCollapsed ? 60 : 240;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg)", color: "var(--text-primary)" }}
    >
      <GuildTopbar />

      <div className="flex flex-1" style={{ paddingTop: "var(--topbar-h)" }}>
        <GuildSidebar />

        <main
          className="flex-1 min-h-[calc(100vh-56px)] transition-[margin] duration-250"
          style={{
            marginLeft: `${sidebarWidth}px`,
            padding: "32px 36px 96px",
            background: "var(--bg-elevated)",
          }}
        >
          {isLoading ? (
            /* ── Loading ── */
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: "var(--accent-dim)", border: "1px solid var(--accent-border)" }}
              >
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--accent)" }} />
              </div>
              <div className="text-center">
                <p
                  className="text-[13.5px] font-semibold"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Sunucu verileri yükleniyor
                </p>
                <p className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>
                  Lütfen bekleyin...
                </p>
              </div>
            </div>
          ) : loadError ? (
            /* ── Error ── */
            <div className="max-w-sm mx-auto mt-24 text-center animate-fade-in">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: "var(--danger-dim)", border: "1px solid var(--danger-border)" }}
              >
                <AlertCircle className="w-6 h-6" style={{ color: "var(--danger)" }} />
              </div>
              <h2
                className="text-[17px] font-bold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                Yükleme Hatası
              </h2>
              <p
                className="text-[12.5px] leading-relaxed mb-6"
                style={{ color: "var(--text-muted)" }}
              >
                {loadError}
              </p>
              <button
                onClick={() => fetchGuilds()}
                className="btn btn-ghost text-[13px]"
              >
                Yeniden Dene
              </button>
            </div>
          ) : !selectedGuild ? (
            /* ── No guild ── */
            <div className="max-w-sm mx-auto mt-24 text-center animate-fade-in">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: "var(--accent-dim)", border: "1px solid var(--accent-border)" }}
              >
                <ServerOff className="w-6 h-6" style={{ color: "var(--accent)" }} />
              </div>
              <h2
                className="text-[17px] font-bold mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                Sunucu Seçilmedi
              </h2>
              <p
                className="text-[12.5px] leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                Yönetmek istediğiniz Discord sunucusunu üstteki menüden seçin.
              </p>
            </div>
          ) : (
            <div className="w-full max-w-[1100px] mx-auto animate-fade-in">
              {children}
            </div>
          )}
        </main>
      </div>

      <DirtySaveBar />

      {/* ── Toast notification ── */}
      {toast.visible && (
        <div
          className="fixed top-[68px] right-5 flex items-center gap-3 z-50 animate-slide-right"
          style={{
            background: "rgba(14,14,18,0.96)",
            backdropFilter: "blur(20px)",
            border: `1px solid ${
              toast.type === "success"
                ? "var(--success-border)"
                : toast.type === "error"
                ? "var(--danger-border)"
                : "var(--info-border)"
            }`,
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-lg)",
            padding: "12px 16px",
            minWidth: "220px",
            maxWidth: "340px",
          }}
        >
          {toast.type === "success" ? (
            <CheckCircle className="w-4 h-4 shrink-0" style={{ color: "var(--success)" }} />
          ) : toast.type === "error" ? (
            <AlertCircle className="w-4 h-4 shrink-0" style={{ color: "var(--danger)" }} />
          ) : (
            <Info className="w-4 h-4 shrink-0" style={{ color: "var(--info)" }} />
          )}
          <span
            className="text-[12.5px] font-medium leading-snug"
            style={{ color: "var(--text-secondary)" }}
          >
            {toast.message}
          </span>
        </div>
      )}
    </div>
  );
}

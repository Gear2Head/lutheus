"use client";

// SECTION: APP_BOOTSTRAP
// PURPOSE: Full-page layout shell — topbar + sidebar + main content with smooth transitions and modern loading/error states.

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useBotDashboardStore } from "@/store/bot-dashboard-store";
import { GuildSidebar } from "./guild-sidebar";
import { GuildTopbar } from "./guild-topbar";
import { DirtySaveBar } from "./dirty-save-bar";
import { Loader2, AlertCircle, ServerOff } from "lucide-react";
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
  const sidebarWidth = sidebarCollapsed ? 56 : 228;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg)", color: "var(--text-main)" }}
    >
      <GuildTopbar />

      <div className="flex flex-1 pt-14">
        <GuildSidebar />

        <main
          className="flex-1 min-h-[calc(100vh-56px)] transition-all duration-300"
          style={{
            marginLeft: sidebarWidth,
            padding: "28px 32px 80px",
          }}
        >
          {isLoading ? (
            /* Loading state */
            <div className="w-full h-full min-h-[60vh] flex flex-col items-center justify-center gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)" }}
              >
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--accent)" }} />
              </div>
              <div className="text-center">
                <p
                  className="text-[13px] font-semibold"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Sunucu verileri yükleniyor
                </p>
                <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                  Lütfen bekleyin...
                </p>
              </div>
            </div>
          ) : loadError ? (
            /* Error state */
            <div className="max-w-sm mx-auto mt-24 text-center animate-fade-in">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: "var(--danger-dim)", border: "1px solid rgba(248,113,113,0.25)" }}
              >
                <AlertCircle className="w-6 h-6" style={{ color: "var(--danger)" }} />
              </div>
              <h2
                className="text-[16px] font-bold mb-2"
                style={{ color: "var(--text-main)" }}
              >
                Yükleme Hatası
              </h2>
              <p
                className="text-[12px] leading-relaxed mb-6"
                style={{ color: "var(--text-muted)" }}
              >
                {loadError}
              </p>
              <button
                onClick={() => fetchGuilds()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150"
                style={{
                  background: "var(--surface-solid)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-accent)";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
                }}
              >
                Yeniden Dene
              </button>
            </div>
          ) : !selectedGuild ? (
            /* No guild selected */
            <div className="max-w-sm mx-auto mt-24 text-center animate-fade-in">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)" }}
              >
                <ServerOff className="w-6 h-6" style={{ color: "var(--accent)" }} />
              </div>
              <h2
                className="text-[16px] font-bold mb-2"
                style={{ color: "var(--text-main)" }}
              >
                Sunucu Seçilmedi
              </h2>
              <p
                className="text-[12px] leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                Yönetmek istediğiniz Discord sunucusunu üstteki menüden seçin.
              </p>
            </div>
          ) : (
            <div className="w-full max-w-5xl mx-auto animate-fade-in">
              {children}
            </div>
          )}
        </main>
      </div>

      <DirtySaveBar />

      {/* Toast */}
      {toast.visible && (
        <div
          className="fixed top-16 right-5 px-4 py-3 rounded-2xl flex items-center gap-3 z-50 animate-slide-up"
          style={{
            background:
              toast.type === "success"
                ? "rgba(12, 28, 20, 0.95)"
                : toast.type === "error"
                ? "rgba(28, 12, 12, 0.95)"
                : "rgba(12, 18, 28, 0.95)",
            border:
              toast.type === "success"
                ? "1px solid rgba(52,211,153,0.25)"
                : toast.type === "error"
                ? "1px solid rgba(248,113,113,0.25)"
                : "1px solid rgba(96,165,250,0.25)",
            boxShadow: "var(--shadow-lg)",
            backdropFilter: "blur(16px)",
            minWidth: "200px",
          }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{
              background:
                toast.type === "success"
                  ? "var(--success)"
                  : toast.type === "error"
                  ? "var(--danger)"
                  : "var(--info)",
            }}
          />
          <span
            className="text-[12px] font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            {toast.message}
          </span>
        </div>
      )}
    </div>
  );
}

"use client";

// SECTION: APP_BOOTSTRAP
// PURPOSE: Full-page layout manager that orchestrates the sidebar, topbar, active route display, and loading states.

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useBotDashboardStore } from "@/store/bot-dashboard-store";
import { GuildSidebar } from "./guild-sidebar";
import { GuildTopbar } from "./guild-topbar";
import { DirtySaveBar } from "./dirty-save-bar";
import { Loader2, AlertCircle } from "lucide-react";

interface ShellProps {
  children: React.ReactNode;
}

export function BotDashboardShell({ children }: ShellProps) {
  const params = useParams();
  const {
    fetchGuilds,
    selectGuild,
    selectedGuild,
    isGuildsLoading,
    isConfigLoading,
    sidebarCollapsed,
    toast
  } = useBotDashboardStore();

  const guildId = params.guildId as string;

  // Initialize guilds
  useEffect(() => {
    fetchGuilds();
  }, [fetchGuilds]);

  // Sync route param with state
  useEffect(() => {
    if (guildId && guildId !== "default" && selectedGuild?.id !== guildId) {
      selectGuild(guildId);
    }
  }, [guildId, selectedGuild, selectGuild]);

  const isLoading = isGuildsLoading || isConfigLoading;

  return (
    <div className="min-h-screen bg-[#0b0c10] text-[#f5f5f7] flex flex-col font-sans selection:bg-[#66fcf1] selection:text-[#0b0c10]">
      {/* Top Header */}
      <GuildTopbar />

      {/* Main Surface */}
      <div className="flex-1 flex pt-16 relative">
        {/* Left Navigation */}
        <GuildSidebar />

        {/* Dynamic content wrapper */}
        <main
          className={`flex-grow min-h-[calc(100vh-4rem)] p-6 md:p-8 transition-all duration-300 ${
            sidebarCollapsed ? "ml-16" : "ml-64"
          } pb-24`}
        >
          {isLoading ? (
            <div className="w-full h-full min-h-[50vh] flex flex-col items-center justify-center gap-4 text-gray-400">
              <Loader2 className="w-8 h-8 text-[#66fcf1] animate-spin" />
              <p className="text-xs font-semibold tracking-wider uppercase">Sunucu Verileri Yükleniyor...</p>
            </div>
          ) : !selectedGuild ? (
            <div className="max-w-md mx-auto mt-20 text-center p-8 bg-[#1f2833]/40 border border-[#2f3e46] rounded-2xl backdrop-blur-md">
              <AlertCircle className="w-12 h-12 text-[#66fcf1] mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Sunucu Seçilmedi</h2>
              <p className="text-xs text-[#c5c6c7] leading-relaxed mb-6">
                Yönetmek istediğiniz aktif Discord sunucusunu seçin veya sol üst menüden yeni sunucu davet edin.
              </p>
            </div>
          ) : (
            <div className="w-full max-w-6xl mx-auto animate-in fade-in duration-300">
              {children}
            </div>
          )}
        </main>
      </div>

      {/* Save banner when configuration is modified */}
      <DirtySaveBar />

      {/* Global toast notification system */}
      {toast.visible && (
        <div
          className={`fixed top-20 right-6 px-5 py-3.5 rounded-xl border shadow-2xl flex items-center gap-3 z-50 animate-in slide-in-from-right-10 fade-in duration-300 ${
            toast.type === "success"
              ? "bg-emerald-950/80 border-emerald-500/30 text-emerald-400"
              : toast.type === "error"
              ? "bg-red-950/80 border-red-500/30 text-red-400"
              : "bg-blue-950/80 border-blue-500/30 text-blue-400"
          }`}
        >
          <div className="text-xs font-semibold">{toast.message}</div>
        </div>
      )}
    </div>
  );
}

"use client";

// SECTION: DASHBOARD_VIEW
// PURPOSE: Server selection page providing a clean, elegant list of guilds the user can manage, with direct Vercel routes.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getStoredSession } from "@/lib/auth/session";
import { discordDashboardApi } from "@/lib/discord/api";
import { DashboardGuild } from "@/lib/discord/types";
import { Shield, Users, ArrowLeft, Loader2, Link2, Settings, Sparkles, AlertTriangle, RefreshCw } from "lucide-react";

export default function BotServerSelectionPage() {
  const [guilds, setGuilds] = useState<DashboardGuild[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "installed" | "invite">("all");
  const router = useRouter();

  useEffect(() => {
    const session = getStoredSession();
    if (!session?.idToken) {
      router.push("/auth/login.html");
      return;
    }
    const role = session.role?.toLowerCase() || '';
    const isMgmt = ['kurucu', 'admin', 'yonetici', 'genel_sorumlu', 'discord_yoneticisi', 'kidemli', 'kidemli_discord_moderatoru', 'senior_moderator'].includes(role);
    if (!isMgmt) {
      router.push("/dashboard");
      return;
    }

    async function loadGuilds() {
      try {
        setError(null);
        const data = await discordDashboardApi.fetchGuilds();
        // filter manageable guilds only (Sapphire style dashboard only lets you select managed servers)
        const manageable = data.guilds.filter(g => g.manageable);
        setGuilds(manageable);
      } catch (err) {
        console.error("Failed to load guilds", err);
        const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
        if (msg.includes("Unauthorized") || msg.includes("401")) {
          setError("Oturum süresi dolmuş veya yetkisiz erişim. Lütfen tekrar giriş yapın.");
        } else if (msg.includes("DISCORD_BOT_TOKEN") || msg.includes("500")) {
          setError("Bot yapılandırması eksik. Sunucu yöneticisiyle iletişime geçin.");
        } else {
          setError(`Sunucular yüklenirken bir hata oluştu: ${msg}`);
        }
      } finally {
        setLoading(false);
      }
    }

    loadGuilds();
  }, [router]);

  const filteredGuilds = guilds.filter((g) => {
    if (filter === "installed") return g.botInstalled;
    if (filter === "invite") return !g.botInstalled;
    return true;
  });

  const getInviteLink = (guildId: string) => {
    const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || "1500551629768888542";
    const redirectUri = encodeURIComponent("https://lutheus.vercel.app/api/auth/discord/callback");
    return `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&redirect_uri=${redirectUri}&integration_type=0&scope=applications.commands+bot&guild_id=${guildId}`;
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] text-[#f5f5f7] flex flex-col p-6 md:p-12 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#66fcf1]/5 blur-[150px] pointer-events-none" />

      {/* Header */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between mb-12 z-10">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Geri Dön</span>
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#66fcf1] to-purple-600 p-[1px]">
            <div className="bg-[#1f2833] w-full h-full rounded-[7px] flex items-center justify-center">
              <Shield className="w-4 h-4 text-[#66fcf1]" />
            </div>
          </div>
          <span className="text-sm font-bold tracking-wider">LUTHEUS DASHBOARD</span>
        </div>
      </header>

      {/* Title */}
      <div className="max-w-6xl w-full mx-auto mb-10 z-10">
        <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-[#66fcf1]" />
          <span>Bir Sunucu Seçin</span>
        </h1>
        <p className="text-sm text-[#c5c6c7] font-light mt-2">
          Yönetmek istediğiniz veya bot eklemek istediğiniz sunucuyu aşağıdan filtreleyip seçin.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="max-w-6xl w-full mx-auto flex gap-3 border-b border-[#2f3e46] pb-4 mb-8 z-10">
        {(["all", "installed", "invite"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-300 ${
              filter === t
                ? "bg-[#66fcf1]/10 text-[#66fcf1] border border-[#66fcf1]/30 shadow-[0_0_15px_rgba(102,252,241,0.05)]"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {t === "all" ? "Tüm Sunucular" : t === "installed" ? "Bot Ekli" : "Kurulum Gerekli"}
          </button>
        ))}
      </div>

      {/* Grid List */}
      <div className="max-w-6xl w-full mx-auto flex-1 z-10">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3 text-gray-400">
            <Loader2 className="w-8 h-8 text-[#66fcf1] animate-spin" />
            <span className="text-xs uppercase tracking-widest font-semibold">Sunucular Yükleniyor...</span>
          </div>
        ) : error ? (
          <div className="max-w-lg mx-auto mt-8 p-8 bg-[#1f2833]/40 border border-red-500/20 rounded-2xl text-center flex flex-col items-center gap-4 backdrop-blur-md">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-red-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white mb-1">Sunucular Yüklenemedi</h3>
              <p className="text-sm text-[#c5c6c7] leading-relaxed">{error}</p>
            </div>
            <button
              onClick={() => { setLoading(true); setError(null); discordDashboardApi.fetchGuilds().then(d => setGuilds(d.guilds.filter(g => g.manageable))).catch(e => setError(e instanceof Error ? e.message : "Hata")).finally(() => setLoading(false)); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1f2833] border border-[#2f3e46] text-sm font-semibold text-[#66fcf1] hover:bg-[#2f3e46] transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Yeniden Dene
            </button>
          </div>
        ) : filteredGuilds.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center p-8 bg-[#1f2833]/30 border border-[#2f3e46] rounded-2xl text-center">
            <Shield className="w-10 h-10 text-gray-500 mb-3" />
            <p className="text-sm text-gray-400 font-medium mb-1">Bu kritere uygun sunucu bulunamadı.</p>
            <p className="text-xs text-gray-500">Bot yüklü ve yönetim izniniz olan bir sunucu gereklidir.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredGuilds.map((g) => (
              <div
                key={g.id}
                className="group relative bg-[#1f2833]/40 hover:bg-[#1f2833]/80 border border-[#2f3e46] hover:border-[#66fcf1]/50 rounded-2xl p-6 transition-all duration-300 hover:shadow-[0_0_20px_rgba(102,252,241,0.1)] flex flex-col justify-between min-h-[220px]"
              >
                {/* Server Icon and Info */}
                <div className="flex items-start gap-4">
                  {g.iconUrl ? (
                    <img
                      src={g.iconUrl}
                      alt={g.name}
                      className="w-14 h-14 rounded-xl object-cover border border-[#2f3e46]/80 group-hover:border-[#66fcf1]/30 transition-colors"
                    />
                  ) : (
                    <div className="w-14 h-14 bg-[#1c2331] rounded-xl flex items-center justify-center text-lg font-bold text-[#66fcf1] border border-[#2f3e46]/80 group-hover:border-[#66fcf1]/30 transition-colors">
                      {g.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="truncate flex-1">
                    <h3 className="text-base font-bold text-white group-hover:text-[#66fcf1] transition-colors truncate">
                      {g.name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 font-light mt-1">
                      <Users className="w-3.5 h-3.5" />
                      <span>{g.memberCount.toLocaleString("tr-TR")} üye</span>
                    </div>
                  </div>
                </div>

                {/* Status and CTA Button */}
                <div className="mt-8 flex flex-col gap-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400 font-light">Durum:</span>
                    <span
                      className={`font-semibold tracking-wide uppercase px-2 py-0.5 rounded text-[9px] ${
                        g.botInstalled
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}
                    >
                      {g.botInstalled ? "Aktif" : "Kurulum Gerekli"}
                    </span>
                  </div>

                  {g.botInstalled ? (
                    <Link
                      href={`/bot/${g.id}`}
                      className="flex items-center justify-center gap-2 w-full py-3 bg-[#66fcf1] text-[#0b0c10] font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-[#45f3ff] transition-all shadow-[0_0_15px_rgba(102,252,241,0.1)] group-hover:shadow-[0_0_20px_rgba(102,252,241,0.25)]"
                    >
                      <Settings className="w-4 h-4" />
                      <span>Yönet</span>
                    </Link>
                  ) : (
                    <a
                      href={getInviteLink(g.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-3 bg-[#1c2331] text-[#66fcf1] font-semibold rounded-xl text-xs uppercase tracking-wider hover:bg-[#66fcf1]/10 border border-[#66fcf1]/30 hover:border-[#66fcf1] transition-all"
                    >
                      <Link2 className="w-4 h-4" />
                      <span>Botu Ekle</span>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

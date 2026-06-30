"use client";

// SECTION: DASHBOARD_RENDER
// PURPOSE: Modern home dashboard with stats, module cards and runtime status panels.

import { useBotDashboardStore } from "@/store/bot-dashboard-store";
import {
  MessageSquare,
  Shield,
  FileText,
  UserPlus,
  Zap,
  Bot,
  Wifi,
  HelpCircle,
  ExternalLink,
  ArrowRight,
  Activity,
  Hash,
  Star,
} from "lucide-react";

export default function GuildDashboardHomePage() {
  const {
    selectedGuild,
    config,
    channels,
    roles,
    commands,
    runtimeStatus,
    recentActions,
    caseStats,
  } = useBotDashboardStore();

  const activeModulesCount = config
    ? Object.values(config.modules).filter(Boolean).length
    : 0;

  const quickStats = [
    {
      name: "Aktif Modüller",
      value: `${activeModulesCount}`,
      total: "8",
      desc: "etkin özellik",
      icon: Zap,
      accent: "var(--accent)",
      accentDim: "var(--accent-dim)",
    },
    {
      name: "Roller",
      value: roles.length.toString(),
      desc: "sunucu rolü",
      icon: Star,
      accent: "#a78bfa",
      accentDim: "rgba(167,139,250,0.12)",
    },
    {
      name: "Kanallar",
      value: channels.length.toString(),
      desc: "okunan kanal",
      icon: Hash,
      accent: "var(--info)",
      accentDim: "var(--info-dim)",
    },
    {
      name: "Komutlar",
      value: commands.length.toString(),
      desc: "slash komut",
      icon: Bot,
      accent: "var(--success)",
      accentDim: "var(--success-dim)",
    },
  ];

  const controlCards = [
    {
      name: "Custom Messages",
      desc: "Sunucuya özel mesaj tetikleyicileri ve embed şablonları oluşturun.",
      href: "messages",
      icon: MessageSquare,
      status: config?.modules.welcomeMessages ? "Aktif" : "Pasif",
    },
    {
      name: "Moderation Cases",
      desc: "Yapay zeka ve moderatörler tarafından verilen cezaları ve geçmişi inceleyin.",
      href: "moderation",
      icon: Shield,
      status: config?.modules.moderation ? "Aktif" : "Pasif",
    },
    {
      name: "User Reports",
      desc: "Şüpheli durumlar hakkında yetkililere gönderilen rapor kayıtları.",
      href: "logging",
      icon: FileText,
      status: config?.modules.logging ? "Aktif" : "Pasif",
    },
    {
      name: "Role Greetings",
      desc: "Sunucuya katılan kullanıcılara otomatik rol atama kuralları.",
      href: "join-roles",
      icon: UserPlus,
      status: config?.modules.joinRoles ? "Aktif" : "Pasif",
    },
  ];

  return (
    <div className="space-y-8">

      {/* Welcome Banner */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          padding: "28px 32px",
        }}
      >
        {/* Subtle glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 60% 80% at 95% 10%, rgba(102,252,241,0.04) 0%, transparent 70%)",
          }}
        />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span
                className="badge badge-accent"
              >
                Dashboard
              </span>
              <span
                className="text-[11px]"
                style={{ color: "var(--text-muted)" }}
              >
                v2.0
              </span>
            </div>
            <h1
              className="text-[22px] font-bold leading-tight"
              style={{ color: "var(--text-main)" }}
            >
              Hoş geldin,{" "}
              <span style={{ color: "var(--accent)" }}>
                {selectedGuild?.name || "Yönetici"}
              </span>
            </h1>
            <p
              className="text-[13px] mt-2 max-w-md leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              Lutheus AI Moderasyon paneline başarıyla bağlandınız. Sol menüden özellikleri yapılandırabilirsiniz.
            </p>
          </div>

          {/* Online indicator */}
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl shrink-0"
            style={{
              background: runtimeStatus?.ready
                ? "var(--success-dim)"
                : "var(--danger-dim)",
              border: `1px solid ${runtimeStatus?.ready ? "rgba(52,211,153,0.22)" : "rgba(248,113,113,0.22)"}`,
            }}
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background: runtimeStatus?.ready ? "var(--success)" : "var(--danger)",
                boxShadow: runtimeStatus?.ready
                  ? "0 0 8px rgba(52,211,153,0.5)"
                  : "0 0 8px rgba(248,113,113,0.5)",
              }}
            />
            <div>
              <p
                className="text-[12px] font-semibold"
                style={{ color: runtimeStatus?.ready ? "var(--success)" : "var(--danger)" }}
              >
                {runtimeStatus?.ready ? "Online" : "Offline"}
              </p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {runtimeStatus?.latency_ms
                  ? `${runtimeStatus.latency_ms}ms`
                  : "Gateway"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {quickStats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.name}
              className="rounded-2xl p-5 flex flex-col gap-3"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-[11px] font-medium"
                  style={{ color: "var(--text-muted)" }}
                >
                  {s.name}
                </span>
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: s.accentDim }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: s.accent }} />
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span
                    className="text-[26px] font-bold leading-none"
                    style={{ color: "var(--text-main)" }}
                  >
                    {s.value}
                  </span>
                  {s.total && (
                    <span
                      className="text-[13px] font-medium"
                      style={{ color: "var(--text-muted)" }}
                    >
                      /{s.total}
                    </span>
                  )}
                </div>
                <p
                  className="text-[11px] mt-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  {s.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Runtime Status Row */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Gateway */}
        <div
          className="rounded-2xl p-5"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
              Gateway Durumu
            </span>
            <Wifi className="w-4 h-4" style={{ color: runtimeStatus?.ready ? "var(--success)" : "var(--danger)" }} />
          </div>
          <p className="text-[20px] font-bold" style={{ color: "var(--text-main)" }}>
            {runtimeStatus?.ready ? "Online" : "Offline"}
          </p>
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
            {runtimeStatus?.latency_ms ? `${runtimeStatus.latency_ms} ms gecikme` : "Heartbeat bekleniyor"}
          </p>
        </div>

        {/* Total Cases */}
        <div
          className="rounded-2xl p-5"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
              Toplam Case
            </span>
            <Shield className="w-4 h-4" style={{ color: "var(--warning)" }} />
          </div>
          <p className="text-[20px] font-bold" style={{ color: "var(--text-main)" }}>
            {caseStats?.total ?? 0}
          </p>
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
            {caseStats?.invalidRecent?.length ?? 0} hatalı CUK kaydı
          </p>
        </div>

        {/* Last Action */}
        <div
          className="rounded-2xl p-5"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
              Son Aksiyon
            </span>
            <Activity className="w-4 h-4" style={{ color: "var(--info)" }} />
          </div>
          <p
            className="text-[13px] font-semibold truncate"
            style={{ color: "var(--text-main)" }}
          >
            {recentActions[0]?.action || "Kayıt yok"}
          </p>
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
            {recentActions[0]?.status || "Aksiyon bekleniyor"}
          </p>
        </div>
      </div>

      {/* Control Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3
            className="text-[15px] font-bold"
            style={{ color: "var(--text-main)" }}
          >
            Hızlı Kontrol Kartları
          </h3>
          <span
            className="text-[11px] font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            sık kullanılan
          </span>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {controlCards.map((c) => {
            const Icon = c.icon;
            const isActive = c.status === "Aktif";
            return (
              <a
                key={c.name}
                href={`/bot/${selectedGuild?.id}?tab=${c.href}`}
                className="group flex items-start gap-4 rounded-2xl p-5 transition-all duration-200"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border-accent)";
                  (e.currentTarget as HTMLAnchorElement).style.background = "var(--surface-hover)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)";
                  (e.currentTarget as HTMLAnchorElement).style.background = "var(--surface)";
                }}
              >
                {/* Icon */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    background: "var(--accent-dim)",
                    border: "1px solid var(--border-accent)",
                  }}
                >
                  <Icon className="w-4.5 h-4.5" style={{ color: "var(--accent)" }} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4
                      className="text-[13px] font-semibold truncate"
                      style={{ color: "var(--text-main)" }}
                    >
                      {c.name}
                    </h4>
                    <span
                      className="badge shrink-0"
                      style={
                        isActive
                          ? { color: "var(--success)", background: "var(--success-dim)" }
                          : { color: "var(--text-muted)", background: "rgba(255,255,255,0.05)" }
                      }
                    >
                      {c.status}
                    </span>
                  </div>
                  <p
                    className="text-[12px] leading-relaxed"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {c.desc}
                  </p>
                </div>

                {/* Arrow */}
                <ArrowRight
                  className="w-4 h-4 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1 group-hover:translate-x-0 duration-200"
                  style={{ color: "var(--accent)" }}
                />
              </a>
            );
          })}
        </div>
      </div>

      {/* Support Banner */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 rounded-2xl p-5"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "rgba(167,139,250,0.12)",
              border: "1px solid rgba(167,139,250,0.2)",
            }}
          >
            <HelpCircle className="w-4 h-4" style={{ color: "#a78bfa" }} />
          </div>
          <div>
            <h4
              className="text-[13px] font-semibold"
              style={{ color: "var(--text-main)" }}
            >
              Yardıma mı ihtiyacınız var?
            </h4>
            <p
              className="text-[12px] mt-0.5 leading-relaxed max-w-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Topluluğumuza katılın, güncellemelere göz atın ve destek ekibimizden yardım alın.
            </p>
          </div>
        </div>

        <a
          href="https://discord.gg/sapphire"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-semibold transition-all duration-150 shrink-0"
          style={{
            background: "rgba(167,139,250,0.12)",
            color: "#a78bfa",
            border: "1px solid rgba(167,139,250,0.22)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "rgba(167,139,250,0.2)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "rgba(167,139,250,0.12)";
          }}
        >
          <span>Destek Sunucusu</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}

"use client";

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

/* ── helpers ── */
const statusStyle = (ready?: boolean) => ({
  bg:     ready ? "var(--success-dim)"    : "var(--danger-dim)",
  border: ready ? "var(--success-border)" : "var(--danger-border)",
  color:  ready ? "var(--success)"        : "var(--danger)",
  dot:    ready ? "var(--success)"        : "var(--danger)",
});

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
      name:      "Aktif Modüller",
      value:     `${activeModulesCount}`,
      sub:       `/ 8 özellik`,
      icon:      Zap,
      color:     "var(--accent)",
      colorDim:  "var(--accent-dim)",
    },
    {
      name:      "Roller",
      value:     roles.length.toString(),
      sub:       "sunucu rolü",
      icon:      Star,
      color:     "var(--purple)",
      colorDim:  "var(--purple-dim)",
    },
    {
      name:      "Kanallar",
      value:     channels.length.toString(),
      sub:       "okunan kanal",
      icon:      Hash,
      color:     "var(--info)",
      colorDim:  "var(--info-dim)",
    },
    {
      name:      "Komutlar",
      value:     commands.length.toString(),
      sub:       "slash komut",
      icon:      Bot,
      color:     "var(--success)",
      colorDim:  "var(--success-dim)",
    },
  ];

  const controlCards = [
    {
      name:   "Özel Mesajlar",
      desc:   "Sunucuya özel mesaj tetikleyicileri ve embed şablonları oluşturun.",
      tab:    "messages",
      icon:   MessageSquare,
      active: config?.modules.welcomeMessages ?? false,
    },
    {
      name:   "Moderasyon",
      desc:   "Yapay zeka ve moderatörler tarafından verilen cezaları inceleyin.",
      tab:    "moderation",
      icon:   Shield,
      active: config?.modules.moderation ?? false,
    },
    {
      name:   "Kullanıcı Raporları",
      desc:   "Şüpheli durumlar için gönderilen rapor kayıtlarını görüntüleyin.",
      tab:    "logging",
      icon:   FileText,
      active: config?.modules.logging ?? false,
    },
    {
      name:   "Katılım Rolleri",
      desc:   "Sunucuya katılan kullanıcılara otomatik rol atama kuralları.",
      tab:    "join-roles",
      icon:   UserPlus,
      active: config?.modules.joinRoles ?? false,
    },
  ];

  const ss = statusStyle(runtimeStatus?.ready);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>

      {/* ── Welcome banner ── */}
      <div
        className="relative overflow-hidden"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-xl)",
          padding: "28px 32px",
        }}
      >
        {/* subtle accent glow top-right */}
        <div
          className="absolute pointer-events-none"
          style={{
            inset: 0,
            background:
              "radial-gradient(ellipse 55% 70% at 100% 0%, rgba(102,252,241,0.05) 0%, transparent 65%)",
          }}
        />

        <div
          className="relative flex flex-col sm:flex-row sm:items-start justify-between"
          style={{ gap: "20px" }}
        >
          {/* Text side */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <span className="badge badge-accent">Dashboard</span>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>v2.0</span>
            </div>

            <h1
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "var(--text-primary)",
                lineHeight: 1.25,
                margin: 0,
              }}
            >
              Hoş geldin,{" "}
              <span style={{ color: "var(--accent)" }}>
                {selectedGuild?.name || "Yönetici"}
              </span>
            </h1>
            <p
              style={{
                fontSize: "13px",
                color: "var(--text-muted)",
                marginTop: "8px",
                maxWidth: "420px",
                lineHeight: 1.6,
              }}
            >
              Lutheus AI Moderasyon paneline bağlandınız. Sol menüden özellikleri yapılandırabilirsiniz.
            </p>
          </div>

          {/* Status chip */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px 18px",
              borderRadius: "var(--radius-lg)",
              background: ss.bg,
              border: `1px solid ${ss.border}`,
              flexShrink: 0,
            }}
          >
            <span
              className="animate-dot-pulse"
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: ss.dot,
                boxShadow: `0 0 8px ${ss.dot}80`,
                flexShrink: 0,
              }}
            />
            <div>
              <p style={{ fontSize: "12.5px", fontWeight: 700, color: ss.color, lineHeight: 1.2 }}>
                {runtimeStatus?.ready ? "Online" : "Offline"}
              </p>
              <p style={{ fontSize: "10.5px", color: "var(--text-muted)", marginTop: "2px" }}>
                {runtimeStatus?.latency_ms ? `${runtimeStatus.latency_ms}ms` : "Gateway"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats grid ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "14px",
        }}
      >
        {quickStats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.name}
              className="stat-card"
              style={{ padding: "20px" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "14px",
                }}
              >
                <span
                  style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.2px" }}
                >
                  {s.name}
                </span>
                <div
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "var(--radius-sm)",
                    background: s.colorDim,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon style={{ width: "14px", height: "14px", color: s.color }} />
                </div>
              </div>
              <p
                style={{
                  fontSize: "28px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  lineHeight: 1,
                  margin: 0,
                }}
              >
                {s.value}
              </p>
              <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "5px" }}>
                {s.sub}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Runtime status row ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "14px",
        }}
      >
        {/* Gateway */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "18px 20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)" }}>Gateway</span>
            <Wifi style={{ width: "14px", height: "14px", color: runtimeStatus?.ready ? "var(--success)" : "var(--danger)" }} />
          </div>
          <p style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            {runtimeStatus?.ready ? "Online" : "Offline"}
          </p>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            {runtimeStatus?.latency_ms ? `${runtimeStatus.latency_ms} ms gecikme` : "Bekleniyor"}
          </p>
        </div>

        {/* Total cases */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "18px 20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)" }}>Toplam Case</span>
            <Shield style={{ width: "14px", height: "14px", color: "var(--warning)" }} />
          </div>
          <p style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            {caseStats?.total ?? 0}
          </p>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            {caseStats?.invalidRecent?.length ?? 0} hatalı CUK kaydı
          </p>
        </div>

        {/* Last action */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "18px 20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)" }}>Son Aksiyon</span>
            <Activity style={{ width: "14px", height: "14px", color: "var(--info)" }} />
          </div>
          <p
            style={{
              fontSize: "13.5px",
              fontWeight: 600,
              color: "var(--text-primary)",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {recentActions[0]?.action || "Kayıt yok"}
          </p>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            {recentActions[0]?.status || "Aksiyon bekleniyor"}
          </p>
        </div>
      </div>

      {/* ── Quick-access control cards ── */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "16px",
          }}
        >
          <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Hızlı Kontrol
          </h3>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>sık kullanılan</span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "14px",
          }}
        >
          {controlCards.map((c) => {
            const Icon = c.icon;
            const isActive = c.active;
            return (
              <a
                key={c.name}
                href={`/bot/${selectedGuild?.id}?tab=${c.tab}`}
                className="group card card-hover"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "16px",
                  padding: "20px",
                  textDecoration: "none",
                }}
              >
                {/* Icon badge */}
                <div
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "var(--radius-md)",
                    background: "var(--accent-dim)",
                    border: "1px solid var(--accent-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                >
                  <Icon style={{ width: "16px", height: "16px", color: "var(--accent)" }} />
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
                    <span
                      style={{
                        fontSize: "13.5px",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.name}
                    </span>
                    <span
                      className="badge"
                      style={{
                        flexShrink: 0,
                        color: isActive ? "var(--success)" : "var(--text-muted)",
                        background: isActive ? "var(--success-dim)" : "rgba(255,255,255,0.05)",
                      }}
                    >
                      {isActive ? "Aktif" : "Pasif"}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "var(--text-muted)",
                      lineHeight: 1.55,
                      margin: 0,
                    }}
                  >
                    {c.desc}
                  </p>
                </div>

                {/* Arrow */}
                <ArrowRight
                  style={{
                    width: "15px",
                    height: "15px",
                    color: "var(--accent)",
                    flexShrink: 0,
                    marginTop: "2px",
                    opacity: 0,
                    transition: "opacity 0.15s, transform 0.15s",
                  }}
                  className="group-hover:opacity-100"
                />
              </a>
            );
          })}
        </div>
      </div>

      {/* ── Support banner ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-xl)",
          padding: "22px 28px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "var(--radius-md)",
              background: "var(--purple-dim)",
              border: "1px solid var(--purple-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <HelpCircle style={{ width: "16px", height: "16px", color: "var(--purple)" }} />
          </div>
          <div>
            <p style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
              Yardıma mı ihtiyacınız var?
            </p>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "3px", maxWidth: "340px", lineHeight: 1.5 }}>
              Topluluğumuza katılın ve destek ekibimizden yardım alın.
            </p>
          </div>
        </div>

        <a
          href="https://discord.gg/sapphire"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            padding: "9px 18px",
            borderRadius: "var(--radius-md)",
            fontSize: "12.5px",
            fontWeight: 600,
            background: "var(--purple-dim)",
            color: "var(--purple)",
            border: "1px solid var(--purple-border)",
            textDecoration: "none",
            transition: "background 0.15s",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "rgba(168,85,247,0.18)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "var(--purple-dim)";
          }}
        >
          <span>Destek Sunucusu</span>
          <ExternalLink style={{ width: "13px", height: "13px" }} />
        </a>
      </div>
    </div>
  );
}

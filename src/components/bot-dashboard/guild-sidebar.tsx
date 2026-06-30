"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useBotDashboardStore } from "@/store/bot-dashboard-store";
import {
  Home,
  Settings,
  Terminal,
  MessageSquare,
  Sparkles,
  ShieldAlert,
  Hammer,
  Bell,
  UserPlus,
  Smile,
  FolderLock,
  ClipboardList,
  LogOut,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
} from "lucide-react";

interface MenuItem {
  name: string;
  tab: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

interface NavGroup {
  label: string;
  items: MenuItem[];
}

export function GuildSidebar() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "home";
  const { selectedGuild, sidebarCollapsed, setSidebarCollapsed } = useBotDashboardStore();
  const guildId = selectedGuild?.id || "default";

  const navGroups: NavGroup[] = [
    {
      label: "Genel",
      items: [
        { name: "Anasayfa",      tab: "home",             icon: Home },
        { name: "Genel Ayarlar", tab: "general-settings", icon: Settings },
        { name: "Komutlar",      tab: "commands",          icon: Terminal },
        { name: "Mesajlar",      tab: "messages",          icon: MessageSquare },
        { name: "Marka",         tab: "custom-branding",   icon: Sparkles },
      ],
    },
    {
      label: "Modüller",
      items: [
        { name: "Oto Moderasyon",   tab: "auto-moderation",      icon: ShieldAlert },
        { name: "Moderasyon",       tab: "moderation",            icon: Hammer },
        { name: "Bildirimler",      tab: "social-notifications",  icon: Bell },
        { name: "Katılım Rolleri",  tab: "join-roles",            icon: UserPlus },
        { name: "Tepki Rolleri",    tab: "reaction-roles",        icon: Smile },
        { name: "Hoş Geldin",       tab: "welcome-messages",      icon: MessageSquare },
        { name: "Rol Bağlantıları", tab: "role-connections",      icon: FolderLock },
        { name: "Loglama",          tab: "logging",               icon: ClipboardList },
      ],
    },
    {
      label: "Sistem",
      items: [
        { name: "Tüm Sunucular", tab: "__servers__", icon: LayoutGrid },
      ],
    },
  ];

  const renderLink = (item: MenuItem) => {
    const Icon = item.icon;
    const isActive = activeTab === item.tab;
    const href = item.tab === "__servers__" ? "/bot" : `/bot/${guildId}?tab=${item.tab}`;

    return (
      <Link
        key={item.tab}
        href={href}
        title={sidebarCollapsed ? item.name : undefined}
        className={`nav-item${isActive ? " active" : ""}`}
        style={{
          justifyContent: sidebarCollapsed ? "center" : undefined,
          paddingInline: sidebarCollapsed ? "0" : undefined,
          width: sidebarCollapsed ? "40px" : undefined,
          height: "36px",
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLAnchorElement).style.background = "var(--surface-hover)";
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-primary)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLAnchorElement).style.background = "";
            (e.currentTarget as HTMLAnchorElement).style.color = "";
          }
        }}
      >
        <Icon
          className="nav-icon w-[15px] h-[15px] shrink-0"
          style={{ color: isActive ? "var(--accent)" : "var(--text-muted)" }}
        />
        {!sidebarCollapsed && (
          <span className="truncate text-[13px]">{item.name}</span>
        )}
      </Link>
    );
  };

  return (
    <aside
      className="fixed left-0 bottom-0 flex flex-col z-30 transition-[width] duration-250"
      style={{
        top: "var(--topbar-h)",
        width: sidebarCollapsed ? "var(--sidebar-w-collapsed)" : "var(--sidebar-w)",
        background: "rgba(9,9,11,0.96)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRight: "1px solid var(--border)",
      }}
    >
      {/* ── Scrollable nav area ── */}
      <nav
        className="flex-1 overflow-y-auto hide-scrollbar"
        style={{ padding: "12px 10px 8px" }}
      >
        {navGroups.map((group, gi) => (
          <div key={group.label} style={{ marginBottom: gi < navGroups.length - 1 ? "18px" : "0" }}>
            {/* Group label */}
            {!sidebarCollapsed && (
              <p className="nav-group-label" style={{ marginBottom: "6px" }}>
                {group.label}
              </p>
            )}
            {sidebarCollapsed && gi > 0 && (
              <div className="divider" style={{ marginBottom: "10px" }} />
            )}

            {/* Items */}
            <div
              className="flex flex-col"
              style={{
                gap: "2px",
                alignItems: sidebarCollapsed ? "center" : undefined,
              }}
            >
              {group.items.map(renderLink)}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Footer ── */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          padding: "10px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        {/* Return to main */}
        <Link
          href="/"
          title="Ana Menüye Dön"
          className="nav-item"
          style={{
            justifyContent: sidebarCollapsed ? "center" : undefined,
            height: "36px",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLAnchorElement;
            el.style.background = "var(--danger-dim)";
            el.style.color = "var(--danger)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLAnchorElement;
            el.style.background = "";
            el.style.color = "";
          }}
        >
          <LogOut
            className="w-[15px] h-[15px] shrink-0"
            style={{ color: "var(--text-muted)" }}
          />
          {!sidebarCollapsed && (
            <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
              Ana Menü
            </span>
          )}
        </Link>

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="flex items-center justify-center rounded-xl transition-colors duration-150 focus:outline-none"
          style={{
            height: "34px",
            background: "var(--surface-02)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.borderColor = "var(--accent-border)";
            el.style.color = "var(--accent)";
            el.style.background = "var(--accent-dim)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.borderColor = "var(--border)";
            el.style.color = "var(--text-muted)";
            el.style.background = "var(--surface-02)";
          }}
          aria-label={sidebarCollapsed ? "Genişlet" : "Daralt"}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </aside>
  );
}

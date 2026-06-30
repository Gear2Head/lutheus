"use client";

// SECTION: ROUTER_SETUP
// PURPOSE: Sidebar navigation — clean modern layout with smooth active states and collapsible mode.

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
  LogOut,
  FolderLock,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
} from "lucide-react";

interface MenuItem {
  name: string;
  tab: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

export function GuildSidebar() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "home";
  const { selectedGuild, sidebarCollapsed, setSidebarCollapsed } = useBotDashboardStore();

  const guildId = selectedGuild?.id || "default";

  const primaryMenu: MenuItem[] = [
    { name: "Anasayfa", tab: "home", icon: Home },
    { name: "Genel Ayarlar", tab: "general-settings", icon: Settings },
    { name: "Komutlar", tab: "commands", icon: Terminal },
    { name: "Mesajlar", tab: "messages", icon: MessageSquare },
    { name: "Marka", tab: "custom-branding", icon: Sparkles },
  ];

  const modulesMenu: MenuItem[] = [
    { name: "Oto Moderasyon", tab: "auto-moderation", icon: ShieldAlert },
    { name: "Moderasyon", tab: "moderation", icon: Hammer },
    { name: "Bildirimler", tab: "social-notifications", icon: Bell },
    { name: "Katılım Rolleri", tab: "join-roles", icon: UserPlus },
    { name: "Tepki Rolleri", tab: "reaction-roles", icon: Smile },
    { name: "Hoş Geldin", tab: "welcome-messages", icon: MessageSquare },
    { name: "Rol Bağlantıları", tab: "role-connections", icon: FolderLock },
    { name: "Loglama", tab: "logging", icon: ClipboardList },
  ];

  const renderLink = (item: MenuItem) => {
    const Icon = item.icon;
    const isActive = activeTab === item.tab;
    const href = `/bot/${guildId}?tab=${item.tab}`;

    return (
      <Link
        key={item.name}
        href={href}
        title={sidebarCollapsed ? item.name : undefined}
        className="group flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 relative"
        style={{
          color: isActive ? "var(--accent)" : "var(--text-muted)",
          background: isActive ? "var(--accent-dim)" : "transparent",
          boxShadow: isActive ? "inset 2px 0 0 var(--accent)" : undefined,
          justifyContent: sidebarCollapsed ? "center" : undefined,
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLAnchorElement).style.background = "var(--surface-hover)";
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-secondary)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)";
          }
        }}
      >
        <Icon
          className="w-4 h-4 shrink-0"
          style={{ color: isActive ? "var(--accent)" : undefined }}
        />
        {!sidebarCollapsed && (
          <span className="truncate">{item.name}</span>
        )}
      </Link>
    );
  };

  return (
    <aside
      className="fixed top-14 left-0 bottom-0 flex flex-col z-30 transition-all duration-300"
      style={{
        width: sidebarCollapsed ? "56px" : "228px",
        background: "rgba(8, 10, 14, 0.94)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderRight: "1px solid var(--border)",
      }}
    >
      <div className="flex-1 overflow-y-auto px-2.5 py-4 space-y-6 hide-scrollbar">

        {/* Primary */}
        <div className="space-y-0.5">
          {!sidebarCollapsed && (
            <p className="section-label mb-2">Ana Panel</p>
          )}
          {primaryMenu.map(renderLink)}
        </div>

        {/* Divider */}
        <div style={{ height: "1px", background: "var(--border-soft)", margin: "0 4px" }} />

        {/* Modules */}
        <div className="space-y-0.5">
          {!sidebarCollapsed && (
            <p className="section-label mb-2">Modüller</p>
          )}
          {modulesMenu.map(renderLink)}
        </div>
      </div>

      {/* Footer */}
      <div
        className="p-2.5 flex flex-col gap-1.5"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        {/* Return Home */}
        <Link
          href="/"
          title="Ana Menüye Dön"
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all duration-150"
          style={{
            color: "var(--text-muted)",
            justifyContent: sidebarCollapsed ? "center" : undefined,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "var(--surface-hover)";
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--danger)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)";
          }}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!sidebarCollapsed && <span>Ana Menü</span>}
        </Link>

        {/* Collapse Toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="flex items-center justify-center w-full py-2 rounded-xl transition-all duration-150"
          style={{
            background: "var(--surface-solid)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-accent)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
          }}
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

"use client";

// SECTION: ROUTER_SETUP
// PURPOSE: Sidebar navigation mimicking Sapphire's side-bar style but using Lutheus themes.

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
  ClipboardList
} from "lucide-react";

export function GuildSidebar() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "home";
  const { selectedGuild, sidebarCollapsed, setSidebarCollapsed } = useBotDashboardStore();

  const guildId = selectedGuild?.id || "default";

  // Menu lists
  const primaryMenu = [
    { name: "Home", tab: "home", icon: Home },
    { name: "General Settings", tab: "general-settings", icon: Settings },
    { name: "Commands", tab: "commands", icon: Terminal },
    { name: "Messages", tab: "messages", icon: MessageSquare },
    { name: "Custom Branding", tab: "custom-branding", icon: Sparkles },
  ];

  const modulesMenu = [
    { name: "Auto Moderation", tab: "auto-moderation", icon: ShieldAlert },
    { name: "Moderation", tab: "moderation", icon: Hammer },
    { name: "Social Notifications", tab: "social-notifications", icon: Bell },
    { name: "Join Roles", tab: "join-roles", icon: UserPlus },
    { name: "Reaction Roles", tab: "reaction-roles", icon: Smile },
    { name: "Welcome Messages", tab: "welcome-messages", icon: MessageSquare },
    { name: "Role Connections", tab: "role-connections", icon: FolderLock },
    { name: "Logging", tab: "logging", icon: ClipboardList },
  ];

  const renderLink = (item: { name: string; tab: string; icon: any }) => {
    const Icon = item.icon;
    const isActive = activeTab === item.tab;
    const href = `/bot/${guildId}?tab=${item.tab}`;

    return (
      <Link
        key={item.name}
        href={href}
        className={`group flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
          isActive
            ? "bg-[#66fcf1]/10 text-[#66fcf1] border-l-2 border-l-[#66fcf1] shadow-[inset_4px_0_10px_rgba(102,252,241,0.05)]"
            : "text-gray-400 hover:text-white hover:bg-[#1f2833]/40"
        } ${sidebarCollapsed ? "justify-center" : ""}`}
        title={sidebarCollapsed ? item.name : undefined}
      >
        <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-[#66fcf1]" : "text-gray-400 group-hover:text-white"}`} />
        {!sidebarCollapsed && <span className="truncate">{item.name}</span>}
      </Link>
    );
  };

  return (
    <aside
      className={`fixed top-16 left-0 bottom-0 bg-[#0b0c10] border-r border-[#2f3e46] flex flex-col z-30 transition-all duration-300 ${
        sidebarCollapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-7">
        {/* Primary Settings */}
        <div className="space-y-1">
          {!sidebarCollapsed && (
            <h5 className="px-4 text-[10px] font-bold text-gray-500 tracking-wider uppercase mb-2">
              Ana Panel
            </h5>
          )}
          {primaryMenu.map(renderLink)}
        </div>

        {/* Modules Section */}
        <div className="space-y-1">
          {!sidebarCollapsed && (
            <h5 className="px-4 text-[10px] font-bold text-gray-500 tracking-wider uppercase mb-2">
              Modüller
            </h5>
          )}
          {modulesMenu.map(renderLink)}
        </div>
      </div>

      {/* Collapse button and Return home */}
      <div className="p-3 border-t border-[#2f3e46] flex flex-col gap-2">
        <Link
          href="/"
          className={`flex items-center gap-3 px-4 py-2 text-xs font-semibold text-gray-500 hover:text-[#66fcf1] transition-colors rounded-xl ${
            sidebarCollapsed ? "justify-center" : ""
          }`}
          title="Ana Sayfaya Dön"
        >
          <LogOut className="w-4.5 h-4.5" />
          {!sidebarCollapsed && <span>Ana Menü</span>}
        </Link>

        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="flex items-center justify-center w-full py-2 bg-[#1f2833]/40 hover:bg-[#1f2833] rounded-xl text-gray-400 hover:text-[#66fcf1] border border-[#2f3e46]/50 transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}

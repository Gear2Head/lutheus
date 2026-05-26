"use client";

// SECTION: APP_BOOTSTRAP
// PURPOSE: Main tab orchestrator that dynamically renders configuration panels based on URL query parameter, saving serverless lambdas.

import { useSearchParams } from "next/navigation";
import HomeTab from "@/components/bot-dashboard/tabs/home-tab";
import GeneralSettingsTab from "@/components/bot-dashboard/tabs/general-settings-tab";
import CommandsTab from "@/components/bot-dashboard/tabs/commands-tab";
import MessagesTab from "@/components/bot-dashboard/tabs/messages-tab";
import CustomBrandingTab from "@/components/bot-dashboard/tabs/custom-branding-tab";
import AutoModerationTab from "@/components/bot-dashboard/tabs/auto-moderation-tab";
import ModerationTab from "@/components/bot-dashboard/tabs/moderation-tab";
import SocialNotificationsTab from "@/components/bot-dashboard/tabs/social-notifications-tab";
import JoinRolesTab from "@/components/bot-dashboard/tabs/join-roles-tab";
import ReactionRolesTab from "@/components/bot-dashboard/tabs/reaction-roles-tab";
import WelcomeMessagesTab from "@/components/bot-dashboard/tabs/welcome-messages-tab";
import RoleConnectionsTab from "@/components/bot-dashboard/tabs/role-connections-tab";
import LoggingTab from "@/components/bot-dashboard/tabs/logging-tab";

export default function GuildDashboardRouterPage() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "home";

  switch (activeTab) {
    case "home":
      return <HomeTab />;
    case "general-settings":
      return <GeneralSettingsTab />;
    case "commands":
      return <CommandsTab />;
    case "messages":
      return <MessagesTab />;
    case "custom-branding":
      return <CustomBrandingTab />;
    case "auto-moderation":
      return <AutoModerationTab />;
    case "moderation":
      return <ModerationTab />;
    case "social-notifications":
      return <SocialNotificationsTab />;
    case "join-roles":
      return <JoinRolesTab />;
    case "reaction-roles":
      return <ReactionRolesTab />;
    case "welcome-messages":
      return <WelcomeMessagesTab />;
    case "role-connections":
      return <RoleConnectionsTab />;
    case "logging":
      return <LoggingTab />;
    default:
      return <HomeTab />;
  }
}

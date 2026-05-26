"use client";

// SECTION: APP_BOOTSTRAP
// PURPOSE: Layout wrapper for the guild-specific routes, nesting them in the BotDashboardShell.

import { BotDashboardShell } from "@/components/bot-dashboard/bot-dashboard-shell";

export default function GuildDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <BotDashboardShell>{children}</BotDashboardShell>;
}

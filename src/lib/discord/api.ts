// SECTION: API_CLIENT
// PURPOSE: Calls real serverless administrative APIs on Vercel without synthetic data fallback.

import { BotActionResult, BotDashboardPayload, DashboardGuild, GuildConfig } from "./types";
import { getStoredSession } from "../auth/session";

const API_BASE = "/api";

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const session = getStoredSession();
  const token = session?.idToken;

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export const discordDashboardApi = {
  async fetchGuilds(): Promise<{ guilds: DashboardGuild[] }> {
    const data = await apiRequest<{ guilds: DashboardGuild[] }>("/admin/discord-bot-guilds");
    return { guilds: data.guilds };
  },

  async fetchDashboardConfig(guildId: string): Promise<BotDashboardPayload> {
    return apiRequest<BotDashboardPayload>(`/admin/discord-bot-dashboard?guildId=${guildId}`);
  },

  async updateDashboardConfig(guildId: string, config: GuildConfig): Promise<void> {
    await apiRequest(`/admin/discord-bot-dashboard?guildId=${guildId}`, {
      method: "POST",
      body: JSON.stringify(config),
    });
  },

  async triggerAction(guildId: string, action: string, payload: Record<string, unknown> = {}): Promise<BotActionResult> {
    return apiRequest<BotActionResult>(`/admin/discord-bot-action?guildId=${guildId}`, {
      method: "POST",
      body: JSON.stringify({ guildId, action, payload }),
    });
  }
};

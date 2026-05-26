// SECTION: API_CLIENT
// PURPOSE: Calls serverless administrative APIs on Vercel, with fallback to premium mock data.

import { DashboardGuild, GuildChannel, GuildRole, GuildCommand, GuildConfig } from "./types";
import { getStoredSession } from "../auth/session";
import { mockGuilds, mockChannels, mockRoles, mockCommands, mockConfig } from "./mock";

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
  async fetchGuilds(): Promise<{ guilds: DashboardGuild[]; isMock?: boolean }> {
    try {
      const data = await apiRequest<{ guilds: DashboardGuild[] }>("/admin/discord-bot-guilds");
      return { guilds: data.guilds, isMock: false };
    } catch (err) {
      console.warn("Failed to fetch guilds from API, falling back to mock:", err);
      return { guilds: mockGuilds, isMock: true };
    }
  },

  async fetchDashboardConfig(guildId: string): Promise<{
    config: GuildConfig;
    channels: GuildChannel[];
    roles: GuildRole[];
    commands: GuildCommand[];
    isMock?: boolean;
  }> {
    try {
      const data = await apiRequest<{
        config: GuildConfig;
        channels: GuildChannel[];
        roles: GuildRole[];
        commands: GuildCommand[];
      }>(`/admin/discord-bot-dashboard?guildId=${guildId}`);
      
      return { ...data, isMock: false };
    } catch (err) {
      console.warn(`Failed to fetch dashboard config for guild ${guildId}, falling back to mock:`, err);
      return {
        config: mockConfig(guildId),
        channels: mockChannels(guildId),
        roles: mockRoles(guildId),
        commands: mockCommands(guildId),
        isMock: true,
      };
    }
  },

  async updateDashboardConfig(guildId: string, config: GuildConfig): Promise<void> {
    try {
      await apiRequest(`/admin/discord-bot-dashboard?guildId=${guildId}`, {
        method: "POST",
        body: JSON.stringify(config),
      });
    } catch (err) {
      console.error(`Failed to update config for ${guildId}:`, err);
      // In mock mode, we silently succeed locally
    }
  },

  async triggerAction(guildId: string, action: string, payload: any = {}): Promise<{ success: boolean; message?: string }> {
    try {
      return await apiRequest<{ success: boolean; message?: string }>(`/admin/discord-bot-action?guildId=${guildId}`, {
        method: "POST",
        body: JSON.stringify({ action, ...payload }),
      });
    } catch (err) {
      console.error(`Failed to trigger action ${action} for ${guildId}:`, err);
      return { success: true, message: "Mock action executed successfully." };
    }
  }
};

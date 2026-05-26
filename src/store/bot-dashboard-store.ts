// SECTION: STATE_STORE
// PURPOSE: Global React state management using Zustand for managing current guild, config changes, dirty state, loading, and menu toggles.

import { create } from "zustand";
import { DashboardGuild, GuildChannel, GuildRole, GuildCommand, GuildConfig } from "../lib/discord/types";
import { discordDashboardApi } from "../lib/discord/api";

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
  visible: boolean;
}

interface BotDashboardState {
  guilds: DashboardGuild[];
  isGuildsLoading: boolean;
  selectedGuild: DashboardGuild | null;
  config: GuildConfig | null;
  initialConfig: GuildConfig | null;
  channels: GuildChannel[];
  roles: GuildRole[];
  commands: GuildCommand[];
  isConfigLoading: boolean;
  isSaving: boolean;
  isMockMode: boolean;
  sidebarCollapsed: boolean;
  dirty: boolean;
  toast: ToastState;

  // Actions
  fetchGuilds: () => Promise<void>;
  selectGuild: (guildId: string) => Promise<void>;
  updateConfig: (updater: (prev: GuildConfig) => GuildConfig) => void;
  saveConfig: () => Promise<void>;
  triggerBotAction: (action: string, payload?: any) => Promise<{ success: boolean; message?: string }>;
  setSidebarCollapsed: (collapsed: boolean) => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  hideToast: () => void;
  resetConfigChanges: () => void;
}

export const useBotDashboardStore = create<BotDashboardState>((set, get) => ({
  guilds: [],
  isGuildsLoading: false,
  selectedGuild: null,
  config: null,
  initialConfig: null,
  channels: [],
  roles: [],
  commands: [],
  isConfigLoading: false,
  isSaving: false,
  isMockMode: false,
  sidebarCollapsed: false,
  dirty: false,
  toast: { message: "", type: "info", visible: false },

  fetchGuilds: async () => {
    set({ isGuildsLoading: true });
    try {
      const { guilds, isMock } = await discordDashboardApi.fetchGuilds();
      set({ guilds, isMockMode: isMock });
      
      // Auto-select first manageable guild if none is selected
      if (guilds.length > 0 && !get().selectedGuild) {
        const firstManageable = guilds.find(g => g.manageable && g.botInstalled);
        if (firstManageable) {
          get().selectGuild(firstManageable.id);
        }
      }
    } catch (err) {
      get().showToast("Sunucular yüklenirken bir hata oluştu", "error");
    } finally {
      set({ isGuildsLoading: false });
    }
  },

  selectGuild: async (guildId: string) => {
    const guild = get().guilds.find((g) => g.id === guildId) || null;
    set({ selectedGuild: guild, isConfigLoading: true, dirty: false });
    
    try {
      const data = await discordDashboardApi.fetchDashboardConfig(guildId);
      set({
        config: data.config,
        initialConfig: JSON.parse(JSON.stringify(data.config)), // deep clone
        channels: data.channels,
        roles: data.roles,
        commands: data.commands,
        isMockMode: get().isMockMode || data.isMock || false,
      });
    } catch (err) {
      get().showToast("Sunucu ayarları yüklenemedi", "error");
    } finally {
      set({ isConfigLoading: false });
    }
  },

  updateConfig: (updater) => {
    const current = get().config;
    if (!current) return;
    const next = updater(current);
    
    // Check if configuration actually changed from initial
    const initial = get().initialConfig;
    const isDirty = JSON.stringify(next) !== JSON.stringify(initial);

    set({ config: next, dirty: isDirty });
  },

  saveConfig: async () => {
    const { config, selectedGuild } = get();
    if (!config || !selectedGuild) return;

    set({ isSaving: true });
    try {
      await discordDashboardApi.updateDashboardConfig(selectedGuild.id, config);
      set({
        initialConfig: JSON.parse(JSON.stringify(config)),
        dirty: false,
      });
      get().showToast("Ayarlar başarıyla kaydedildi!", "success");
    } catch (err) {
      get().showToast("Ayarlar kaydedilirken hata oluştu", "error");
    } finally {
      set({ isSaving: false });
    }
  },

  triggerBotAction: async (action, payload = {}) => {
    const { selectedGuild } = get();
    if (!selectedGuild) return { success: false, message: "Sunucu seçilmedi" };

    try {
      return await discordDashboardApi.triggerAction(selectedGuild.id, action, payload);
    } catch (err) {
      return { success: false, message: "Aksiyon tetiklenemedi" };
    }
  },

  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

  showToast: (message, type = "info") => {
    set({ toast: { message, type, visible: true } });
    setTimeout(() => {
      get().hideToast();
    }, 4000);
  },

  hideToast: () => set({ toast: { ...get().toast, visible: false } }),

  resetConfigChanges: () => {
    const initial = get().initialConfig;
    if (!initial) return;
    set({ config: JSON.parse(JSON.stringify(initial)), dirty: false });
  }
}));

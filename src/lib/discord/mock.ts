// SECTION: STATE_STORE
// PURPOSE: High-fidelity mock data mimicking the Sapphire dashboard structure and content for premium testing.

import { DashboardGuild, GuildChannel, GuildRole, GuildCommand, GuildConfig } from "./types";

export const mockGuilds: DashboardGuild[] = [
  {
    id: "1223431616081166336",
    name: "Lutheus Test Server",
    iconUrl: "https://cdn.discordapp.com/icons/1223431616081166336/a_e0b968846c4fca75fb6f1c4e75f63116.gif",
    memberCount: 1420,
    botInstalled: true,
    manageable: true,
    owner: true,
    permissions: "8"
  },
  {
    id: "987654321098765432",
    name: "Gear2Head Community",
    iconUrl: "",
    memberCount: 54320,
    botInstalled: true,
    manageable: true,
    owner: false,
    permissions: "8"
  },
  {
    id: "555555555555555555",
    name: "Unmanaged Server",
    iconUrl: "",
    memberCount: 12,
    botInstalled: false,
    manageable: false,
    owner: false,
    permissions: "0"
  },
  {
    id: "444444444444444444",
    name: "Invite-Only Guild",
    iconUrl: "",
    memberCount: 382,
    botInstalled: false,
    manageable: true,
    owner: false,
    permissions: "8"
  }
];

export const mockChannels = (guildId: string): GuildChannel[] => [
  { id: "101", name: "genel-sohbet", type: 0 },
  { id: "102", name: "duyurular", type: 0 },
  { id: "103", name: "bot-komutlari", type: 0 },
  { id: "104", name: "moderasyon-log", type: 0 },
  { id: "105", name: "sesli-oda-1", type: 2 },
  { id: "106", name: "Sesli Kanallar", type: 4 }
];

export const mockRoles = (guildId: string): GuildRole[] => [
  { id: "201", name: "Kurucu", color: 0xff0000, rawPosition: 5 },
  { id: "202", name: "Yönetici", color: 0x00ff00, rawPosition: 4 },
  { id: "203", name: "Moderatör", color: 0x0000ff, rawPosition: 3 },
  { id: "204", name: "V.I.P", color: 0xffff00, rawPosition: 2 },
  { id: "205", name: "Üye", color: 0x808080, rawPosition: 1 }
];

export const mockCommands = (guildId: string): GuildCommand[] => [
  { id: "cmd_ban", name: "ban", description: "Belirtilen kullanıcıyı sunucudan yasaklar.", enabled: true, requiredRole: "203" },
  { id: "cmd_kick", name: "kick", description: "Belirtilen kullanıcıyı sunucudan atar.", enabled: true, requiredRole: "203" },
  { id: "cmd_warn", name: "warn", description: "Kullanıcıya resmi uyarı gönderir ve kaydeder.", enabled: true, requiredRole: "203" },
  { id: "cmd_mute", name: "mute", description: "Kullanıcıyı sesli ve yazılı kanallarda susturur.", enabled: true, requiredRole: "203", cooldown: 5 },
  { id: "cmd_unmute", name: "unmute", description: "Susturulmuş kullanıcının susturmasını kaldırır.", enabled: true, requiredRole: "203" },
  { id: "cmd_timeout", name: "timeout", description: "Kullanıcıya geçici susturma (timeout) cezası verir.", enabled: true, requiredRole: "203" },
  { id: "cmd_report", name: "report", description: "Bir kullanıcıyı yetkililere raporlar.", enabled: true, cooldown: 10 },
  { id: "cmd_prefix", name: "prefix", description: "Botun sunucu özelindeki prefixini değiştirir.", enabled: true, requiredRole: "202" },
  { id: "cmd_help", name: "help", description: "Tüm komutların listesini ve kullanım detaylarını gösterir.", enabled: true }
];

export const mockConfig = (guildId: string): GuildConfig => ({
  guildId,
  language: "tr",
  timezone: "Europe/Istanbul",
  prefix: "!",
  dashboardAccessRole: "202",
  dataRetentionDays: 30,
  modules: {
    autoModeration: true,
    moderation: true,
    socialNotifications: false,
    joinRoles: true,
    reactionRoles: false,
    welcomeMessages: true,
    roleConnections: false,
    logging: true
  },
  welcomeSettings: {
    channelId: "101",
    welcomeMessage: "Sunucumuza hoş geldin {user}! Seninle birlikte {member_count} kişiyiz.",
    goodbyeMessage: "{user} sunucudan ayrıldı. Görüşmek üzere!",
    sendDm: false,
    embedEnabled: true
  },
  joinRolesSettings: {
    roles: ["205"],
    delayedRoles: [],
    delaySeconds: 0
  },
  loggingSettings: {
    channelId: "104",
    events: {
      messageDelete: true,
      messageEdit: true,
      memberJoin: true,
      memberLeave: true,
      memberBan: true,
      memberUnban: true,
      roleUpdate: false,
      channelUpdate: false
    }
  }
});

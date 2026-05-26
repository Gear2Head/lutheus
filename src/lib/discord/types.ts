// SECTION: STATE_STORE
// PURPOSE: Types for Discord objects and guild configurations within the Lutheus dashboard ecosystem.

export interface DashboardGuild {
  id: string;
  name: string;
  icon?: string;
  iconUrl?: string;
  memberCount: number;
  botInstalled: boolean;
  manageable: boolean;
  owner: boolean;
  permissions: string;
}

export interface GuildChannel {
  id: string;
  name: string;
  type: number; // 0: text, 2: voice, 4: category, etc.
}

export interface GuildRole {
  id: string;
  name: string;
  color: number;
  rawPosition: number;
}

export interface GuildCommand {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  cooldown?: number;
  requiredRole?: string;
}

export interface GuildConfig {
  guildId: string;
  language: string;
  timezone: string;
  prefix: string;
  dashboardAccessRole?: string;
  dataRetentionDays: number;
  modules: {
    autoModeration: boolean;
    moderation: boolean;
    socialNotifications: boolean;
    joinRoles: boolean;
    reactionRoles: boolean;
    welcomeMessages: boolean;
    roleConnections: boolean;
    logging: boolean;
  };
  welcomeSettings?: {
    channelId: string;
    welcomeMessage: string;
    goodbyeMessage: string;
    sendDm: boolean;
    embedEnabled: boolean;
  };
  joinRolesSettings?: {
    roles: string[];
    delayedRoles: string[];
    delaySeconds: number;
  };
  loggingSettings?: {
    channelId: string;
    events: {
      messageDelete: boolean;
      messageEdit: boolean;
      memberJoin: boolean;
      memberLeave: boolean;
      memberBan: boolean;
      memberUnban: boolean;
      roleUpdate: boolean;
      channelUpdate: boolean;
    };
  };
}

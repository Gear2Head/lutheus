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

export interface BotRuntimeStatus {
  guild_id: string;
  bot_user_id?: string | null;
  bot_tag?: string | null;
  ready: boolean;
  latency_ms?: number | null;
  uptime_seconds?: number | null;
  last_heartbeat_at?: string | null;
  last_command_sync_at?: string | null;
  command_sync_status?: string | null;
  last_error?: string | null;
}

export interface BotActionAudit {
  id: string;
  guild_id: string;
  action: string;
  status: "pending" | "processing" | "completed" | "failed";
  requested_by_discord_id?: string | null;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string | null;
  created_at: string;
  processed_at?: string | null;
}

export interface BotAuditLog {
  id: string;
  action: string;
  target_type?: string | null;
  actor_discord_id?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface BotCaseStats {
  total: number;
  invalidRecent: Array<{
    case_id: string;
    author_display_name?: string | null;
    reason_raw?: string | null;
    cuk_verdict?: string | null;
    scraped_at?: string | null;
  }>;
}

export interface BotDashboardPayload {
  config: GuildConfig;
  channels: GuildChannel[];
  roles: GuildRole[];
  commands: GuildCommand[];
  runtimeStatus: BotRuntimeStatus | null;
  recentActions: BotActionAudit[];
  auditLogs: BotAuditLog[];
  caseStats: BotCaseStats;
}

export interface BotActionResult {
  success: boolean;
  message?: string;
  actionId?: string;
}

export interface GuildConfig {
  guildId: string;
  language: string;
  timezone: string;
  prefix: string;
  dashboardAccessRole?: string;
  dataRetentionDays: number;
  logChannelId?: string;
  alertChannelId?: string;
  statsChannelId?: string;
  isActive?: boolean;
  updatedAt?: string | null;
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
  commandSettings?: Record<string, unknown>;
  webhookSettings?: Record<string, unknown>;
}

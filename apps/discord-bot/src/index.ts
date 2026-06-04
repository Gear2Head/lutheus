import {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    EmbedBuilder,
    ActivityType,
    Partials,
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType
} from 'discord.js';
import { createServer } from 'node:http';
import { supabase, botToken, logChannelId, guildId } from './botConfig.js';
import { EmergencyLockdownCommand } from './commands/critical/EmergencyLockdown.js';
import { QueryCaseCommand } from './commands/queryCase.js';
import { QueryStaffCommand } from './commands/queryStaff.js';
// SECTION: MOD_COMMANDS_IMPORTS
// PURPOSE: Moderasyon komutları - ban, kick, timeout, warn, purge, userinfo, serverinfo, modlogs, unban
import { BanCommand } from './commands/mod/BanCommand.js';
import { KickCommand } from './commands/mod/KickCommand.js';
import { TimeoutCommand } from './commands/mod/TimeoutCommand.js';
import { WarnCommand } from './commands/mod/WarnCommand.js';
import { WarnsCommand } from './commands/mod/WarnsCommand.js';
import { PurgeCommand } from './commands/mod/PurgeCommand.js';
import { UserInfoCommand } from './commands/mod/UserInfoCommand.js';
import { ServerInfoCommand } from './commands/mod/ServerInfoCommand.js';
import { ModLogsCommand } from './commands/mod/ModLogsCommand.js';
import { UnbanCommand } from './commands/mod/UnbanCommand.js';
import { diagnosticCommands } from './commands/diagnostics/DbDiagnosticsCommands.js';
import { runDbHealthCheck, setPollCursor, setLastPollError } from './lib/dbDiagnostics.js';
import { RaporCommand } from './commands/rapor.js';

// In-memory cache for dynamic guild configurations to power real-time welcome, automod, reaction roles etc.
const guildConfigsCache: Record<string, any> = {};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Message, Partials.Reaction, Partials.User]
});

// SECTION: HEALTH_SERVER
// PURPOSE: Railway health endpoint and classified startup status for bot deploys.
let readyAt: string | null = null;
let lastError = botToken ? '' : 'MISSING_DISCORD_BOT_TOKEN';
let lastDbHealth: Awaited<ReturnType<typeof runDbHealthCheck>> | null = null;

function classifyDiscordError(error: any) {
    const code = String(error?.code || error?.status || '');
    const message = String(error?.message || '');
    if (code === '429' || message.includes('rate limit')) return 'DISCORD_RATE_LIMITED';
    if (code === '50001' || code === '50013') return 'DISCORD_MISSING_PERMISSION';
    if (message.includes('Used disallowed intents')) return 'DISCORD_INTENT_REQUIRED';
    return 'DISCORD_API_UNAVAILABLE';
}

function startHealthServer() {
    const port = Number(process.env.PORT || 3000);
    createServer((req, res) => {
        if (req.url !== '/health') {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'NOT_FOUND' }));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            ok: Boolean(client.isReady()) && (lastDbHealth?.pingOk ?? false),
            service: 'lutheus-discord-bot',
            guildId,
            readyAt,
            uptime: process.uptime(),
            lastError,
            discord: { ready: client.isReady() },
            supabase: lastDbHealth
                ? {
                    ok: lastDbHealth.pingOk,
                    totalCases: lastDbHealth.totalCases,
                    guildCases: lastDbHealth.guildCases,
                    error: lastDbHealth.pingError,
                }
                : null,
        }));
    }).listen(port, () => {
        console.log(`Discord Bot: Health endpoint listening on ${port}`);
    });
}

const commands = [
    {
        data: new SlashCommandBuilder()
            .setName('setup')
            .setDescription('Lutheus bot guild kanal ayarlarini gercek veritabanina kaydeder.')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addChannelOption(option => option.setName('log_channel').setDescription('Moderasyon log kanali').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
            .addChannelOption(option => option.setName('alert_channel').setDescription('CUK alert kanali').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
            .addChannelOption(option => option.setName('stats_channel').setDescription('Pointtrain istatistik kanali').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(false)),
        async execute(interaction: any) {
            const logChannel = interaction.options.getChannel('log_channel', true);
            const alertChannel = interaction.options.getChannel('alert_channel', true);
            const statsChannel = interaction.options.getChannel('stats_channel', false);
            
            const configRow = {
                guild_id: interaction.guildId,
                log_channel_id: logChannel.id,
                alert_channel_id: alertChannel.id,
                stats_channel_id: statsChannel?.id || null,
                modules: { moderation: true, logging: true },
                logging_settings: { channelId: logChannel.id, events: { memberBan: true, memberUnban: true, memberJoin: true, memberLeave: true, messageDelete: true, messageEdit: true, roleUpdate: false, channelUpdate: false } },
                is_active: true,
                setup_completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                updated_by: interaction.user.id
            };

            await supabase.from('bot_guild_config').upsert([configRow], { onConflict: 'guild_id' });
            
            // Immediately update the local cache
            guildConfigsCache[interaction.guildId] = mapDbConfig(configRow);

            // Send test embeds
            const logEmbed = new EmbedBuilder()
                .setTitle('⚙️ Log Kanalı Ayarlandı')
                .setColor(0x2ed573)
                .setDescription('Bu kanal **Lutheus Moderasyon Log** kanalı olarak başarıyla tanımlandı ve ayarlandı.')
                .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] }).catch(() => null);

            const alertEmbed = new EmbedBuilder()
                .setTitle('🚨 Alarm Kanalı Ayarlandı')
                .setColor(0xffa502)
                .setDescription('Bu kanal **Lutheus CUK Alarm** kanalı olarak başarıyla tanımlandı ve ayarlandı.')
                .setTimestamp();
            await alertChannel.send({ embeds: [alertEmbed] }).catch(() => null);

            if (statsChannel) {
                const statsEmbed = new EmbedBuilder()
                    .setTitle('📊 İstatistik Kanalı Ayarlandı')
                    .setColor(0x3742fa)
                    .setDescription('Bu kanal **Lutheus İstatistik** kanalı olarak başarıyla tanımlandı ve ayarlandı.')
                    .setTimestamp();
                await statsChannel.send({ embeds: [statsEmbed] }).catch(() => null);
            }

            // Send a test DM to the executor
            const dmEmbed = new EmbedBuilder()
                .setTitle('✉️ Lutheus DM Testi')
                .setColor(0x7c5af5)
                .setDescription(`Merhaba **${interaction.user.username}**!\nLutheus bot kurulumu başarıyla tamamlandı ve DM gönderme sisteminin çalıştığı doğrulandı.`)
                .setTimestamp();
            await interaction.user.send({ embeds: [dmEmbed] }).catch((err: any) => {
                console.warn('Could not send welcome DM:', err.message);
            });

            await interaction.reply({ content: 'Lutheus bot ayarlari kaydedildi ve test mesajları gönderildi.', ephemeral: true });
        }
    },
    EmergencyLockdownCommand,
    QueryCaseCommand,
    QueryStaffCommand,
    // Moderasyon
    BanCommand,
    KickCommand,
    TimeoutCommand,
    WarnCommand,
    WarnsCommand,
    PurgeCommand,
    UserInfoCommand,
    ServerInfoCommand,
    ModLogsCommand,
    UnbanCommand,
    RaporCommand,
    ...diagnosticCommands,
];

function mapDbConfig(row: any) {
    const modules = row.modules || {};
    const welcomeSettings = row.welcome_settings || {};
    const loggingSettings = row.logging_settings || {};
    return {
        guildId: row.guild_id,
        language: row.language || 'tr',
        timezone: row.timezone || 'Europe/Istanbul',
        prefix: row.prefix || '!',
        logChannelId: row.log_channel_id || '',
        alertChannelId: row.alert_channel_id || '',
        statsChannelId: row.stats_channel_id || '',
        dashboardAccessRole: row.dashboard_access_role_id || '',
        dataRetentionDays: Number(row.data_retention_days || 30),
        modules,
        welcomeSettings,
        welcome: {
            enabled: Boolean(modules.welcomeMessages),
            channelId: welcomeSettings.channelId || '',
            message: welcomeSettings.welcomeMessage || 'Hos geldin {user}!',
            goodbyeMessage: welcomeSettings.goodbyeMessage || '{username} sunucudan ayrildi.',
            embedEnabled: Boolean(welcomeSettings.embedEnabled),
            dmEnabled: Boolean(welcomeSettings.sendDm),
            dmMessage: welcomeSettings.dmMessage || welcomeSettings.welcomeMessage || 'Hos geldin {user}!'
        },
        joinRolesSettings: row.join_roles_settings || {},
        loggingSettings,
        logging: {
            enabled: Boolean(modules.logging),
            channelId: row.log_channel_id || loggingSettings.channelId || ''
        },
        commandSettings: row.command_settings || {},
        commands: row.command_settings || {},
        webhookSettings: row.webhook_settings || {},
    };
}

async function writeRuntimeHeartbeat(commandSyncStatus = 'ready') {
    const rows = client.guilds.cache.map((guild) => ({
        guild_id: guild.id,
        bot_user_id: client.user?.id || null,
        bot_tag: client.user?.tag || null,
        ready: client.isReady(),
        latency_ms: Math.max(0, Math.round(client.ws.ping || 0)),
        uptime_seconds: Math.round(process.uptime()),
        last_heartbeat_at: new Date().toISOString(),
        command_sync_status: commandSyncStatus,
        last_error: lastError || null,
        updated_at: new Date().toISOString()
    }));
    if (rows.length) {
        await supabase.from('bot_runtime_status').upsert(rows, { onConflict: 'guild_id' });
    }
}

async function completeBotAction(id: string, status: 'completed' | 'failed', result: Record<string, unknown>, error = '') {
    await supabase
        .from('bot_action_audit')
        .update({
            status,
            result,
            error: error || null,
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', id);
}

async function registerSlashCommands() {
    if (!botToken) {
        console.warn('Discord Bot: DISCORD_BOT_TOKEN is not set. Skipping command registration.');
        return;
    }
    const rest = new REST({ version: '10' }).setToken(botToken);
    try {
        const clientAppId = client.application?.id || client.user?.id || process.env.DISCORD_CLIENT_ID;
        if (!clientAppId) {
            console.warn('Discord Bot: DISCORD_CLIENT_ID could not be resolved. Skipping command registration.');
            return;
        }

        let targetGuildIds = guildId
            ? [guildId]
            : [...client.guilds.cache.keys()];

        if (guildId && !client.guilds.cache.has(guildId)) {
            console.warn(`Discord Bot: DISCORD_GUILD_ID ${guildId} is not in joined guild cache. Falling back to joined guilds.`);
            targetGuildIds = [...client.guilds.cache.keys()];
        }

        if (targetGuildIds.length === 0) {
            console.warn('Discord Bot: No joined guilds found. Skipping command registration.');
            return;
        }

        const commandBody = commands.map(cmd => cmd.data.toJSON());
        console.log(`Discord Bot: Registering slash commands for App ID ${clientAppId} in guilds: ${targetGuildIds.join(', ')}`);

        for (const targetGuildId of targetGuildIds) {
            try {
                await rest.put(
                    Routes.applicationGuildCommands(clientAppId, targetGuildId),
                    { body: commandBody }
                );
                console.log(`Discord Bot: Slash commands registered for guild ${targetGuildId}.`);
            } catch (error: unknown) {
                const discordError = error as { code?: string | number; status?: string | number };
                if (String(discordError.code) === '50001' || String(discordError.status) === '403') {
                    console.error(`Discord Bot: Slash command registration missing access for guild ${targetGuildId}. Reinvite bot with applications.commands scope and verify DISCORD_GUILD_ID.`);
                } else {
                    console.error(`Discord Bot: Slash command registration failed for guild ${targetGuildId}:`, error);
                }
            }
        }
    } catch (error) {
        console.error('Discord Bot: Slash command registration setup failed:', error);
    }
}

async function syncModeratorProfiles(actor = 'system') {
    console.log(`Discord Bot: Starting profile synchronization triggered by ${actor}...`);
    try {
        const { data: roleCacheRows, error } = await supabase.from('role_cache').select('*');
        if (error || !roleCacheRows || roleCacheRows.length === 0) return;

        let syncCount = 0;
        for (const row of roleCacheRows) {
            const discordId = row.discord_id;
            if (!discordId || !/^\d{17,20}$/.test(discordId)) continue;

            try {
                const user = await client.users.fetch(discordId);
                const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 }) || null;
                const displayName = user.globalName || user.username;

                await supabase.from('role_cache').update({
                    raw_payload: {
                        ...(row.raw_payload || {}),
                        displayName,
                        avatar: avatarUrl,
                        avatarUpdatedAt: new Date().toISOString()
                    },
                    updated_at: new Date().toISOString()
                }).eq('discord_id', discordId);

                const { data: existingProfile } = await supabase.from('staff_profiles').select('*').eq('discord_id', discordId).maybeSingle();

                const profileUpdate = {
                    discord_id: discordId,
                    display_name: displayName,
                    username: user.username,
                    avatar_url: avatarUrl,
                    staff_rank: row.staff_rank,
                    permission_group: row.staff_rank === 'admin' ? 'admin' : (row.staff_rank === 'yonetici' ? 'management' : 'moderator'),
                    permission_level: row.staff_rank === 'admin' ? 100 : (row.staff_rank === 'yonetici' ? 80 : 50),
                    is_active_staff: true,
                    last_seen_at: new Date().toISOString(),
                    raw_payload: {
                        ...(existingProfile?.raw_payload || {}),
                        displayName,
                        avatar: avatarUrl
                    },
                    updated_at: new Date().toISOString()
                };

                await supabase.from('staff_profiles').upsert([profileUpdate], { onConflict: 'discord_id' });
                syncCount++;
            } catch (userErr: any) {
                console.warn(`Discord Bot: Failed to fetch user ${discordId}:`, userErr.message);
            }
        }

        console.log(`Discord Bot: Successfully synchronized ${syncCount} profiles!`);

        await supabase.from('audit_logs').insert([{
            action: 'discord_profiles_synced',
            target_type: 'bot',
            metadata: { syncCount, actor },
            created_at: new Date().toISOString()
        }]);

        const targetChannelId = logChannelId;
        if (targetChannelId) {
            const channel = await client.channels.fetch(targetChannelId).catch(() => null);
            if (channel && channel.isTextBased()) {
                const embed = new EmbedBuilder()
                    .setTitle('🔄 Moderator Profilleri Senkronize Edildi')
                    .setColor(0x2ed573)
                    .setDescription(`Panel üzerindeki tüm yetkili profilleri ve fotoğrafları Discord API ile başarıyla eşitlendi.`)
                    .addFields(
                        { name: '🔄 Eşitlenen Yetkili Sayısı', value: `\`${syncCount}\` profil`, inline: true },
                        { name: '👤 Tetikleyen Aktör', value: `\`${actor}\``, inline: true }
                    )
                    .setTimestamp();
                await (channel as any).send({ embeds: [embed] }).catch(() => null);
            }
        }
    } catch (err: any) {
        console.error('Discord Bot: Profile sync failed:', err.message);
    }
}

let lastProcessedTime = new Date().toISOString();
let lastTriggerTimestamp = 0;

function startSupabasePolling() {
    console.log('Discord Bot: Initializing Supabase polling...');

    // Sapphire case polling has been removed as requested.

    // 2. Poll app settings sync triggers every 15 seconds
    setInterval(async () => {
        try {
            const { data: row, error } = await supabase
                .from('app_settings')
                .select('*')
                .eq('key', 'settings')
                .maybeSingle();

            if (error) return;

            const policy = row?.value || {};
            if (policy.syncTrigger) {
                const ts = policy.syncTrigger.timestamp || 0;
                if (ts > lastTriggerTimestamp && Date.now() - ts < 60000) {
                    lastTriggerTimestamp = ts;
                    await syncModeratorProfiles(policy.syncTrigger.actor || 'panel');
                }
            }
        } catch (err: any) {
            console.error('Discord Bot: Poll settings sync trigger failed:', err.message);
        }
    }, 15000);

    // 3. Poll guild module and settings configs every 30 seconds
    const pollConfigs = async () => {
        try {
            const { data: rows, error } = await supabase
                .from('bot_guild_config')
                .select('*')
                .eq('is_active', true);

            if (error) return;

            if (rows) {
                rows.forEach(row => {
                    guildConfigsCache[row.guild_id] = mapDbConfig(row);
                });
                console.log(`Discord Bot: Loaded configs cache for ${rows.length} guilds.`);
            }
        } catch (err: any) {
            console.error('Discord Bot: Poll configs failed:', err.message);
        }
    };
    pollConfigs();
    setInterval(pollConfigs, 30000);

    const pollDashboardActions = async () => {
        try {
            const { data: rows, error } = await supabase
                .from('bot_action_audit')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: true })
                .limit(10);
            if (error || !rows?.length) return;

            for (const row of rows) {
                await supabase.from('bot_action_audit').update({ status: 'processing', updated_at: new Date().toISOString() }).eq('id', row.id);
                try {
                    if (row.action === 'sync_commands') {
                        await registerSlashCommands();
                        await supabase.from('bot_runtime_status').update({
                            last_command_sync_at: new Date().toISOString(),
                            command_sync_status: 'synced',
                            updated_at: new Date().toISOString()
                        }).eq('guild_id', row.guild_id);
                        await completeBotAction(row.id, 'completed', { synced: true });
                    } else if (row.action === 'force_sync') {
                        await syncModeratorProfiles(row.requested_by_discord_id || 'dashboard');
                        await completeBotAction(row.id, 'completed', { syncedProfiles: true });
                    } else if (row.action === 'lockdown' || row.action === 'unlockdown') {
                        const enabled = row.action === 'lockdown';
                        guildConfigsCache[row.guild_id] = {
                            ...(guildConfigsCache[row.guild_id] || {}),
                            lockdown: enabled
                        };
                        await completeBotAction(row.id, 'completed', { lockdown: enabled });
                    } else {
                        await completeBotAction(row.id, 'failed', {}, 'UNKNOWN_ACTION');
                    }
                } catch (err: any) {
                    await completeBotAction(row.id, 'failed', {}, err.message || 'ACTION_FAILED');
                }
            }
        } catch (err: any) {
            console.error('Discord Bot: Dashboard action polling failed:', err.message);
        }
    };
    setInterval(pollDashboardActions, 10000);
    setInterval(() => writeRuntimeHeartbeat().catch((err: any) => console.warn('Discord Bot: heartbeat write failed:', err.message)), 15000);
    writeRuntimeHeartbeat().catch(() => null);
}

async function sendCaseEmbedLog(data: any) {
    const targetChannelId = logChannelId || data.botChannelId;
    if (!targetChannelId) return;

    try {
        const channel = await client.channels.fetch(targetChannelId).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        const status = String(data.reviewStatus || 'pending').toLowerCase();
        const color = status === 'valid' ? 0x2ed573 : status === 'invalid' ? 0xff4757 : 0xffa502;
        const statusEmoji = status === 'valid' ? '✅ DOĞRU (VALID)' : status === 'invalid' ? '❌ HATALI (INVALID)' : '⏳ BEKLEYEN (PENDING)';

        const embed = new EmbedBuilder()
            .setTitle(`🚨 Yeni Ceza Saptandı - #${data.caseId}`)
            .setURL(data.sourceUrl || `https://dashboard.sapph.xyz/`)
            .setColor(color)
            .setDescription(`Sistem taranan yeni bir ceza kaydını başarıyla Firestore'a kaydetti.`)
            .addFields(
                { name: '👤 Cezalandırılan', value: `**${data.user || 'Bilinmiyor'}**\nID: \`${data.userId || '-'}\``, inline: true },
                { name: '👮 Yetkili (Atan)', value: `**${data.authorName || 'Bilinmiyor'}**\nID: \`${data.authorId || '-'}\``, inline: true },
                { name: '⚡ Tür / Süre', value: `\`${String(data.type || 'unknown').toUpperCase()}\` / \`${data.duration || 'Süresiz'}\``, inline: true },
                { name: '📝 Ceza Sebebi', value: `\`\`\`\n${data.reason || '-'}\n\`\`\`` },
                { name: '📊 SRE Değerlendirmesi', value: `**${statusEmoji}**` }
            )
            .setFooter({ text: 'Lutheus CezaRapor Otomasyonu' })
            .setTimestamp(data.scrapedAt ? new Date(data.scrapedAt) : new Date());

        await (channel as any).send({ embeds: [embed] }).catch(() => null);
        console.log(`Discord Bot: Dispatched ceza embed log for case #${data.caseId}`);
    } catch (err: any) {
        console.error(`Discord Bot: Failed to dispatch embed log for case #${data.caseId}:`, err.message);
    }
}

async function sendTestCaseLog(data: any) {
    const targetChannelId = logChannelId;
    if (!targetChannelId) return;

    try {
        const channel = await client.channels.fetch(targetChannelId).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        const embed = new EmbedBuilder()
            .setTitle(`🧪 Lutheus Entegrasyon Test Embedi`)
            .setColor(0x3742fa)
            .setDescription(`**Başarılı!** Lutheus CezaRapor admin paneli ve Discord Bot bağlantısı sorunsuz çalışıyor.`)
            .addFields(
                { name: '📡 Veritabanı', value: '🟢 Bağlı (Firestore)', inline: true },
                { name: '🤖 Bot Gateway', value: '🟢 Bağlı (WebSocket)', inline: true },
                { name: '🛠️ Test Eden Yetkili', value: `\`${data.authorName || 'Gear_Head'}\``, inline: true },
                { name: '📝 Mesaj', value: `\`\`\`\n${data.reason}\n\`\`\`` }
            )
            .setFooter({ text: 'Lutheus CezaRapor SRE Otomasyonu' })
            .setTimestamp();

        await (channel as any).send({ embeds: [embed] }).catch(() => null);
        console.log(`Discord Bot: Dispatched Test embed log successfully!`);
    } catch (err: any) {
        console.error('Discord Bot: Failed to dispatch test embed log:', err.message);
    }
}

client.once('clientReady', async () => {
    console.log(`Discord Bot: Logged in successfully as ${client.user?.tag}!`);
    readyAt = new Date().toISOString();
    lastError = '';
    client.user?.setActivity('Lutheus SRE Audit', { type: ActivityType.Watching });

    try {
        lastDbHealth = await runDbHealthCheck(guildId || undefined);
        console.log('Discord Bot: DB health check', {
            pingOk: lastDbHealth.pingOk,
            totalCases: lastDbHealth.totalCases,
            guildCases: lastDbHealth.guildCases,
            targetGuildId: lastDbHealth.targetGuildId,
            supabaseUrlConfigured: lastDbHealth.supabaseUrlConfigured,
            supabaseKeyConfigured: lastDbHealth.supabaseKeyConfigured,
        });
        if (!lastDbHealth.pingOk) {
            console.warn('Discord Bot: DB health check failed:', lastDbHealth.pingError);
        }
    } catch (err: any) {
        console.error('Discord Bot: DB health startup probe failed:', err?.message || err);
    }

    await registerSlashCommands();
    startSupabasePolling();
    setupAuditLogListeners();
    startScheduledReporting();
});

// SECTION: AUDIT_LOG_LISTENERS
// PURPOSE: Discord native moderasyon olaylarını (ban, unban, kick, timeout) otomatik log kanalına iletir.
function setupAuditLogListeners() {
    const getLogChannelId = (guildId: string | null) => {
        if (!guildId) return logChannelId;
        return guildConfigsCache[guildId]?.logChannelId || logChannelId;
    };

    // Member ban added
    client.on('guildBanAdd', async (ban) => {
        const activeLogChannelId = getLogChannelId(ban.guild.id);
        if (!activeLogChannelId) return;
        try {
            const channel = await client.channels.fetch(activeLogChannelId).catch(() => null);
            if (!channel || !channel.isTextBased()) return;
            const audit = await ban.guild.fetchAuditLogs({ type: 22 /* BAN_MEMBER */, limit: 1 }).catch(() => null);
            const entry = audit?.entries.first();
            const embed = new EmbedBuilder()
                .setTitle('🔨 Kullanıcı Yasaklandı')
                .setColor(0xff4757)
                .setThumbnail(ban.user.displayAvatarURL())
                .addFields(
                    { name: '👤 Yasaklanan', value: `**${ban.user.tag}**\n\`${ban.user.id}\``, inline: true },
                    { name: '👮 Yetkili', value: entry?.executor ? `**${entry.executor.tag}**` : 'Bilinmiyor', inline: true },
                    { name: '📝 Sebep', value: entry?.reason || ban.reason || 'Sebep belirtilmedi' }
                )
                .setFooter({ text: 'Lutheus Oto-Log' }).setTimestamp();
            await (channel as any).send({ embeds: [embed] }).catch(() => null);
        } catch {
            // Ignore audit log delivery failures.
        }
    });

    // Member ban removed
    client.on('guildBanRemove', async (ban) => {
        const activeLogChannelId = getLogChannelId(ban.guild.id);
        if (!activeLogChannelId) return;
        try {
            const channel = await client.channels.fetch(activeLogChannelId).catch(() => null);
            if (!channel || !channel.isTextBased()) return;
            const audit = await ban.guild.fetchAuditLogs({ type: 23 /* UNBAN_MEMBER */, limit: 1 }).catch(() => null);
            const entry = audit?.entries.first();
            const embed = new EmbedBuilder()
                .setTitle('✅ Yasak Kaldırıldı')
                .setColor(0x2ed573)
                .setThumbnail(ban.user.displayAvatarURL())
                .addFields(
                    { name: '👤 Kullanıcı', value: `**${ban.user.tag}**\n\`${ban.user.id}\``, inline: true },
                    { name: '👮 Yetkili', value: entry?.executor ? `**${entry.executor.tag}**` : 'Bilinmiyor', inline: true },
                    { name: '📝 Sebep', value: entry?.reason || 'Sebep belirtilmedi' }
                )
                .setFooter({ text: 'Lutheus Oto-Log' }).setTimestamp();
            await (channel as any).send({ embeds: [embed] }).catch(() => null);
        } catch {
            // Ignore audit log delivery failures.
        }
    });

    // Member removed (kick detection & goodbye module)
    client.on('guildMemberRemove', async (member) => {
        // 1. Kick detection
        const activeLogChannelId = getLogChannelId(member.guild.id);
        if (activeLogChannelId) {
            try {
                await new Promise(r => setTimeout(r, 500)); // Small delay to ensure audit log is available
                const audit = await member.guild.fetchAuditLogs({ type: 20 /* KICK_MEMBER */, limit: 1 }).catch(() => null);
                const entry = audit?.entries.first();
                if (entry && entry.targetId === member.id && Date.now() - entry.createdTimestamp <= 5000) {
                    const channel = await client.channels.fetch(activeLogChannelId).catch(() => null);
                    if (channel && channel.isTextBased()) {
                        const embed = new EmbedBuilder()
                            .setTitle('👢 Kullanıcı Atıldı (Kick)')
                            .setColor(0xff6b35)
                            .setThumbnail(member.user.displayAvatarURL())
                            .addFields(
                                { name: '👤 Atılan', value: `**${member.user.tag}**\n\`${member.id}\``, inline: true },
                                { name: '👮 Yetkili', value: entry.executor ? `**${entry.executor.tag}**` : 'Bilinmiyor', inline: true },
                                { name: '📝 Sebep', value: entry.reason || 'Sebep belirtilmedi' }
                            )
                            .setFooter({ text: 'Lutheus Oto-Log' }).setTimestamp();
                        await (channel as any).send({ embeds: [embed] }).catch(() => null);
                    }
                }
            } catch {
                // Ignore audit log delivery failures.
            }
        }

        // 2. Goodbye message module
        const config = guildConfigsCache[member.guild.id];
        if (config && config.welcome && config.welcome.enabled && config.welcome.goodbyeEnabled) {
            const welcome = config.welcome;
            const goodbyeChannel = welcome.goodbyeChannelId || welcome.channelId;
            if (goodbyeChannel) {
                try {
                    const channel = await member.guild.channels.fetch(goodbyeChannel).catch(() => null);
                    if (channel && channel.isTextBased()) {
                        const rawMsg = welcome.goodbyeMessage || '{username} sunucudan ayrıldı.';
                        const msg = rawMsg
                            .replace(/{user}/g, member.user.username)
                            .replace(/{username}/g, member.user.username)
                            .replace(/{server}/g, member.guild.name)
                            .replace(/{memberCount}/g, String(member.guild.memberCount));
                        await (channel as any).send(msg).catch(() => null);
                    }
                } catch {
                    // Ignore goodbye delivery failures.
                }
            }
        }
    });

    // Member timeout (via member update)
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        const activeLogChannelId = getLogChannelId(newMember.guild.id);
        if (!activeLogChannelId) return;
        const wasTimedOut = !!oldMember.communicationDisabledUntil;
        const isTimedOut = !!newMember.communicationDisabledUntil;
        if (wasTimedOut === isTimedOut) return;
        try {
            const channel = await client.channels.fetch(activeLogChannelId).catch(() => null);
            if (!channel || !channel.isTextBased()) return;
            const audit = await newMember.guild.fetchAuditLogs({ type: 24 /* MEMBER_UPDATE */, limit: 1 }).catch(() => null);
            const entry = audit?.entries.first();
            if (isTimedOut && !wasTimedOut) {
                // New timeout applied
                const until = newMember.communicationDisabledUntil!;
                const embed = new EmbedBuilder()
                    .setTitle('⏱️ Kullanıcı Susturuldu (Timeout)')
                    .setColor(0xffa502)
                    .setThumbnail(newMember.user.displayAvatarURL())
                    .addFields(
                        { name: '👤 Susturulan', value: `**${newMember.user.tag}**\n\`${newMember.id}\``, inline: true },
                        { name: '👮 Yetkili', value: entry?.executor ? `**${entry.executor.tag}**` : 'Bilinmiyor', inline: true },
                        { name: '📅 Bitiş', value: `<t:${Math.floor(until.getTime() / 1000)}:R>`, inline: true },
                        { name: '📝 Sebep', value: entry?.reason || 'Sebep belirtilmedi' }
                    )
                    .setFooter({ text: 'Lutheus Oto-Log' }).setTimestamp();
                await (channel as any).send({ embeds: [embed] }).catch(() => null);
            } else if (!isTimedOut && wasTimedOut) {
                // Timeout removed
                const embed = new EmbedBuilder()
                    .setTitle('✅ Timeout Kaldırıldı')
                    .setColor(0x2ed573)
                    .addFields(
                        { name: '👤 Kullanıcı', value: `**${newMember.user.tag}**\n\`${newMember.id}\``, inline: true },
                        { name: '👮 Yetkili', value: entry?.executor ? `**${entry.executor.tag}**` : 'Bilinmiyor', inline: true }
                    )
                    .setFooter({ text: 'Lutheus Oto-Log' }).setTimestamp();
                await (channel as any).send({ embeds: [embed] }).catch(() => null);
            }
        } catch {
            // Ignore audit log delivery failures.
        }
    });

    // Bulk message delete log
    client.on('messageDeleteBulk', async (messages, channel) => {
        const activeLogChannelId = getLogChannelId(channel.guild?.id || null);
        if (!activeLogChannelId) return;
        try {
            const logChannel = await client.channels.fetch(activeLogChannelId).catch(() => null);
            if (!logChannel || !logChannel.isTextBased()) return;
            const embed = new EmbedBuilder()
                .setTitle('🧹 Toplu Mesaj Silindi')
                .setColor(0xa29bfe)
                .addFields(
                    { name: '🗑️ Silinen', value: `**${messages.size}** mesaj`, inline: true },
                    { name: '📍 Kanal', value: `<#${channel.id}>`, inline: true }
                )
                .setFooter({ text: 'Lutheus Oto-Log' }).setTimestamp();
            await (logChannel as any).send({ embeds: [embed] }).catch(() => null);
        } catch {
            // Ignore audit log delivery failures.
        }
    });

    console.log('Discord Bot: Audit log event listeners active.');
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const guildId = interaction.guildId;
    if (guildId) {
        const config = guildConfigsCache[guildId];
        if (config && config.commands) {
            const cmdConfig = config.commands;
            if (cmdConfig.disabledCommands && cmdConfig.disabledCommands.includes(interaction.commandName)) {
                await interaction.reply({ content: '❌ Bu komut sunucu yöneticisi tarafından devre dışı bırakılmıştır.', ephemeral: true });
                return;
            }
        }
    }

    const command = commands.find(cmd => cmd.data.name === interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (err) {
        console.error(`Discord Bot: Command ${interaction.commandName} execution error:`, err);
        const replyObj = { content: '❌ Bu komut yürütülürken sistemsel bir hata oluştu!', ephemeral: true };
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp(replyObj).catch(() => null);
        } else {
            await interaction.reply(replyObj).catch(() => null);
        }
    }
});

// SECTION: ADDITIONAL_BOT_MODULES
// PURPOSE: Event listeners for config-driven modules (Welcome, AutoMod, Levels, Reaction Roles) backed by Firestore

// 1. Welcome Message module
client.on('guildMemberAdd', async (member) => {
    const config = guildConfigsCache[member.guild.id];
    if (!config || !config.welcome || !config.welcome.enabled) return;

    const welcome = config.welcome;
    const channelId = welcome.channelId;
    if (!channelId) return;

    try {
        const channel = await member.guild.channels.fetch(channelId).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        const rawMsg = welcome.message || 'Hoş geldin {user}!';
        const msg = rawMsg
            .replace(/{user}/g, `<@${member.id}>`)
            .replace(/{username}/g, member.user.username)
            .replace(/{server}/g, member.guild.name)
            .replace(/{memberCount}/g, String(member.guild.memberCount));

        if (welcome.embedEnabled) {
            const embed = new EmbedBuilder()
                .setTitle(welcome.embedTitle || 'Hoş Geldiniz!')
                .setColor(welcome.embedColor || 0x7c5af5)
                .setDescription(msg)
                .setThumbnail(member.user.displayAvatarURL())
                .setTimestamp();
            await (channel as any).send({ content: `<@${member.id}>`, embeds: [embed] }).catch(() => null);
        } else {
            await (channel as any).send(msg).catch(() => null);
        }

        if (welcome.dmEnabled && welcome.dmMessage) {
            const dm = welcome.dmMessage
                .replace(/{user}/g, member.user.username)
                .replace(/{server}/g, member.guild.name);
            await member.send(dm).catch(() => null);
        }
    } catch (e: any) {
        console.warn('Discord Bot: Welcome execution failed:', e.message);
    }
});

// 2. Levels / XP gain cooldown map
const xpCooldowns = new Set<string>();

async function handleUserXPGain(message: any) {
    if (message.author.bot || !message.guildId) return;

    const config = guildConfigsCache[message.guildId];
    if (!config || !config.levels || !config.levels.enabled) return;

    const key = `${message.guildId}:${message.author.id}`;
    if (xpCooldowns.has(key)) return;

    const levels = config.levels;
    const xpMin = levels.xpMin || 15;
    const xpMax = levels.xpMax || 25;
    const xpGained = Math.floor(Math.random() * (xpMax - xpMin + 1)) + xpMin;

    // Set user cooldown
    xpCooldowns.add(key);
    setTimeout(() => xpCooldowns.delete(key), (levels.cooldownSeconds || 60) * 1000);

    try {
        const key = `level_profile_${message.guildId}_${message.author.id}`;
        const { data: row } = await supabase.from('app_settings').select('*').eq('key', key).maybeSingle();
        const data = row?.value || {};

        let xp = xpGained + Number(data.xp || 0);
        let level = Number(data.level || 1);

        const nextLevelXp = level * 100;
        if (xp >= nextLevelXp) {
            level++;
            const lvlMsg = await message.channel.send(`🎉 Tebrikler ${message.author}! Seviye atladın ve **Level ${level}** oldun!`).catch(() => null);
            if (lvlMsg) setTimeout(() => lvlMsg.delete().catch(() => null), 6000);

            // Assign reward role
            const rewards = levels.rewards || {};
            const rewardRoleId = rewards[level];
            if (rewardRoleId && message.member) {
                await message.member.roles.add(rewardRoleId).catch(() => null);
            }
        }

        await supabase.from('app_settings').upsert([{
            key,
            value: {
                guildId: message.guildId,
                userId: message.author.id,
                xp,
                level,
                lastMessageAt: Date.now()
            },
            updated_at: new Date().toISOString()
        }], { onConflict: 'key' });
    } catch (e: any) {
        console.warn('Discord Bot: Levels profile update failed:', e.message);
    }
}

// 3. AutoMod & message XP listener
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guildId) return;

    // Handle XP gain concurrently
    handleUserXPGain(message).catch(() => null);

    const config = guildConfigsCache[message.guildId];
    if (!config || !config.automod || !config.automod.enabled) return;

    const automod = config.automod;
    const member = message.member;
    if (!member) return;

    // Check exemptions
    const exemptRoles = automod.antiLink?.exemptRoles || [];
    const exemptChannels = automod.exemptChannels || [];

    if (exemptChannels.includes(message.channelId)) return;
    const hasExemptRole = member.roles.cache.some(r => exemptRoles.includes(r.id));
    if (hasExemptRole) return;

    const content = message.content;
    let shouldDelete = false;
    let action = 'delete';
    let reason = 'AutoMod Violation';

    // 3.1 Anti-Link
    if (automod.antiLink_enabled && /https?:\/\/[^\s]+/.test(content)) {
        shouldDelete = true;
        action = automod.antiLink_action || 'warn';
        reason = 'Zararlı/İzinsiz Link Paylaşımı';
    }

    // 3.2 Anti-Invite
    if (automod.antiInvite_enabled && /(discord\.gg|discord\.com\/invite)\/[^\s]+/.test(content)) {
        shouldDelete = true;
        action = automod.antiLink_action || 'warn';
        reason = 'Sunucu Davet Linki Paylaşımı';
    }

    // 3.3 Bad Words
    if (automod.badWords_enabled && automod.badWords_list) {
        const badWords = String(automod.badWords_list).split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
        const lowerContent = content.toLowerCase();
        const containsBadWord = badWords.some(w => lowerContent.includes(w));
        if (containsBadWord) {
            shouldDelete = true;
            action = 'delete';
            reason = 'Yasaklı Kelime Kullanımı';
        }
    }

    // 3.4 Anti-Caps
    if (automod.antiCaps_enabled && content.length >= 10) {
        const capsCount = content.replace(/[^A-ZÇĞİÖŞÜ]/g, '').length;
        const percent = (capsCount / content.length) * 100;
        const maxPercent = automod.antiCaps_maxPercent || 70;
        if (percent > maxPercent) {
            shouldDelete = true;
            action = 'delete';
            reason = 'Aşırı Büyük Harf Kullanımı';
        }
    }

    if (shouldDelete) {
        await message.delete().catch(() => null);
        if (action === 'warn') {
            const warnChannel = await message.channel.send(`⚠️ ${message.author}, lütfen sunucumuzda kurallara uyun. Sebep: **${reason}**`).catch(() => null);
            if (warnChannel) setTimeout(() => warnChannel.delete().catch(() => null), 6000);
        } else if (action === 'timeout') {
            await member.timeout(10 * 60 * 1000, `AutoMod: ${reason}`).catch(() => null);
            const muteMsg = await message.channel.send(`⏱️ ${message.author} 10 dakika boyunca susturuldu. Sebep: **${reason}**`).catch(() => null);
            if (muteMsg) setTimeout(() => muteMsg.delete().catch(() => null), 8000);
        }
    }
});

// 4. Reaction Roles panel listeners
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot || !reaction.message.guildId) return;

    if (reaction.partial) await reaction.fetch().catch(() => null);
    const messageId = reaction.message.id;
    const guildId = reaction.message.guildId;

    const config = guildConfigsCache[guildId];
    if (!config || !config.reactionRoles) return;

    const panel = (config.reactionRoles as any[] || []).find(p => p.messageId === messageId || p.channelId === reaction.message.channelId);
    if (!panel) return;

    const emojiName = reaction.emoji.name;
    const option = (panel.roles as any[] || []).find(r => r.emoji === emojiName);
    if (!option) return;

    const guild = reaction.message.guild;
    if (!guild) return;

    const member = await guild.members.fetch(user.id).catch(() => null);
    if (member) {
        await member.roles.add(option.roleId).catch(() => null);
    }
});

client.on('messageReactionRemove', async (reaction, user) => {
    if (user.bot || !reaction.message.guildId) return;

    if (reaction.partial) await reaction.fetch().catch(() => null);
    const messageId = reaction.message.id;
    const guildId = reaction.message.guildId;

    const config = guildConfigsCache[guildId];
    if (!config || !config.reactionRoles) return;

    const panel = (config.reactionRoles as any[] || []).find(p => p.messageId === messageId || p.channelId === reaction.message.channelId);
    if (!panel) return;

    const emojiName = reaction.emoji.name;
    const option = (panel.roles as any[] || []).find(r => r.emoji === emojiName);
    if (!option) return;

    const guild = reaction.message.guild;
    if (!guild) return;

    const member = await guild.members.fetch(user.id).catch(() => null);
    if (member) {
        await member.roles.remove(option.roleId).catch(() => null);
    }
});

async function sendDailyWeeklyReports() {
    console.log('Discord Bot: Executing scheduled stats reporting...');
    for (const [guildId, config] of Object.entries(guildConfigsCache)) {
        const targetChannelId = config.statsChannelId || config.logChannelId;
        if (!targetChannelId) continue;

        try {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) continue;

            const channel = await client.channels.fetch(targetChannelId).catch(() => null);
            if (!channel || !channel.isTextBased()) continue;

            const { data: cases, error } = await supabase
                .from('sapphire_cases')
                .select('*')
                .eq('guild_id', guildId);

            if (error || !cases || cases.length === 0) continue;

            const totalCount = cases.length;
            const staffSet = new Set(cases.map(c => c.author_discord_id || c.author_display_name).filter(Boolean));
            const activeStaffCount = staffSet.size;

            const validCount = cases.filter(c => String(c.cuk_verdict || '').toLowerCase() === 'valid').length;
            const invalidCount = cases.filter(c => String(c.cuk_verdict || '').toLowerCase() === 'invalid').length;
            const accuracy = totalCount ? Math.round((validCount / totalCount) * 100) : 0;

            const now = Date.now();
            const last24hCount = cases.filter(c => c.scraped_at && (now - new Date(c.scraped_at).getTime()) <= 24 * 60 * 60 * 1000).length;
            const last7dCount = cases.filter(c => c.scraped_at && (now - new Date(c.scraped_at).getTime()) <= 7 * 24 * 60 * 60 * 1000).length;

            const typesMap: Record<string, number> = {};
            cases.forEach(c => {
                const t = String(c.type || 'unknown').toUpperCase();
                typesMap[t] = (typesMap[t] || 0) + 1;
            });
            const typesFormatted = Object.entries(typesMap)
                .map(([type, count]) => `• \`${type}\`: **${count}**`)
                .join('\n') || '• Kayıt yok';

            const categoriesMap: Record<string, number> = {};
            const classifyReasonLocal = (reason: string): string => {
                const raw = String(reason || '').toLowerCase();
                if (/yetkili|adal|admin|mod|ekip|ismini|aşağ|iftira/i.test(raw)) return 'Yetkililere Saygısızlık';
                if (/oyuncu|şahsa|kişiye|üyeye|saygısızlık|hakaret/i.test(raw)) return 'Oyunculara Saygısızlık';
                if (/küfür|argo|uygunsuz/i.test(raw)) return 'Küfür / Hakaret';
                if (/dini|milli|kutsal|atatürk|din/i.test(raw) && !/dinamik/i.test(raw)) return 'Dini / Milli Değerler';
                if (/düzen|sohbet|bozmak|flood|spam|polemik|toks|toxic|kışkırt/i.test(raw)) return 'Sunucu Dinamiği';
                if (/reklam|davet|discord\.gg|youtube\.com/i.test(raw)) return 'Reklam';
                if (/destek|bilet|ticket/i.test(raw)) return 'Destek Talebi';
                return 'Diğer / Yönetim Kararı';
            };

            cases.forEach(c => {
                const cat = classifyReasonLocal(c.reason_raw || '');
                categoriesMap[cat] = (categoriesMap[cat] || 0) + 1;
            });
            const categoriesFormatted = Object.entries(categoriesMap)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, count]) => `• ${cat}: **${count}**`)
                .join('\n') || '• Kayıt yok';

            const accuracyColor = accuracy >= 90 ? 0x2ed573 : accuracy >= 80 ? 0xffa502 : 0xff4757;
            const accuracyEmoji = accuracy >= 90 ? '🟢 MÜKEMMEL' : accuracy >= 80 ? '🟡 STABİL' : '🔴 KRİTİK SEVİYE';

            const embed = new EmbedBuilder()
                .setTitle(`📅 Günlük Sunucu Moderasyon Raporu`)
                .setColor(accuracyColor)
                .setDescription(`Sistem tarafından otomatik hazırlanan günlük özet moderasyon ve CUK denetim raporu.`)
                .addFields(
                    { name: '📈 Genel Durum', value: `Top. Ceza: **${totalCount}**\nAktif Yetkili: **${activeStaffCount}**\nSon 24 Saat: **+${last24hCount}**\nSon 7 Gün: **+${last7dCount}**`, inline: true },
                    { name: '🎯 CUK Uyum Skoru', value: `Skor: **%${accuracy}**\nDurum: **${accuracyEmoji}**\n✅ Geçerli: **${validCount}**\n❌ Hatalı: **${invalidCount}**`, inline: true },
                    { name: '⚡ Ceza Dağılımları', value: typesFormatted },
                    { name: '📜 En Sık İhlal Edilen Kurallar', value: categoriesFormatted }
                )
                .setFooter({ text: 'Lutheus Otomatik Günlük Zamanlayıcı' })
                .setTimestamp();

            await (channel as any).send({ embeds: [embed] }).catch(() => null);
            console.log(`Discord Bot: Dispatched scheduled stats report for guild ${guildId}`);

        } catch (err: any) {
            console.error(`Discord Bot: Scheduled report failure for guild ${guildId}:`, err.message);
        }
    }
}

function startScheduledReporting() {
    console.log('Discord Bot: Starting daily scheduled reporting clock...');
    setInterval(sendDailyWeeklyReports, 24 * 60 * 60 * 1000);
}

if (botToken) {
    startHealthServer();
    client.login(botToken).catch((err) => {
        lastError = classifyDiscordError(err);
        console.error('Discord Bot: Client login failed:', err.message);
    });
} else {
    startHealthServer();
    console.error('Discord Bot: MISSING_DISCORD_BOT_TOKEN');
}

process.on('unhandledRejection', (reason: any) => {
    lastError = classifyDiscordError(reason);
    console.error('Discord Bot: Unhandled rejection:', reason?.message || reason);
});

process.on('uncaughtException', (error: any) => {
    lastError = classifyDiscordError(error);
    console.error('Discord Bot: Uncaught exception:', error?.message || error);
});

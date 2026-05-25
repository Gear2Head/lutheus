import {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    EmbedBuilder,
    ActivityType
} from 'discord.js';
import { db, botToken, logChannelId, guildId } from './botConfig.js';
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

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.MessageContent
    ]
});

const commands = [
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
];

async function registerSlashCommands() {
    if (!botToken) {
        console.warn('Discord Bot: DISCORD_BOT_TOKEN is not set. Skipping command registration.');
        return;
    }
    const rest = new REST({ version: '10' }).setToken(botToken);
    try {
        const clientAppId = process.env.DISCORD_CLIENT_ID || '1500551629768888542';
        console.log('Discord Bot: Registering slash commands...');
        await rest.put(
            Routes.applicationGuildCommands(clientAppId, guildId),
            { body: commands.map(cmd => cmd.data.toJSON()) }
        );
        console.log('Discord Bot: Slash commands registered successfully!');
    } catch (error) {
        console.error('Discord Bot: Slash command registration failed:', error);
    }
}

async function syncModeratorProfiles(actor = 'system') {
    console.log(`Discord Bot: Starting profile synchronization triggered by ${actor}...`);
    try {
        const snapshot = await db.collection('roleCache').get();
        if (snapshot.empty) return;

        let syncCount = 0;
        for (const doc of snapshot.docs) {
            const data = doc.data();
            const discordId = data.discordId || String(data.identityKey || doc.id).replace(/^discord:/, '');
            if (!discordId || !/^\d{17,20}$/.test(discordId)) continue;

            try {
                const user = await client.users.fetch(discordId);
                const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 }) || null;
                const displayName = user.globalName || user.username;

                await doc.ref.update({
                    displayName,
                    avatar: avatarUrl,
                    updatedAt: new Date().toISOString(),
                    updatedBy: 'discord-bot-sync'
                });

                const regRef = db.collection('userRegistry').doc(discordId);
                const regSnap = await regRef.get();
                if (regSnap.exists) {
                    await regRef.update({
                        name: displayName,
                        avatar: avatarUrl,
                        lastSeen: Date.now()
                    });
                }
                syncCount++;
            } catch (userErr: any) {
                console.warn(`Discord Bot: Failed to fetch user ${discordId}:`, userErr.message);
            }
        }

        console.log(`Discord Bot: Successfully synchronized ${syncCount} profiles!`);

        await db.collection('auditLogs').add({
            action: 'discord_profiles_synced',
            details: { syncCount, actor },
            createdAt: new Date().toISOString()
        });

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
                await channel.send({ embeds: [embed] }).catch(() => null);
            }
        }
    } catch (err: any) {
        console.error('Discord Bot: Profile sync failed:', err.message);
    }
}

function startFirestoreListeners() {
    console.log('Discord Bot: Initializing Firestore listeners...');

    let initialized = false;
    db.collection('cases')
        .orderBy('scrapedAt', 'desc')
        .limit(10)
        .onSnapshot(async (snapshot) => {
            if (!initialized) {
                initialized = true;
                return;
            }

            for (const change of snapshot.docChanges()) {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    if (!data) continue;

                    if (data.isTest) {
                        console.log('Discord Bot: Received a test log trigger!');
                        await sendTestCaseLog(data);
                        await change.doc.ref.delete().catch(() => null);
                        continue;
                    }

                    await sendCaseEmbedLog(data);
                }
            }
        }, (error) => {
            console.error('Discord Bot: Firestore cases listener error:', error);
        });

    db.collection('rolePolicy').doc('settings')
        .onSnapshot(async (docSnap) => {
            if (docSnap.exists) {
                const policy = docSnap.data();
                if (policy && policy.syncTrigger) {
                    const ts = policy.syncTrigger.timestamp || 0;
                    if (Date.now() - ts < 15000) {
                        await syncModeratorProfiles(policy.syncTrigger.actor || 'panel');
                    }
                }
            }
        }, (error) => {
            console.error('Discord Bot: Firestore settings listener error:', error);
        });
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

        await channel.send({ embeds: [embed] }).catch(() => null);
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

        await channel.send({ embeds: [embed] }).catch(() => null);
        console.log(`Discord Bot: Dispatched Test embed log successfully!`);
    } catch (err: any) {
        console.error('Discord Bot: Failed to dispatch test embed log:', err.message);
    }
}

client.once('ready', async () => {
    console.log(`Discord Bot: Logged in successfully as ${client.user?.tag}!`);
    client.user?.setActivity('Lutheus SRE Audit', { type: ActivityType.Watching });

    await registerSlashCommands();
    startFirestoreListeners();
    setupAuditLogListeners();
});

// SECTION: AUDIT_LOG_LISTENERS
// PURPOSE: Discord native moderasyon olaylarını (ban, unban, kick, timeout) otomatik log kanalına iletir.
function setupAuditLogListeners() {
    // Member ban added
    client.on('guildBanAdd', async (ban) => {
        if (!logChannelId) return;
        try {
            const channel = await client.channels.fetch(logChannelId).catch(() => null);
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
        if (!logChannelId) return;
        try {
            const channel = await client.channels.fetch(logChannelId).catch(() => null);
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

    // Member removed (kick detection via audit log)
    client.on('guildMemberRemove', async (member) => {
        if (!logChannelId) return;
        try {
            await new Promise(r => setTimeout(r, 500)); // Small delay to ensure audit log is available
            const audit = await member.guild.fetchAuditLogs({ type: 20 /* KICK_MEMBER */, limit: 1 }).catch(() => null);
            const entry = audit?.entries.first();
            if (!entry || entry.targetId !== member.id) return;
            if (Date.now() - entry.createdTimestamp > 5000) return; // Only recent kicks
            const channel = await client.channels.fetch(logChannelId).catch(() => null);
            if (!channel || !channel.isTextBased()) return;
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
        } catch {
            // Ignore audit log delivery failures.
        }
    });

    // Member timeout (via member update)
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        if (!logChannelId) return;
        const wasTimedOut = !!oldMember.communicationDisabledUntil;
        const isTimedOut = !!newMember.communicationDisabledUntil;
        if (wasTimedOut === isTimedOut) return;
        try {
            const channel = await client.channels.fetch(logChannelId).catch(() => null);
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
        if (!logChannelId) return;
        try {
            const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
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

if (botToken) {
    client.login(botToken).catch((err) => {
        console.error('Discord Bot: Client login failed:', err.message);
    });
} else {
    console.error('Discord Bot: DISCORD_BOT_TOKEN environment variable is not defined!');
}

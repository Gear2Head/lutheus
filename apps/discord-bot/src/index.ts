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

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages
    ]
});

const commands = [
    EmergencyLockdownCommand,
    QueryCaseCommand,
    QueryStaffCommand
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
});

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

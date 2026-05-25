import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, AuditLogEvent } from 'discord.js';
import { db } from '../../botConfig.js';

// SECTION: MOD_LOGS_COMMAND
// PURPOSE: Son moderasyon eylemlerini Firestore'dan çekip Discord'a listeler.
export const ModLogsCommand = {
    data: new SlashCommandBuilder()
        .setName('mod-log')
        .setDescription('Son moderasyon eylemlerini listeler.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addIntegerOption(opt => opt.setName('limit').setDescription('Listelenecek kayıt sayısı (max 15)').setMinValue(1).setMaxValue(15).setRequired(false))
        .addStringOption(opt => opt.setName('eylem').setDescription('Eylem türü filtrele').setRequired(false)
            .addChoices(
                { name: 'Ban', value: 'ban' },
                { name: 'Kick', value: 'kick' },
                { name: 'Timeout', value: 'timeout' },
                { name: 'Uyarı', value: 'warn' },
                { name: 'Toplu Silme', value: 'purge' },
            )),

    async execute(interaction: ChatInputCommandInteraction) {
        const limit = interaction.options.getInteger('limit') ?? 10;
        const actionFilter = interaction.options.getString('eylem');

        await interaction.deferReply({ ephemeral: true });

        try {
            let query = db.collection('auditLogs')
                .where('guildId', '==', interaction.guild!.id)
                .orderBy('createdAt', 'desc')
                .limit(limit);

            if (actionFilter) {
                query = db.collection('auditLogs')
                    .where('guildId', '==', interaction.guild!.id)
                    .where('action', '==', actionFilter)
                    .orderBy('createdAt', 'desc')
                    .limit(limit) as any;
            }

            const snap = await query.get();

            if (snap.empty) {
                await interaction.editReply({ content: '📋 Kayıt bulunamadı.' });
                return;
            }

            const actionEmoji: Record<string, string> = {
                ban: '🔨', kick: '👢', timeout: '⏱️', warn: '⚠️', purge: '🧹',
                discord_profiles_synced: '🔄', emergency_lockdown: '🚨'
            };

            const lines = snap.docs.map(doc => {
                const d = doc.data();
                const emoji = actionEmoji[d.action] || '📌';
                const date = d.createdAt ? `<t:${Math.floor(new Date(d.createdAt).getTime() / 1000)}:R>` : 'Bilinmiyor';
                const target = d.targetTag ? `**${d.targetTag}**` : d.channelName ? `#${d.channelName}` : '–';
                return `${emoji} \`${d.action}\` ${target} — *${d.actorTag || 'sistem'}* ${date}`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setTitle(`📋 Mod Kayıtları${actionFilter ? ` (${actionFilter})` : ''}`)
                .setColor(0x7c5af5)
                .setDescription(lines)
                .setFooter({ text: `Son ${snap.size} kayıt • Lutheus Mod Sistemi` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err: any) {
            await interaction.editReply({ content: `❌ **Hata:** ${err.message}` });
        }
    }
};

// SECTION: BOT_COMMANDS
// PURPOSE: Fetches recent moderation audit logs from Supabase.

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { supabase, guildId as envGuildId } from '../../botConfig.js';

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
            let queryBuilder = supabase
                .from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (actionFilter) {
                queryBuilder = queryBuilder.eq('action', actionFilter);
            }

            const { data: rows, error } = await queryBuilder;

            if (error) throw error;
            if (!rows || rows.length === 0) {
                const gid = interaction.guildId || envGuildId || '';
                const { count: totalCount } = await supabase
                    .from('audit_logs')
                    .select('*', { count: 'exact', head: true });
                const filtered = rows && actionFilter ? `action=${actionFilter}` : 'filtre yok';
                await interaction.editReply({
                    content: [
                        '📋 Kayıt bulunamadı.',
                        `Guild: \`${gid || 'tanimsiz'}\``,
                        `audit_logs toplam: **${totalCount ?? '?'}**`,
                        `Sorgu: limit=${limit}, ${filtered}`,
                        'Ipucu: Kayitlar metadata.guildId ile yazilir; RLS veya bos tablo olabilir.',
                    ].join('\n'),
                });
                return;
            }

            const actionEmoji: Record<string, string> = {
                ban: '🔨', kick: '👢', timeout: '⏱️', warn: '⚠️', purge: '🧹',
                discord_profiles_synced: '🔄', emergency_lockdown: '🚨'
            };

            const lines = rows.map((d: any) => {
                const meta = d.metadata || {};
                const emoji = actionEmoji[d.action] || '📌';
                const date = d.created_at ? `<t:${Math.floor(new Date(d.created_at).getTime() / 1000)}:R>` : 'Bilinmiyor';
                const target = meta.targetTag ? `**${meta.targetTag}**` : meta.channelName ? `#${meta.channelName}` : '–';
                return `${emoji} \`${d.action}\` ${target} — *${meta.actorTag || d.actor_email || 'sistem'}* ${date}`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setTitle(`📋 Mod Kayıtları${actionFilter ? ` (${actionFilter})` : ''}`)
                .setColor(0x7c5af5)
                .setDescription(lines)
                .setFooter({ text: `Son ${rows.length} kayıt • Lutheus Mod Sistemi` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err: any) {
            await interaction.editReply({ content: `❌ **Hata:** ${err.message}` });
        }
    }
};

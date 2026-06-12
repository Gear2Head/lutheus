// SECTION: BOT_COMMANDS
// PURPOSE: Paginated Sapphire case history viewer with buttons and user search dropdown filter.

import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    UserSelectMenuBuilder,
} from 'discord.js';
import { supabase, guildId as envGuildId } from '../botConfig.js';
import { formatCaseDuration } from '../lib/caseEmbed.js';

export async function buildCasesMessage(guildId: string, filter: string, page: number, targetUserId: string) {
    let query = supabase
        .from('sapphire_cases')
        .select('*', { count: 'exact' })
        .eq('guild_id', guildId);

    if (filter !== 'all') {
        query = query.eq('type', filter);
    }

    if (targetUserId !== 'none') {
        query = query.eq('punished_user_discord_id', targetUserId);
    }

    query = query.order('created_at_sapphire', { ascending: false });

    const limit = 10;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: rows, count, error } = await query;
    if (error) throw error;

    const totalCases = count || 0;
    const totalPages = Math.max(1, Math.ceil(totalCases / limit));

    const embed = new EmbedBuilder()
        .setTitle('🔨 Sapphire Ceza Geçmişi')
        .setColor(filter === 'mute' ? 0xffa502 : filter === 'ban' ? 0xff4757 : filter === 'warn' ? 0x2ed573 : 0x7c5af5)
        .setTimestamp();

    let description = '';
    if (targetUserId !== 'none') {
        description += `👤 **Kullanıcı Filtresi:** <@${targetUserId}>\n`;
    }
    if (filter !== 'all') {
        description += `🏷️ **Tür Filtresi:** \`${filter.toUpperCase()}\`\n`;
    }
    if (description) description += '\n';

    if (!rows || rows.length === 0) {
        description += `❌ **Kayıt Bulunamadı:** Belirtilen filtrelere uygun ceza kaydı bulunmamaktadır.`;
    } else {
        rows.forEach((row, i) => {
            const index = from + i + 1;
            const userMention = row.punished_user_discord_id ? `<@${row.punished_user_discord_id}>` : `**${row.punished_user_display_name || 'Bilinmiyor'}**`;
            const staffMention = row.author_discord_id ? `<@${row.author_discord_id}>` : `**${row.author_display_name || 'Bilinmiyor'}**`;
            const duration = formatCaseDuration(row);
            const typeStr = String(row.type || 'bilinmiyor').toUpperCase();
            const reason = row.reason_raw || '-';

            description += `**${index}.** \`#${row.case_id}\` • ${userMention}\n`;
            description += `└ **Tür / Süre:** \`${typeStr}\` / \`${duration}\` • **Yetkili:** ${staffMention}\n`;
            description += `└ **Sebep:** \`${reason.length > 80 ? reason.slice(0, 80) + '...' : reason}\`\n\n`;
        });
    }

    embed.setDescription(description);
    embed.setFooter({ text: `Sayfa ${page} / ${totalPages} • Toplam ${totalCases} Ceza` });

    const filterRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`case_nav:all:1:${targetUserId}`)
            .setLabel('Genel')
            .setStyle(filter === 'all' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`case_nav:mute:1:${targetUserId}`)
            .setLabel('Mute')
            .setStyle(filter === 'mute' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`case_nav:ban:1:${targetUserId}`)
            .setLabel('Ban')
            .setStyle(filter === 'ban' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`case_nav:warn:1:${targetUserId}`)
            .setLabel('Warn')
            .setStyle(filter === 'warn' ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );

    const selectRow = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
        new UserSelectMenuBuilder()
            .setCustomId(`case_user_select:${filter}:${page}`)
            .setPlaceholder('Cezalarda kullanıcı ara...')
    );

    const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`case_nav:${filter}:${page - 1}:${targetUserId}`)
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page <= 1),
        new ButtonBuilder()
            .setCustomId(`case_nav:all:1:none`)
            .setEmoji('🏠')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`case_nav:${filter}:${page + 1}:${targetUserId}`)
            .setEmoji('▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= totalPages)
    );

    return {
        embeds: [embed],
        components: [filterRow, selectRow, navRow],
    };
}

export const CezalarCommand = {
    data: new SlashCommandBuilder()
        .setName('cezalar')
        .setDescription('Sapphire ceza geçmişini listeler ve filtreler.')
        .addUserOption(option =>
            option.setName('kullanici')
                .setDescription('Cezalarını sorgulamak istediğiniz kullanıcı')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('tip')
                .setDescription('Ceza türüne göre filtrele')
                .setRequired(false)
                .addChoices(
                    { name: 'Genel (Hepsi)', value: 'all' },
                    { name: 'Mute', value: 'mute' },
                    { name: 'Ban', value: 'ban' },
                    { name: 'Warn', value: 'warn' }
                )
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('kullanici', false);
        const filter = interaction.options.getString('tip', false) || 'all';
        const targetUserId = targetUser ? targetUser.id : 'none';
        const targetGuildId = interaction.guildId || envGuildId || '1223431616081166336';

        try {
            const payload = await buildCasesMessage(targetGuildId, filter, 1, targetUserId);
            await interaction.editReply(payload);
        } catch (error) {
            console.error('Cezalar command execution error:', error);
            await interaction.editReply({ content: '❌ Ceza listesi yüklenirken bir hata oluştu.' });
        }
    }
};

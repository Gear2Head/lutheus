import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, TextChannel } from 'discord.js';
import { db } from '../../botConfig.js';

// SECTION: PURGE_COMMAND
// PURPOSE: Kanaldan toplu mesaj siler (max 100, 14 günden eski mesajlar silinemez).
export const PurgeCommand = {
    data: new SlashCommandBuilder()
        .setName('temizle')
        .setDescription('Kanaldan belirtilen sayıda mesajı toplu siler (maks 100).')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(opt => opt.setName('miktar').setDescription('Silinecek mesaj sayısı (1-100)').setMinValue(1).setMaxValue(100).setRequired(true))
        .addUserOption(opt => opt.setName('kullanici').setDescription('Sadece bu kullanıcının mesajlarını sil').setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        const amount = interaction.options.getInteger('miktar', true);
        const filterUser = interaction.options.getUser('kullanici');

        await interaction.deferReply({ ephemeral: true });

        try {
            const channel = interaction.channel as TextChannel;
            const messages = await channel.messages.fetch({ limit: 100 });

            let toDelete = [...messages.values()];

            // Remove messages older than 14 days (Discord bulk delete limitation)
            const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
            toDelete = toDelete.filter(m => m.createdTimestamp > twoWeeksAgo);

            if (filterUser) {
                toDelete = toDelete.filter(m => m.author.id === filterUser.id);
            }

            toDelete = toDelete.slice(0, amount);

            if (toDelete.length === 0) {
                await interaction.editReply({ content: '❌ Silinecek mesaj bulunamadı (14 günden eski mesajlar toplu silinemez).' });
                return;
            }

            const deleted = await channel.bulkDelete(toDelete, true);

            await db.collection('auditLogs').add({
                action: 'purge', count: deleted.size,
                actorId: interaction.user.id, actorTag: interaction.user.tag,
                channelId: channel.id, channelName: channel.name,
                filterUserId: filterUser?.id || null,
                guildId: interaction.guild!.id, createdAt: new Date().toISOString(),
            });

            const embed = new EmbedBuilder()
                .setTitle('🧹 Toplu Mesaj Silindi')
                .setColor(0x2ed573)
                .addFields(
                    { name: '🗑️ Silinen', value: `**${deleted.size}** mesaj`, inline: true },
                    { name: '📍 Kanal', value: `${channel}`, inline: true },
                    { name: '👮 Yetkili', value: `**${interaction.user.tag}**`, inline: true },
                    filterUser ? { name: '🎯 Filtre', value: `**${filterUser.tag}**`, inline: true } : { name: '\u200b', value: '\u200b', inline: true }
                )
                .setFooter({ text: 'Lutheus Mod Sistemi' }).setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // Delete the reply after 5 seconds
            setTimeout(() => interaction.deleteReply().catch(() => null), 5000);
        } catch (err: any) {
            await interaction.editReply({ content: `❌ **Hata:** ${err.message}` });
        }
    }
};

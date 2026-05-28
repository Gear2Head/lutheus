// SECTION: BOT_COMMANDS
// PURPOSE: Message bulk delete command with audit logging to Supabase.

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, TextChannel } from 'discord.js';
import { supabase } from '../../botConfig.js';

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

            await supabase.from('audit_logs').insert([{
                action: 'purge',
                target_type: 'channel',
                actor_discord_id: interaction.user.id,
                metadata: {
                    count: deleted.size,
                    actorTag: interaction.user.tag,
                    channelId: channel.id,
                    channelName: channel.name,
                    filterUserId: filterUser?.id || null,
                    guildId: interaction.guild!.id
                },
                created_at: new Date().toISOString()
            }]);

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

            setTimeout(() => interaction.deleteReply().catch(() => null), 5000);
        } catch (err: any) {
            await interaction.editReply({ content: `❌ **Hata:** ${err.message}` });
        }
    }
};

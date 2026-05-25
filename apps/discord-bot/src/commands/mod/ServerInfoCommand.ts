import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

// SECTION: SERVERINFO_COMMAND
// PURPOSE: Sunucu hakkında detaylı istatistikler gösterir.
export const ServerInfoCommand = {
    data: new SlashCommandBuilder()
        .setName('sunucu-bilgi')
        .setDescription('Sunucu hakkında detaylı bilgi ve istatistikler gösterir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const guild = await interaction.guild!.fetch();
            const owner = await guild.fetchOwner().catch(() => null);
            const channels = guild.channels.cache;
            const textChannels = channels.filter(c => c.type === 0).size;
            const voiceChannels = channels.filter(c => c.type === 2).size;
            const categoryChannels = channels.filter(c => c.type === 4).size;
            const roles = guild.roles.cache.filter(r => r.id !== guild.id).size;
            const emojis = guild.emojis.cache.size;
            const boosts = guild.premiumSubscriptionCount ?? 0;
            const boostTier = guild.premiumTier;
            const createdAt = Math.floor(guild.createdTimestamp / 1000);

            const verifyLevel = ['Yok', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'][guild.verificationLevel] || 'Bilinmiyor';

            const embed = new EmbedBuilder()
                .setTitle(`🏠 Sunucu Bilgisi — ${guild.name}`)
                .setColor(0x7c5af5)
                .setThumbnail(guild.iconURL({ size: 256 }) || '')
                .setImage(guild.bannerURL({ size: 1024 }) || null)
                .addFields(
                    { name: '🆔 Sunucu ID', value: `\`${guild.id}\``, inline: true },
                    { name: '👑 Sahibi', value: owner ? `**${owner.user.tag}**` : 'Bilinmiyor', inline: true },
                    { name: '📅 Oluşturuldu', value: `<t:${createdAt}:D>`, inline: true },
                    { name: '👥 Üye Sayısı', value: `**${guild.memberCount}**`, inline: true },
                    { name: '🤖 Bot Sayısı', value: `**${guild.members.cache.filter(m => m.user.bot).size}**`, inline: true },
                    { name: '🎭 Rol Sayısı', value: `**${roles}**`, inline: true },
                    { name: '💬 Metin Kanalı', value: `**${textChannels}**`, inline: true },
                    { name: '🔊 Ses Kanalı', value: `**${voiceChannels}**`, inline: true },
                    { name: '📁 Kategori', value: `**${categoryChannels}**`, inline: true },
                    { name: '😄 Emoji', value: `**${emojis}**`, inline: true },
                    { name: '💎 Boost', value: `**${boosts}** (Tier ${boostTier})`, inline: true },
                    { name: '🔒 Doğrulama', value: verifyLevel, inline: true },
                )
                .setFooter({ text: 'Lutheus Mod Sistemi' }).setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err: any) {
            await interaction.editReply({ content: `❌ **Hata:** ${err.message}` });
        }
    }
};

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

// SECTION: USERINFO_COMMAND
// PURPOSE: Bir kullanıcı hakkında detaylı bilgi gösterir (hesap yaşı, roller, katılım tarihi vb.)
export const UserInfoCommand = {
    data: new SlashCommandBuilder()
        .setName('kullanici-bilgi')
        .setDescription('Bir kullanıcı hakkında detaylı bilgi gösterir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(opt => opt.setName('kullanici').setDescription('Bilgi alınacak kullanıcı').setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        const target = interaction.options.getUser('kullanici') || interaction.user;
        await interaction.deferReply({ ephemeral: true });

        try {
            const guild = interaction.guild!;
            const member = await guild.members.fetch(target.id).catch(() => null);

            const createdAt = Math.floor(target.createdTimestamp / 1000);
            const joinedAt = member?.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;

            const roles = member?.roles.cache
                .filter(r => r.id !== guild.id)
                .sort((a, b) => b.position - a.position)
                .map(r => `${r}`)
                .slice(0, 10)
                .join(' ') || 'Rol yok';

            const flags: string[] = [];
            if (target.bot) flags.push('🤖 Bot');
            if (member?.permissions.has(PermissionFlagsBits.Administrator)) flags.push('🛡️ Yönetici');
            if (member?.premiumSinceTimestamp) flags.push('💎 Nitro Booster');

            const embed = new EmbedBuilder()
                .setTitle(`👤 Kullanıcı Bilgisi — ${target.tag}`)
                .setColor(member?.displayColor || 0x7c5af5)
                .setThumbnail(target.displayAvatarURL({ size: 256 }))
                .addFields(
                    { name: '🆔 Discord ID', value: `\`${target.id}\``, inline: true },
                    { name: '📛 Kullanıcı Adı', value: target.username, inline: true },
                    { name: '📅 Hesap Oluşturuldu', value: `<t:${createdAt}:F>\n<t:${createdAt}:R>`, inline: false },
                    joinedAt ? { name: '🏠 Sunucuya Katıldı', value: `<t:${joinedAt}:F>\n<t:${joinedAt}:R>`, inline: false } : { name: '\u200b', value: '\u200b', inline: false },
                    { name: '🎭 Roller', value: roles },
                    flags.length ? { name: '🏷️ Özellikler', value: flags.join(' · ') } : { name: '\u200b', value: '\u200b' }
                )
                .setFooter({ text: 'Lutheus Mod Sistemi' }).setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err: any) {
            await interaction.editReply({ content: `❌ **Hata:** ${err.message}` });
        }
    }
};

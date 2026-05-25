import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, GuildMember } from 'discord.js';
import { db } from '../../botConfig.js';

// SECTION: KICK_COMMAND
// PURPOSE: Kullanıcıyı sunucudan atar (ban değil, geri gelebilir).
export const KickCommand = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Bir kullanıcıyı sunucudan atar (geri girebilir).')
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption(opt => opt.setName('kullanici').setDescription('Atılacak kullanıcı').setRequired(true))
        .addStringOption(opt => opt.setName('sebep').setDescription('Atma sebebi').setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        const target = interaction.options.getUser('kullanici', true);
        const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi';

        await interaction.deferReply({ ephemeral: true });

        try {
            const guild = interaction.guild!;
            const member = await guild.members.fetch(target.id).catch(() => null) as GuildMember | null;

            if (!member) { await interaction.editReply({ content: '❌ Bu kullanıcı sunucuda bulunamadı.' }); return; }
            if (!member.kickable) { await interaction.editReply({ content: '❌ Bu kullanıcıyı atamam. Yetkim yetersiz.' }); return; }

            await member.kick(`${interaction.user.tag}: ${reason}`);

            await db.collection('auditLogs').add({
                action: 'kick', targetId: target.id, targetTag: target.tag,
                actorId: interaction.user.id, actorTag: interaction.user.tag,
                reason, guildId: guild.id, createdAt: new Date().toISOString(),
            });

            const embed = new EmbedBuilder()
                .setTitle('👢 Kullanıcı Atıldı')
                .setColor(0xff6b35)
                .setThumbnail(target.displayAvatarURL())
                .addFields(
                    { name: '👤 Kullanıcı', value: `**${target.tag}**\n\`${target.id}\``, inline: true },
                    { name: '👮 Yetkili', value: `**${interaction.user.tag}**`, inline: true },
                    { name: '📝 Sebep', value: reason }
                )
                .setFooter({ text: 'Lutheus Mod Sistemi' }).setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err: any) {
            await interaction.editReply({ content: `❌ **Hata:** ${err.message}` });
        }
    }
};

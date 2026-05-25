import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, GuildMember } from 'discord.js';
import { db } from '../../botConfig.js';

// SECTION: TIMEOUT_COMMAND
// PURPOSE: Kullanıcıyı belirli süre susturur (Discord native timeout/mute).
export const TimeoutCommand = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Bir kullanıcıyı belirli süre susturur (timeout).')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(opt => opt.setName('kullanici').setDescription('Susturulacak kullanıcı').setRequired(true))
        .addIntegerOption(opt => opt.setName('sure_dakika').setDescription('Timeout süresi (dakika, max 40320)').setMinValue(1).setMaxValue(40320).setRequired(true))
        .addStringOption(opt => opt.setName('sebep').setDescription('Timeout sebebi').setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        const target = interaction.options.getUser('kullanici', true);
        const minutes = interaction.options.getInteger('sure_dakika', true);
        const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi';

        await interaction.deferReply({ ephemeral: true });

        try {
            const guild = interaction.guild!;
            const member = await guild.members.fetch(target.id).catch(() => null) as GuildMember | null;

            if (!member) { await interaction.editReply({ content: '❌ Kullanıcı sunucuda bulunamadı.' }); return; }
            if (!member.moderatable) { await interaction.editReply({ content: '❌ Bu kullanıcıyı susturamam. Yetkim yetersiz.' }); return; }

            const durationMs = minutes * 60 * 1000;
            const until = new Date(Date.now() + durationMs);
            await member.timeout(durationMs, `${interaction.user.tag}: ${reason}`);

            const label = minutes >= 1440 ? `${Math.floor(minutes / 1440)} gün` : minutes >= 60 ? `${Math.floor(minutes / 60)} saat` : `${minutes} dakika`;

            await db.collection('auditLogs').add({
                action: 'timeout', targetId: target.id, targetTag: target.tag,
                actorId: interaction.user.id, actorTag: interaction.user.tag,
                reason, durationMinutes: minutes, until: until.toISOString(),
                guildId: guild.id, createdAt: new Date().toISOString(),
            });

            const embed = new EmbedBuilder()
                .setTitle('⏱️ Kullanıcı Susturuldu (Timeout)')
                .setColor(0xffa502)
                .setThumbnail(target.displayAvatarURL())
                .addFields(
                    { name: '👤 Kullanıcı', value: `**${target.tag}**\n\`${target.id}\``, inline: true },
                    { name: '👮 Yetkili', value: `**${interaction.user.tag}**`, inline: true },
                    { name: '⏱️ Süre', value: label, inline: true },
                    { name: '📅 Bitiş', value: `<t:${Math.floor(until.getTime() / 1000)}:R>`, inline: true },
                    { name: '📝 Sebep', value: reason }
                )
                .setFooter({ text: 'Lutheus Mod Sistemi' }).setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err: any) {
            await interaction.editReply({ content: `❌ **Hata:** ${err.message}` });
        }
    }
};

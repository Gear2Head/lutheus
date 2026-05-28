// SECTION: BOT_COMMANDS
// PURPOSE: Unban command with audit logging to Supabase.

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { supabase } from '../../botConfig.js';

export const UnbanCommand = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Yasaklı bir kullanıcının yasağını kaldırır.')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addStringOption(opt => opt.setName('kullanici_id').setDescription('Yasağı kaldırılacak kullanıcının Discord ID\'si').setRequired(true))
        .addStringOption(opt => opt.setName('sebep').setDescription('Yasak kaldırma sebebi').setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        const targetId = interaction.options.getString('kullanici_id', true).trim();
        const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi';

        await interaction.deferReply({ ephemeral: true });

        try {
            const guild = interaction.guild!;
            const ban = await guild.bans.fetch(targetId).catch(() => null);

            if (!ban) {
                await interaction.editReply({ content: `❌ \`${targetId}\` ID'li kullanıcı zaten yasaklı değil veya bulunamadı.` });
                return;
            }

            await guild.bans.remove(targetId, `${interaction.user.tag}: ${reason}`);

            await supabase.from('audit_logs').insert([{
                action: 'unban',
                target_type: 'member',
                actor_discord_id: interaction.user.id,
                metadata: {
                    targetId,
                    targetTag: ban.user.tag,
                    actorTag: interaction.user.tag,
                    reason,
                    guildId: guild.id
                },
                created_at: new Date().toISOString()
            }]);

            const embed = new EmbedBuilder()
                .setTitle('✅ Yasak Kaldırıldı')
                .setColor(0x2ed573)
                .setThumbnail(ban.user.displayAvatarURL())
                .addFields(
                    { name: '👤 Kullanıcı', value: `**${ban.user.tag}**\n\`${ban.user.id}\``, inline: true },
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

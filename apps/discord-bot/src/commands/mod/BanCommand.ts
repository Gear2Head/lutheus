// SECTION: BOT_COMMANDS
// PURPOSE: Permanent ban command with audit logging to Supabase.

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, GuildMember } from 'discord.js';
import { supabase } from '../../botConfig.js';

export const BanCommand = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bir kullanıcıyı sunucudan kalıcı olarak yasaklar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(opt => opt.setName('kullanici').setDescription('Yasaklanacak kullanıcı').setRequired(true))
        .addStringOption(opt => opt.setName('sebep').setDescription('Yasaklama sebebi').setRequired(false))
        .addIntegerOption(opt => opt.setName('mesaj_sil').setDescription('Kaç günlük mesajı silinsin? (0-7)').setMinValue(0).setMaxValue(7).setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction) {
        const target = interaction.options.getUser('kullanici', true);
        const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi';
        const deleteMessageDays = interaction.options.getInteger('mesaj_sil') ?? 0;

        await interaction.deferReply({ ephemeral: true });

        try {
            const guild = interaction.guild!;
            const member = await guild.members.fetch(target.id).catch(() => null) as GuildMember | null;

            if (member && !member.bannable) {
                await interaction.editReply({ content: '❌ Bu kullanıcıyı yasaklayamam. Yetkim yetersiz.' });
                return;
            }

            await guild.bans.create(target.id, { reason: `${interaction.user.tag}: ${reason}`, deleteMessageSeconds: deleteMessageDays * 86400 });

            await supabase.from('audit_logs').insert([{
                action: 'ban',
                target_type: 'member',
                actor_discord_id: interaction.user.id,
                metadata: {
                    targetId: target.id,
                    targetTag: target.tag,
                    actorTag: interaction.user.tag,
                    reason,
                    guildId: guild.id
                },
                created_at: new Date().toISOString()
            }]);

            const embed = new EmbedBuilder()
                .setTitle('🔨 Kullanıcı Yasaklandı')
                .setColor(0xff4757)
                .setThumbnail(target.displayAvatarURL())
                .addFields(
                    { name: '👤 Kullanıcı', value: `**${target.tag}**\n\`${target.id}\``, inline: true },
                    { name: '👮 Yetkili', value: `**${interaction.user.tag}**`, inline: true },
                    { name: '📝 Sebep', value: reason }
                )
                .setFooter({ text: 'Lutheus Mod Sistemi' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (err: any) {
            await interaction.editReply({ content: `❌ **Hata:** ${err.message}` });
        }
    }
};

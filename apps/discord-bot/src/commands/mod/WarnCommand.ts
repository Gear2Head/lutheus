// SECTION: BOT_COMMANDS
// PURPOSE: Warn command with tracking in Supabase app_settings and audit logging.

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { supabase } from '../../botConfig.js';

export const WarnCommand = {
    data: new SlashCommandBuilder()
        .setName('uyar')
        .setDescription('Bir kullanıcıya resmi uyarı verir ve sisteme kaydeder.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(opt => opt.setName('kullanici').setDescription('Uyarılacak kullanıcı').setRequired(true))
        .addStringOption(opt => opt.setName('sebep').setDescription('Uyarı sebebi').setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
        const target = interaction.options.getUser('kullanici', true);
        const reason = interaction.options.getString('sebep', true);

        await interaction.deferReply({ ephemeral: true });

        try {
            const guild = interaction.guild!;
            const key = `warns_${guild.id}_${target.id}`;

            // Count previous warnings
            const { data: row } = await supabase.from('app_settings').select('*').eq('key', key).maybeSingle();
            const warnsList = row ? (row.value || []) : [];
            const warnCount = warnsList.length + 1;

            const newWarn = {
                targetId: target.id,
                targetTag: target.tag,
                actorId: interaction.user.id,
                actorTag: interaction.user.tag,
                reason,
                guildId: guild.id,
                warnNumber: warnCount,
                createdAt: new Date().toISOString(),
            };

            warnsList.push(newWarn);

            await supabase.from('app_settings').upsert([{
                key,
                value: warnsList,
                updated_at: new Date().toISOString()
            }], { onConflict: 'key' });

            await supabase.from('audit_logs').insert([{
                action: 'warn',
                target_type: 'member',
                actor_discord_id: interaction.user.id,
                metadata: {
                    targetId: target.id,
                    targetTag: target.tag,
                    actorTag: interaction.user.tag,
                    reason,
                    warnCount,
                    guildId: guild.id
                },
                created_at: new Date().toISOString()
            }]);

            // Try to DM the user
            const dmEmbed = new EmbedBuilder()
                .setTitle(`⚠️ Uyarı Aldınız — ${guild.name}`)
                .setColor(0xffa502)
                .setDescription(`Bir yetkili tarafından uyarı aldınız.`)
                .addFields(
                    { name: '📝 Sebep', value: reason },
                    { name: '📊 Toplam Uyarınız', value: `**${warnCount}** uyarı` }
                )
                .setFooter({ text: 'Lutheus Mod Sistemi' }).setTimestamp();

            await target.send({ embeds: [dmEmbed] }).catch(() => null);

            const replyEmbed = new EmbedBuilder()
                .setTitle('⚠️ Kullanıcı Uyarıldı')
                .setColor(0xffa502)
                .setThumbnail(target.displayAvatarURL())
                .addFields(
                    { name: '👤 Kullanıcı', value: `**${target.tag}**\n\`${target.id}\``, inline: true },
                    { name: '👮 Yetkili', value: `**${interaction.user.tag}**`, inline: true },
                    { name: '📊 Toplam Uyarı', value: `**${warnCount}**`, inline: true },
                    { name: '📝 Sebep', value: reason }
                )
                .setFooter({ text: 'Lutheus Mod Sistemi' }).setTimestamp();

            await interaction.editReply({ embeds: [replyEmbed] });
        } catch (err: any) {
            await interaction.editReply({ content: `❌ **Hata:** ${err.message}` });
        }
    }
};

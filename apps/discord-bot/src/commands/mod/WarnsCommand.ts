// SECTION: BOT_COMMANDS
// PURPOSE: Warns list command retrieving data from Supabase app_settings.

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { supabase } from '../../botConfig.js';

interface WarnRecord {
    createdAt?: string;
    reason?: string;
    actorTag?: string;
}

export const WarnsCommand = {
    data: new SlashCommandBuilder()
        .setName('uyarilar')
        .setDescription('Bir kullanıcının uyarı geçmişini gösterir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(opt => opt.setName('kullanici').setDescription('Sorgulanan kullanıcı').setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
        const target = interaction.options.getUser('kullanici', true);
        await interaction.deferReply({ ephemeral: true });

        try {
            const guild = interaction.guild!;
            const key = `warns_${guild.id}_${target.id}`;

            const { data: row } = await supabase.from('app_settings').select('*').eq('key', key).maybeSingle();
            const warnsList: WarnRecord[] = row ? ((row.value as WarnRecord[]) || []) : [];

            if (warnsList.length === 0) {
                await interaction.editReply({ content: `✅ **${target.tag}** adlı kullanıcının sistemde kayıtlı uyarısı yok.` });
                return;
            }

            const sortedWarns = [...warnsList].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 10);

            const warnsText = sortedWarns.map((w, i: number) => {
                const date = w.createdAt ? new Date(w.createdAt).toLocaleDateString('tr-TR') : 'Tarih Yok';
                return `**${i + 1}.** \`${date}\` — ${w.reason} *(${w.actorTag || 'Yetkili'})*`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setTitle(`📋 Uyarı Geçmişi — ${target.tag}`)
                .setColor(0xffa502)
                .setThumbnail(target.displayAvatarURL())
                .setDescription(warnsText)
                .addFields({ name: '📊 Toplam Uyarı', value: `**${warnsList.length}**`, inline: true })
                .setFooter({ text: 'Lutheus Mod Sistemi' }).setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            await interaction.editReply({ content: `❌ **Hata:** ${error.message}` });
        }
    }
};

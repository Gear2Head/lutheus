import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { db } from '../../botConfig.js';

// SECTION: WARNS_LIST_COMMAND
// PURPOSE: Bir kullanıcının tüm uyarı geçmişini listeler.
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
            const snap = await db.collection('warns')
                .where('targetId', '==', target.id)
                .where('guildId', '==', guild.id)
                .orderBy('createdAt', 'desc')
                .limit(10)
                .get();

            if (snap.empty) {
                await interaction.editReply({ content: `✅ **${target.tag}** adlı kullanıcının sistemde kayıtlı uyarısı yok.` });
                return;
            }

            const warnsText = snap.docs.map((doc, i) => {
                const w = doc.data();
                const date = w.createdAt ? new Date(w.createdAt).toLocaleDateString('tr-TR') : 'Tarih Yok';
                return `**${i + 1}.** \`${date}\` — ${w.reason} *(${w.actorTag})*`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setTitle(`📋 Uyarı Geçmişi — ${target.tag}`)
                .setColor(0xffa502)
                .setThumbnail(target.displayAvatarURL())
                .setDescription(warnsText)
                .addFields({ name: '📊 Toplam Uyarı', value: `**${snap.size}**`, inline: true })
                .setFooter({ text: 'Lutheus Mod Sistemi' }).setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err: any) {
            await interaction.editReply({ content: `❌ **Hata:** ${err.message}` });
        }
    }
};

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { db } from '../botConfig.js';

export const QueryStaffCommand = {
    data: new SlashCommandBuilder()
        .setName('yetkili-durum')
        .setDescription('Bir yetkilinin CUK performans skorlarını ve istatistiklerini sorgular.')
        .addUserOption(option =>
            option.setName('kullanici')
                .setDescription('Sorgulanacak Discord yetkilisi')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('isim_veya_id')
                .setDescription('Alternatif olarak isim veya Discord ID girin')
                .setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        try {
            const userOption = interaction.options.getUser('kullanici');
            const stringOption = interaction.options.getString('isim_veya_id');

            let targetId = '';
            let targetName = '';

            if (userOption) {
                targetId = userOption.id;
                targetName = userOption.username;
            } else if (stringOption) {
                const raw = stringOption.trim();
                if (/^\d{17,20}$/.test(raw)) {
                    targetId = raw;
                } else {
                    targetName = raw;
                }
            } else {
                targetId = interaction.user.id;
                targetName = interaction.user.username;
            }

            let roleLabel = 'Moderatör';
            let customName = '';
            if (targetId) {
                const cacheSnap = await db.collection('roleCache').doc(`discord_${targetId}`).get();
                if (cacheSnap.exists) {
                    const cache = cacheSnap.data();
                    if (cache) {
                        roleLabel = cache.role || roleLabel;
                        customName = cache.displayName || '';
                    }
                }
            }

            let snapshot;
            if (targetId) {
                snapshot = await db.collection('cases').where('authorId', '==', targetId).get();
            } else {
                snapshot = await db.collection('cases').where('authorName', '==', targetName).get();
            }

            const cases = snapshot.docs.map(doc => doc.data());
            const totalCount = cases.length;

            if (totalCount === 0) {
                await interaction.editReply({
                    content: `ℹ️ **Ceza Kaydı Bulunamadı:** Yetkilinin (${targetName || targetId}) veritabanında henüz taranmış bir ceza kaydı bulunmamaktadır.`
                });
                return;
            }

            const validCount = cases.filter(c => String(c.reviewStatus || '').toLowerCase() === 'valid').length;
            const invalidCount = cases.filter(c => String(c.reviewStatus || '').toLowerCase() === 'invalid').length;
            const pendingCount = cases.filter(c => !c.reviewStatus || String(c.reviewStatus || '').toLowerCase() === 'pending').length;
            const accuracy = totalCount ? Math.round((validCount / totalCount) * 100) : 0;

            const roleLabels: Record<string, string> = {
                admin: '🛡️ Yönetici (Admin)',
                yonetici: '🛡️ Yönetici',
                genel_sorumlu: '👑 Genel Sorumlu',
                discord_yoneticisi: '⚖️ Discord Yöneticisi',
                kidemli_discord_moderatoru: '⚖️ Kıdemli Discord Moderatörü',
                discord_moderatoru: '👮 Discord Moderatörü',
                discord_destek_ekibi: '🤝 Destek Ekibi'
            };
            const resolvedRoleLabel = roleLabels[roleLabel.toLowerCase()] || roleLabel;

            const accuracyColor = accuracy >= 90 ? 0x2ed573 : accuracy >= 80 ? 0xffa502 : 0xff4757;
            const accuracyEmoji = accuracy >= 90 ? '🟢 MÜKEMMEL' : accuracy >= 80 ? '🟡 STABİL' : '🔴 KRİTİK SEVİYE';

            const displayName = customName || targetName || (targetId ? `Yetkili ${targetId.slice(-4)}` : 'Bilinmeyen Yetkili');

            const embed = new EmbedBuilder()
                .setTitle(`📊 Yetkili Performans Karnesi`)
                .setColor(accuracyColor)
                .setDescription(`**${displayName}** yetkilisine ait CUK denetim istatistikleri aşağıda çıkarılmıştır.`)
                .setThumbnail(userOption ? userOption.displayAvatarURL() : 'https://cdn.discordapp.com/embed/avatars/0.png')
                .addFields(
                    { name: '🎖️ Görev / Rütbe', value: `\`${resolvedRoleLabel}\``, inline: true },
                    { name: '🎯 Doğruluk Skoru', value: `**%${accuracy}** (${accuracyEmoji})`, inline: true },
                    { name: '🔨 Toplam İşlem', value: `\`${totalCount}\``, inline: true },
                    { name: '✅ Doğrulanmış (Valid)', value: `\`${validCount}\``, inline: true },
                    { name: '❌ Hatalı (Invalid)', value: `\`${invalidCount}\``, inline: true },
                    { name: '⏳ Bekleyen (Pending)', value: `\`${pendingCount}\``, inline: true }
                )
                .setFooter({ text: 'Lutheus CezaRapor SRE Otomasyonu' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error: any) {
            console.error('Discord Bot: queryStaff error:', error);
            await interaction.editReply({
                content: `🚨 **İstatistik Sorgu Hatası:** Veriler işlenirken bir hata meydana geldi.\nHata: \`${error.message}\``
            });
        }
    }
};

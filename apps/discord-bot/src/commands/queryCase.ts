import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { db } from '../botConfig.js';

export const QueryCaseCommand = {
    data: new SlashCommandBuilder()
        .setName('ceza-sorgu')
        .setDescription('Case ID ile ceza durumunu ve CUK doğruluk analizini sorgular.')
        .addStringOption(option =>
            option.setName('caseid')
                .setDescription('Sorgulanacak ceza ID\'si (Örn: gwm6yH8)')
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const caseId = interaction.options.getString('caseid', true).trim();
        await interaction.deferReply();

        try {
            const snapshot = await db.collection('cases')
                .where('caseId', '==', caseId)
                .limit(1)
                .get();

            if (snapshot.empty) {
                await interaction.editReply({
                    content: `❌ **Ceza Bulunamadı:** \`${caseId}\` kimliğine sahip herhangi bir ceza kaydı veritabanında mevcut değil.`
                });
                return;
            }

            const doc = snapshot.docs[0];
            const data = doc.data();

            const status = String(data.reviewStatus || 'pending').toLowerCase();
            const color = status === 'valid' ? 0x2ed573 : status === 'invalid' ? 0xff4757 : 0xffa502;
            const statusEmoji = status === 'valid' ? '✅ DOĞRULANDI (VALID)' : status === 'invalid' ? '❌ HATALI (INVALID)' : '❓ İNCELENİYOR (PENDING)';

            const embed = new EmbedBuilder()
                .setTitle(`🔨 Ceza Sorgu Raporu - #${caseId}`)
                .setURL(data.sourceUrl || `https://dashboard.sapph.xyz/`)
                .setColor(color)
                .setDescription(`Sistem tarafından saptanan ceza detayları ve kural analizleri aşağıda listelenmiştir.`)
                .addFields(
                    { name: '👤 Cezalı Kullanıcı', value: `**${data.user || 'Bilinmiyor'}**\nID: \`${data.userId || '-'}\``, inline: true },
                    { name: '👮 Cezayı Atan Yetkili', value: `**${data.authorName || 'Bilinmiyor'}**\nID: \`${data.authorId || '-'}\``, inline: true },
                    { name: '⚡ Ceza Türü / Süre', value: `\`${String(data.type || 'unknown').toUpperCase()}\` / \`${data.duration || 'Süresiz'}\``, inline: true },
                    { name: '📝 İlan Edilen Sebep', value: `\`\`\`\n${data.reason || '-'}\n\`\`\`` },
                    { name: '📊 SRE Değerlendirme Durumu', value: `**${statusEmoji}**` }
                );

            if (data.note) {
                embed.addFields({ name: '✏️ Yönetici Notu', value: `*${data.note}*` });
            }

            // Optional AI analysis
            const analysisSnap = await db.collection('analysis').doc(doc.id).get();
            if (analysisSnap.exists) {
                const analysis = analysisSnap.data();
                if (analysis && analysis.feedback) {
                    embed.addFields({ name: '🧠 AI Karar Destek Gerekçesi', value: `\`\`\`\n${analysis.feedback.slice(0, 1000)}\n\`\`\`` });
                }
            }

            embed.setFooter({ text: 'Lutheus CezaRapor SRE Otomasyonu' })
                .setTimestamp(data.scrapedAt ? new Date(data.scrapedAt) : new Date());

            await interaction.editReply({ embeds: [embed] });

        } catch (error: any) {
            console.error('Discord Bot: queryCase error:', error);
            await interaction.editReply({
                content: `🚨 **Sorgu Hatası:** Veritabanına erişirken bir hata meydana geldi.\nHata: \`${error.message}\``
            });
        }
    }
};

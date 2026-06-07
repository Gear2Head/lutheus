// SECTION: BOT_COMMANDS
// PURPOSE: Computes and displays server-wide moderation stats and CUK rule audit compliance statistics.

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { supabase, guildId as envGuildId } from '../botConfig.js';

function classifyReason(reason: string): string {
    const raw = String(reason || '').toLowerCase();
    if (/yetkili|adal|admin|mod|ekip|ismini|aşağ|iftira/i.test(raw)) {
        return 'Yetkililere Saygısızlık';
    }
    if (/oyuncu|şahsa|kişiye|üyeye|saygısızlık|hakaret/i.test(raw)) {
        return 'Oyunculara Saygısızlık';
    }
    if (/küfür|argo|uygunsuz/i.test(raw)) {
        return 'Küfür / Hakaret';
    }
    if (/dini|milli|kutsal|atatürk|din/i.test(raw) && !/dinamik/i.test(raw)) {
        return 'Dini / Milli Değerler';
    }
    if (/düzen|sohbet|bozmak|flood|spam|polemik|toks|toxic|kışkırt/i.test(raw)) {
        return 'Sunucu Dinamiği';
    }
    if (/reklam|davet|discord\.gg|youtube\.com/i.test(raw)) {
        return 'Reklam';
    }
    if (/destek|bilet|ticket/i.test(raw)) {
        return 'Destek Talebi';
    }
    return 'Diğer / Yönetim Kararı';
}

export const RaporCommand = {
    data: new SlashCommandBuilder()
        .setName('rapor')
        .setDescription('Sunucu genel ceza istatistiklerini ve CUK kuralları uyum durumunu listeler.'),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        try {
            const targetGuildId = interaction.guildId || envGuildId || '1223431616081166336';

            const { data: cases, error } = await supabase
                .from('sapphire_cases')
                .select('*')
                .eq('guild_id', targetGuildId);

            if (error) {
                throw error;
            }

            if (!cases || cases.length === 0) {
                await interaction.editReply({
                    content: 'ℹ️ **Veri Bulunamadı:** Veritabanında taranmış ceza kaydı bulunamadı.'
                });
                return;
            }

            // 1. Total statistics
            const totalCount = cases.length;

            // 2. Active Staff Unique Count
            const staffSet = new Set(cases.map(c => c.author_discord_id || c.author_display_name).filter(Boolean));
            const activeStaffCount = staffSet.size;

            // 3. CUK verdicts
            const validCount = cases.filter(c => String(c.cuk_verdict || '').toLowerCase() === 'valid').length;
            const invalidCount = cases.filter(c => String(c.cuk_verdict || '').toLowerCase() === 'invalid').length;
            const pendingCount = cases.filter(c => !c.cuk_verdict || String(c.cuk_verdict || '').toLowerCase() === 'pending').length;
            const accuracy = totalCount ? Math.round((validCount / totalCount) * 100) : 0;

            // 4. Case Types counts
            const typesMap: Record<string, number> = {};
            cases.forEach(c => {
                const t = String(c.type || 'unknown').toUpperCase();
                typesMap[t] = (typesMap[t] || 0) + 1;
            });
            const typesFormatted = Object.entries(typesMap)
                .map(([type, count]) => `• \`${type}\`: **${count}**`)
                .join('\n') || '• Kayıt yok';

            // 5. Rule distribution (semantically classified reasons)
            const categoriesMap: Record<string, number> = {};
            cases.forEach(c => {
                const cat = classifyReason(c.reason_raw || '');
                categoriesMap[cat] = (categoriesMap[cat] || 0) + 1;
            });
            const categoriesFormatted = Object.entries(categoriesMap)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, count]) => `• ${cat}: **${count}**`)
                .join('\n') || '• Kayıt yok';

            // 6. Time-based trends (last 24 hours / last 7 days)
            const now = Date.now();
            const last24hCount = cases.filter(c => c.scraped_at && (now - new Date(c.scraped_at).getTime()) <= 24 * 60 * 60 * 1000).length;
            const last7dCount = cases.filter(c => c.scraped_at && (now - new Date(c.scraped_at).getTime()) <= 7 * 24 * 60 * 60 * 1000).length;

            const accuracyColor = accuracy >= 90 ? 0x2ed573 : accuracy >= 80 ? 0xffa502 : 0xff4757;
            const accuracyEmoji = accuracy >= 90 ? '🟢 MÜKEMMEL' : accuracy >= 80 ? '🟡 STABİL' : '🔴 KRİTİK SEVİYE';

            const embed = new EmbedBuilder()
                .setTitle(`📊 Sunucu Moderasyon İstatistik Raporu`)
                .setColor(accuracyColor)
                .setDescription(`Lutheus CezaRapor sisteminden elde edilen genel veritabanı analizleri aşağıdadır.`)
                .addFields(
                    { name: '📈 Genel Durum', value: `Top. Ceza: **${totalCount}**\nAktif Yetkili: **${activeStaffCount}**\n24 Saatlik Akış: **+${last24hCount}**\n7 Günlük Akış: **+${last7dCount}**`, inline: true },
                    { name: '🎯 CUK Uyum Skoru', value: `Skor: **%${accuracy}**\nDurum: **${accuracyEmoji}**\n✅ Geçerli: **${validCount}**\n❌ Hatalı: **${invalidCount}**`, inline: true },
                    { name: '⚡ Ceza Dağılımları', value: typesFormatted },
                    { name: '📜 En Sık İhlal Edilen Kurallar', value: categoriesFormatted }
                )
                .setFooter({ text: 'Lutheus CezaRapor SRE Otomasyonu' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            console.error('Discord Bot: rapor command error:', err);
            await interaction.editReply({
                content: `🚨 **Rapor Üretme Hatası:** Verileri işlerken sistemsel bir hata oluştu.\nHata: \`${err.message}\``
            });
        }
    }
};

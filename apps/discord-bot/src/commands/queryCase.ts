// SECTION: BOT_COMMANDS
// PURPOSE: Queries Sapphire case details and AI audit analysis from Supabase sapphire_cases and app_settings.

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { supabase, guildId as envGuildId } from '../botConfig.js';
import { runDbHealthCheck, formatDiagnosticsBlock } from '../lib/dbDiagnostics.js';

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
            const targetGuildId = interaction.guildId || envGuildId || '1223431616081166336';

            const { data: row } = await supabase
                .from('sapphire_cases')
                .select('*')
                .eq('case_id', caseId)
                .eq('guild_id', targetGuildId)
                .maybeSingle();

            if (!row) {
                const snapshot = await runDbHealthCheck(targetGuildId);
                await interaction.editReply({
                    content: [
                        `❌ **Ceza Bulunamadı:** \`${caseId}\` guild \`${targetGuildId}\` altında yok.`,
                        '',
                        formatDiagnosticsBlock(snapshot),
                    ].join('\n'),
                });
                return;
            }

            const status = String(row.cuk_verdict || 'pending').toLowerCase();
            const color = status === 'valid' ? 0x2ed573 : status === 'invalid' ? 0xff4757 : 0xffa502;
            const statusEmoji = status === 'valid' ? '✅ DOĞRULANDI (VALID)' : status === 'invalid' ? '❌ HATALI (INVALID)' : '❓ İNCELENİYOR (PENDING)';

            const embed = new EmbedBuilder()
                .setTitle(`🔨 Ceza Sorgu Raporu - #${caseId}`)
                .setURL(row.case_url || `https://dashboard.sapph.xyz/`)
                .setColor(color)
                .setDescription(`Sistem tarafından saptanan ceza detayları ve kural analizleri aşağıda listelenmiştir.`)
                .addFields(
                    { name: '👤 Cezalı Kullanıcı', value: `**${row.punished_user_display_name || 'Bilinmiyor'}**\nID: \`${row.punished_user_discord_id || '-'}\``, inline: true },
                    { name: '👮 Cezayı Atan Yetkili', value: `**${row.author_display_name || 'Bilinmiyor'}**\nID: \`${row.author_discord_id || '-'}\``, inline: true },
                    { name: '⚡ Ceza Türü / Süre', value: `\`${String(row.type || 'unknown').toUpperCase()}\` / \`${row.duration_raw || (row.is_permanent ? 'Süresiz' : 'Geçici')}\``, inline: true },
                    { name: '📝 İlan Edilen Sebep', value: `\`\`\`\n${row.reason_raw || '-'}\n\`\`\`` },
                    { name: '📊 SRE Değerlendirme Durumu', value: `**${statusEmoji}**` }
                );

            const legacyPayload = row.legacy_payload || {};
            if (legacyPayload.note) {
                embed.addFields({ name: '✏️ Yönetici Notu', value: `*${legacyPayload.note}*` });
            }

            // Optional AI analysis
            const caseKey = `${row.guild_id || '1223431616081166336'}_${row.case_id}`;
            const { data: analysisRow } = await supabase
                .from('app_settings')
                .select('*')
                .eq('key', `analysis/${caseKey}`)
                .maybeSingle();

            if (analysisRow) {
                const analysis = analysisRow.value || {};
                if (analysis.feedback) {
                    embed.addFields({ name: '🧠 AI Karar Destek Gerekçesi', value: `\`\`\`\n${analysis.feedback.slice(0, 1000)}\n\`\`\`` });
                }
            }

            embed.setFooter({ text: 'Lutheus CezaRapor SRE Otomasyonu' })
                .setTimestamp(row.scraped_at ? new Date(row.scraped_at) : new Date());

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            console.error('Discord Bot: queryCase error:', err);
            await interaction.editReply({
                content: `🚨 **Sorgu Hatası:** Veritabanına erişirken bir hata meydana geldi.\nHata: \`${err.message}\``
            });
        }
    }
};

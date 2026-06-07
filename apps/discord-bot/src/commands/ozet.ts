// SECTION: BOT_COMMANDS
// PURPOSE: Lists the last 25 invalid (non-compliant) CUK cases for the server.

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { supabase, guildId as envGuildId } from '../botConfig.js';

export const OzetCommand = {
    data: new SlashCommandBuilder()
        .setName('ozet')
        .setDescription('CUK kurallarına uymayan son 25 hatalı ceza kaydını özet halinde listeler.'),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        try {
            const targetGuildId = interaction.guildId || envGuildId || '1223431616081166336';

            let { data: cases, error } = await supabase
                .from('sapphire_cases')
                .select('*')
                .eq('guild_id', targetGuildId)
                .eq('cuk_verdict', 'invalid')
                .order('scraped_at', { ascending: false })
                .limit(25);

            if (error) {
                throw error;
            }

            if (!cases || cases.length === 0) {
                const { data: globalCases, error: globalError } = await supabase
                    .from('sapphire_cases')
                    .select('*')
                    .eq('cuk_verdict', 'invalid')
                    .order('scraped_at', { ascending: false })
                    .limit(25);
                if (!globalError && globalCases && globalCases.length > 0) {
                    cases = globalCases;
                }
            }

            if (!cases || cases.length === 0) {
                await interaction.editReply({
                    content: '✅ **Hatalı Ceza Bulunmadı:** CUK kurallarına uymayan hatalı ceza kaydı bulunamadı.'
                });
                return;
            }

            const description = cases.map(c => {
                const duration = c.duration_raw || (c.is_permanent ? 'Süresiz' : 'Geçici');
                const active = c.is_open ? 'Aktif' : 'Pasif';
                const author = c.author_display_name || 'Bilinmiyor';
                return `• **#${c.case_id}** | Süre: \`${duration}\` | Aktiflik: \`${active}\` | Doğruluk: \`❌ Hatalı\` | Yetkili: \`${author}\``;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setTitle('🚨 Hatalı Ceza Özet Raporu')
                .setColor(0xff4757)
                .setDescription(description)
                .setFooter({ text: 'Lutheus CezaRapor SRE Otomasyonu' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            console.error('Discord Bot: ozet command error:', err);
            await interaction.editReply({
                content: `🚨 **Hata:** Özet rapor oluşturulurken veritabanı hatası oluştu.\nHata: \`${err.message}\``
            });
        }
    }
};

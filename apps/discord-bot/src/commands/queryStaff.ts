// SECTION: BOT_COMMANDS
// PURPOSE: Queries staff performance statistics from Supabase role_cache and sapphire_cases.

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { supabase, guildId as envGuildId } from '../botConfig.js';

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
                const { data: cache } = await supabase
                    .from('role_cache')
                    .select('*')
                    .eq('discord_id', targetId)
                    .maybeSingle();

                if (cache) {
                    roleLabel = cache.staff_rank || roleLabel;
                    customName = cache.raw_payload?.displayName || '';
                }
            }

            const targetGuildId = interaction.guildId || envGuildId || '1223431616081166336';

            let rows;
            if (targetId) {
                const { data } = await supabase
                    .from('sapphire_cases')
                    .select('*')
                    .eq('author_discord_id', targetId)
                    .eq('guild_id', targetGuildId);
                rows = data;
            } else {
                const { data } = await supabase
                    .from('sapphire_cases')
                    .select('*')
                    .eq('author_display_name', targetName)
                    .eq('guild_id', targetGuildId);
                rows = data;
            }

            const cases = rows || [];
            const totalCount = cases.length;

            if (totalCount === 0) {
                await interaction.editReply({
                    content: `ℹ️ **Ceza Kaydı Bulunamadı:** Yetkili \`${targetName || targetId}\` için ceza kaydı bulunamadı.`
                });
                return;
            }

            const validCount = cases.filter(c => String(c.cuk_verdict || '').toLowerCase() === 'valid').length;
            const invalidCount = cases.filter(c => String(c.cuk_verdict || '').toLowerCase() === 'invalid').length;
            const pendingCount = cases.filter(c => !c.cuk_verdict || String(c.cuk_verdict || '').toLowerCase() === 'pending').length;
            const accuracy = totalCount ? Math.round((validCount / totalCount) * 100) : 0;

            // Appeal metrics
            let appealTotal = 0;
            let appealApproved = 0;
            let appealRejected = 0;
            try {
                const { data: appeals } = await supabase
                    .from('case_appeals')
                    .select('*')
                    .in('case_id', cases.map(c => c.case_id).filter(Boolean));
                const appealData = appeals || [];
                appealTotal = appealData.length;
                appealApproved = appealData.filter(a => a.status === 'approved').length;
                appealRejected = appealData.filter(a => a.status === 'rejected').length;
            } catch (err) {
                console.warn('Lutheus Hadron Scraper Fail: Failed to fetch appeal metrics:', err);
            }

            // Hadron ticket metrics
            let ticketTotal = 0;
            let ticketMessageCount = 0;
            try {
                const { data: tickets } = await supabase
                    .from('user_tickets')
                    .select('*')
                    .eq('assigned_mod_id', targetId);
                const ticketData = tickets || [];
                ticketTotal = ticketData.length;
                ticketMessageCount = ticketData.reduce((sum, t) => sum + (t.message_count || 0), 0);
            } catch (err) {
                console.warn('Lutheus Hadron Scraper Fail: Failed to fetch ticket metrics:', err);
            }

            const appealRate = totalCount > 0 ? Math.round((appealTotal / totalCount) * 100) : 0;
            const appealAccuracy = appealTotal > 0 ? Math.round((appealApproved / appealTotal) * 100) : 0;
            const avgMessagesPerTicket = ticketTotal > 0 ? Math.round(ticketMessageCount / ticketTotal) : 0;

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
                    { name: '⏳ Bekleyen (Pending)', value: `\`${pendingCount}\``, inline: true },
                    { name: '⚖️ İtiraz Oranı', value: `%${appealRate} (${appealTotal}/${totalCount})`, inline: true },
                    { name: '✅ İtiraz Kabul', value: `%${appealAccuracy} (${appealApproved}/${appealTotal})`, inline: true },
                    { name: '🎫 Hadron Bileti', value: `${ticketTotal} (Ort. ${avgMessagesPerTicket} msg)`, inline: true }
                )
                .setFooter({ text: 'Lutheus CezaRapor SRE Otomasyonu' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            console.error('Discord Bot: queryStaff error:', err);
            await interaction.editReply({
                content: `🚨 **İstatistik Sorgu Hatası:** Veriler işlenirken bir hata meydana geldi.\nHata: \`${err.message}\``
            });
        }
    }
};

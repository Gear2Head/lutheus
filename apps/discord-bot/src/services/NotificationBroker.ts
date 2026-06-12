import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { supabase } from '../botConfig.js';

const FOUNDER_DISCORD_IDS = ['758769576778661989']; // Kurucular (Gear_Head vb.)

export function startNotificationBroker(client: Client) {
    console.log('[NotificationBroker] Starting Supabase Realtime listener for sapphire_cases...');

    // Subscribe to insert/update events on sapphire_cases
    const channel = supabase
        .channel('sapphire_cases_realtime')
        .on(
            'postgres_changes',
            {
                event: '*', // Listen to INSERT and UPDATE
                schema: 'public',
                table: 'sapphire_cases'
            },
            async (payload) => {
                const newRow = payload.new as any;
                const oldRow = payload.old as any;

                if (!newRow) return;

                // Check if verdict is 'invalid' and it was either just inserted or changed to invalid
                const becameInvalid = newRow.cuk_verdict === 'invalid' && (!oldRow || oldRow.cuk_verdict !== 'invalid');

                if (becameInvalid) {
                    console.log(`[NotificationBroker] Detected invalid case: #${newRow.case_id} by staff: ${newRow.author_display_name}`);
                    await handleInvalidCase(client, newRow);
                }
            }
        )
        .subscribe((status) => {
            console.log(`[NotificationBroker] Realtime subscription status: ${status}`);
        });

    return channel;
}

async function handleInvalidCase(client: Client, caseRow: any) {
    const guildId = caseRow.guild_id || process.env.DISCORD_GUILD_ID || '';
    if (!guildId) return;

    try {
        const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) {
            console.warn(`[NotificationBroker] Guild not found: ${guildId}`);
            return;
        }

        // Try to find a channel named 'lutheus-logs'
        const channels = await guild.channels.fetch();
        const logsChannel = channels.find(c => c !== null && c.name === 'lutheus-logs' && c.isTextBased()) as TextChannel | undefined;

        // Construct Embed
        const embed = new EmbedBuilder()
            .setTitle('⚠️ CUK İhlali - Hatalı Ceza Raporu')
            .setColor(0xff453a)
            .setTimestamp()
            .setDescription(`**Case ID:** \`#${caseRow.case_id}\`\n**Yetkili:** <@${caseRow.author_discord_id}> (${caseRow.author_display_name})\n**Cezalandırılan:** ${caseRow.punished_user_display_name} (\`${caseRow.punished_user_discord_id}\`)\n**Sebep:** \`${caseRow.reason_raw}\`\n**Süre:** \`${caseRow.duration_raw}\``)
            .addFields(
                { name: 'Kategori', value: caseRow.cuk_analysis?.category || 'Belirsiz', inline: true },
                { name: 'Hata Nedeni', value: caseRow.cuk_analysis?.message || 'Ceza Uygulama Kitapçığı kurallarına aykırı süre veya sebep.', inline: false }
            );

        if (logsChannel) {
            await logsChannel.send({ embeds: [embed] }).catch((err) => {
                console.error(`[NotificationBroker] Failed to send message to lutheus-logs:`, err);
            });
            console.log(`[NotificationBroker] Alert message successfully sent to #lutheus-logs`);
        } else {
            console.warn(`[NotificationBroker] Channel 'lutheus-logs' not found in guild.`);
        }

        // Send DMs to founders
        for (const founderId of FOUNDER_DISCORD_IDS) {
            try {
                const user = client.users.cache.get(founderId) || await client.users.fetch(founderId).catch(() => null);
                if (user) {
                    await user.send({
                        content: `⚠️ **[LUTHEUS ALARM]** Yetkili <@${caseRow.author_discord_id}> tarafından kesilen \`#${caseRow.case_id}\` nolu ceza CUK kurallarına göre **HATALI** olarak değerlendirildi!`,
                        embeds: [embed]
                    });
                    console.log(`[NotificationBroker] Alert DM successfully sent to founder: ${founderId}`);
                }
            } catch (dmErr: any) {
                console.warn(`[NotificationBroker] Failed to DM founder ${founderId}:`, dmErr.message || dmErr);
            }
        }
    } catch (err) {
        console.error('[NotificationBroker] Error in handleInvalidCase:', err);
    }
}

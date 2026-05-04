import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    ButtonBuilder,
    ButtonInteraction,
    ActionRowBuilder,
    ButtonStyle,
    ComponentType
} from 'discord.js';
import { createHmac, randomUUID } from 'crypto';

interface BackendResponse {
    ok: boolean;
    status: number;
    body: unknown;
}

async function signedBackendRequest(
    method: string,
    endpoint: string,
    payload: Record<string, unknown>
): Promise<BackendResponse> {
    const backendUrl = process.env.BACKEND_BASE_URL;
    const hmacSecret = process.env.BOT_HMAC_SECRET;

    if (!backendUrl || !hmacSecret) {
        throw new Error('ENV_MISSING: BACKEND_BASE_URL or BOT_HMAC_SECRET is not set');
    }

    const timestamp = Date.now().toString();
    const correlationId = randomUUID();
    const body = JSON.stringify(payload);
    const signature = createHmac('sha256', hmacSecret)
        .update(`${timestamp}.${body}`)
        .digest('hex');

    const response = await fetch(`${backendUrl}${endpoint}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-Signature': signature,
            'X-Timestamp': timestamp,
            'X-Correlation-Id': correlationId
        },
        body
    });

    const responseBody = await response.json().catch(() => null);

    return {
        ok: response.ok,
        status: response.status,
        body: responseBody
    };
}

function auditLog(event: string, meta: Record<string, unknown>): void {
    process.stdout.write(
        JSON.stringify({
            timestamp: new Date().toISOString(),
            event,
            ...meta
        }) + '\n'
    );
}

export const EmergencyLockdownCommand = {
    data: new SlashCommandBuilder()
        .setName('lockdown')
        .setDescription('[KRITIK] Sistemi Muhurler. API isteklerini 403 blokajina alir.')
        .setDefaultMemberPermissions(0),

    async execute(interaction: ChatInputCommandInteraction) {
        const correlationId = randomUUID();

        const confirmButton = new ButtonBuilder()
            .setCustomId('confirm_lockdown')
            .setLabel('KESINLESTIR VE MUHURLE')
            .setStyle(ButtonStyle.Danger);

        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel_lockdown')
            .setLabel('Iptal')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(cancelButton, confirmButton);

        const response = await interaction.reply({
            content:
                '**DIKKAT!** Sistemi lockdown moduna alacaksiniz.\n' +
                'Tum tarama onaylari ve veri girisleri duracaktir.\n\n' +
                `Correlation ID: \`${correlationId}\`\n` +
                'Emin misiniz?',
            components: [row],
            ephemeral: true
        });

        auditLog('LOCKDOWN_PROMPTED', {
            initiatorId: interaction.user.id,
            initiatorTag: interaction.user.tag,
            guildId: interaction.guildId,
            correlationId
        });

        try {
            const confirmation = await response.awaitMessageComponent({
                filter: (component: ButtonInteraction) => component.user.id === interaction.user.id,
                time: 15_000,
                componentType: ComponentType.Button
            });

            if (confirmation.customId !== 'confirm_lockdown') {
                auditLog('LOCKDOWN_CANCELLED', {
                    initiatorId: interaction.user.id,
                    correlationId
                });
                await confirmation.update({ content: 'Islem iptal edildi.', components: [] });
                return;
            }

            await confirmation.update({ content: 'Backend muhurleniyor...', components: [] });

            let backendResult: BackendResponse;
            try {
                backendResult = await signedBackendRequest('POST', '/v1/ops/lockdown', {
                    initiatorDiscordId: interaction.user.id,
                    correlationId,
                    timestamp: Date.now()
                });
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                auditLog('LOCKDOWN_FETCH_ERROR', { correlationId, error: message });
                await interaction.editReply({
                    content: `Backend'e ulasilamadi. Muhurleme gerceklesmedi.\nHata: \`${message}\``,
                    components: []
                });
                return;
            }

            if (!backendResult.ok) {
                auditLog('LOCKDOWN_BACKEND_REJECTED', {
                    correlationId,
                    status: backendResult.status,
                    body: backendResult.body
                });
                await interaction.editReply({
                    content:
                        `Backend istegi reddetti (HTTP ${backendResult.status}). ` +
                        'Muhurleme gerceklesmedi. SRE ekibini bilgilendirin.',
                    components: []
                });
                return;
            }

            auditLog('LOCKDOWN_ACTIVATED', {
                initiatorId: interaction.user.id,
                guildId: interaction.guildId,
                correlationId
            });

            await interaction.editReply({
                content:
                    'SISTEM KILITLENDI (LOCKDOWN AKTIF). Ihlal taramalari ve bot veri girisleri reddediliyor.\n' +
                    `Correlation ID: \`${correlationId}\``,
                components: []
            });
        } catch {
            auditLog('LOCKDOWN_TIMEOUT', { correlationId });
            await interaction.editReply({
                content: 'Zaman asimi. Islem iptal edildi.',
                components: []
            });
        }
    }
};

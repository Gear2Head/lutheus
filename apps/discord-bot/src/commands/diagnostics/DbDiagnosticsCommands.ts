import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    EmbedBuilder,
} from 'discord.js';
import { supabase, guildId as envGuildId } from '../../botConfig.js';
import {
    runDbHealthCheck,
    formatDiagnosticsBlock,
    getSyncStatus,
} from '../../lib/dbDiagnostics.js';

function resolveGuildId(interaction: ChatInputCommandInteraction): string {
    return interaction.guildId || envGuildId || '1223431616081166336';
}

export const DbHealthCommand = {
    data: new SlashCommandBuilder()
        .setName('db-health')
        .setDescription('Supabase baglanti ve tablo erisim teşhisi (admin).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const snapshot = await runDbHealthCheck(resolveGuildId(interaction));
        const embed = new EmbedBuilder()
            .setTitle('Lutheus DB Health')
            .setColor(snapshot.pingOk ? 0x2ed573 : 0xff4757)
            .setDescription(formatDiagnosticsBlock(snapshot));
        await interaction.editReply({ embeds: [embed] });
    },
};

export const CasesCountCommand = {
    data: new SlashCommandBuilder()
        .setName('cases-count')
        .setDescription('sapphire_cases kayit sayilari (admin).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const gid = resolveGuildId(interaction);
        const snapshot = await runDbHealthCheck(gid);
        await interaction.editReply({
            content: [
                `Global: **${snapshot.totalCases ?? '?'}** kayit`,
                `Guild \`${gid}\`: **${snapshot.guildCases ?? '?'}** kayit`,
                snapshot.pingError ? `Teşhis: \`${snapshot.pingError}\`` : '',
            ].filter(Boolean).join('\n'),
        });
    },
};

export const LastCasesCommand = {
    data: new SlashCommandBuilder()
        .setName('last-cases')
        .setDescription('Son 5 sapphire case kaydi (admin).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const gid = resolveGuildId(interaction);
        const { data, error } = await supabase
            .from('sapphire_cases')
            .select('case_id, scraped_at, author_display_name, cuk_verdict')
            .eq('guild_id', gid)
            .order('scraped_at', { ascending: false })
            .limit(5);

        if (error) {
            await interaction.editReply({ content: `Sorgu hatasi: \`${error.message}\`` });
            return;
        }
        if (!data?.length) {
            const snapshot = await runDbHealthCheck(gid);
            await interaction.editReply({
                content: `Guild \`${gid}\` icin case yok.\n\n${formatDiagnosticsBlock(snapshot)}`,
            });
            return;
        }

        const lines = data.map(
            (r) =>
                `\`${r.case_id}\` — ${r.author_display_name || '?'} — ${r.cuk_verdict || 'pending'} — ${r.scraped_at || '?'}`,
        );
        await interaction.editReply({ content: lines.join('\n') });
    },
};

export const CaseGetCommand = {
    data: new SlashCommandBuilder()
        .setName('case-get')
        .setDescription('Case ID ile DB kaydi getir (admin).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption((o) =>
            o.setName('case_id').setDescription('Case ID').setRequired(true),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const caseId = interaction.options.getString('case_id', true).trim();
        const gid = resolveGuildId(interaction);

        const { data: row, error } = await supabase
            .from('sapphire_cases')
            .select('case_id, guild_id, author_display_name, reason_raw, cuk_verdict, scraped_at')
            .eq('case_id', caseId)
            .eq('guild_id', gid)
            .maybeSingle();

        if (error) {
            await interaction.editReply({ content: `Sorgu hatasi: \`${error.message}\`` });
            return;
        }
        if (!row) {
            const snapshot = await runDbHealthCheck(gid);
            await interaction.editReply({
                content: [
                    `\`${caseId}\` guild \`${gid}\` altinda bulunamadi.`,
                    '',
                    formatDiagnosticsBlock(snapshot),
                ].join('\n'),
            });
            return;
        }

        await interaction.editReply({
            content: [
                `**#${row.case_id}**`,
                `Guild: \`${row.guild_id}\``,
                `Yetkili: ${row.author_display_name}`,
                `CUK: ${row.cuk_verdict}`,
                `Sebep: ${(row.reason_raw || '').slice(0, 120)}`,
            ].join('\n'),
        });
    },
};

export const SyncStatusCommand = {
    data: new SlashCommandBuilder()
        .setName('sync-status')
        .setDescription('Case poll cursor ve son hata (admin).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const status = getSyncStatus();
        const snapshot = await runDbHealthCheck(resolveGuildId(interaction));
        await interaction.editReply({
            content: [
                `Env guild: \`${status.envGuildId || 'tanimsiz'}\``,
                `Poll cursor: \`${status.pollCursor}\``,
                status.lastPollError ? `Son poll hata: \`${status.lastPollError}\`` : 'Son poll hata: yok',
                '',
                `DB guild case sayisi: **${snapshot.guildCases ?? '?'}**`,
            ].join('\n'),
        });
    },
};

export const diagnosticCommands = [
    DbHealthCommand,
    CasesCountCommand,
    LastCasesCommand,
    CaseGetCommand,
    SyncStatusCommand,
];

import { supabase, guildId as envGuildId } from '../botConfig.js';

export interface DbHealthSnapshot {
    checkedAt: string;
    supabaseUrlConfigured: boolean;
    supabaseKeyConfigured: boolean;
    pingOk: boolean;
    pingError: string | null;
    totalCases: number | null;
    guildCases: number | null;
    targetGuildId: string;
    lastCaseIds: string[];
    pollCursor: string;
    lastPollError: string | null;
}

let pollCursor = new Date().toISOString();
let lastPollError: string | null = null;

export function setPollCursor(iso: string) {
    pollCursor = iso;
}

export function setLastPollError(message: string | null) {
    lastPollError = message;
}

export function getSyncStatus() {
    return {
        pollCursor,
        lastPollError,
        envGuildId: envGuildId || null,
    };
}

export async function runDbHealthCheck(targetGuildId?: string): Promise<DbHealthSnapshot> {
    const gid = targetGuildId || envGuildId || '1223431616081166336';
    const supabaseUrlConfigured = Boolean(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    );
    const supabaseKeyConfigured = Boolean(
        process.env.SUPABASE_ANON_KEY ||
        process.env.SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    );

    let pingOk = false;
    let pingError: string | null = null;
    let totalCases: number | null = null;
    let guildCases: number | null = null;
    let lastCaseIds: string[] = [];

    try {
        const { count, error } = await supabase
            .from('sapphire_cases')
            .select('*', { count: 'exact', head: true });

        if (error) {
            pingError = error.message;
        } else {
            pingOk = true;
            totalCases = count ?? 0;
        }

        const { count: gCount, error: gErr } = await supabase
            .from('sapphire_cases')
            .select('*', { count: 'exact', head: true })
            .eq('guild_id', gid);

        if (!gErr) {
            guildCases = gCount ?? 0;
        }

        const { data: lastRows, error: lastErr } = await supabase
            .from('sapphire_cases')
            .select('case_id, scraped_at, guild_id')
            .eq('guild_id', gid)
            .order('scraped_at', { ascending: false })
            .limit(5);

        if (!lastErr && lastRows) {
            lastCaseIds = lastRows.map((r) => r.case_id);
        }
    } catch (err) {
        pingError = err instanceof Error ? err.message : 'DB_PROBE_FAILED';
    }

    return {
        checkedAt: new Date().toISOString(),
        supabaseUrlConfigured,
        supabaseKeyConfigured,
        pingOk,
        pingError,
        totalCases,
        guildCases,
        targetGuildId: gid,
        lastCaseIds,
        pollCursor,
        lastPollError,
    };
}

export function formatDiagnosticsBlock(snapshot: DbHealthSnapshot): string {
    const lines = [
        `**DB Health** (${snapshot.checkedAt})`,
        `Supabase URL: ${snapshot.supabaseUrlConfigured ? 'var' : 'yok'}`,
        `Supabase key: ${snapshot.supabaseKeyConfigured ? 'var (deger loglanmaz)' : 'yok'}`,
        `Ping: ${snapshot.pingOk ? 'OK' : 'HATA'}`,
        snapshot.pingError ? `Hata: \`${snapshot.pingError}\`` : null,
        `Toplam case: ${snapshot.totalCases ?? '?'}`,
        `Guild (\`${snapshot.targetGuildId}\`) case: ${snapshot.guildCases ?? '?'}`,
        snapshot.lastCaseIds.length
            ? `Son case ID: ${snapshot.lastCaseIds.map((id) => `\`${id}\``).join(', ')}`
            : 'Son case ID: (yok)',
        `Poll cursor: \`${snapshot.pollCursor}\``,
        snapshot.lastPollError ? `Son poll hata: \`${snapshot.lastPollError}\`` : null,
    ].filter(Boolean);

    return lines.join('\n');
}

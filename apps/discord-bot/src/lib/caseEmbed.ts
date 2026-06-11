const DEFAULT_GUILD_ID = '1223431616081166336';

const GENERIC_NAME_RE = /^(unknown moderator|bilinmeyen yetkili|yetkili\s*\(\d{1,8}\)|moderator\s*\(\d{1,8}\))$/i;

export interface SapphireCaseRow {
    case_id: string;
    guild_id?: string;
    case_url?: string | null;
    duration_raw?: string | null;
    duration_ms?: number | null;
    is_permanent?: boolean | null;
    is_open?: boolean | null;
    author_discord_id?: string | null;
    author_display_name?: string | null;
    cuk_verdict?: string | null;
    cuk_analysis?: { message?: string; category?: string; score?: number } | null;
}

export interface StaffProfileRow {
    discord_id: string;
    username?: string | null;
    in_game_name?: string | null;
    display_name?: string | null;
}

export function buildSapphireCaseUrl(guildId: string | null | undefined, caseId: string): string {
    const gid = String(guildId || DEFAULT_GUILD_ID).trim();
    return `https://dashboard.sapph.xyz/${gid}/moderation/cases/${encodeURIComponent(caseId)}`;
}

export function buildLutheusCaseUrl(caseId: string): string {
    return `https://lutheus.vercel.app/dashboard/#/cases?case=${encodeURIComponent(caseId)}`;
}

export function minutesToHuman(mins: number): string {
    if (!mins || mins === 0) return 'Kalıcı';
    if (mins < 60) return `${mins} dk`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h < 24) return m > 0 ? `${h}sa ${m}dk` : `${h} saat`;
    const d = Math.floor(h / 24);
    return `${d} gün`;
}

export function isGenericStaffName(name?: string | null, discordId?: string | null): boolean {
    const clean = (name || '').replace(/\(\)?/g, '').trim();
    if (!clean) return true;
    if (discordId && clean.toLowerCase() === discordId.toLowerCase()) return true;
    if (clean.toLowerCase() === 'bilinmiyor' || clean.toLowerCase() === 'unknown') return true;
    return GENERIC_NAME_RE.test(clean);
}

export function resolveAuthorDisplayName(
    row: SapphireCaseRow,
    staffProfile?: StaffProfileRow | null,
): string {
    const discordId = row.author_discord_id || staffProfile?.discord_id || '';
    const caseName = row.author_display_name;
    const profileName = staffProfile?.in_game_name || staffProfile?.username || staffProfile?.display_name;

    if (!isGenericStaffName(caseName, discordId) && caseName) return caseName;
    if (profileName) return profileName;
    if (discordId) return `Yetkili (${discordId.slice(-4)})`;
    return 'Bilinmiyor';
}

export function formatCaseDuration(row: SapphireCaseRow): string {
    if (row.duration_raw) return row.duration_raw;
    if (row.is_permanent) return 'Süresiz';
    if (row.duration_ms) return minutesToHuman(Math.round(row.duration_ms / 60000));
    return 'Belirtilmemiş';
}

export function formatAuthorField(row: SapphireCaseRow, staffProfile?: StaffProfileRow | null): string {
    const name = resolveAuthorDisplayName(row, staffProfile);
    const id = row.author_discord_id || staffProfile?.discord_id || '-';
    return `**${name}** (ID: \`${id}\`)`;
}

export function getValidSapphireUrl(row: SapphireCaseRow): string {
    const rawUrl = row.case_url?.trim();
    if (!rawUrl) {
        return buildSapphireCaseUrl(row.guild_id, row.case_id);
    }
    const isInvalid = rawUrl.startsWith('ws://') || 
                      rawUrl.startsWith('wss://') || 
                      rawUrl.includes('socket.io') || 
                      !rawUrl.startsWith('http');
    if (isInvalid) {
        return buildSapphireCaseUrl(row.guild_id, row.case_id);
    }
    return rawUrl;
}

export function formatCaseIdField(row: SapphireCaseRow): string {
    const caseId = row.case_id;
    const sapphireUrl = getValidSapphireUrl(row);
    const lutheusUrl = buildLutheusCaseUrl(caseId);
    return `[#${caseId}](${sapphireUrl}) · [Lutheus'ta Görüntüle](${lutheusUrl})`;
}

export function formatVerdictField(row: SapphireCaseRow): string {
    const message = row.cuk_analysis?.message || 'Sebep belirtilmemiş';
    return `❌ Hatalı\n${message}`;
}


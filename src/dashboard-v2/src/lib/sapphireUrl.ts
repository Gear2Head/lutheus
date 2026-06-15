const DEFAULT_GUILD_ID = '1223431616081166336';

export function buildSapphireCaseUrl(guildId: string | null | undefined, caseId: string | null | undefined): string | null {
  const gid = String(guildId || DEFAULT_GUILD_ID).trim();
  const cid = String(caseId || '').trim();
  if (!cid) return null;
  return `https://dashboard.sapph.xyz/${gid}/moderation/cases/${encodeURIComponent(cid)}`;
}

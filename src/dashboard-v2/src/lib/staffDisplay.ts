import { SapphireCase, StaffProfile } from './supabase';

const GENERIC_NAME_RE = /^(unknown moderator|bilinmeyen yetkili|yetkili\s*\(\d{1,8}\)|moderator\s*\(\d{1,8}\)|bilinmeyen|unknown|unknown user|bilinmeyen kullanıcı|bilinmeyen kullanici)$/i;

export function isGenericStaffName(name?: string | null, discordId?: string): boolean {
  const clean = (name || '').replace(/\(\)?/g, '').trim();
  if (!clean) return true;
  if (discordId && clean.toLowerCase() === discordId.toLowerCase()) return true;
  return GENERIC_NAME_RE.test(clean);
}

export function formatStaffName(name?: string | null, discordId?: string, fallbackLabel = 'Yetkili'): string {
  const clean = (name || '').replace(/\(\)?/g, '').trim();
  if (!isGenericStaffName(clean, discordId)) return clean;
  return discordId ? `${fallbackLabel} (${discordId.slice(-4)})` : fallbackLabel;
}

export function resolveStaffName(
  profile: StaffProfile | null | undefined,
  sourceCase: SapphireCase | null | undefined,
  fallbackLabel = 'Yetkili',
): string {
  const caseName = sourceCase?.author_display_name;
  const profileName = profile?.in_game_name || profile?.username;
  const preferred = !isGenericStaffName(caseName, sourceCase?.author_discord_id || profile?.discord_id)
    ? caseName
    : profileName;

  return formatStaffName(preferred, sourceCase?.author_discord_id || profile?.discord_id, fallbackLabel);
}

export function resolveStaffAvatar(
  profile: StaffProfile | null | undefined,
  sourceCase: SapphireCase | null | undefined,
  discordId: string,
): string {
  return profile?.avatar_url || sourceCase?.author_avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${discordId}`;
}

// ============================================================
// Lutheus Auth Bridge — wraps the existing chrome.storage based
// AuthService for use inside the React SPA.
// Reads lutheusAuthSession from chrome.storage.local (set by
// public/auth/authService.js during Discord / Google OAuth).
// ============================================================

const SESSION_KEY = 'lutheusAuthSession';

// Role labels matching public/auth/rolePolicy.js ROLE_LABELS
export const ROLE_LABELS: Record<string, string> = {
  kurucu: 'Kurucu',
  admin: 'Admin',
  yonetici: 'Yönetici',
  genel_sorumlu: 'Genel Sorumlu',
  discord_yoneticisi: 'Discord Yöneticisi',
  kidemli: 'Kıdemli',
  kidemli_discord_moderatoru: 'Kıdemli Discord Moderatörü',
  senior_moderator: 'Senior Moderatör',
  moderator: 'Discord Moderatör',
  discord_moderatoru: 'Discord Moderatör',
  support: 'Discord Destek Ekibi',
  discord_destek_ekibi: 'Discord Destek Ekibi',
  viewer: 'Viewer',
  pending: 'Beklemede',
  blocked: 'Engelli',
  eski_yetkili: 'Eski Yetkili',
};

export const ROLE_COLORS: Record<string, string> = {
  kurucu: '#ef4444',
  admin: '#7f1d1d',
  yonetici: '#dc2626',
  genel_sorumlu: '#dc2626',
  discord_yoneticisi: '#ff2da8',
  kidemli: '#c2410c',
  kidemli_discord_moderatoru: '#c2410c',
  senior_moderator: '#c2410c',
  moderator: '#fb923c',
  discord_moderatoru: '#fb923c',
  support: '#be185d',
  discord_destek_ekibi: '#be185d',
  viewer: '#64748b',
  pending: '#71717a',
  blocked: '#52525b',
  eski_yetkili: '#64748b',
};

// Admin-level roles that can access the full dashboard
const ADMIN_ROLES = new Set([
  'kurucu', 'admin', 'yonetici', 'genel_sorumlu',
  'discord_yoneticisi', 'kidemli', 'kidemli_discord_moderatoru',
  'senior_moderator',
]);

export interface LutheusSession {
  uid: string;
  provider: 'discord' | 'google';
  idToken: string;
  refreshToken: string | null;
  expiresAt: number;
  role: string;
  profile: {
    uid: string;
    provider: string;
    discordId: string | null;
    username: string | null;
    displayName: string;
    avatar: string | null;
    email: string | null;
    role: string;
    status: string;
  };
}

function isExtension(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local;
}

export async function getSession(): Promise<LutheusSession | null> {
  if (isExtension()) {
    return new Promise((resolve) => {
      chrome.storage.local.get([SESSION_KEY], (result) => {
        resolve(result[SESSION_KEY] || null);
      });
    });
  }
  // Fallback for dev server (non-extension context)
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  if (isExtension()) {
    return new Promise((resolve) => {
      chrome.storage.local.remove([SESSION_KEY], resolve);
    });
  }
  localStorage.removeItem(SESSION_KEY);
}

export function isSessionExpired(session: LutheusSession): boolean {
  if (!session?.expiresAt) return true;
  return Date.now() + 60_000 >= Number(session.expiresAt);
}

export function canAccessAdmin(role: string): boolean {
  return ADMIN_ROLES.has(role?.toLowerCase());
}

const MANAGEMENT_ROLES = new Set([
  'kurucu', 'admin', 'yonetici', 'genel_sorumlu', 'discord_yoneticisi'
]);

export function hasPermission(role: string, permission: string): boolean {
  const normalizedRole = role?.toLowerCase();

  // Enforce strict protection: only management roles can perform mutations/updates
  if (
    permission.endsWith(':update') || 
    permission.endsWith(':delete') || 
    permission.endsWith(':create') ||
    [
      'penalties:update', 'staff:update', 'rules:update', 'access:update',
      'announcement:manage', 'staff:access_approve', 'staff:assign_role'
    ].includes(permission)
  ) {
    return MANAGEMENT_ROLES.has(normalizedRole);
  }

  if (ADMIN_ROLES.has(normalizedRole)) return true;
  const modPerms = ['dashboard:view', 'reports:view', 'penalties:view', 'blacklist:view'];
  if (normalizedRole === 'discord_moderatoru' || normalizedRole === 'moderator') {
    return modPerms.includes(permission);
  }
  if (normalizedRole === 'discord_destek_ekibi' || normalizedRole === 'support') {
    return ['dashboard:view', 'reports:view'].includes(permission);
  }
  return false;
}

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role?.toLowerCase()] || role || 'Bilinmiyor';
}

export function getRoleColor(role: string): string {
  return ROLE_COLORS[role?.toLowerCase()] || '#64748b';
}

export function getAvatarUrl(session: LutheusSession | null): string {
  if (!session) return `https://api.dicebear.com/7.x/avataaars/svg?seed=anonymous`;
  if (session.profile?.avatar) return session.profile.avatar;
  const seed = session.profile?.discordId || session.profile?.uid || 'user';
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
}

// Open the existing login page (public/auth/login.html) if not authenticated
export function redirectToLogin(): void {
  if (isExtension() && chrome.runtime?.getURL) {
    window.location.href = chrome.runtime.getURL('src/auth/login.html');
  } else {
    window.location.href = '/src/auth/login.html';
  }
}

// Dev-mode mock session for local development outside the extension
export function getDevMockSession(): LutheusSession {
  return {
    uid: 'discord:758769576778661989',
    provider: 'discord',
    idToken: 'dev-mock-token',
    refreshToken: null,
    expiresAt: Date.now() + 86400000,
    role: 'kurucu',
    profile: {
      uid: 'discord:758769576778661989',
      provider: 'discord',
      discordId: '758769576778661989',
      username: 'Gear_Head',
      displayName: 'Gear_Head',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=758769576778661989',
      email: null,
      role: 'kurucu',
      status: 'active',
    },
  };
}

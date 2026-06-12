// SECTION: SESSION_MANAGER
// PURPOSE: Manage user authentication sessions locally in browser localStorage, compliant with the existing Lutheus login framework.

export interface LutheusSession {
  idToken: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  savedAt?: number;
  role?: string;
  user?: {
    uid: string;
    displayName: string;
    email?: string;
    photoURL?: string;
    discordId?: string;
  };
}

const SESSION_KEY = "lutheusAuthSession";

export function getStoredSession(): LutheusSession | null {
  if (typeof window === "undefined") return null;
  const item = localStorage.getItem(SESSION_KEY);
  if (!item) return null;
  try {
    return JSON.parse(item) as LutheusSession;
  } catch {
    return null;
  }
}

export function setStoredSession(session: LutheusSession): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    ...session,
    savedAt: Date.now()
  }));
}

export function clearStoredSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}

export function isSessionExpired(session: LutheusSession | null, skewMs = 60_000): boolean {
  if (!session?.expiresAt) return true;
  return Date.now() + skewMs >= Number(session.expiresAt);
}

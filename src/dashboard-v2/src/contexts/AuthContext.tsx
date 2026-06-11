/// <reference types="vite/client" />
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  LutheusSession,
  getSession,
  clearSession,
  isSessionExpired,
  redirectToLogin,
  getDevMockSession,
} from '../lib/auth';
import { setAuthToken } from '../lib/supabase';

interface AuthContextValue {
  session: LutheusSession | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshSession?: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  logout: async () => {},
  refreshSession: async () => {},
});

const IS_DEV = import.meta.env.DEV;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<LutheusSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        let s = await getSession();

        // In dev mode outside the extension, use a mock session
        if (!s && IS_DEV) {
          console.warn('[Lutheus Auth] Dev mode: using mock session');
          s = getDevMockSession();
        }

        if (s) {
          if (isSessionExpired(s) && !IS_DEV) {
            await clearSession();
            redirectToLogin();
            return;
          }
          // Set JWT on supabase client for authenticated requests
          setAuthToken(s.idToken);
          setSession(s);
        } else {
          redirectToLogin();
        }
      } catch (err) {
        console.error('[Lutheus Auth] Session init failed:', err);
        if (!IS_DEV) redirectToLogin();
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const logout = async () => {
    await clearSession();
    setAuthToken(null);
    setSession(null);
    redirectToLogin();
  };

  const refreshSession = async () => {
    try {
      const s = await getSession();
      if (!s) return;

      const { supabaseFetch } = await import('../lib/supabase');
      const data = await supabaseFetch<any[]>('staff_profiles', 'GET', `discord_id=eq.${s.profile.discordId}`);
      const profile = data?.[0];
      if (profile) {
        const newRole = profile.staff_rank || 'pending';
        const isApproved = profile.access_status === 'approved' && profile.is_active_staff === true;

        if (newRole !== s.role || isApproved !== (s.profile.status === 'active')) {
          const updatedSession: LutheusSession = {
            ...s,
            role: newRole,
            profile: {
              ...s.profile,
              role: newRole,
              status: isApproved ? 'active' : 'pending'
            }
          };

          const SESSION_KEY = 'lutheusAuthSession';
          if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            await new Promise<void>((resolve) => {
              chrome.storage.local.set({ [SESSION_KEY]: updatedSession }, resolve);
            });
          } else {
            localStorage.setItem(SESSION_KEY, JSON.stringify(updatedSession));
          }

          setSession(updatedSession);
        }
      }
    } catch (err) {
      console.error('[Lutheus Auth] Failed to refresh session:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ session, loading, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

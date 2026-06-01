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
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  logout: async () => {},
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

  return (
    <AuthContext.Provider value={{ session, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

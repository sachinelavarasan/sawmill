import type { Permission } from '@sawmill/shared';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, auth, Profile, setSessionLostHandler } from './api';
import { useI18n } from './i18n';

interface AuthState {
  user: Profile | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (p: Permission) => boolean;
  /** Re-read the profile (e.g. after the owner renames the mill). */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { setLang } = useI18n();

  useEffect(() => {
    setSessionLostHandler(() => setUser(null));
    auth
      .restore()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const profile = await auth.login(username, password);
      if (profile.preferredLanguage === 'ta' || profile.preferredLanguage === 'en') setLang(profile.preferredLanguage);
      setUser(profile);
    },
    [setLang],
  );

  const logout = useCallback(async () => {
    await auth.logout().catch(() => undefined);
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    setUser(await api<Profile>('/auth/me'));
  }, []);

  // UI-only convenience; the API enforces the same rules on every request.
  const can = useCallback((p: Permission) => !!user?.permissions.includes(p), [user]);

  const value = useMemo(() => ({ user, loading, login, logout, can, refreshProfile }), [user, loading, login, logout, can, refreshProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}

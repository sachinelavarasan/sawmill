import type { PageTourKey, Permission, UiMode } from '@timbertrail/shared';
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
  /** Simple view: only the daily core work, big tiles, few words. The default for everyone. */
  simple: boolean;
  /** Switch between the simple view and every feature; saved on the user so it follows them to any browser. */
  setUiMode: (mode: UiMode) => Promise<void>;
  /** The guided tour was finished or closed: saved on the user so it does not start again on any browser. */
  markTourDone: () => Promise<void>;
  /** One page's tour was finished or closed: saved on the user so it does not start by itself again. */
  markTourSeen: (tour: PageTourKey) => Promise<void>;
}

/** last known view, so a reload shows the right one before /auth/me answers */
const UI_MODE_KEY = 'timbertrail.uiMode';
const readCachedMode = (): UiMode => {
  try {
    return localStorage.getItem(UI_MODE_KEY) === 'full' ? 'full' : 'simple';
  } catch {
    return 'simple';
  }
};
const cacheMode = (m: UiMode) => {
  try {
    localStorage.setItem(UI_MODE_KEY, m);
  } catch {
    /* private window: the server copy is still kept */
  }
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { lang, setLang } = useI18n();

  useEffect(() => {
    setSessionLostHandler(() => setUser(null));
    auth
      .restore()
      .then((profile) => {
        // the language saved on the user (users.preferred_language) wins over this browser's last one
        if (profile && (profile.preferredLanguage === 'ta' || profile.preferredLanguage === 'en')) setLang(profile.preferredLanguage);
        setUser(profile);
      })
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

  const uiMode: UiMode = user?.uiMode === 'full' || user?.uiMode === 'simple' ? user.uiMode : readCachedMode();
  useEffect(() => {
    if (user?.uiMode) cacheMode(user.uiMode);
  }, [user?.uiMode]);

  const setUiMode = useCallback(async (mode: UiMode) => {
    cacheMode(mode);
    setUser((u) => (u ? { ...u, uiMode: mode } : u)); // show it at once; the server copy follows
    try {
      setUser(await api<Profile>('/auth/me/preferences', { method: 'PATCH', body: { uiMode: mode } }));
    } catch {
      /* keep the local choice; it is saved again next time */
    }
  }, []);

  const markTourDone = useCallback(async () => {
    setUser((u) => (u && !u.tourCompletedAt ? { ...u, tourCompletedAt: new Date().toISOString() } : u));
    try {
      setUser(await api<Profile>('/auth/me/preferences', { method: 'PATCH', body: { tourCompleted: true } }));
    } catch {
      /* this browser remembers it; the server copy is saved next time */
    }
  }, []);

  const markTourSeen = useCallback(async (tour: PageTourKey) => {
    setUser((u) => (u && !u.toursSeen.includes(tour) ? { ...u, toursSeen: [...u.toursSeen, tour] } : u));
    try {
      setUser(await api<Profile>('/auth/me/preferences', { method: 'PATCH', body: { tourSeen: tour } }));
    } catch {
      /* this browser remembers it; the server copy is saved next time */
    }
  }, []);

  // a language picked anywhere (top bar, Settings) is saved on the user, so it follows them to any device
  useEffect(() => {
    if (!user || user.preferredLanguage === lang) return;
    setUser({ ...user, preferredLanguage: lang });
    api<Profile>('/auth/me/preferences', { method: 'PATCH', body: { preferredLanguage: lang } }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the language changes
  }, [lang]);

  const simple = uiMode === 'simple';
  const value = useMemo(
    () => ({ user, loading, login, logout, can, refreshProfile, simple, setUiMode, markTourDone, markTourSeen }),
    [user, loading, login, logout, can, refreshProfile, simple, setUiMode, markTourDone, markTourSeen],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}

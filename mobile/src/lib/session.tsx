/** Who is logged in, and what they may do. Screens read this; the root layout guards routes with it. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Permission, UiMode } from '@timbertrail/shared';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { auth, Profile, setSessionLostHandler } from './api';
import { releasePushToken } from './push-token';
import { queryClient } from './query';

interface Session {
  /** null = logged out */
  user: Profile | null;
  /** true until the saved login has been checked at start-up */
  booting: boolean;
  can: (p: Permission) => boolean;
  login: (username: string, password: string) => Promise<Profile>;
  logout: () => Promise<void>;
  /** Simple view: only the daily work, big tiles, few words. The default for everyone, the owner too. */
  simple: boolean;
  /** Switch between the simple view and every feature. Shown at once; saved on the user so it follows them to the web. */
  setUiMode: (mode: UiMode) => Promise<void>;
  /** Save the language on the user, so it follows them to the web and other phones. Quiet on failure. */
  saveLanguage: (lang: 'en' | 'ta') => void;
}

const SessionCtx = createContext<Session | null>(null);

// ── last known view, per user, so the app opens in the right one even if the server copy is missing ──
const modeKey = (userId: string) => `timbertrail:uiMode:${userId}`;
const isMode = (v: unknown): v is UiMode => v === 'simple' || v === 'full';
const cacheMode = (userId: string, m: UiMode) => void AsyncStorage.setItem(modeKey(userId), m).catch(() => undefined);
async function readCachedMode(userId: string): Promise<UiMode | null> {
  try {
    const v = await AsyncStorage.getItem(modeKey(userId));
    return isMode(v) ? v : null;
  } catch {
    return null;
  }
}

export function SessionProvider({ children, onLogin }: { children: ReactNode; onLogin?: (p: Profile) => void }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [booting, setBooting] = useState(true);
  const [cachedMode, setCachedMode] = useState<UiMode | null>(null);
  /** the signed-in user's id right now, so a late answer for an earlier user is dropped */
  const currentId = useRef<string | null>(null);
  currentId.current = user?.id ?? null;

  useEffect(() => {
    setSessionLostHandler(() => {
      queryClient.clear();
      setUser(null);
    });
    auth
      .restore()
      .then((p) => {
        setUser(p);
        if (p) onLogin?.(p);
      })
      .catch(() => setUser(null))
      .finally(() => setBooting(false));
    // run once at start-up
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep the per-user cache in step with the server copy; fall back to it when the profile has none
  const userId = user?.id ?? null;
  const serverMode = user?.uiMode;
  useEffect(() => {
    if (!userId) {
      setCachedMode(null);
      return;
    }
    if (isMode(serverMode)) {
      cacheMode(userId, serverMode);
      setCachedMode(serverMode);
      return;
    }
    let alive = true;
    void readCachedMode(userId).then((m) => alive && setCachedMode(m));
    return () => {
      alive = false;
    };
  }, [userId, serverMode]);

  const login = useCallback(
    async (username: string, password: string) => {
      const p = await auth.login(username, password);
      onLogin?.(p);
      setUser(p);
      return p;
    },
    [onLogin],
  );

  const logout = useCallback(async () => {
    await releasePushToken(); // while still signed in, so the API accepts it
    await auth.logout();
    queryClient.clear(); // nothing from this account stays in memory
    setUser(null);
  }, []);

  /** take the server's answer only if the same person is still signed in */
  const acceptFor = (id: string) => (p: Profile) => {
    if (currentId.current === id) setUser(p);
  };

  const setUiMode = useCallback(async (mode: UiMode) => {
    const id = currentId.current;
    if (!id) return;
    cacheMode(id, mode);
    setCachedMode(mode);
    setUser((u) => (u ? { ...u, uiMode: mode } : u)); // show it at once; the server copy follows
    try {
      acceptFor(id)(await auth.savePreferences({ uiMode: mode }));
    } catch {
      /* keep the local choice; the cache holds it on this phone */
    }
  }, []);

  const saveLanguage = useCallback((lang: 'en' | 'ta') => {
    const id = currentId.current;
    if (!id) return;
    setUser((u) => (u && u.preferredLanguage !== lang ? { ...u, preferredLanguage: lang } : u));
    auth.savePreferences({ preferredLanguage: lang }).then(acceptFor(id), () => undefined);
  }, []);

  const uiMode: UiMode = isMode(user?.uiMode) ? user.uiMode : (cachedMode ?? 'simple');
  const simple = uiMode === 'simple';

  const value = useMemo<Session>(
    () => ({ user, booting, can: (p) => !!user?.permissions.includes(p), login, logout, simple, setUiMode, saveLanguage }),
    [user, booting, login, logout, simple, setUiMode, saveLanguage],
  );
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionCtx);
  if (!ctx) throw new Error('useSession outside SessionProvider');
  return ctx;
}

/** Inside the logged-in area the user is never null. */
export function useUser(): Profile {
  const { user } = useSession();
  if (!user) throw new Error('useUser while logged out');
  return user;
}

/** Simple view on? Screens use this to show the plain layout. */
export const useSimple = (): boolean => useSession().simple;

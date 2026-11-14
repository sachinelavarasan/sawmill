/** Who is logged in, and what they may do. Screens read this; the root layout guards routes with it. */
import type { Permission } from '@sawmill/shared';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { auth, Profile, setSessionLostHandler } from './api';
import { queryClient } from './query';

interface Session {
  /** null = logged out */
  user: Profile | null;
  /** true until the saved login has been checked at start-up */
  booting: boolean;
  can: (p: Permission) => boolean;
  login: (username: string, password: string) => Promise<Profile>;
  logout: () => Promise<void>;
}

const SessionCtx = createContext<Session | null>(null);

export function SessionProvider({ children, onLogin }: { children: ReactNode; onLogin?: (p: Profile) => void }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [booting, setBooting] = useState(true);

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
    await auth.logout();
    queryClient.clear(); // nothing from this account stays in memory
    setUser(null);
  }, []);

  const value = useMemo<Session>(
    () => ({ user, booting, can: (p) => !!user?.permissions.includes(p), login, logout }),
    [user, booting, login, logout],
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

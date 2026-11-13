/**
 * Minimal navigation: three bottom tabs plus a stack of pushed screens.
 * No navigation library needed; the Android back button pops the stack.
 */
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { BackHandler } from 'react-native';

export type Tab = 'home' | 'imports' | 'measure';

export type Route =
  | { name: 'newImport' }
  | { name: 'editImport'; id: string }
  | { name: 'import'; id: string }
  | { name: 'measure'; id: string };

interface Nav {
  tab: Tab;
  stack: Route[];
  setTab: (t: Tab) => void;
  push: (r: Route) => void;
  pop: () => void;
  replace: (r: Route) => void;
  /** Bumped whenever a screen is popped, so lists below can refresh. */
  version: number;
}

const NavCtx = createContext<Nav | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<Tab>('home');
  const [stack, setStack] = useState<Route[]>([]);
  const [version, setVersion] = useState(0);

  const push = useCallback((r: Route) => setStack((s) => [...s, r]), []);
  const pop = useCallback(() => {
    setStack((s) => s.slice(0, -1));
    setVersion((v) => v + 1);
  }, []);
  const replace = useCallback((r: Route) => setStack((s) => [...s.slice(0, -1), r]), []);
  const setTab = useCallback((t: Tab) => {
    setStack([]);
    setTabState(t);
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length) {
        pop();
        return true;
      }
      if (tab !== 'home') {
        setTab('home');
        return true;
      }
      return false; // let Android close the app
    });
    return () => sub.remove();
  }, [stack.length, tab, pop, setTab]);

  const value = useMemo(() => ({ tab, stack, setTab, push, pop, replace, version }), [tab, stack, setTab, push, pop, replace, version]);
  return <NavCtx.Provider value={value}>{children}</NavCtx.Provider>;
}

export function useNav() {
  const ctx = useContext(NavCtx);
  if (!ctx) throw new Error('useNav outside NavProvider');
  return ctx;
}

import { THEMES, type ThemeColors, type ThemeName } from '@sawmill/shared';
import * as SecureStore from 'expo-secure-store';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

const THEME_KEY = 'sawmill_theme';

interface Theme {
  name: ThemeName;
  c: ThemeColors;
  toggle: () => void;
}

const ThemeCtx = createContext<Theme>({ name: 'light', c: THEMES.light, toggle: () => {} });

/** Follows the phone's light/dark setting until the user picks one with the toggle. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system: ThemeName = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [choice, setChoice] = useState<ThemeName | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(THEME_KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark') setChoice(v);
      })
      .catch(() => undefined);
  }, []);

  const name = choice ?? system;
  const toggle = useCallback(() => {
    const next: ThemeName = name === 'dark' ? 'light' : 'dark';
    setChoice(next);
    SecureStore.setItemAsync(THEME_KEY, next).catch(() => undefined);
  }, [name]);

  const value = useMemo(() => ({ name, c: THEMES[name], toggle }), [name, toggle]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);

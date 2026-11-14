/**
 * Light / dark. Follows the phone until the user picks one with the toggle;
 * the choice is remembered on the phone. Colours live in src/global.css.
 */
import * as SecureStore from 'expo-secure-store';
import { useCallback } from 'react';
import { Uniwind, useUniwind } from 'uniwind';

const THEME_KEY = 'sawmill_theme';

/** Call once at start-up. */
export function restoreTheme() {
  SecureStore.getItemAsync(THEME_KEY)
    .then((v) => {
      if (v === 'light' || v === 'dark') Uniwind.setTheme(v);
    })
    .catch(() => undefined);
}

export function useThemeToggle() {
  const { theme } = useUniwind();
  const dark = theme === 'dark';
  const toggle = useCallback(() => {
    const next = dark ? 'light' : 'dark';
    Uniwind.setTheme(next);
    SecureStore.setItemAsync(THEME_KEY, next).catch(() => undefined);
  }, [dark]);
  return { dark, toggle };
}

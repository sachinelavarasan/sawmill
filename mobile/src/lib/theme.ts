/**
 * Light / dark. Follows the phone until the user picks one with the toggle;
 * the choice is remembered on the phone. Colours live in src/global.css.
 */
import { KEYS, getStored, setStored } from './storage';
import { useCallback } from 'react';
import { Uniwind, useUniwind } from 'uniwind';


/** Call once at start-up. */
export function restoreTheme() {
  getStored(KEYS.theme)
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
    setStored(KEYS.theme, next).catch(() => undefined);
  }, [dark]);
  return { dark, toggle };
}

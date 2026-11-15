/**
 * Light / dark. Starts in light until the user picks one with the toggle;
 * the choice is remembered on the phone. Colours live in src/global.css.
 */
import { KEYS, getStored, setStored } from './storage';
import { useCallback } from 'react';
import { Uniwind, useUniwind } from 'uniwind';


/** Call once at start-up (the splash screen is still up): light, unless dark was picked on this phone. */
export function restoreTheme() {
  Uniwind.setTheme('light');
  getStored(KEYS.theme)
    .then((v) => {
      if (v === 'dark') Uniwind.setTheme('dark');
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

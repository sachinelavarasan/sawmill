/**
 * Light / dark / follow the phone. The choice is a preference (services/preferences), applied
 * through Uniwind; colours live in src/global.css.
 */
import { useCallback } from 'react';
import { useUniwind } from 'uniwind';
import { usePreferences } from '../services/preferences';

export function useThemeToggle() {
  const { theme } = useUniwind();
  const { theme: preference, setTheme } = usePreferences();
  /** what is on screen now (with "system", whatever the phone is using) */
  const dark = theme === 'dark';
  const toggle = useCallback(() => setTheme(dark ? 'light' : 'dark'), [dark, setTheme]);
  return { dark, toggle, preference, setPreference: setTheme };
}

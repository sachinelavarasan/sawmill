import { THEMES, type ThemeName } from '@sawmill/shared';
import { useCallback, useEffect, useState } from 'react';

const THEME_KEY = 'sawmill.theme';

function saved(): ThemeName | null {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

const systemQuery = () => window.matchMedia('(prefers-color-scheme: dark)');
const current = (): ThemeName => saved() ?? (systemQuery().matches ? 'dark' : 'light');

/** Browser chrome (Android address bar) follows the brand band colour. */
function syncMeta(theme: ThemeName) {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEMES[theme].hero);
}

/**
 * Call once before the first render. With no saved choice the stylesheet
 * follows the device setting on its own; a saved choice pins the theme.
 */
export function initTheme() {
  const choice = saved();
  if (choice) document.documentElement.dataset.theme = choice;
  syncMeta(current());
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeName>(current);

  useEffect(() => {
    const mq = systemQuery();
    const onChange = () => {
      if (!saved()) setTheme(mq.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => syncMeta(theme), [theme]);

  const toggle = useCallback(() => {
    const next: ThemeName = theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage unavailable — the choice lasts for this page only */
    }
    document.documentElement.dataset.theme = next;
    setTheme(next);
  }, [theme]);

  return { theme, toggle };
}

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

/** Browser chrome (Android address bar) follows the brand band colour (--hero in tokens.css). */
function syncMeta(theme: ThemeName) {
  const hero = getComputedStyle(document.documentElement).getPropertyValue('--hero').trim() || THEMES[theme].hero;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', hero);
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

/** What the person picked: a fixed theme, or whatever the device uses. */
export type ThemeChoice = ThemeName | 'system';

/** A quarter-second colour fade while the theme changes (styles in index.css), unless less motion is asked for. */
function fadeColours() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const root = document.documentElement;
  root.classList.add('theme-switching');
  window.setTimeout(() => root.classList.remove('theme-switching'), 300);
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeName>(current);
  const [choice, setChoiceState] = useState<ThemeChoice>(() => saved() ?? 'system');

  useEffect(() => {
    const mq = systemQuery();
    const onChange = () => {
      if (!saved()) setTheme(mq.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => syncMeta(theme), [theme]);

  /** Light, dark, or follow the device again. */
  const setChoice = useCallback((next: ThemeChoice) => {
    fadeColours();
    try {
      if (next === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage unavailable — the choice lasts for this page only */
    }
    if (next === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    setChoiceState(next);
    setTheme(next === 'system' ? (systemQuery().matches ? 'dark' : 'light') : next);
  }, []);

  const toggle = useCallback(() => setChoice(theme === 'dark' ? 'light' : 'dark'), [theme, setChoice]);

  return { theme, choice, setChoice, toggle };
}

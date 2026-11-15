import { THEMES, type ThemeName } from '@timbertrail/shared';
import { useCallback, useEffect, useState } from 'react';

const THEME_KEY = 'timbertrail.theme';

/** What a person picked on this device; nothing picked yet means light (the app's default theme). */
function saved(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

const DEFAULT_THEME: ThemeName = 'light';
const systemQuery = () => window.matchMedia('(prefers-color-scheme: dark)');
const resolve = (choice: ThemeChoice): ThemeName => (choice === 'system' ? (systemQuery().matches ? 'dark' : 'light') : choice);
const current = (): ThemeName => resolve(saved());

/** Browser chrome (Android address bar) follows the brand band colour (--hero in tokens.css). */
function syncMeta(theme: ThemeName) {
  const hero = getComputedStyle(document.documentElement).getPropertyValue('--hero').trim() || THEMES[theme].hero;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', hero);
}

/**
 * Call once before the first render. Light unless the person picked otherwise; "system"
 * leaves the stylesheet to follow the device setting on its own.
 */
export function initTheme() {
  const choice = saved();
  if (choice !== 'system') document.documentElement.dataset.theme = choice;
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
  const [choice, setChoiceState] = useState<ThemeChoice>(saved);

  useEffect(() => {
    const mq = systemQuery();
    const onChange = () => {
      if (saved() === 'system') setTheme(mq.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => syncMeta(theme), [theme]);

  /** Light, dark, or follow the device again. */
  const setChoice = useCallback((next: ThemeChoice) => {
    fadeColours();
    try {
      // "system" is stored too: with nothing stored the app starts in light
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage unavailable — the choice lasts for this page only */
    }
    if (next === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    setChoiceState(next);
    setTheme(resolve(next));
  }, []);

  const toggle = useCallback(() => setChoice(theme === 'dark' ? 'light' : 'dark'), [theme, setChoice]);

  return { theme, choice, setChoice, toggle };
}

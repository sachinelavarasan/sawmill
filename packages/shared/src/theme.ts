/**
 * Colour tokens for SAWMILL PRO — forest green, white and one timber-amber accent.
 * The Android app reads these directly; the web app mirrors them as CSS variables
 * in `web/src/styles.css`. Change both together.
 */
export interface ThemeColors {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  muted: string;
  primary: string;
  onPrimary: string;
  primarySoft: string;
  accent: string;
  accentSoft: string;
  ok: string;
  okSoft: string;
  bad: string;
  badSoft: string;
  /** Brand band behind the app bar / login hero — dark green in both themes. */
  hero: string;
  heroText: string;
  heroMuted: string;
  heroChip: string;
}

export type ThemeName = 'light' | 'dark';

export const THEMES: Record<ThemeName, ThemeColors> = {
  light: {
    bg: '#F4F6F3',
    surface: '#FFFFFF',
    surface2: '#EEF2EE',
    border: '#DDE4DE',
    text: '#14231B',
    muted: '#55655C',
    primary: '#1B4332',
    onPrimary: '#FFFFFF',
    primarySoft: '#E3EFE8',
    accent: '#B45309',
    accentSoft: '#FCEFDC',
    ok: '#1B6B45',
    okSoft: '#E0F2E7',
    bad: '#A32D22',
    badSoft: '#FBE6E3',
    hero: '#1B4332',
    heroText: '#FFFFFF',
    heroMuted: '#D5E5DC',
    heroChip: '#2D6A4F',
  },
  dark: {
    bg: '#0E1512',
    surface: '#16201B',
    surface2: '#1E2B24',
    border: '#2C3B33',
    text: '#E8EFEA',
    muted: '#9DB0A5',
    primary: '#52B788',
    onPrimary: '#0B1F16',
    primarySoft: '#1D3A2C',
    accent: '#F0A04B',
    accentSoft: '#3A2A14',
    ok: '#6FD3A0',
    okSoft: '#173526',
    bad: '#F2958B',
    badSoft: '#3D1D19',
    hero: '#12281E',
    heroText: '#FFFFFF',
    heroMuted: '#D5E5DC',
    heroChip: '#2D6A4F',
  },
};

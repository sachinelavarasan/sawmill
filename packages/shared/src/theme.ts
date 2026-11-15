/**
 * Colour tokens for TimberTrail — Navy & Saffron: deep navy structure, white surfaces and one saffron accent.
 * The same values as the Android app (mobile/src/global.css) and the web app (web/src/tokens.css).
 * Change all three together.
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
  /** Information (neither good nor bad): soft blue. */
  info: string;
  infoSoft: string;
  /** Brand band behind the app bar / login hero — dark slate in both themes. */
  hero: string;
  heroText: string;
  heroMuted: string;
  heroChip: string;
}

export type ThemeName = 'light' | 'dark';

export const THEMES: Record<ThemeName, ThemeColors> = {
  light: {
    bg: '#F4F6F9',
    surface: '#FFFFFF',
    surface2: '#EEF1F5',
    border: '#E3E8EF',
    text: '#0F172A',
    muted: '#64748B',
    primary: '#13213A',
    onPrimary: '#FFFFFF',
    primarySoft: '#E8EDF5',
    accent: '#B45309',
    accentSoft: '#FFF3DC',
    ok: '#15803D',
    okSoft: '#DCFCE7',
    bad: '#C2261B',
    badSoft: '#FDE8E6',
    info: '#1D4ED8',
    infoSoft: '#DFE9FD',
    hero: '#0F1B2E',
    heroText: '#FFFFFF',
    heroMuted: '#A3AFC2',
    heroChip: '#1D2B44',
  },
  dark: {
    bg: '#08111F',
    surface: '#0F1A2C',
    surface2: '#16233A',
    border: '#1C2A42',
    text: '#E7ECF4',
    muted: '#8B99B0',
    primary: '#D8E1EE',
    onPrimary: '#08111F',
    primarySoft: '#16233A',
    accent: '#F7B548',
    accentSoft: '#2B2112',
    ok: '#5FD39A',
    okSoft: '#12301F',
    bad: '#F29589',
    badSoft: '#361A17',
    info: '#8FBDF3',
    infoSoft: '#13253C',
    hero: '#0C1627',
    heroText: '#F4F7FB',
    heroMuted: '#8B99B0',
    heroChip: '#182740',
  },
};

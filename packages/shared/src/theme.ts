/**
 * Colour tokens for SAWMILL PRO — Slate & Saffron: neutral graphite, white and one saffron accent.
 * The Android app reads these directly; the web app mirrors them as CSS variables
 * in `web/src/tokens.css`. Change both together.
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
    bg: '#F4F5F6',
    surface: '#FFFFFF',
    surface2: '#ECEEF0',
    border: '#DDE1E5',
    text: '#1A1F24',
    muted: '#58626C',
    primary: '#27323D',
    onPrimary: '#FFFFFF',
    primarySoft: '#E6EAEE',
    accent: '#985200',
    accentSoft: '#FDEFD6',
    ok: '#1B6B45',
    okSoft: '#E0F2E7',
    bad: '#A32D22',
    badSoft: '#FBE6E3',
    info: '#1A5A9E',
    infoSoft: '#E4EEFA',
    hero: '#1E262E',
    heroText: '#FFFFFF',
    heroMuted: '#DBE1E6',
    heroChip: '#36424F',
  },
  dark: {
    bg: '#111417',
    surface: '#1A1F24',
    surface2: '#232A31',
    border: '#323B44',
    text: '#E8ECEF',
    muted: '#A1ACB6',
    primary: '#C9D3DC',
    onPrimary: '#141A20',
    primarySoft: '#2A333C',
    accent: '#F0A04B',
    accentSoft: '#3A2A14',
    ok: '#6FD3A0',
    okSoft: '#173526',
    bad: '#F2958B',
    badSoft: '#3D1D19',
    info: '#8FBDF3',
    infoSoft: '#172A40',
    hero: '#1A2128',
    heroText: '#FFFFFF',
    heroMuted: '#DBE1E6',
    heroChip: '#36424F',
  },
};

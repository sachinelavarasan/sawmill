/**
 * The one place preferences live while the app runs. Screens read and change them through
 * usePreferences() (and the narrower hooks below); nothing else touches storage.
 *
 * Lifecycle
 *  - start-up: the phone's record (the login screen's look) is read at once — a few ms, so the
 *    login screen is never held up by preferences;
 *  - sign-in (or a restored session): that user's record is read, migrated and validated, and the
 *    app (Routes) waits for it, so the first screen already has their theme, language, landing
 *    screen and dashboard;
 *  - every change is applied at once and saved shortly after (coalesced, unchanged values skipped);
 *  - sign-out / another user: pending writes are flushed to the previous user's key, their record
 *    is dropped from memory, and the next user loads their own — or the defaults. The only thing
 *    carried over is what the person signing in picked on the login screen just before.
 *
 * Preferences never widen access: dashboard widgets and landing screens are filtered by
 * permission wherever they are used, whatever is stored.
 */
import type { Permission } from '@timbertrail/shared';
import { createContext, ReactNode, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Uniwind } from 'uniwind';
import { setDateFormat } from '../../lib/format';
import { LangCtx } from '../../lib/i18n';
import { setInAppDisplay } from '../../lib/notifications';
import { useSession } from '../../lib/session';
import { defaultPreferences } from './preference.defaults';
import { DEVICE_KEY, flushWrites, loadDevicePreferences, loadUserPreferences, scheduleWrite, userKey } from './preference.storage';
import {
  type DashboardRole,
  type DashboardWidget,
  type DevicePreferences,
  LANDING_SCREENS,
  type LandingInfo,
  type Language,
  type ListDensity,
  PREFERENCES_VERSION,
  type ThemePreference,
  type UserPreferences,
  WIDGETS,
  type WidgetInfo,
} from './preference.types';

interface PreferencesValue {
  /** the phone's record is read, and the signed-in user's too (when there is one) */
  ready: boolean;
  /** the signed-in user's preferences; the defaults while signed out */
  prefs: UserPreferences;
  /** effective language and theme (signed out: the phone's) */
  language: Language;
  theme: ThemePreference;
  /** change the signed-in user's preferences (no-op while signed out) */
  update: (change: (p: UserPreferences) => UserPreferences) => void;
  /** work signed in (the user's record) and signed out (the login screen's look) */
  setLanguage: (l: Language) => void;
  setTheme: (t: ThemePreference) => void;
  /** back to the defaults (language follows the account again) */
  reset: () => void;
}

const PrefsCtx = createContext<PreferencesValue | null>(null);

const isLanguage = (v: unknown): v is Language => v === 'en' || v === 'ta';

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user, saveLanguage } = useSession();
  const userId = user?.id ?? null;
  /** the account's language at the moment this user's record loads (the server wins on open) */
  const accountLangRef = useRef<Language | null>(null);
  accountLangRef.current = isLanguage(user?.preferredLanguage) ? user.preferredLanguage : null;
  const [device, setDevice] = useState<DevicePreferences | null>(null);
  const [loaded, setLoaded] = useState<{ userId: string; prefs: UserPreferences } | null>(null);
  /** what was picked on the login screen since the last sign-out — given to a first-time user */
  const loginPick = useRef<{ language?: Language; theme?: ThemePreference }>({});

  useEffect(() => {
    let alive = true;
    void loadDevicePreferences().then((d) => alive && setDevice(d));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    // whatever the previous user changed last goes to their key before anything else happens
    flushWrites();
    if (!userId) {
      setLoaded(null);
      return;
    }
    let alive = true;
    void loadUserPreferences(userId).then(({ prefs, created }) => {
      if (!alive) return;
      if (created) {
        if (loginPick.current.language) prefs.language = loginPick.current.language;
        if (loginPick.current.theme) prefs.theme = loginPick.current.theme;
      }
      loginPick.current = {};
      // the language saved on the user (set on the web or another phone) wins over this phone's copy
      if (accountLangRef.current) prefs.language = accountLangRef.current;
      setLoaded({ userId, prefs });
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  // anything still waiting is written when the app leaves the foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s !== 'active' && flushWrites());
    return () => sub.remove();
  }, []);

  const current = loaded && loaded.userId === userId ? loaded.prefs : null;
  const ready = !!device && (!userId || !!current);
  const prefs = current ?? defaultPreferences();
  const accountLanguage = isLanguage(user?.preferredLanguage) ? user.preferredLanguage : null;
  const language: Language = current ? (current.language ?? accountLanguage ?? 'en') : (device?.language ?? 'en');
  const theme: ThemePreference = current ? current.theme : (device?.theme ?? 'light');

  // ── apply ──
  // formats are plain functions; set before children render (idempotent)
  setDateFormat(prefs.display.dateFormat);
  setInAppDisplay(prefs.notifications);
  // before paint, so a screen never shows a frame in the other theme
  useLayoutEffect(() => {
    Uniwind.setTheme(theme);
  }, [theme]);

  // ── save ──
  useEffect(() => {
    if (current && userId) scheduleWrite(userKey(userId), current);
  }, [current, userId]);
  useEffect(() => {
    // the phone remembers the last look, for the login screen
    if (device) scheduleWrite(DEVICE_KEY, { version: PREFERENCES_VERSION, language, theme } satisfies DevicePreferences);
  }, [device, language, theme]);

  // ── change ──
  const update = useCallback(
    (change: (p: UserPreferences) => UserPreferences) => setLoaded((l) => (l && l.userId === userId ? { userId: l.userId, prefs: change(l.prefs) } : l)),
    [userId],
  );
  const signedIn = !!current;
  const setLanguage = useCallback(
    (l: Language) => {
      if (signedIn) {
        update((p) => (p.language === l ? p : { ...p, language: l }));
        saveLanguage(l); // follows the user to the web and other phones
      } else {
        loginPick.current.language = l;
        setDevice((d) => d && { ...d, language: l });
      }
    },
    [signedIn, update, saveLanguage],
  );
  const setTheme = useCallback(
    (t: ThemePreference) => {
      if (signedIn) update((p) => (p.theme === t ? p : { ...p, theme: t }));
      else {
        loginPick.current.theme = t;
        setDevice((d) => d && { ...d, theme: t });
      }
    },
    [signedIn, update],
  );
  const reset = useCallback(() => update(() => defaultPreferences()), [update]);

  const value = useMemo<PreferencesValue>(
    () => ({ ready, prefs, language, theme, update, setLanguage, setTheme, reset }),
    // `prefs` is a fresh default object while signed out; `current` is what actually changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, current, language, theme, update, setLanguage, setTheme, reset],
  );
  // useT re-renders on the date format too, so dates on screen follow a change at once
  const langValue = useMemo(() => ({ lang: language, setLang: setLanguage, rev: prefs.display.dateFormat }), [language, setLanguage, prefs.display.dateFormat]);

  return (
    <PrefsCtx.Provider value={value}>
      <LangCtx.Provider value={langValue}>{children}</LangCtx.Provider>
    </PrefsCtx.Provider>
  );
}

export function usePreferences(): PreferencesValue {
  const ctx = useContext(PrefsCtx);
  if (!ctx) throw new Error('usePreferences outside PreferencesProvider');
  return ctx;
}

export const useListDensity = (): ListDensity => useContext(PrefsCtx)?.prefs.display.listDensity ?? 'comfortable';

// ───────── what a person may be offered (permissions always win over preferences) ─────────

export function availableWidgets(role: DashboardRole, can: (p: Permission) => boolean): WidgetInfo[] {
  return WIDGETS.filter((w) => w.roles.includes(role) && (!w.permission || can(w.permission)));
}

/** This dashboard's sections to show, in the person's order. */
export function useDashboardWidgets(role: DashboardRole, can: (p: Permission) => boolean): DashboardWidget[] {
  const { prefs } = usePreferences();
  const allowed = new Set(availableWidgets(role, can).map((w) => w.id));
  const visible = new Set(prefs.dashboard.visibleWidgets);
  return prefs.dashboard.widgetOrder.filter((id) => allowed.has(id) && visible.has(id));
}

export const availableLandingScreens = (can: (p: Permission) => boolean): LandingInfo[] => LANDING_SCREENS.filter((l) => !l.permission || can(l.permission));

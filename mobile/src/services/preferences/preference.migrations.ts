/**
 * Turning whatever is stored into a valid, current record.
 *
 * Stored data may be missing, malformed (a half-written JSON, an old build's shape, a value this
 * build no longer knows) or from an older schema. Nothing read from storage is trusted: it is
 * migrated step by step to PREFERENCES_VERSION, then every field is checked and anything unusable
 * falls back to its default. Reading never throws.
 *
 * To change the schema: bump PREFERENCES_VERSION and add MIGRATIONS[oldVersion] that turns a
 * version-`oldVersion` object into a version-`oldVersion + 1` one.
 */
import { defaultDevicePreferences, defaultPreferences } from './preference.defaults';
import {
  type DashboardWidget,
  type DateFormat,
  type DevicePreferences,
  LANDING_SCREENS,
  type LandingScreen,
  type Language,
  type ListDensity,
  PREFERENCES_VERSION,
  type ThemePreference,
  type UserPreferences,
  WIDGET_IDS,
} from './preference.types';

type Loose = Record<string, unknown>;

const isObj = (v: unknown): v is Loose => typeof v === 'object' && v !== null && !Array.isArray(v);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

const LANGS: Language[] = ['en', 'ta'];
const THEMES: ThemePreference[] = ['light', 'dark', 'system'];
const DENSITIES: ListDensity[] = ['comfortable', 'compact'];
const DATE_FORMATS: DateFormat[] = ['medium', 'numeric', 'iso'];
const LANDINGS = LANDING_SCREENS.map((l) => l.id);

/** Known widget ids, in the stored order, without duplicates. */
function widgetList(v: unknown): DashboardWidget[] | null {
  if (!Array.isArray(v)) return null;
  return [...new Set(v.filter((x): x is DashboardWidget => WIDGET_IDS.includes(x as DashboardWidget)))];
}

/** Schema steps: MIGRATIONS[n] lifts a version-n record to version n + 1. */
const MIGRATIONS: Record<number, (old: Loose) => Loose> = {
  // 0 → 1: records written before versioning had no `version`; their fields already match v1.
  0: (old) => ({ ...old, version: 1 }),
};

function upgrade(raw: Loose): Loose {
  let rec = raw;
  let v = typeof rec.version === 'number' && Number.isInteger(rec.version) ? rec.version : 0;
  // a record from a newer build: keep what still validates, never "downgrade" by guessing
  if (v > PREFERENCES_VERSION) return rec;
  while (v < PREFERENCES_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) break;
    rec = step(rec);
    v += 1;
  }
  return rec;
}

/** Any stored value → a complete, valid UserPreferences. */
export function migratePreferences(raw: unknown): UserPreferences {
  const d = defaultPreferences();
  if (!isObj(raw)) return d;
  const r = upgrade(raw);
  const dash = isObj(r.dashboard) ? r.dashboard : {};
  const display = isObj(r.display) ? r.display : {};
  const notes = isObj(r.notifications) ? r.notifications : {};

  // widgets this record has never arranged (added in a later build) go to the end, shown
  const order = widgetList(dash.widgetOrder) ?? d.dashboard.widgetOrder;
  const unseen = WIDGET_IDS.filter((w) => !order.includes(w));
  const visible = widgetList(dash.visibleWidgets) ?? d.dashboard.visibleWidgets;

  return {
    version: PREFERENCES_VERSION,
    language: r.language === null ? null : LANGS.includes(r.language as Language) ? (r.language as Language) : d.language,
    theme: oneOf(r.theme, THEMES, d.theme),
    defaultLandingScreen: oneOf<LandingScreen>(r.defaultLandingScreen, LANDINGS, d.defaultLandingScreen),
    dashboard: {
      widgetOrder: [...order, ...unseen],
      visibleWidgets: [...new Set([...visible, ...unseen])],
    },
    display: {
      listDensity: oneOf(display.listDensity, DENSITIES, d.display.listDensity),
      dateFormat: oneOf(display.dateFormat, DATE_FORMATS, d.display.dateFormat),
    },
    notifications: {
      inAppBanner: bool(notes.inAppBanner, d.notifications.inAppBanner),
      inAppSound: bool(notes.inAppSound, d.notifications.inAppSound),
    },
  };
}

/** Any stored value → a complete, valid DevicePreferences. */
export function migrateDevicePreferences(raw: unknown): DevicePreferences {
  const d = defaultDevicePreferences();
  if (!isObj(raw)) return d;
  const r = upgrade(raw);
  return { version: PREFERENCES_VERSION, language: oneOf(r.language, LANGS, d.language), theme: oneOf(r.theme, THEMES, d.theme) };
}

/** JSON text → a parsed value, or null when it isn't JSON. */
export function parseStored(text: string | null): unknown {
  if (text == null) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

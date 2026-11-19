/**
 * Where preferences are kept: AsyncStorage, one key per user plus one for the phone.
 *
 *   timbertrail:preferences:{userId}   that person's UserPreferences
 *   timbertrail:preferences:device     the login screen's look (DevicePreferences)
 *
 * Only the preference provider calls this module; screens go through usePreferences().
 *
 * Writes are coalesced: a burst of changes (a toggle tapped twice, a widget moved three places) is
 * written once, ~250 ms after the last change, and a value equal to what was last written is not
 * written at all. Storage failures are swallowed: a preference that could not be saved is not
 * worth an error on screen, and reads fall back to defaults.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteStored, getStored, KEYS } from '../../lib/storage';
import { migrateDevicePreferences, migratePreferences, parseStored } from './preference.migrations';
import type { DevicePreferences, Language, ThemePreference, UserPreferences } from './preference.types';

const PREFIX = 'timbertrail:preferences:';
export const userKey = (userId: string) => `${PREFIX}${userId}`;
export const DEVICE_KEY = `${PREFIX}device`;

const WRITE_DELAY = 250;

/** what each key last held in storage (as read or written), so equal values aren't rewritten */
const lastWritten = new Map<string, string>();
const pending = new Map<string, { json: string; timer: ReturnType<typeof setTimeout> }>();

async function read(key: string): Promise<unknown> {
  try {
    const text = await AsyncStorage.getItem(key);
    if (text != null) lastWritten.set(key, text);
    return parseStored(text);
  } catch {
    return null;
  }
}

function writeNow(key: string, json: string) {
  pending.delete(key);
  if (lastWritten.get(key) === json) return;
  lastWritten.set(key, json);
  AsyncStorage.setItem(key, json).catch(() => {
    // let the next change try again
    lastWritten.delete(key);
  });
}

/** Save `value` under `key` soon (coalesced, skipped when unchanged). */
export function scheduleWrite(key: string, value: unknown) {
  const json = JSON.stringify(value);
  const queued = pending.get(key);
  if (queued) clearTimeout(queued.timer);
  if (lastWritten.get(key) === json) {
    pending.delete(key);
    return;
  }
  pending.set(key, { json, timer: setTimeout(() => writeNow(key, json), WRITE_DELAY) });
}

/** Write anything still waiting, now (before switching user, or when the app goes to background). */
export function flushWrites() {
  for (const [key, p] of [...pending]) {
    clearTimeout(p.timer);
    writeNow(key, p.json);
  }
}

/** The phone's record; before one exists, the look the phone had before per-user preferences. */
export async function loadDevicePreferences(): Promise<DevicePreferences> {
  const stored = await read(DEVICE_KEY);
  if (stored != null) return migrateDevicePreferences(stored);
  return migrateDevicePreferences({ ...migrateDevicePreferences(null), ...(await legacyDeviceLook()) });
}

/**
 * This user's preferences. The first time a user signs in on this phone after the update, the
 * theme and language the phone used to keep for everyone (secure store, before per-user
 * preferences) become theirs, and the shared values are removed so the next person on this phone
 * starts from the defaults rather than inheriting them.
 */
export async function loadUserPreferences(userId: string): Promise<{ prefs: UserPreferences; created: boolean }> {
  const stored = await read(userKey(userId));
  if (stored != null) return { prefs: migratePreferences(stored), created: false };

  const prefs = migratePreferences(null);
  try {
    const [theme, lang] = await Promise.all([getStored(KEYS.theme), getStored(KEYS.lang)]);
    if (theme === 'dark' || theme === 'light') prefs.theme = theme as ThemePreference;
    if (lang === 'en' || lang === 'ta') prefs.language = lang as Language;
    if (theme != null || lang != null) await Promise.all([deleteStored(KEYS.theme), deleteStored(KEYS.lang)]);
  } catch {
    // the secure store is unavailable: defaults it is
  }
  return { prefs, created: true };
}

/**
 * The look the phone had before per-user preferences, for the login screen on the first start
 * after the update. Read-only: the per-user load above moves the values on sign-in.
 */
export async function legacyDeviceLook(): Promise<Partial<DevicePreferences>> {
  try {
    const [theme, lang] = await Promise.all([getStored(KEYS.theme), getStored(KEYS.lang)]);
    return {
      ...(theme === 'dark' || theme === 'light' ? { theme } : {}),
      ...(lang === 'en' || lang === 'ta' ? { language: lang } : {}),
    };
  } catch {
    return {};
  }
}

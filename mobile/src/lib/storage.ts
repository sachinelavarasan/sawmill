/**
 * Values this phone keeps in the secure store, under "timbertrail_" keys.
 *
 * Builds before the rename used "sawmill_" keys. Reading a key moves its old value across
 * the first time, so updating the app keeps you signed in with your theme and language.
 */
import * as SecureStore from 'expo-secure-store';

export const KEYS = {
  refresh: 'timbertrail_refresh',
  theme: 'timbertrail_theme',
  lang: 'timbertrail_lang',
  welcomed: 'timbertrail_welcomed',
  /** daily reminder: JSON { on: boolean, hour: number } */
  reminder: 'timbertrail_reminder',
} as const;

type Key = (typeof KEYS)[keyof typeof KEYS];

const legacy = (k: Key) => k.replace(/^timbertrail_/, 'sawmill_');

export async function getStored(k: Key): Promise<string | null> {
  const v = await SecureStore.getItemAsync(k);
  if (v != null) return v;
  const old = await SecureStore.getItemAsync(legacy(k));
  if (old == null) return null;
  await SecureStore.setItemAsync(k, old);
  await SecureStore.deleteItemAsync(legacy(k));
  return old;
}

export const setStored = (k: Key, v: string) => SecureStore.setItemAsync(k, v);

export async function deleteStored(k: Key) {
  await SecureStore.deleteItemAsync(k);
  await SecureStore.deleteItemAsync(legacy(k));
}

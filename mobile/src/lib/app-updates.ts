/**
 * Over-the-air updates (EAS Update, configured in app.config.js).
 *
 * At start the app opens straight away from what it has and asks for a newer update in the
 * background (checkAutomatically: ON_LOAD, no waiting). It asks again when it comes back to the
 * foreground, at most every 30 minutes. A downloaded update is used from the next start; the
 * person is offered "Restart now" once (never forced — they may be in the middle of measuring).
 *
 * Off in development and in builds made without an EAS project id (Updates.isEnabled = false).
 */
import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

export const updatesOn = Updates.isEnabled && !__DEV__;

const FOREGROUND_GAP_MS = 30 * 60_000;
let lastCheck = 0;

export type CheckResult = 'downloaded' | 'latest' | 'failed' | 'off';

/** Ask for a newer update and download it if there is one. Never throws (no signal = 'failed'). */
export async function checkForAppUpdate(): Promise<CheckResult> {
  if (!updatesOn) return 'off';
  lastCheck = Date.now();
  try {
    const found = await Updates.checkForUpdateAsync();
    if (!found.isAvailable) return 'latest';
    const fetched = await Updates.fetchUpdateAsync();
    return fetched.isNew ? 'downloaded' : 'latest';
  } catch {
    return 'failed';
  }
}

/** Start the downloaded update now. */
export const restartIntoUpdate = () => Updates.reloadAsync();

/** What is running: shown under Settings → About. */
export function runningUpdateLabel(): string | null {
  if (!updatesOn || Updates.isEmbeddedLaunch || !Updates.updateId) return null;
  const when = Updates.createdAt ? Updates.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  return `${Updates.updateId.slice(0, 8)}${when ? ` · ${when}` : ''}`;
}

/**
 * Checks on return to the foreground (throttled) and reports, once per downloaded update,
 * that it is ready — `onReady` is called with the update id.
 */
export function useAppUpdates(onReady: (updateId: string) => void) {
  const { isUpdatePending, downloadedUpdate } = Updates.useUpdates();
  const told = useRef<string | null>(null);
  const ready = useRef(onReady);
  ready.current = onReady;

  useEffect(() => {
    if (!updatesOn) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && Date.now() - lastCheck > FOREGROUND_GAP_MS) void checkForAppUpdate();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const id = downloadedUpdate?.updateId;
    if (!updatesOn || !isUpdatePending || !id || told.current === id) return;
    told.current = id;
    ready.current(id);
  }, [isUpdatePending, downloadedUpdate?.updateId]);
}

/** For the Settings row: a downloaded update is waiting for a restart. */
export function useUpdateWaiting(): boolean {
  const { isUpdatePending } = Updates.useUpdates();
  return updatesOn && isUpdatePending;
}

/**
 * Logs measured while the phone had no connection.
 *
 * The yard often has weak signal. When saving a log fails because the server can't be reached
 * (ApiError status 0), the log is kept in a small file on the phone and sent later, in the order
 * it was measured: when the app comes back to the foreground, every 20 s while anything waits,
 * and right after any log saves normally. Each log carries a `clientRef` the phone makes up, so
 * if a send reached the server but the reply was lost, the resend is recognised there instead of
 * being stored twice (see ImportsService.addLog).
 *
 * Only measurements (girth, length) are kept here — never prices or other financial figures,
 * which stay in memory only (see query.ts).
 *
 * A log the server refuses (the load was submitted meanwhile, or the numbers are out of range)
 * stays on the phone with the reason, so it is never silently lost; the accountant can delete it.
 */
import { importLogCft } from '@timbertrail/shared';
import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { ApiError } from './api';
import { importsApi, type Log, type Totals } from './imports-api';

export interface PendingLog {
  /** sent as clientRef */
  ref: string;
  /** who measured it: only sent while that person is signed in */
  userId: string;
  loadId: string;
  /** the load's code, for messages shown away from the measure screen */
  loadCode: string;
  girthIn: number;
  lengthFt: number;
  /** the same formula and rounding as the server */
  cft: number;
  measuredAt: string;
  /** set when the server refused it; it is not retried */
  error?: string;
}

const file = new File(Paths.document, 'pending-logs.json');
let items: PendingLog[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  try {
    if (file.exists) {
      const parsed: unknown = JSON.parse(file.textSync());
      if (Array.isArray(parsed)) items = parsed as PendingLog[];
    }
  } catch {
    items = []; // a damaged file must not stop measuring
  }
}

function commit(next: PendingLog[]) {
  items = next;
  try {
    if (!file.exists) file.create();
    file.write(JSON.stringify(items));
  } catch {
    // keep going in memory; the next change tries to write again
  }
  listeners.forEach((l) => l());
}

/** RFC 4122 v4 id; only has to be unique per load, so Math.random is enough. */
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const newLogRef = uuid;

/** True when the failure means "couldn't reach the server" (worth keeping and retrying), not "the server said no". */
export const isOffline = (e: unknown) => e instanceof ApiError && (e.status === 0 || e.status >= 500);

export function pendingFor(userId: string, loadId?: string): PendingLog[] {
  ensureLoaded();
  return items.filter((p) => p.userId === userId && (!loadId || p.loadId === loadId));
}

export function enqueueLog(p: Omit<PendingLog, 'cft' | 'measuredAt'>) {
  ensureLoaded();
  commit([...items, { ...p, cft: importLogCft(p.girthIn, p.lengthFt), measuredAt: new Date().toISOString() }]);
}

/** Correct a log that hasn't been sent yet (it is retried again if it had been refused). */
export function updatePending(ref: string, girthIn: number, lengthFt: number) {
  ensureLoaded();
  commit(items.map((p) => (p.ref === ref ? { ...p, girthIn, lengthFt, cft: importLogCft(girthIn, lengthFt), error: undefined } : p)));
}

export function removePending(ref: string) {
  ensureLoaded();
  commit(items.filter((p) => p.ref !== ref));
}

/** Re-render when the waiting logs change. */
export function usePendingLogs(userId: string | null | undefined, loadId?: string): PendingLog[] {
  const all = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => {
      ensureLoaded();
      return items;
    },
  );
  if (!userId) return [];
  return all.filter((p) => p.userId === userId && (!loadId || p.loadId === loadId));
}

export interface Sent {
  pending: PendingLog;
  log: Log;
  totals: Totals;
}

let flushing: Promise<Sent[]> | null = null;
const sentListeners = new Set<(s: Sent) => void>();

/** Called for each waiting log the server accepted (the measure screen moves it into the list). */
export function onLogSent(fn: (s: Sent) => void) {
  sentListeners.add(fn);
  return () => {
    sentListeners.delete(fn);
  };
}

/**
 * Send this person's waiting logs, oldest first. Stops at the first one that can't reach the
 * server (the rest wait for the next try, so the order — and the log numbers — stay as measured).
 * One flush at a time.
 */
export function flushPending(userId: string): Promise<Sent[]> {
  flushing ??= (async () => {
    const sent: Sent[] = [];
    for (const p of pendingFor(userId).filter((x) => !x.error)) {
      try {
        const res = await importsApi.addLog(p.loadId, p.girthIn, p.lengthFt, p.ref);
        const s = { pending: p, log: res.log, totals: { totalLogs: res.totalLogs, totalCft: res.totalCft } };
        sent.push(s);
        // screens add the saved log first, then the waiting copy goes — the totals never dip in between
        sentListeners.forEach((l) => l(s));
        removePending(p.ref);
      } catch (e) {
        if (isOffline(e)) break;
        // refused (load submitted, not found, invalid): keep it with the reason, don't retry
        ensureLoaded();
        commit(items.map((x) => (x.ref === p.ref ? { ...x, error: (e as Error).message } : x)));
      }
    }
    return sent;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

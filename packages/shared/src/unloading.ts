/**
 * Unloading time & charges (requirements §5).
 *
 *   Duration = End − Start, in whole minutes
 *   Charges  = Rate per hour × Duration / 60, rounded to 2 decimals (paise)
 *
 * Billing is proportional to the minute; if the mill bills by started hour,
 * change `unloadingCharges` here and every client + the API follow.
 */
import { roundTo } from './cft';

export class UnloadingInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnloadingInputError';
  }
}

export function durationMinutes(start: Date | string, end: Date | string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) throw new UnloadingInputError('Invalid start or end time');
  if (e < s) throw new UnloadingInputError('End time must be after start time');
  return Math.round((e - s) / 60_000);
}

export function unloadingCharges(minutes: number, ratePerHour: number): number {
  if (!Number.isFinite(minutes) || minutes < 0) throw new UnloadingInputError('Duration must be 0 or more');
  if (!Number.isFinite(ratePerHour) || ratePerHour < 0) throw new UnloadingInputError('Rate must be 0 or more');
  return roundTo((ratePerHour * minutes) / 60, 2);
}

/** 150 → "2h 30m", 45 → "45m" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

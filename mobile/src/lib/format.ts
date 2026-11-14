/** Numbers and dates the way the mill reads them (en-IN grouping; CFT always 3 decimals). */
import { formatCft } from '@sawmill/shared';

export const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
/** CFT: three decimals, as stored and calculated everywhere else. */
export const num3 = (n: number) => Number(formatCft(n)).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
export const int = (n: number) => n.toLocaleString('en-IN');
export const signed3 = (n: number) => `${n > 0 ? '+' : ''}${num3(n)}`;
export const signedInt = (n: number) => `${n > 0 ? '+' : ''}${int(n)}`;

export const dateTime = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—';
/** A timestamp or a YYYY-MM-DD day. */
export const dateOnly = (s: string | null | undefined) =>
  s ? new Date(s.length === 10 ? `${s}T00:00:00` : s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const timeOnly = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '—';

/** Local calendar day as YYYY-MM-DD. */
export const isoDay = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
export const todayIso = () => isoDay(new Date());

export interface Period {
  from: string;
  to: string;
}
export type PeriodKey = 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear' | 'lastYear';
export const PERIOD_KEYS: PeriodKey[] = ['thisMonth', 'lastMonth', 'thisQuarter', 'thisYear', 'lastYear'];

/** Same quick ranges as the web dashboard, in the phone's local calendar. */
export function presets(now = new Date()): Record<PeriodKey, Period> {
  const y = now.getFullYear();
  const m = now.getMonth();
  return {
    thisMonth: { from: isoDay(new Date(y, m, 1)), to: isoDay(now) },
    lastMonth: { from: isoDay(new Date(y, m - 1, 1)), to: isoDay(new Date(y, m, 0)) },
    thisQuarter: { from: isoDay(new Date(y, Math.floor(m / 3) * 3, 1)), to: isoDay(now) },
    thisYear: { from: isoDay(new Date(y, 0, 1)), to: isoDay(now) },
    lastYear: { from: isoDay(new Date(y - 1, 0, 1)), to: isoDay(new Date(y - 1, 11, 31)) },
  };
}
export const periodQuery = (p: Period) => `from=${p.from}&to=${p.to}`;

/** Parse a typed number; null when empty or not a number. */
export function parseNum(v: string): number | null {
  const s = v.trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Keep only what a decimal field may hold: digits, one dot, at most `decimals` places. */
export function cleanDecimal(v: string, decimals = 2): string {
  let s = v.replace(/[^0-9.]/g, '');
  const dot = s.indexOf('.');
  if (dot >= 0) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '').slice(0, decimals);
  return s;
}
export const cleanInt = (v: string) => v.replace(/[^0-9]/g, '');

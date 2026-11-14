/**
 * Date ranges for accounts and reports, in the mill's local time.
 * `from`/`to` are inclusive calendar days (YYYY-MM-DD). For timestamp columns use
 * `start` (inclusive) and `end` (exclusive), which are those days' local midnights in UTC.
 */
import { BadRequestException } from '@nestjs/common';
import { IsOptional, Matches } from 'class-validator';
import { eq } from 'drizzle-orm';
import type { DbOrTx } from '../db/db.module';
import { mills } from '../db/schema';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export class PeriodQuery {
  @IsOptional() @Matches(DAY, { message: 'from must be YYYY-MM-DD' }) from?: string;
  @IsOptional() @Matches(DAY, { message: 'to must be YYYY-MM-DD' }) to?: string;
}

export interface Period {
  from: string;
  to: string;
  start: Date;
  end: Date;
}

export async function millOffsetMinutes(db: DbOrTx, millId: string): Promise<number> {
  const [mill] = await db.select({ settings: mills.settings }).from(mills).where(eq(mills.id, millId));
  return Number(mill?.settings?.utcOffsetMinutes ?? 330);
}

/** Today's date (YYYY-MM-DD) at the mill. */
export function localToday(offsetMin: number, now = Date.now()): string {
  return new Date(now + offsetMin * 60_000).toISOString().slice(0, 10);
}

/** Resolve a from/to query; defaults to the current month up to today. */
export function resolvePeriod(q: { from?: string; to?: string }, offsetMin: number, now = Date.now()): Period {
  const today = localToday(offsetMin, now);
  const to = q.to ?? today;
  const from = q.from ?? `${today.slice(0, 8)}01`;
  const startMs = Date.parse(`${from}T00:00:00Z`);
  const endMs = Date.parse(`${to}T00:00:00Z`) + DAY_MS;
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) throw new BadRequestException('Invalid date');
  if (startMs >= endMs) throw new BadRequestException('"from" must be on or before "to"');
  if (endMs - startMs > 5 * 366 * DAY_MS) throw new BadRequestException('The period can be at most 5 years');
  return {
    from,
    to,
    start: new Date(startMs - offsetMin * 60_000),
    end: new Date(endMs - offsetMin * 60_000),
  };
}

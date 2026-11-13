/**
 * Chart series for the dashboards. Every series is zero-filled per day/month so
 * the charts draw a continuous axis, and days are the mill's local days.
 * Same counting rules as the KPIs: only APPROVED imports / exports / stock count.
 */
import { Injectable } from '@nestjs/common';
import { roundTo } from '@sawmill/shared';
import { and, count, eq, gte, lt, lte, sql, sum } from 'drizzle-orm';
import { AccountsService } from '../accounts/accounts.service';
import { localToday, millOffsetMinutes, resolvePeriod } from '../common/period';
import type { AuthUser } from '../common/types';
import { Database, InjectDb } from '../db/db.module';
import { exportLoads, importLoads, logMeasurements, stockMovements } from '../db/schema';

const DAY_MS = 86_400_000;

/** The `n` local days ending today, oldest first, as YYYY-MM-DD. */
export function lastDays(today: string, n: number): string[] {
  const end = Date.parse(`${today}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => new Date(end - (n - 1 - i) * DAY_MS).toISOString().slice(0, 10));
}

/** The `n` months ending with today's month, oldest first: { month: YYYY-MM, from, to } (to capped at today). */
export function lastMonths(today: string, n: number) {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7)) - 1;
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - (n - 1 - i), 1));
    const from = d.toISOString().slice(0, 10);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    return { month: from.slice(0, 7), from, to: last > today ? today : last };
  });
}

@Injectable()
export class ChartsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly accounts: AccountsService,
  ) {}

  async owner(actor: AuthUser) {
    const millId = actor.millId;
    const off = await millOffsetMinutes(this.db, millId);
    const today = localToday(off);
    const days = lastDays(today, 30);
    const flowPeriod = resolvePeriod({ from: days[0], to: today }, off);
    // a timestamp's local day, for grouping
    const localDay = sql<string>`to_char((${importLoads.arrivalAt} at time zone 'UTC') + make_interval(mins => ${off}), 'YYYY-MM-DD')`;

    const [received, shipped, stock, cash] = await Promise.all([
      this.db
        .select({ day: localDay, cft: sum(importLoads.totalCft) })
        .from(importLoads)
        .where(and(eq(importLoads.millId, millId), eq(importLoads.status, 'APPROVED'), gte(importLoads.arrivalAt, flowPeriod.start), lt(importLoads.arrivalAt, flowPeriod.end)))
        // by position: the offset is a bind parameter, and Postgres won't match
        // "GROUP BY expr($2)" to "SELECT expr($1)" even with equal values
        .groupBy(sql`1`),
      this.db
        .select({ day: exportLoads.exportDate, cft: sum(exportLoads.totalCft) })
        .from(exportLoads)
        .where(and(eq(exportLoads.millId, millId), eq(exportLoads.status, 'APPROVED'), gte(exportLoads.exportDate, days[0]), lte(exportLoads.exportDate, today)))
        .groupBy(exportLoads.exportDate),
      this.db
        .select({ woodType: stockMovements.woodType, kind: stockMovements.kind, cft: sum(stockMovements.cftDelta) })
        .from(stockMovements)
        .where(eq(stockMovements.millId, millId))
        .groupBy(stockMovements.woodType, stockMovements.kind),
      Promise.all(
        lastMonths(today, 6).map(async (m) => {
          const p = await this.accounts.profitAndLoss(millId, resolvePeriod({ from: m.from, to: m.to }, off));
          return { month: m.month, sales: p.sales, expenses: p.totalExpenses };
        }),
      ),
    ]);

    const inByDay = new Map(received.map((r) => [r.day, Number(r.cft ?? 0)]));
    const outByDay = new Map(shipped.map((r) => [r.day, Number(r.cft ?? 0)]));
    const woods = new Map<string, { woodType: string; rawCft: number; finishedCft: number }>();
    for (const s of stock) {
      const w = woods.get(s.woodType) ?? { woodType: s.woodType, rawCft: 0, finishedCft: 0 };
      if (s.kind === 'RAW') w.rawCft = roundTo(Number(s.cft ?? 0));
      else w.finishedCft = roundTo(Number(s.cft ?? 0));
      woods.set(s.woodType, w);
    }

    return {
      flow: days.map((day) => ({ day, receivedCft: roundTo(inByDay.get(day) ?? 0), shippedCft: roundTo(outByDay.get(day) ?? 0) })),
      stockByWood: [...woods.values()]
        .filter((w) => w.rawCft > 0 || w.finishedCft > 0)
        .sort((a, b) => b.rawCft + b.finishedCft - (a.rawCft + a.finishedCft)),
      cash,
    };
  }

  /** The accountant's own measuring, last 14 days. */
  async accountant(actor: AuthUser) {
    const off = await millOffsetMinutes(this.db, actor.millId);
    const today = localToday(off);
    const days = lastDays(today, 14);
    const p = resolvePeriod({ from: days[0], to: today }, off);
    const localDay = sql<string>`to_char((${logMeasurements.createdAt} at time zone 'UTC') + make_interval(mins => ${off}), 'YYYY-MM-DD')`;
    const rows = await this.db
      .select({ day: localDay, logs: count(), cft: sum(logMeasurements.cft) })
      .from(logMeasurements)
      .innerJoin(importLoads, eq(importLoads.id, logMeasurements.importLoadId))
      .where(and(eq(importLoads.millId, actor.millId), eq(logMeasurements.createdById, actor.id), gte(logMeasurements.createdAt, p.start), lt(logMeasurements.createdAt, p.end)))
      .groupBy(sql`1`); // by position, see owner()
    const byDay = new Map(rows.map((r) => [r.day, r]));
    return {
      logsByDay: days.map((day) => ({ day, logs: byDay.get(day)?.logs ?? 0, cft: roundTo(Number(byDay.get(day)?.cft ?? 0)) })),
    };
  }
}

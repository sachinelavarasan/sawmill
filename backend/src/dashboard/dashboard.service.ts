import { Injectable } from '@nestjs/common';
import { and, count, desc, eq, gte, inArray, max, SQL, sum } from 'drizzle-orm';
import type { AuthUser } from '../common/types';
import { Database, InjectDb } from '../db/db.module';
import {
  ApprovalStatus,
  expenses,
  exportFinancials,
  exportLoads,
  importFinancials,
  importLoads,
  logMeasurements,
  mills,
  productionRuns,
  stockAdjustments,
  stockMovements,
  unloadingEntries,
  users,
} from '../db/schema';

/** numeric columns arrive as strings (or null for empty SUMs). */
const num = (v: string | number | null | undefined) => (v == null ? 0 : Number(v));
const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

type StatusCounts = Record<ApprovalStatus, number>;
const emptyCounts = (): StatusCounts => ({ DRAFT: 0, SUBMITTED: 0, APPROVED: 0, REJECTED: 0 });

/** Every table whose records go through Owner approval. */
const APPROVABLE = [importLoads, productionRuns, exportLoads, stockAdjustments] as const;

@Injectable()
export class DashboardService {
  constructor(@InjectDb() private readonly db: Database) {}

  /**
   * "Today" in the mill's local time (default India, UTC+05:30):
   * `start` for timestamp columns, `date` (YYYY-MM-DD) for date columns.
   */
  private async today(millId: string): Promise<{ start: Date; date: string }> {
    const [mill] = await this.db.select({ settings: mills.settings }).from(mills).where(eq(mills.id, millId));
    const offsetMin = Number(mill?.settings?.utcOffsetMinutes ?? 330);
    const local = new Date(Date.now() + offsetMin * 60_000);
    local.setUTCHours(0, 0, 0, 0);
    return { start: new Date(local.getTime() - offsetMin * 60_000), date: local.toISOString().slice(0, 10) };
  }

  /** Status counts across every approvable record type, optionally for one creator. */
  private async statusCounts(millId: string, createdById?: string): Promise<StatusCounts> {
    const groups = await Promise.all(
      APPROVABLE.map((t) => {
        const conds: SQL[] = [eq(t.millId, millId)];
        if (createdById) conds.push(eq(t.createdById, createdById));
        return this.db
          .select({ status: t.status, n: count() })
          .from(t)
          .where(and(...conds))
          .groupBy(t.status);
      }),
    );
    const counts = emptyCounts();
    for (const g of groups.flat()) counts[g.status] += g.n;
    return counts;
  }

  private async stockCft(millId: string, kind: 'RAW' | 'FINISHED') {
    const [r] = await this.db
      .select({ total: sum(stockMovements.cftDelta) })
      .from(stockMovements)
      .where(and(eq(stockMovements.millId, millId), eq(stockMovements.kind, kind)));
    return round(num(r?.total), 3);
  }

  async owner(user: AuthUser) {
    const millId = user.millId;
    const today = await this.today(millId);
    const db = this.db;
    const approvedImport = and(eq(importLoads.millId, millId), eq(importLoads.status, 'APPROVED'));
    const approvedExport = and(eq(exportLoads.millId, millId), eq(exportLoads.status, 'APPROVED'));

    const [
      [importCount],
      [exportCount],
      rawStockCft,
      finishedStockCft,
      [todayImp],
      [todayExp],
      counts,
      [sales],
      [purchases],
      [unloading],
      [other],
    ] = await Promise.all([
      db.select({ n: count() }).from(importLoads).where(approvedImport),
      db.select({ n: count() }).from(exportLoads).where(approvedExport),
      this.stockCft(millId, 'RAW'),
      this.stockCft(millId, 'FINISHED'),
      db.select({ n: count() }).from(importLoads).where(and(eq(importLoads.millId, millId), gte(importLoads.arrivalAt, today.start))),
      db
        .select({ n: count() })
        .from(exportLoads)
        .where(and(eq(exportLoads.millId, millId), gte(exportLoads.exportDate, today.date))),
      this.statusCounts(millId),
      db
        .select({ sale: sum(exportFinancials.saleAmount), received: sum(exportFinancials.amountReceived) })
        .from(exportFinancials)
        .innerJoin(exportLoads, eq(exportLoads.id, exportFinancials.exportLoadId))
        .where(approvedExport),
      db
        .select({
          purchase: sum(importFinancials.purchaseAmount),
          transport: sum(importFinancials.transportCharges),
          paid: sum(importFinancials.amountPaid),
        })
        .from(importFinancials)
        .innerJoin(importLoads, eq(importLoads.id, importFinancials.importLoadId))
        .where(approvedImport),
      db
        .select({ charges: sum(unloadingEntries.totalCharges) })
        .from(unloadingEntries)
        .innerJoin(importLoads, eq(importLoads.id, unloadingEntries.importLoadId))
        .where(approvedImport),
      db.select({ amount: sum(expenses.amount) }).from(expenses).where(eq(expenses.millId, millId)),
    ]);

    const totalSales = num(sales?.sale);
    const totalExpenses = num(purchases?.purchase) + num(purchases?.transport) + num(unloading?.charges) + num(other?.amount);

    return {
      kpis: {
        totalImportLoads: importCount.n,
        totalExportLoads: exportCount.n,
        rawStockCft,
        finishedStockCft,
        todayImports: todayImp.n,
        todayExports: todayExp.n,
        pendingApprovals: counts.SUBMITTED,
        totalSales: round(totalSales, 2),
        totalExpenses: round(totalExpenses, 2),
        pendingReceivables: round(totalSales - num(sales?.received), 2),
        pendingPayables: round(num(purchases?.purchase) - num(purchases?.paid), 2),
        profitLoss: round(totalSales - totalExpenses, 2),
      },
      accountantActivity: await this.accountantActivity(millId),
    };
  }

  /** Accountant Activity Monitor (owner only). */
  private async accountantActivity(millId: string) {
    const accountants = await this.db
      .select({ id: users.id, name: users.name, isActive: users.isActive, lastLoginAt: users.lastLoginAt })
      .from(users)
      .where(and(eq(users.millId, millId), eq(users.role, 'ACCOUNTANT')))
      .orderBy(users.name);

    return Promise.all(
      accountants.map(async (a) => {
        const latestOf = (t: typeof importLoads | typeof exportLoads | typeof productionRuns) =>
          this.db
            .select({ at: max(t.createdAt) })
            .from(t)
            .where(and(eq(t.millId, millId), eq(t.createdById, a.id)));

        const [counts, [logs], [imp], [exp], [prd]] = await Promise.all([
          this.statusCounts(millId, a.id),
          this.db
            .select({ n: count(), cft: sum(logMeasurements.cft) })
            .from(logMeasurements)
            .innerJoin(importLoads, eq(importLoads.id, logMeasurements.importLoadId))
            .where(and(eq(importLoads.millId, millId), eq(logMeasurements.createdById, a.id))),
          latestOf(importLoads),
          latestOf(exportLoads),
          latestOf(productionRuns),
        ]);

        const latest = [
          { type: 'IMPORT', at: imp?.at },
          { type: 'EXPORT', at: exp?.at },
          { type: 'PRODUCTION', at: prd?.at },
        ]
          .filter((e): e is { type: string; at: Date } => !!e.at)
          .sort((x, y) => y.at.getTime() - x.at.getTime())[0];

        return {
          accountantId: a.id,
          accountantName: a.name,
          isActive: a.isActive,
          lastLoginAt: a.lastLoginAt,
          lastEntryType: latest?.type ?? null,
          lastEntryAt: latest?.at ?? null,
          logsMeasured: logs?.n ?? 0,
          totalCft: round(num(logs?.cft), 3),
          draftEntries: counts.DRAFT,
          pendingEntries: counts.SUBMITTED,
          approvedEntries: counts.APPROVED,
          rejectedEntries: counts.REJECTED,
        };
      }),
    );
  }

  /**
   * Operational dashboard. An accountant sees only their own entries;
   * an owner opening it sees the whole mill. No financial data here.
   */
  async accountant(user: AuthUser) {
    const millId = user.millId;
    const onlyMine = user.role === 'ACCOUNTANT';
    const { start: today } = await this.today(millId);

    const scope = (t: typeof importLoads | typeof exportLoads, extra?: SQL) =>
      and(eq(t.millId, millId), onlyMine ? eq(t.createdById, user.id) : undefined, extra);

    const [[todayImp], [todayExp], counts, inProgress] = await Promise.all([
      this.db.select({ n: count() }).from(importLoads).where(scope(importLoads, gte(importLoads.createdAt, today))),
      this.db.select({ n: count() }).from(exportLoads).where(scope(exportLoads, gte(exportLoads.createdAt, today))),
      this.statusCounts(millId, onlyMine ? user.id : undefined),
      this.db
        .select({
          id: importLoads.id,
          code: importLoads.code,
          lorryNumber: importLoads.lorryNumber,
          woodType: importLoads.woodType,
          totalLogs: importLoads.totalLogs,
          totalCft: importLoads.totalCft,
          status: importLoads.status,
          rejectionReason: importLoads.rejectionReason,
          updatedAt: importLoads.updatedAt,
        })
        .from(importLoads)
        .where(scope(importLoads, inArray(importLoads.status, ['DRAFT', 'REJECTED'])))
        .orderBy(desc(importLoads.updatedAt))
        .limit(10),
    ]);

    return {
      kpis: {
        todayImports: todayImp.n,
        todayExports: todayExp.n,
        draftEntries: counts.DRAFT,
        pendingSubmissions: counts.SUBMITTED,
        approvedEntries: counts.APPROVED,
        rejectedEntries: counts.REJECTED,
      },
      measurementProgress: inProgress.map((l) => ({ ...l, totalCft: round(num(l.totalCft), 3) })),
    };
  }
}

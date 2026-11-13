/**
 * The owner's approval queue: every submitted record, of every kind, oldest first.
 * Approving/rejecting still goes through each record's own endpoint
 * (POST /imports/:id/approve, /production/:id/approve, …), which holds the rules
 * and the stock posting — this module only reads.
 */
import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { Permission } from '@sawmill/shared';
import { and, asc, count, eq } from 'drizzle-orm';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import type { AuthUser } from '../common/types';
import { Database, InjectDb } from '../db/db.module';
import { exportLoads, importLoads, productionRuns, stockAdjustments, users } from '../db/schema';

/** Each type is capped so one huge backlog can't make the page unusable; counts are exact. */
const CAP = 200;
const dim = (v: string | null) => (v == null ? null : Number(v));

@Injectable()
export class ApprovalsService {
  constructor(@InjectDb() private readonly db: Database) {}

  async queue(actor: AuthUser) {
    const millId = actor.millId;
    const [imports, production, exports, adjustments] = await Promise.all([
      this.db
        .select({
          id: importLoads.id,
          code: importLoads.code,
          submittedAt: importLoads.submittedAt,
          createdByName: users.name,
          lorryNumber: importLoads.lorryNumber,
          woodType: importLoads.woodType,
          totalLogs: importLoads.totalLogs,
          totalCft: importLoads.totalCft,
        })
        .from(importLoads)
        .innerJoin(users, eq(users.id, importLoads.createdById))
        .where(and(eq(importLoads.millId, millId), eq(importLoads.status, 'SUBMITTED')))
        .orderBy(asc(importLoads.submittedAt))
        .limit(CAP),
      this.db
        .select({
          id: productionRuns.id,
          code: productionRuns.code,
          submittedAt: productionRuns.submittedAt,
          createdByName: users.name,
          importCode: importLoads.code,
          woodType: productionRuns.woodType,
          inputCft: productionRuns.inputCft,
          outputCft: productionRuns.outputCft,
          wasteCft: productionRuns.wasteCft,
        })
        .from(productionRuns)
        .innerJoin(users, eq(users.id, productionRuns.createdById))
        .innerJoin(importLoads, eq(importLoads.id, productionRuns.importLoadId))
        .where(and(eq(productionRuns.millId, millId), eq(productionRuns.status, 'SUBMITTED')))
        .orderBy(asc(productionRuns.submittedAt))
        .limit(CAP),
      this.db
        .select({
          id: exportLoads.id,
          code: exportLoads.code,
          submittedAt: exportLoads.submittedAt,
          createdByName: users.name,
          lorryNumber: exportLoads.lorryNumber,
          woodType: exportLoads.woodType,
          totalPieces: exportLoads.totalPieces,
          totalCft: exportLoads.totalCft,
        })
        .from(exportLoads)
        .innerJoin(users, eq(users.id, exportLoads.createdById))
        .where(and(eq(exportLoads.millId, millId), eq(exportLoads.status, 'SUBMITTED')))
        .orderBy(asc(exportLoads.submittedAt))
        .limit(CAP),
      this.db
        .select({
          id: stockAdjustments.id,
          code: stockAdjustments.code,
          submittedAt: stockAdjustments.submittedAt,
          createdByName: users.name,
          kind: stockAdjustments.kind,
          woodType: stockAdjustments.woodType,
          importCode: importLoads.code,
          thicknessIn: stockAdjustments.thicknessIn,
          widthIn: stockAdjustments.widthIn,
          lengthFt: stockAdjustments.lengthFt,
          piecesDelta: stockAdjustments.piecesDelta,
          cftDelta: stockAdjustments.cftDelta,
          reason: stockAdjustments.reason,
        })
        .from(stockAdjustments)
        .innerJoin(users, eq(users.id, stockAdjustments.createdById))
        .innerJoin(importLoads, eq(importLoads.id, stockAdjustments.importLoadId))
        .where(and(eq(stockAdjustments.millId, millId), eq(stockAdjustments.status, 'SUBMITTED')))
        .orderBy(asc(stockAdjustments.submittedAt))
        .limit(CAP),
    ]);
    const counts = await this.counts(millId);

    const items = [
      ...imports.map((r) => ({ type: 'IMPORT' as const, ...r, totalCft: Number(r.totalCft) })),
      ...production.map((r) => ({
        type: 'PRODUCTION' as const,
        ...r,
        inputCft: r.inputCft == null ? null : Number(r.inputCft),
        outputCft: Number(r.outputCft),
        wasteCft: r.wasteCft == null ? null : Number(r.wasteCft),
      })),
      ...exports.map((r) => ({ type: 'EXPORT' as const, ...r, totalCft: Number(r.totalCft) })),
      ...adjustments.map((r) => ({
        type: 'ADJUSTMENT' as const,
        ...r,
        thicknessIn: dim(r.thicknessIn),
        widthIn: dim(r.widthIn),
        lengthFt: dim(r.lengthFt),
        cftDelta: Number(r.cftDelta),
      })),
    ].sort((a, b) => (a.submittedAt?.getTime() ?? 0) - (b.submittedAt?.getTime() ?? 0));

    return { counts, items };
  }

  /** Exact number waiting per type (the list itself is capped). Also used for the menu badge. */
  async counts(millId: string) {
    const [[imp], [prd], [exp], [adj]] = await Promise.all([
      this.db.select({ n: count() }).from(importLoads).where(and(eq(importLoads.millId, millId), eq(importLoads.status, 'SUBMITTED'))),
      this.db.select({ n: count() }).from(productionRuns).where(and(eq(productionRuns.millId, millId), eq(productionRuns.status, 'SUBMITTED'))),
      this.db.select({ n: count() }).from(exportLoads).where(and(eq(exportLoads.millId, millId), eq(exportLoads.status, 'SUBMITTED'))),
      this.db.select({ n: count() }).from(stockAdjustments).where(and(eq(stockAdjustments.millId, millId), eq(stockAdjustments.status, 'SUBMITTED'))),
    ]);
    const counts = { IMPORT: imp.n, PRODUCTION: prd.n, EXPORT: exp.n, ADJUSTMENT: adj.n };
    return { ...counts, total: imp.n + prd.n + exp.n + adj.n };
  }
}

@Controller('approvals')
@RequirePermissions(Permission.OPERATIONS_APPROVE)
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  queue(@CurrentUser() user: AuthUser) {
    return this.approvals.queue(user);
  }

  /** Just the numbers, for the menu badge (polled). */
  @Get('count')
  count(@CurrentUser() user: AuthUser) {
    return this.approvals.counts(user.millId);
  }
}

@Module({ controllers: [ApprovalsController], providers: [ApprovalsService] })
export class ApprovalsModule {}

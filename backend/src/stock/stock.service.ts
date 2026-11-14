import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ACCOUNTANT_EDITABLE_STATUSES, exportPieceCft, hasPermission, Permission, roundTo } from '@sawmill/shared';
import { and, asc, count, desc, eq, inArray, SQL, sql, sum } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service';
import { nextCode } from '../common/codes';
import { assertEditable, assertVisible, canEdit } from '../common/editability';
import type { AuthUser } from '../common/types';
import { Database, DbOrTx, InjectDb } from '../db/db.module';
import { exportLoads, importLoads, productionRuns, stockAdjustments, stockMovements, users } from '../db/schema';
import { assertStockNotNegative, lockImportLoads, syncMovements } from './ledger';
import { CreateAdjustmentDto, ListAdjustmentsQuery, MovementsQuery, UpdateAdjustmentDto } from './stock.dto';

type AdjustmentRow = typeof stockAdjustments.$inferSelect;
const dim = (v: string | null) => (v == null ? null : Number(v));

const adjustmentView = (a: AdjustmentRow & { importCode?: string; createdByName?: string }) => ({
  id: a.id,
  code: a.code,
  kind: a.kind,
  woodType: a.woodType,
  importLoadId: a.importLoadId,
  importCode: a.importCode ?? '',
  thicknessIn: dim(a.thicknessIn),
  widthIn: dim(a.widthIn),
  lengthFt: dim(a.lengthFt),
  piecesDelta: a.piecesDelta,
  cftDelta: Number(a.cftDelta),
  reason: a.reason,
  status: a.status,
  rejectionReason: a.rejectionReason,
  createdById: a.createdById,
  createdByName: a.createdByName ?? '',
  submittedAt: a.submittedAt,
  reviewedAt: a.reviewedAt,
  createdAt: a.createdAt,
});

/**
 * Stock balances (always computed from the ledger), the ledger itself, and
 * stock adjustments — corrections that, like everything else, only reach the
 * ledger when the owner approves them.
 */
@Injectable()
export class StockService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  // ───────── balances ─────────

  /** Current raw stock per import load and finished stock per wood type, size and load. */
  async balances(actor: AuthUser) {
    const millId = actor.millId;
    const nonZero = sql`sum(${stockMovements.cftDelta}) <> 0 or sum(${stockMovements.piecesDelta}) <> 0`;
    const [raw, finished] = await Promise.all([
      this.db
        .select({
          importLoadId: importLoads.id,
          importCode: importLoads.code,
          woodType: importLoads.woodType,
          arrivalAt: importLoads.arrivalAt,
          receivedLogs: importLoads.totalLogs,
          receivedCft: importLoads.totalCft,
          logs: sum(stockMovements.piecesDelta),
          cft: sum(stockMovements.cftDelta),
        })
        .from(stockMovements)
        .innerJoin(importLoads, eq(importLoads.id, stockMovements.importLoadId))
        .where(and(eq(stockMovements.millId, millId), eq(stockMovements.kind, 'RAW')))
        .groupBy(importLoads.id)
        .having(nonZero)
        .orderBy(asc(importLoads.arrivalAt)),
      this.db
        .select({
          woodType: stockMovements.woodType,
          thicknessIn: stockMovements.thicknessIn,
          widthIn: stockMovements.widthIn,
          lengthFt: stockMovements.lengthFt,
          importLoadId: importLoads.id,
          importCode: importLoads.code,
          pieces: sum(stockMovements.piecesDelta),
          cft: sum(stockMovements.cftDelta),
        })
        .from(stockMovements)
        .innerJoin(importLoads, eq(importLoads.id, stockMovements.importLoadId))
        .where(and(eq(stockMovements.millId, millId), eq(stockMovements.kind, 'FINISHED')))
        .groupBy(stockMovements.woodType, stockMovements.thicknessIn, stockMovements.widthIn, stockMovements.lengthFt, importLoads.id)
        .having(nonZero)
        .orderBy(asc(stockMovements.woodType), asc(stockMovements.thicknessIn), asc(stockMovements.widthIn), asc(stockMovements.lengthFt), asc(importLoads.code)),
    ]);

    const rawRows = raw.map((r) => ({
      importLoadId: r.importLoadId,
      importCode: r.importCode,
      woodType: r.woodType,
      arrivalAt: r.arrivalAt,
      receivedLogs: r.receivedLogs,
      receivedCft: Number(r.receivedCft),
      logs: Number(r.logs ?? 0),
      cft: roundTo(Number(r.cft ?? 0)),
    }));
    const finishedRows = finished.map((f) => ({
      woodType: f.woodType,
      thicknessIn: Number(f.thicknessIn),
      widthIn: Number(f.widthIn),
      lengthFt: Number(f.lengthFt),
      importLoadId: f.importLoadId,
      importCode: f.importCode,
      pieces: Number(f.pieces ?? 0),
      cft: roundTo(Number(f.cft ?? 0)),
    }));
    return {
      totals: {
        rawCft: roundTo(rawRows.reduce((s, r) => s + r.cft, 0)),
        rawLoads: rawRows.filter((r) => r.cft > 0).length,
        finishedCft: roundTo(finishedRows.reduce((s, r) => s + r.cft, 0)),
        finishedPieces: finishedRows.reduce((s, r) => s + r.pieces, 0),
      },
      raw: rawRows,
      finished: finishedRows,
    };
  }

  /** The ledger, newest first, with the code of the record that posted each movement. */
  async movements(actor: AuthUser, q: MovementsQuery) {
    const conditions: SQL[] = [eq(stockMovements.millId, actor.millId)];
    if (q.importLoadId) conditions.push(eq(stockMovements.importLoadId, q.importLoadId));
    if (q.kind) conditions.push(eq(stockMovements.kind, q.kind));
    const where = and(...conditions);

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: stockMovements.id,
          createdAt: stockMovements.createdAt,
          kind: stockMovements.kind,
          woodType: stockMovements.woodType,
          importLoadId: stockMovements.importLoadId,
          importCode: importLoads.code,
          thicknessIn: stockMovements.thicknessIn,
          widthIn: stockMovements.widthIn,
          lengthFt: stockMovements.lengthFt,
          piecesDelta: stockMovements.piecesDelta,
          cftDelta: stockMovements.cftDelta,
          source: stockMovements.source,
          sourceId: stockMovements.sourceId,
          postedByName: users.name,
        })
        .from(stockMovements)
        .innerJoin(importLoads, eq(importLoads.id, stockMovements.importLoadId))
        .innerJoin(users, eq(users.id, stockMovements.postedById))
        .where(where)
        .orderBy(desc(stockMovements.createdAt), asc(stockMovements.kind))
        .limit(q.take)
        .offset(q.skip),
      this.db.select({ total: count() }).from(stockMovements).where(where),
    ]);

    const codes = await this.sourceCodes(rows);
    return {
      items: rows.map((r) => ({
        ...r,
        thicknessIn: dim(r.thicknessIn),
        widthIn: dim(r.widthIn),
        lengthFt: dim(r.lengthFt),
        cftDelta: Number(r.cftDelta),
        sourceCode: codes.get(r.sourceId) ?? '',
      })),
      total,
      take: q.take,
      skip: q.skip,
    };
  }

  private async sourceCodes(rows: { source: string; sourceId: string }[]) {
    const ids = (sources: string[]) => [...new Set(rows.filter((r) => sources.includes(r.source)).map((r) => r.sourceId))];
    const lookups: [string[], Promise<{ id: string; code: string }[]> | null][] = [];
    const imp = ids(['IMPORT']);
    const prd = ids(['PRODUCTION_INPUT', 'PRODUCTION_OUTPUT']);
    const adj = ids(['ADJUSTMENT']);
    const exp = ids(['EXPORT']);
    lookups.push([imp, imp.length ? this.db.select({ id: importLoads.id, code: importLoads.code }).from(importLoads).where(inArray(importLoads.id, imp)) : null]);
    lookups.push([prd, prd.length ? this.db.select({ id: productionRuns.id, code: productionRuns.code }).from(productionRuns).where(inArray(productionRuns.id, prd)) : null]);
    lookups.push([adj, adj.length ? this.db.select({ id: stockAdjustments.id, code: stockAdjustments.code }).from(stockAdjustments).where(inArray(stockAdjustments.id, adj)) : null]);
    lookups.push([exp, exp.length ? this.db.select({ id: exportLoads.id, code: exportLoads.code }).from(exportLoads).where(inArray(exportLoads.id, exp)) : null]);
    const map = new Map<string, string>();
    for (const [, p] of lookups) if (p) for (const r of await p) map.set(r.id, r.code);
    return map;
  }

  // ───────── adjustments ─────────

  async listAdjustments(actor: AuthUser, q: ListAdjustmentsQuery) {
    const conditions: SQL[] = [eq(stockAdjustments.millId, actor.millId)];
    if (!hasPermission(actor.role, Permission.OPERATIONS_VIEW_ALL)) conditions.push(eq(stockAdjustments.createdById, actor.id));
    if (q.status) conditions.push(eq(stockAdjustments.status, q.status));
    const where = and(...conditions);
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({ a: stockAdjustments, importCode: importLoads.code, createdByName: users.name })
        .from(stockAdjustments)
        .innerJoin(importLoads, eq(importLoads.id, stockAdjustments.importLoadId))
        .innerJoin(users, eq(users.id, stockAdjustments.createdById))
        .where(where)
        .orderBy(desc(stockAdjustments.createdAt))
        .limit(q.take)
        .offset(q.skip),
      this.db.select({ total: count() }).from(stockAdjustments).where(where),
    ]);
    return {
      items: rows.map((r) => ({ ...adjustmentView({ ...r.a, importCode: r.importCode, createdByName: r.createdByName }), ...this.flags(actor, r.a) })),
      total,
      take: q.take,
      skip: q.skip,
    };
  }

  async createAdjustment(actor: AuthUser, dto: CreateAdjustmentDto) {
    const row = await this.db.transaction(async (tx) => {
      const values = await this.adjustmentValues(tx, actor, dto);
      const code = await nextCode(tx, actor.millId, 'ADJ');
      const [created] = await tx
        .insert(stockAdjustments)
        .values({ millId: actor.millId, code, ...values, createdById: actor.id })
        .returning();
      await this.audit.log({ millId: actor.millId, userId: actor.id, action: 'CREATE', entityType: 'StockAdjustment', entityId: created.id, after: created }, tx);
      return created;
    });
    return this.adjustment(actor, row.id);
  }

  async adjustment(actor: AuthUser, id: string) {
    const a = await this.findAdjustment(this.db, actor, id);
    const [[load], [creator]] = await Promise.all([
      this.db.select({ code: importLoads.code }).from(importLoads).where(eq(importLoads.id, a.importLoadId)),
      this.db.select({ name: users.name }).from(users).where(eq(users.id, a.createdById)),
    ]);
    return { ...adjustmentView({ ...a, importCode: load?.code, createdByName: creator?.name }), ...this.flags(actor, a) };
  }

  async updateAdjustment(actor: AuthUser, id: string, dto: UpdateAdjustmentDto) {
    await this.db.transaction(async (tx) => {
      const before = await this.findAdjustment(tx, actor, id, true);
      const action = assertEditable(actor, before);
      // Validate the record as a whole: e.g. switching to FINISHED needs a size.
      const merged: CreateAdjustmentDto = {
        kind: dto.kind ?? before.kind,
        importLoadId: dto.importLoadId ?? before.importLoadId,
        woodType: dto.woodType ?? (dto.importLoadId || dto.kind ? undefined : before.woodType),
        thicknessIn: dto.thicknessIn !== undefined ? dto.thicknessIn : dim(before.thicknessIn),
        widthIn: dto.widthIn !== undefined ? dto.widthIn : dim(before.widthIn),
        lengthFt: dto.lengthFt !== undefined ? dto.lengthFt : dim(before.lengthFt),
        piecesDelta: dto.piecesDelta ?? before.piecesDelta,
        cftDelta: dto.cftDelta ?? Number(before.cftDelta),
        reason: dto.reason ?? before.reason,
      };
      const values = await this.adjustmentValues(tx, actor, merged);
      const [after] = await tx
        .update(stockAdjustments)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(stockAdjustments.id, id))
        .returning();
      if (after.status === 'APPROVED') await this.postAdjustment(tx, actor, after, [before.importLoadId]);
      await this.audit.log({ millId: actor.millId, userId: actor.id, action, entityType: 'StockAdjustment', entityId: id, before, after }, tx);
    });
    return this.adjustment(actor, id);
  }

  async submitAdjustment(actor: AuthUser, id: string) {
    await this.db.transaction(async (tx) => {
      const before = await this.findAdjustment(tx, actor, id, true);
      if (!ACCOUNTANT_EDITABLE_STATUSES.includes(before.status)) throw new ConflictException('This adjustment has already been submitted');
      assertEditable(actor, before);
      const [after] = await tx
        .update(stockAdjustments)
        .set({ status: 'SUBMITTED', submittedAt: new Date(), rejectionReason: null, updatedAt: new Date() })
        .where(eq(stockAdjustments.id, id))
        .returning();
      await this.audit.log({ millId: actor.millId, userId: actor.id, action: 'SUBMIT', entityType: 'StockAdjustment', entityId: id, before, after }, tx);
    });
    return this.adjustment(actor, id);
  }

  async approveAdjustment(actor: AuthUser, id: string) {
    await this.db.transaction(async (tx) => {
      const before = await this.findAdjustment(tx, actor, id, true);
      if (before.status !== 'SUBMITTED') throw new ConflictException('Only submitted adjustments can be approved');
      const [after] = await tx
        .update(stockAdjustments)
        .set({ status: 'APPROVED', reviewedById: actor.id, reviewedAt: new Date(), updatedAt: new Date() })
        .where(eq(stockAdjustments.id, id))
        .returning();
      await this.postAdjustment(tx, actor, after);
      await this.audit.log({ millId: actor.millId, userId: actor.id, action: 'APPROVE', entityType: 'StockAdjustment', entityId: id, before, after }, tx);
    });
    return this.adjustment(actor, id);
  }

  async rejectAdjustment(actor: AuthUser, id: string, reason: string) {
    await this.db.transaction(async (tx) => {
      const before = await this.findAdjustment(tx, actor, id, true);
      if (before.status !== 'SUBMITTED') throw new ConflictException('Only submitted adjustments can be rejected');
      const [after] = await tx
        .update(stockAdjustments)
        .set({ status: 'REJECTED', rejectionReason: reason, reviewedById: actor.id, reviewedAt: new Date(), updatedAt: new Date() })
        .where(eq(stockAdjustments.id, id))
        .returning();
      await this.audit.log({ millId: actor.millId, userId: actor.id, action: 'REJECT', entityType: 'StockAdjustment', entityId: id, before, after }, tx);
    });
    return this.adjustment(actor, id);
  }

  // ───────── helpers ─────────

  private flags(actor: AuthUser, a: AdjustmentRow) {
    const editable = canEdit(actor, a);
    return {
      editable,
      canSubmit: editable && ACCOUNTANT_EDITABLE_STATUSES.includes(a.status) && hasPermission(actor.role, Permission.OPERATIONS_SUBMIT),
      canReview: a.status === 'SUBMITTED' && hasPermission(actor.role, Permission.OPERATIONS_APPROVE),
    };
  }

  /** Check and normalise an adjustment. Raw: CFT given, no size. Finished: size + pieces given, CFT calculated. */
  private async adjustmentValues(tx: DbOrTx, actor: AuthUser, dto: CreateAdjustmentDto) {
    const [load] = await tx
      .select({ id: importLoads.id, woodType: importLoads.woodType, status: importLoads.status })
      .from(importLoads)
      .where(and(eq(importLoads.id, dto.importLoadId), eq(importLoads.millId, actor.millId)));
    if (!load) throw new BadRequestException('Import load not found');
    if (load.status !== 'APPROVED') throw new BadRequestException('Stock can only be adjusted for approved import loads');
    const pieces = dto.piecesDelta ?? 0;

    if (dto.kind === 'RAW') {
      const cft = roundTo(dto.cftDelta ?? 0);
      if (cft === 0 && pieces === 0) throw new BadRequestException('Enter the CFT (or logs) to add or remove');
      if (cft !== 0 && pieces !== 0 && Math.sign(cft) !== Math.sign(pieces)) {
        throw new BadRequestException('CFT and logs must both add or both remove');
      }
      return {
        kind: 'RAW' as const,
        importLoadId: load.id,
        woodType: load.woodType,
        thicknessIn: null,
        widthIn: null,
        lengthFt: null,
        piecesDelta: pieces,
        cftDelta: String(cft),
        reason: dto.reason,
      };
    }

    if (dto.thicknessIn == null || dto.widthIn == null || dto.lengthFt == null) {
      throw new BadRequestException('Enter the thickness, width and length of the finished size');
    }
    if (pieces === 0) throw new BadRequestException('Enter the number of pieces to add or remove');
    const cft = Math.sign(pieces) * exportPieceCft(dto.thicknessIn, dto.widthIn, dto.lengthFt, Math.abs(pieces));
    return {
      kind: 'FINISHED' as const,
      importLoadId: load.id,
      woodType: dto.woodType || load.woodType,
      thicknessIn: String(dto.thicknessIn),
      widthIn: String(dto.widthIn),
      lengthFt: String(dto.lengthFt),
      piecesDelta: pieces,
      cftDelta: String(roundTo(cft)),
      reason: dto.reason,
    };
  }

  private async postAdjustment(tx: DbOrTx, actor: AuthUser, a: AdjustmentRow, alsoLock: string[] = []) {
    const loads = [a.importLoadId, ...alsoLock];
    await lockImportLoads(tx, loads);
    await syncMovements(tx, {
      millId: a.millId,
      source: 'ADJUSTMENT',
      sourceId: a.id,
      postedById: actor.id,
      target: [
        {
          kind: a.kind,
          woodType: a.woodType,
          importLoadId: a.importLoadId,
          thicknessIn: dim(a.thicknessIn),
          widthIn: dim(a.widthIn),
          lengthFt: dim(a.lengthFt),
          pieces: a.piecesDelta,
          cft: Number(a.cftDelta),
        },
      ],
    });
    await assertStockNotNegative(tx, loads);
  }

  private async findAdjustment(db: DbOrTx, actor: AuthUser, id: string, lock = false): Promise<AdjustmentRow> {
    const query = db
      .select()
      .from(stockAdjustments)
      .where(and(eq(stockAdjustments.id, id), eq(stockAdjustments.millId, actor.millId)))
      .limit(1);
    const [row] = lock ? await query.for('update') : await query;
    try {
      return assertVisible(actor, row);
    } catch {
      throw new NotFoundException('Stock adjustment not found');
    }
  }
}

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ACCOUNTANT_EDITABLE_STATUSES,
  exportPieceCft,
  formatCft,
  hasPermission,
  Permission,
  productionWaste,
  recoveryPercent,
  roundTo,
} from '@sawmill/shared';
import { and, asc, count, desc, eq, SQL, sum } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service';
import { nextCode } from '../common/codes';
import { assertEditable, assertVisible, canEdit } from '../common/editability';
import type { AuthUser } from '../common/types';
import { Database, DbOrTx, InjectDb } from '../db/db.module';
import { importLoads, productionOutputs, productionRuns, users } from '../db/schema';
import { assertStockNotNegative, LedgerLine, lockImportLoads, rawBalance, syncMovements } from '../stock/ledger';
import { CreateProductionDto, ListProductionQuery, OutputDto, UpdateProductionDto } from './production.dto';

type RunRow = typeof productionRuns.$inferSelect;
type OutputRow = typeof productionOutputs.$inferSelect;

const num = (v: string | null | undefined) => (v == null ? null : Number(v));
/** '' clears a text field, undefined leaves it alone. */
const text = (v: string | undefined) => (v === undefined ? undefined : v === '' ? null : v);
/** '' or null clears a timestamp, undefined leaves it alone. */
const when = (v: string | null | undefined) => (v === undefined ? undefined : v ? new Date(v) : null);

const outputView = (o: OutputRow) => ({
  id: o.id,
  thicknessIn: Number(o.thicknessIn),
  widthIn: Number(o.widthIn),
  lengthFt: Number(o.lengthFt),
  pieces: o.pieces,
  cft: Number(o.cft),
});

const SUMMARY = {
  id: productionRuns.id,
  code: productionRuns.code,
  productionDate: productionRuns.productionDate,
  importLoadId: productionRuns.importLoadId,
  importCode: importLoads.code,
  woodType: productionRuns.woodType,
  inputCft: productionRuns.inputCft,
  outputCft: productionRuns.outputCft,
  wasteCft: productionRuns.wasteCft,
  status: productionRuns.status,
  rejectionReason: productionRuns.rejectionReason,
  createdById: productionRuns.createdById,
  createdByName: users.name,
};

/**
 * Production runs: raw CFT from one approved import load is sawn into finished
 * sizes. Nothing touches stock until the owner approves; then raw stock goes
 * down by the input and finished stock goes up by each output size, in the same
 * transaction, traceable to the import load.
 */
@Injectable()
export class ProductionService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthUser, q: ListProductionQuery) {
    const conditions: SQL[] = [eq(productionRuns.millId, actor.millId)];
    if (!hasPermission(actor.role, Permission.OPERATIONS_VIEW_ALL)) conditions.push(eq(productionRuns.createdById, actor.id));
    if (q.status) conditions.push(eq(productionRuns.status, q.status));
    if (q.importLoadId) conditions.push(eq(productionRuns.importLoadId, q.importLoadId));
    const where = and(...conditions);

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select(SUMMARY)
        .from(productionRuns)
        .innerJoin(users, eq(users.id, productionRuns.createdById))
        .innerJoin(importLoads, eq(importLoads.id, productionRuns.importLoadId))
        .where(where)
        .orderBy(desc(productionRuns.productionDate), desc(productionRuns.createdAt))
        .limit(q.take)
        .offset(q.skip),
      this.db.select({ total: count() }).from(productionRuns).where(where),
    ]);
    return {
      items: rows.map((r) => ({ ...r, inputCft: num(r.inputCft), outputCft: Number(r.outputCft), wasteCft: num(r.wasteCft) })),
      total,
      take: q.take,
      skip: q.skip,
    };
  }

  async create(actor: AuthUser, dto: CreateProductionDto) {
    const run = await this.db.transaction(async (tx) => {
      const load = await this.findSourceLoad(tx, actor, dto.importLoadId);
      const { startAt, endAt } = this.checkTimes(dto.startAt ? new Date(dto.startAt) : null, dto.endAt ? new Date(dto.endAt) : null);
      const code = await nextCode(tx, actor.millId, 'PRD');
      const inputCft = dto.inputCft ?? null;
      const [row] = await tx
        .insert(productionRuns)
        .values({
          millId: actor.millId,
          code,
          importLoadId: load.id,
          woodType: load.woodType,
          productionDate: dto.productionDate,
          cuttingMachine: text(dto.cuttingMachine),
          machineOperator: text(dto.machineOperator),
          workerDetails: text(dto.workerDetails),
          startAt,
          endAt,
          inputCft: inputCft == null ? null : String(inputCft),
          wasteCft: inputCft == null ? null : String(productionWaste(inputCft, 0)),
          wasteNotes: text(dto.wasteNotes),
          createdById: actor.id,
        })
        .returning();
      await this.audit.log({ millId: actor.millId, userId: actor.id, action: 'CREATE', entityType: 'ProductionRun', entityId: row.id, after: row }, tx);
      return row;
    });
    return this.detail(actor, run.id);
  }

  async detail(actor: AuthUser, id: string) {
    const run = await this.findRun(this.db, actor, id);
    const [[creator], [load], outputs, available] = await Promise.all([
      this.db.select({ name: users.name }).from(users).where(eq(users.id, run.createdById)),
      this.db
        .select({ code: importLoads.code, lorryNumber: importLoads.lorryNumber, totalCft: importLoads.totalCft })
        .from(importLoads)
        .where(eq(importLoads.id, run.importLoadId)),
      this.db.select().from(productionOutputs).where(eq(productionOutputs.productionRunId, id)).orderBy(asc(productionOutputs.thicknessIn), asc(productionOutputs.widthIn), asc(productionOutputs.lengthFt)),
      rawBalance(this.db, run.importLoadId),
    ]);
    const inputCft = num(run.inputCft);
    const outputCft = Number(run.outputCft);
    const editable = canEdit(actor, run);
    return {
      id: run.id,
      code: run.code,
      importLoadId: run.importLoadId,
      importCode: load?.code ?? '',
      importLorryNumber: load?.lorryNumber ?? '',
      importTotalCft: Number(load?.totalCft ?? 0),
      woodType: run.woodType,
      productionDate: run.productionDate,
      cuttingMachine: run.cuttingMachine,
      machineOperator: run.machineOperator,
      workerDetails: run.workerDetails,
      startAt: run.startAt,
      endAt: run.endAt,
      inputCft,
      outputCft,
      wasteCft: num(run.wasteCft),
      wasteNotes: run.wasteNotes,
      recoveryPercent: recoveryPercent(inputCft, outputCft),
      /** Raw CFT left in the source load right now (approved stock). Once this run is approved it already excludes its input. */
      rawAvailableCft: available,
      status: run.status,
      rejectionReason: run.rejectionReason,
      createdById: run.createdById,
      createdByName: creator?.name ?? '',
      submittedAt: run.submittedAt,
      reviewedAt: run.reviewedAt,
      updatedAt: run.updatedAt,
      editable,
      canSubmit: editable && ACCOUNTANT_EDITABLE_STATUSES.includes(run.status) && hasPermission(actor.role, Permission.OPERATIONS_SUBMIT),
      canReview: run.status === 'SUBMITTED' && hasPermission(actor.role, Permission.OPERATIONS_APPROVE),
      outputs: outputs.map(outputView),
    };
  }

  async update(actor: AuthUser, id: string, dto: UpdateProductionDto) {
    await this.db.transaction(async (tx) => {
      const before = await this.findRun(tx, actor, id, true);
      const action = assertEditable(actor, before);
      const load = dto.importLoadId && dto.importLoadId !== before.importLoadId ? await this.findSourceLoad(tx, actor, dto.importLoadId) : null;
      const startAt = when(dto.startAt);
      const endAt = when(dto.endAt);
      this.checkTimes(startAt === undefined ? before.startAt : startAt, endAt === undefined ? before.endAt : endAt);
      const inputCft = dto.inputCft === undefined ? num(before.inputCft) : dto.inputCft;

      const [after] = await tx
        .update(productionRuns)
        .set({
          importLoadId: load?.id,
          woodType: load?.woodType,
          productionDate: dto.productionDate,
          cuttingMachine: text(dto.cuttingMachine),
          machineOperator: text(dto.machineOperator),
          workerDetails: text(dto.workerDetails),
          startAt,
          endAt,
          inputCft: inputCft == null ? null : String(inputCft),
          wasteCft: inputCft == null ? null : String(productionWaste(inputCft, Number(before.outputCft))),
          wasteNotes: text(dto.wasteNotes),
          updatedAt: new Date(),
        })
        .where(eq(productionRuns.id, id))
        .returning();
      if (after.status === 'APPROVED') {
        if (after.inputCft == null) throw new BadRequestException('An approved run must keep its raw CFT input');
        await this.postStock(tx, actor, after, [before.importLoadId]);
      }
      await this.audit.log({ millId: actor.millId, userId: actor.id, action, entityType: 'ProductionRun', entityId: id, before, after }, tx);
    });
    return this.detail(actor, id);
  }

  // ───────── output sizes ─────────

  async addOutput(actor: AuthUser, runId: string, dto: OutputDto) {
    return this.changeOutputs(actor, runId, async (tx, action) => {
      const [row] = await tx
        .insert(productionOutputs)
        .values({ productionRunId: runId, ...this.outputValues(dto) })
        .returning();
      if (action === 'OWNER_EDIT') {
        await this.audit.log({ millId: actor.millId, userId: actor.id, action, entityType: 'ProductionOutput', entityId: row.id, after: row }, tx);
      }
    });
  }

  async updateOutput(actor: AuthUser, runId: string, outputId: string, dto: OutputDto) {
    return this.changeOutputs(actor, runId, async (tx, action) => {
      const before = await this.findOutput(tx, runId, outputId);
      const [after] = await tx.update(productionOutputs).set(this.outputValues(dto)).where(eq(productionOutputs.id, outputId)).returning();
      await this.audit.log({ millId: actor.millId, userId: actor.id, action, entityType: 'ProductionOutput', entityId: outputId, before, after }, tx);
    });
  }

  async removeOutput(actor: AuthUser, runId: string, outputId: string) {
    return this.changeOutputs(actor, runId, async (tx, action) => {
      const before = await this.findOutput(tx, runId, outputId);
      await tx.delete(productionOutputs).where(eq(productionOutputs.id, outputId));
      await this.audit.log(
        { millId: actor.millId, userId: actor.id, action: action === 'OWNER_EDIT' ? 'OWNER_EDIT' : 'DELETE', entityType: 'ProductionOutput', entityId: outputId, before },
        tx,
      );
    });
  }

  // ───────── approval workflow ─────────

  /** Draft/Rejected → Submitted, once the input and at least one output size are recorded. */
  async submit(actor: AuthUser, id: string) {
    await this.db.transaction(async (tx) => {
      const before = await this.findRun(tx, actor, id, true);
      if (!ACCOUNTANT_EDITABLE_STATUSES.includes(before.status)) throw new ConflictException('This production run has already been submitted');
      assertEditable(actor, before);
      const inputCft = num(before.inputCft);
      if (inputCft == null) throw new BadRequestException('Enter the raw CFT used before submitting');
      const [{ outputs }] = await tx.select({ outputs: count() }).from(productionOutputs).where(eq(productionOutputs.productionRunId, id));
      if (outputs === 0) throw new BadRequestException('Add at least one finished size before submitting');
      const available = await rawBalance(tx, before.importLoadId);
      if (inputCft > available + 0.0005) {
        throw new ConflictException(`Only ${formatCft(available)} CFT of raw stock is left in this import load`);
      }
      const [after] = await tx
        .update(productionRuns)
        .set({ status: 'SUBMITTED', submittedAt: new Date(), rejectionReason: null, updatedAt: new Date() })
        .where(eq(productionRuns.id, id))
        .returning();
      await this.audit.log({ millId: actor.millId, userId: actor.id, action: 'SUBMIT', entityType: 'ProductionRun', entityId: id, before, after }, tx);
    });
    return this.detail(actor, id);
  }

  /** Submitted → Approved: raw stock −input, finished stock +outputs, all in one transaction. */
  async approve(actor: AuthUser, id: string) {
    await this.db.transaction(async (tx) => {
      const before = await this.findRun(tx, actor, id, true);
      if (before.status !== 'SUBMITTED') throw new ConflictException('Only submitted production runs can be approved');
      const [after] = await tx
        .update(productionRuns)
        .set({ status: 'APPROVED', reviewedById: actor.id, reviewedAt: new Date(), updatedAt: new Date() })
        .where(eq(productionRuns.id, id))
        .returning();
      await this.postStock(tx, actor, after);
      await this.audit.log({ millId: actor.millId, userId: actor.id, action: 'APPROVE', entityType: 'ProductionRun', entityId: id, before, after }, tx);
    });
    return this.detail(actor, id);
  }

  async reject(actor: AuthUser, id: string, reason: string) {
    await this.db.transaction(async (tx) => {
      const before = await this.findRun(tx, actor, id, true);
      if (before.status !== 'SUBMITTED') throw new ConflictException('Only submitted production runs can be rejected');
      const [after] = await tx
        .update(productionRuns)
        .set({ status: 'REJECTED', rejectionReason: reason, reviewedById: actor.id, reviewedAt: new Date(), updatedAt: new Date() })
        .where(eq(productionRuns.id, id))
        .returning();
      await this.audit.log({ millId: actor.millId, userId: actor.id, action: 'REJECT', entityType: 'ProductionRun', entityId: id, before, after }, tx);
    });
    return this.detail(actor, id);
  }

  // ───────── helpers ─────────

  private outputValues(dto: OutputDto) {
    return {
      thicknessIn: String(dto.thicknessIn),
      widthIn: String(dto.widthIn),
      lengthFt: String(dto.lengthFt),
      pieces: dto.pieces,
      cft: String(exportPieceCft(dto.thicknessIn, dto.widthIn, dto.lengthFt, dto.pieces)),
    };
  }

  /** Lock the run, check it can be changed, apply the change, then recompute totals (and stock, if approved). */
  private async changeOutputs(actor: AuthUser, runId: string, change: (tx: DbOrTx, action: 'UPDATE' | 'OWNER_EDIT') => Promise<void>) {
    await this.db.transaction(async (tx) => {
      const run = await this.findRun(tx, actor, runId, true);
      const action = assertEditable(actor, run);
      await change(tx, action);
      const [agg] = await tx.select({ cft: sum(productionOutputs.cft) }).from(productionOutputs).where(eq(productionOutputs.productionRunId, runId));
      const outputCft = roundTo(Number(agg.cft ?? 0));
      const inputCft = num(run.inputCft);
      const [after] = await tx
        .update(productionRuns)
        .set({
          outputCft: String(outputCft),
          wasteCft: inputCft == null ? null : String(productionWaste(inputCft, outputCft)),
          updatedAt: new Date(),
        })
        .where(eq(productionRuns.id, runId))
        .returning();
      if (after.status === 'APPROVED') {
        const [{ outputs }] = await tx.select({ outputs: count() }).from(productionOutputs).where(eq(productionOutputs.productionRunId, runId));
        if (outputs === 0) throw new BadRequestException('An approved run must keep at least one finished size');
        await this.postStock(tx, actor, after);
      }
    });
    return this.detail(actor, runId);
  }

  /**
   * Make the ledger match an approved run: −input from the load's raw stock and
   * +each output size to finished stock. Locks the load(s) first and refuses the
   * whole change if any balance would go below zero.
   */
  private async postStock(tx: DbOrTx, actor: AuthUser, run: RunRow, alsoLock: string[] = []) {
    const loads = [run.importLoadId, ...alsoLock];
    await lockImportLoads(tx, loads);
    const outputs = await tx.select().from(productionOutputs).where(eq(productionOutputs.productionRunId, run.id));
    const input: LedgerLine[] = [
      {
        kind: 'RAW',
        woodType: run.woodType,
        importLoadId: run.importLoadId,
        thicknessIn: null,
        widthIn: null,
        lengthFt: null,
        pieces: 0,
        cft: -Number(run.inputCft ?? 0),
      },
    ];
    const output: LedgerLine[] = outputs.map((o) => ({
      kind: 'FINISHED',
      woodType: run.woodType,
      importLoadId: run.importLoadId,
      thicknessIn: Number(o.thicknessIn),
      widthIn: Number(o.widthIn),
      lengthFt: Number(o.lengthFt),
      pieces: o.pieces,
      cft: Number(o.cft),
    }));
    const base = { millId: run.millId, sourceId: run.id, postedById: actor.id };
    await syncMovements(tx, { ...base, source: 'PRODUCTION_INPUT', target: input });
    await syncMovements(tx, { ...base, source: 'PRODUCTION_OUTPUT', target: output });
    await assertStockNotNegative(tx, loads);
  }

  /** Production draws only on approved import loads in the same mill (any accountant's). */
  private async findSourceLoad(tx: DbOrTx, actor: AuthUser, id: string) {
    const [load] = await tx
      .select({ id: importLoads.id, woodType: importLoads.woodType, status: importLoads.status })
      .from(importLoads)
      .where(and(eq(importLoads.id, id), eq(importLoads.millId, actor.millId)));
    if (!load) throw new BadRequestException('Import load not found');
    if (load.status !== 'APPROVED') throw new BadRequestException('Only approved import loads have raw stock to saw');
    return load;
  }

  private checkTimes(startAt: Date | null, endAt: Date | null) {
    if (startAt && endAt && endAt < startAt) throw new BadRequestException('End time must be after start time');
    return { startAt, endAt };
  }

  private async findRun(db: DbOrTx, actor: AuthUser, id: string, lock = false): Promise<RunRow> {
    const query = db
      .select()
      .from(productionRuns)
      .where(and(eq(productionRuns.id, id), eq(productionRuns.millId, actor.millId)))
      .limit(1);
    const [run] = lock ? await query.for('update') : await query;
    try {
      return assertVisible(actor, run);
    } catch {
      throw new NotFoundException('Production run not found');
    }
  }

  private async findOutput(tx: DbOrTx, runId: string, id: string) {
    const [row] = await tx
      .select()
      .from(productionOutputs)
      .where(and(eq(productionOutputs.id, id), eq(productionOutputs.productionRunId, runId)));
    if (!row) throw new NotFoundException('Output size not found');
    return row;
  }
}

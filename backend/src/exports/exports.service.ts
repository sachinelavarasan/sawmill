import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ACCOUNTANT_EDITABLE_STATUSES, exportPieceCft, hasPermission, Permission, roundTo, sizeLabel } from '@sawmill/shared';
import { and, asc, count, desc, eq, inArray, max, SQL, sum } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service';
import { nextCode } from '../common/codes';
import { assertEditable, assertVisible, canEdit } from '../common/editability';
import { textSearch } from '../common/search';
import type { AuthUser } from '../common/types';
import { Database, DbOrTx, InjectDb } from '../db/db.module';
import { clients, exportFinancials, exportLoads, exportMeasurements, importLoads, users } from '../db/schema';
import { assertStockNotNegative, finishedBalance, lockImportLoads, postedLoads, syncMovements } from '../stock/ledger';
import { CreateExportDto, ExportFinancialsDto, ExportLineDto, ListExportsQuery, UpdateExportDto } from './exports.dto';

type ExportRow = typeof exportLoads.$inferSelect;
type LineRow = typeof exportMeasurements.$inferSelect;
type FinancialsRow = typeof exportFinancials.$inferSelect;

const num = (v: string | null | undefined) => (v == null ? null : Number(v));
/** '' clears a text field, undefined leaves it alone. */
const text = (v: string | undefined | null) => (v === undefined ? undefined : v === '' || v === null ? null : v);
/** '' or null clears a timestamp, undefined leaves it alone. */
const when = (v: string | null | undefined) => (v === undefined ? undefined : v ? new Date(v) : null);

const financialsView = (f: FinancialsRow | undefined) => ({
  clientId: f?.clientId ?? null,
  sellingRatePerCft: num(f?.sellingRatePerCft),
  saleAmount: num(f?.saleAmount),
  amountReceived: num(f?.amountReceived) ?? 0,
  paymentStatus: f?.paymentStatus ?? ('UNPAID' as const),
  notes: f?.notes ?? null,
});

const SUMMARY = {
  id: exportLoads.id,
  code: exportLoads.code,
  exportDate: exportLoads.exportDate,
  lorryNumber: exportLoads.lorryNumber,
  woodType: exportLoads.woodType,
  totalPieces: exportLoads.totalPieces,
  totalCft: exportLoads.totalCft,
  status: exportLoads.status,
  rejectionReason: exportLoads.rejectionReason,
  createdById: exportLoads.createdById,
  createdByName: users.name,
};

/** A line's stock position: same wood type, load and size add up. */
const positionKey = (l: { importLoadId: string | null; thicknessIn: string; widthIn: string; lengthFt: string }) =>
  [l.importLoadId, Number(l.thicknessIn), Number(l.widthIn), Number(l.lengthFt)].join('|');

/**
 * Export loads (lorries of sawn wood going out) and their measured lines.
 * Every line names the import load its pieces came from, so a sale is traceable
 * back to the lorry of logs. Finished stock goes down only when the owner approves.
 * The sale side (client, price, payments) lives in export_financials and is owner-only.
 */
@Injectable()
export class ExportsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthUser, q: ListExportsQuery) {
    const conditions: SQL[] = [eq(exportLoads.millId, actor.millId)];
    if (!hasPermission(actor.role, Permission.OPERATIONS_VIEW_ALL)) conditions.push(eq(exportLoads.createdById, actor.id));
    if (q.status) conditions.push(eq(exportLoads.status, q.status));
    const search = textSearch(q.q, [exportLoads.code, exportLoads.lorryNumber, exportLoads.woodType]);
    if (search) conditions.push(search);
    const where = and(...conditions);
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select(SUMMARY)
        .from(exportLoads)
        .innerJoin(users, eq(users.id, exportLoads.createdById))
        .where(where)
        .orderBy(desc(exportLoads.exportDate), desc(exportLoads.createdAt))
        .limit(q.take)
        .offset(q.skip),
      this.db.select({ total: count() }).from(exportLoads).where(where),
    ]);
    return { items: rows.map((r) => ({ ...r, totalCft: Number(r.totalCft) })), total, take: q.take, skip: q.skip };
  }

  async create(actor: AuthUser, dto: CreateExportDto) {
    const row = await this.db.transaction(async (tx) => {
      if (dto.importLoadId) await this.findSourceLoad(tx, actor, dto.importLoadId);
      const startAt = when(dto.startAt) ?? null;
      const endAt = when(dto.endAt) ?? null;
      this.checkTimes(startAt, endAt);
      const code = await nextCode(tx, actor.millId, 'EXP');
      const [created] = await tx
        .insert(exportLoads)
        .values({
          millId: actor.millId,
          code,
          exportDate: dto.exportDate,
          lorryNumber: dto.lorryNumber,
          woodType: dto.woodType,
          driverName: text(dto.driverName),
          driverMobile: text(dto.driverMobile),
          lorryOwnerName: text(dto.lorryOwnerName),
          lorryOwnerMobile: text(dto.lorryOwnerMobile),
          startAt,
          endAt,
          importLoadId: dto.importLoadId ?? null,
          notes: text(dto.notes),
          createdById: actor.id,
        })
        .returning();
      await this.audit.log({ millId: actor.millId, userId: actor.id, action: 'CREATE', entityType: 'ExportLoad', entityId: created.id, after: created }, tx);
      return created;
    });
    return this.detail(actor, row.id);
  }

  async detail(actor: AuthUser, id: string) {
    const exp = await this.findExport(this.db, actor, id);
    const [[creator], lines] = await Promise.all([
      this.db.select({ name: users.name }).from(users).where(eq(users.id, exp.createdById)),
      this.db.select().from(exportMeasurements).where(eq(exportMeasurements.exportLoadId, id)).orderBy(asc(exportMeasurements.lineNumber)),
    ]);
    const loadIds = [...new Set([exp.importLoadId, ...lines.map((l) => l.importLoadId)].filter((v): v is string => !!v))];
    const codes = new Map(
      loadIds.length
        ? (await this.db.select({ id: importLoads.id, code: importLoads.code }).from(importLoads).where(inArray(importLoads.id, loadIds))).map((r) => [r.id, r.code])
        : [],
    );

    // Finished stock still available per line position (after this export, if it's already approved).
    const available = new Map<string, number>();
    for (const l of lines) {
      const k = positionKey(l);
      if (available.has(k) || !l.importLoadId) continue;
      const b = await finishedBalance(this.db, {
        millId: exp.millId,
        woodType: exp.woodType,
        importLoadId: l.importLoadId,
        thicknessIn: Number(l.thicknessIn),
        widthIn: Number(l.widthIn),
        lengthFt: Number(l.lengthFt),
      });
      available.set(k, b.pieces);
    }

    const editable = canEdit(actor, exp);
    return {
      id: exp.id,
      code: exp.code,
      exportDate: exp.exportDate,
      lorryNumber: exp.lorryNumber,
      woodType: exp.woodType,
      driverName: exp.driverName,
      driverMobile: exp.driverMobile,
      lorryOwnerName: exp.lorryOwnerName,
      lorryOwnerMobile: exp.lorryOwnerMobile,
      startAt: exp.startAt,
      endAt: exp.endAt,
      importLoadId: exp.importLoadId,
      importCode: exp.importLoadId ? (codes.get(exp.importLoadId) ?? '') : null,
      notes: exp.notes,
      totalPieces: exp.totalPieces,
      totalCft: Number(exp.totalCft),
      status: exp.status,
      rejectionReason: exp.rejectionReason,
      createdById: exp.createdById,
      createdByName: creator?.name ?? '',
      submittedAt: exp.submittedAt,
      reviewedAt: exp.reviewedAt,
      updatedAt: exp.updatedAt,
      editable,
      canSubmit: editable && ACCOUNTANT_EDITABLE_STATUSES.includes(exp.status) && hasPermission(actor.role, Permission.OPERATIONS_SUBMIT),
      canReview: exp.status === 'SUBMITTED' && hasPermission(actor.role, Permission.OPERATIONS_APPROVE),
      lines: lines.map((l) => ({
        id: l.id,
        lineNumber: l.lineNumber,
        importLoadId: l.importLoadId,
        importCode: l.importLoadId ? (codes.get(l.importLoadId) ?? '') : '',
        thicknessIn: Number(l.thicknessIn),
        widthIn: Number(l.widthIn),
        lengthFt: Number(l.lengthFt),
        pieces: l.pieces,
        cft: Number(l.cft),
        /** finished pieces of this size left in that load (approved stock) */
        availablePieces: available.get(positionKey(l)) ?? 0,
      })),
    };
  }

  async update(actor: AuthUser, id: string, dto: UpdateExportDto) {
    await this.db.transaction(async (tx) => {
      const before = await this.findExport(tx, actor, id, true);
      const action = assertEditable(actor, before);
      if (dto.importLoadId) await this.findSourceLoad(tx, actor, dto.importLoadId);
      const startAt = when(dto.startAt);
      const endAt = when(dto.endAt);
      this.checkTimes(startAt === undefined ? before.startAt : startAt, endAt === undefined ? before.endAt : endAt);
      const [after] = await tx
        .update(exportLoads)
        .set({
          exportDate: dto.exportDate,
          lorryNumber: dto.lorryNumber,
          woodType: dto.woodType,
          driverName: text(dto.driverName),
          driverMobile: text(dto.driverMobile),
          lorryOwnerName: text(dto.lorryOwnerName),
          lorryOwnerMobile: text(dto.lorryOwnerMobile),
          startAt,
          endAt,
          importLoadId: dto.importLoadId,
          notes: text(dto.notes),
          updatedAt: new Date(),
        })
        .where(eq(exportLoads.id, id))
        .returning();
      // the wood type may have changed on an approved export → move which stock it took
      if (after.status === 'APPROVED') await this.postStock(tx, actor, after);
      await this.audit.log({ millId: actor.millId, userId: actor.id, action, entityType: 'ExportLoad', entityId: id, before, after }, tx);
    });
    return this.detail(actor, id);
  }

  // ───────── measurement lines ─────────

  async addLine(actor: AuthUser, exportId: string, dto: ExportLineDto) {
    return this.changeLines(actor, exportId, async (tx, exp, action) => {
      const importLoadId = await this.lineLoad(tx, actor, exp, dto.importLoadId);
      const [{ last }] = await tx.select({ last: max(exportMeasurements.lineNumber) }).from(exportMeasurements).where(eq(exportMeasurements.exportLoadId, exportId));
      const [row] = await tx
        .insert(exportMeasurements)
        .values({ exportLoadId: exportId, lineNumber: (last ?? 0) + 1, importLoadId, ...this.lineValues(dto), createdById: actor.id })
        .returning();
      if (action === 'OWNER_EDIT') {
        await this.audit.log({ millId: actor.millId, userId: actor.id, action, entityType: 'ExportMeasurement', entityId: row.id, after: row }, tx);
      }
    });
  }

  async updateLine(actor: AuthUser, exportId: string, lineId: string, dto: ExportLineDto) {
    return this.changeLines(actor, exportId, async (tx, exp, action) => {
      const before = await this.findLine(tx, exportId, lineId);
      const importLoadId = await this.lineLoad(tx, actor, exp, dto.importLoadId ?? before.importLoadId ?? undefined);
      const [after] = await tx
        .update(exportMeasurements)
        .set({ importLoadId, ...this.lineValues(dto), updatedAt: new Date() })
        .where(eq(exportMeasurements.id, lineId))
        .returning();
      await this.audit.log({ millId: actor.millId, userId: actor.id, action, entityType: 'ExportMeasurement', entityId: lineId, before, after }, tx);
    });
  }

  /** Remaining lines keep their numbers. */
  async removeLine(actor: AuthUser, exportId: string, lineId: string) {
    return this.changeLines(actor, exportId, async (tx, _exp, action) => {
      const before = await this.findLine(tx, exportId, lineId);
      await tx.delete(exportMeasurements).where(eq(exportMeasurements.id, lineId));
      await this.audit.log(
        { millId: actor.millId, userId: actor.id, action: action === 'OWNER_EDIT' ? 'OWNER_EDIT' : 'DELETE', entityType: 'ExportMeasurement', entityId: lineId, before },
        tx,
      );
    });
  }

  // ───────── approval workflow ─────────

  /** Draft/Rejected → Submitted, once at least one line is measured and the stock is there. */
  async submit(actor: AuthUser, id: string) {
    await this.db.transaction(async (tx) => {
      const before = await this.findExport(tx, actor, id, true);
      if (!ACCOUNTANT_EDITABLE_STATUSES.includes(before.status)) throw new ConflictException('This export has already been submitted');
      assertEditable(actor, before);
      const lines = await tx.select().from(exportMeasurements).where(eq(exportMeasurements.exportLoadId, id));
      if (!lines.length) throw new BadRequestException('Measure at least one line before submitting');
      await this.checkAvailable(tx, before, lines);
      const [after] = await tx
        .update(exportLoads)
        .set({ status: 'SUBMITTED', submittedAt: new Date(), rejectionReason: null, updatedAt: new Date() })
        .where(eq(exportLoads.id, id))
        .returning();
      await this.audit.log({ millId: actor.millId, userId: actor.id, action: 'SUBMIT', entityType: 'ExportLoad', entityId: id, before, after }, tx);
    });
    return this.detail(actor, id);
  }

  /** Submitted → Approved: every line is taken out of finished stock, in one transaction. */
  async approve(actor: AuthUser, id: string) {
    await this.db.transaction(async (tx) => {
      const before = await this.findExport(tx, actor, id, true);
      if (before.status !== 'SUBMITTED') throw new ConflictException('Only submitted exports can be approved');
      const [after] = await tx
        .update(exportLoads)
        .set({ status: 'APPROVED', reviewedById: actor.id, reviewedAt: new Date(), updatedAt: new Date() })
        .where(eq(exportLoads.id, id))
        .returning();
      await this.postStock(tx, actor, after);
      await this.audit.log({ millId: actor.millId, userId: actor.id, action: 'APPROVE', entityType: 'ExportLoad', entityId: id, before, after }, tx);
    });
    return this.detail(actor, id);
  }

  async reject(actor: AuthUser, id: string, reason: string) {
    await this.db.transaction(async (tx) => {
      const before = await this.findExport(tx, actor, id, true);
      if (before.status !== 'SUBMITTED') throw new ConflictException('Only submitted exports can be rejected');
      const [after] = await tx
        .update(exportLoads)
        .set({ status: 'REJECTED', rejectionReason: reason, reviewedById: actor.id, reviewedAt: new Date(), updatedAt: new Date() })
        .where(eq(exportLoads.id, id))
        .returning();
      await this.audit.log({ millId: actor.millId, userId: actor.id, action: 'REJECT', entityType: 'ExportLoad', entityId: id, before, after }, tx);
    });
    return this.detail(actor, id);
  }

  // ───────── sale details [OWNER-ONLY] ─────────

  async financials(actor: AuthUser, id: string) {
    await this.findExport(this.db, actor, id);
    const [row] = await this.db.select().from(exportFinancials).where(eq(exportFinancials.exportLoadId, id));
    return financialsView(row);
  }

  /** Create or replace the sale side of an export. Payment status is derived, never typed in. */
  async saveFinancials(actor: AuthUser, id: string, dto: ExportFinancialsDto) {
    return this.db.transaction(async (tx) => {
      await this.findExport(tx, actor, id, true);
      if (dto.clientId) {
        const [client] = await tx
          .select({ id: clients.id })
          .from(clients)
          .where(and(eq(clients.id, dto.clientId), eq(clients.millId, actor.millId)));
        if (!client) throw new BadRequestException('Client not found');
      }
      const amount = dto.saleAmount ?? null;
      const received = dto.amountReceived ?? 0;
      const paymentStatus = received <= 0 ? 'UNPAID' : amount != null && received >= amount ? 'PAID' : 'PARTIAL';
      const values = {
        clientId: dto.clientId ?? null,
        sellingRatePerCft: dto.sellingRatePerCft == null ? null : String(dto.sellingRatePerCft),
        saleAmount: amount == null ? null : String(amount),
        amountReceived: String(received),
        paymentStatus,
        notes: dto.notes || null,
        updatedAt: new Date(),
      } as const;
      const [before] = await tx.select().from(exportFinancials).where(eq(exportFinancials.exportLoadId, id));
      const [after] = await tx
        .insert(exportFinancials)
        .values({ exportLoadId: id, ...values })
        .onConflictDoUpdate({ target: exportFinancials.exportLoadId, set: values })
        .returning();
      await this.audit.log(
        { millId: actor.millId, userId: actor.id, action: before ? 'UPDATE' : 'CREATE', entityType: 'ExportFinancials', entityId: id, before, after },
        tx,
      );
      return financialsView(after);
    });
  }

  // ───────── helpers ─────────

  private lineValues(dto: ExportLineDto) {
    return {
      thicknessIn: String(dto.thicknessIn),
      widthIn: String(dto.widthIn),
      lengthFt: String(dto.lengthFt),
      pieces: dto.pieces,
      cft: String(exportPieceCft(dto.thicknessIn, dto.widthIn, dto.lengthFt, dto.pieces)),
    };
  }

  /** The line's own import load, else the export's; it must be an approved load in this mill. */
  private async lineLoad(tx: DbOrTx, actor: AuthUser, exp: ExportRow, requested: string | undefined) {
    const id = requested ?? exp.importLoadId;
    if (!id) throw new BadRequestException('Choose the import load these pieces came from');
    await this.findSourceLoad(tx, actor, id);
    return id;
  }

  /** Lock the export, check it can be changed, apply the change, recompute totals (and stock, if approved). */
  private async changeLines(actor: AuthUser, exportId: string, change: (tx: DbOrTx, exp: ExportRow, action: 'UPDATE' | 'OWNER_EDIT') => Promise<void>) {
    await this.db.transaction(async (tx) => {
      const exp = await this.findExport(tx, actor, exportId, true);
      const action = assertEditable(actor, exp);
      await change(tx, exp, action);
      const [agg] = await tx
        .select({ pieces: sum(exportMeasurements.pieces), cft: sum(exportMeasurements.cft), lines: count() })
        .from(exportMeasurements)
        .where(eq(exportMeasurements.exportLoadId, exportId));
      const [after] = await tx
        .update(exportLoads)
        .set({ totalPieces: Number(agg.pieces ?? 0), totalCft: String(roundTo(Number(agg.cft ?? 0))), updatedAt: new Date() })
        .where(eq(exportLoads.id, exportId))
        .returning();
      if (after.status === 'APPROVED') {
        if (agg.lines === 0) throw new BadRequestException('An approved export must keep at least one line');
        await this.postStock(tx, actor, after);
      }
    });
    return this.detail(actor, exportId);
  }

  /** Friendly check before submitting: each size asked for must be in that load's finished stock. */
  private async checkAvailable(tx: DbOrTx, exp: ExportRow, lines: LineRow[]) {
    const wanted = new Map<string, { line: LineRow; pieces: number }>();
    for (const l of lines) {
      if (!l.importLoadId) throw new BadRequestException(`Line ${l.lineNumber} has no import load`);
      const k = positionKey(l);
      const w = wanted.get(k) ?? { line: l, pieces: 0 };
      w.pieces += l.pieces;
      wanted.set(k, w);
    }
    for (const { line, pieces } of wanted.values()) {
      const have = await finishedBalance(tx, {
        millId: exp.millId,
        woodType: exp.woodType,
        importLoadId: line.importLoadId!,
        thicknessIn: Number(line.thicknessIn),
        widthIn: Number(line.widthIn),
        lengthFt: Number(line.lengthFt),
      });
      if (pieces > have.pieces) {
        const [load] = await tx.select({ code: importLoads.code }).from(importLoads).where(eq(importLoads.id, line.importLoadId!));
        const size = sizeLabel(Number(line.thicknessIn), Number(line.widthIn), Number(line.lengthFt));
        throw new ConflictException(`Only ${have.pieces} pieces of ${exp.woodType} ${size} from ${load?.code ?? ''} are in finished stock (this export needs ${pieces})`);
      }
    }
  }

  /**
   * Make the ledger match an approved export: −pieces/−CFT of each line's size from
   * that line's import load. Locks every load involved (now and before) and refuses
   * the whole change if any balance would go below zero.
   */
  private async postStock(tx: DbOrTx, actor: AuthUser, exp: ExportRow) {
    const lines = await tx.select().from(exportMeasurements).where(eq(exportMeasurements.exportLoadId, exp.id));
    const loads = [...lines.map((l) => l.importLoadId).filter((v): v is string => !!v), ...(await postedLoads(tx, 'EXPORT', exp.id))];
    await lockImportLoads(tx, loads);
    await syncMovements(tx, {
      millId: exp.millId,
      source: 'EXPORT',
      sourceId: exp.id,
      postedById: actor.id,
      target: lines.map((l) => {
        if (!l.importLoadId) throw new BadRequestException(`Line ${l.lineNumber} has no import load`);
        return {
          kind: 'FINISHED' as const,
          woodType: exp.woodType,
          importLoadId: l.importLoadId,
          thicknessIn: Number(l.thicknessIn),
          widthIn: Number(l.widthIn),
          lengthFt: Number(l.lengthFt),
          pieces: -l.pieces,
          cft: -Number(l.cft),
        };
      }),
    });
    await assertStockNotNegative(tx, loads);
  }

  private async findSourceLoad(tx: DbOrTx, actor: AuthUser, id: string) {
    const [load] = await tx
      .select({ id: importLoads.id, status: importLoads.status })
      .from(importLoads)
      .where(and(eq(importLoads.id, id), eq(importLoads.millId, actor.millId)));
    if (!load) throw new BadRequestException('Import load not found');
    if (load.status !== 'APPROVED') throw new BadRequestException('Exports can only take stock from approved import loads');
    return load;
  }

  private checkTimes(startAt: Date | null, endAt: Date | null) {
    if (startAt && endAt && endAt < startAt) throw new BadRequestException('End time must be after start time');
  }

  private async findExport(db: DbOrTx, actor: AuthUser, id: string, lock = false): Promise<ExportRow> {
    const query = db
      .select()
      .from(exportLoads)
      .where(and(eq(exportLoads.id, id), eq(exportLoads.millId, actor.millId)))
      .limit(1);
    const [row] = lock ? await query.for('update') : await query;
    try {
      return assertVisible(actor, row);
    } catch {
      throw new NotFoundException('Export not found');
    }
  }

  private async findLine(tx: DbOrTx, exportId: string, id: string) {
    const [row] = await tx
      .select()
      .from(exportMeasurements)
      .where(and(eq(exportMeasurements.id, id), eq(exportMeasurements.exportLoadId, exportId)));
    if (!row) throw new NotFoundException('Line not found');
    return row;
  }
}

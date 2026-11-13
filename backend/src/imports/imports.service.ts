import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ACCOUNTANT_EDITABLE_STATUSES,
  durationMinutes,
  hasPermission,
  importLogCft,
  Permission,
  roundTo,
  UnloadingInputError,
  unloadingCharges,
} from '@sawmill/shared';
import { and, asc, count, desc, eq, inArray, max, ne, SQL, sum } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service';
import { nextCode } from '../common/codes';
import type { AuthUser } from '../common/types';
import { Database, DbOrTx, InjectDb } from '../db/db.module';
import { importFinancials, importLoads, logMeasurements, mills, stockMovements, suppliers, unloadingEntries, users } from '../db/schema';
import { assertStockNotNegative, syncMovements } from '../stock/ledger';
import {
  CreateImportDto,
  CreateUnloadingDto,
  FinancialsDto,
  ListImportsQuery,
  LogDto,
  UpdateImportDto,
  UpdateUnloadingDto,
} from './imports.dto';

/** numeric columns arrive as strings. */
const num = (v: string | number | null | undefined) => (v == null ? null : Number(v));
/** '' (sent to clear a field) and undefined are told apart: '' → null, undefined → leave as is. */
const text = (v: string | undefined) => (v === undefined ? undefined : v === '' ? null : v);

type LoadRow = typeof importLoads.$inferSelect;
type UnloadingRow = typeof unloadingEntries.$inferSelect;
type LogRow = typeof logMeasurements.$inferSelect;

const SUMMARY = {
  id: importLoads.id,
  code: importLoads.code,
  arrivalAt: importLoads.arrivalAt,
  lorryNumber: importLoads.lorryNumber,
  woodType: importLoads.woodType,
  totalLogs: importLoads.totalLogs,
  totalCft: importLoads.totalCft,
  status: importLoads.status,
  rejectionReason: importLoads.rejectionReason,
  createdById: importLoads.createdById,
  createdByName: users.name,
  submittedAt: importLoads.submittedAt,
  updatedAt: importLoads.updatedAt,
};

type EditAction = 'UPDATE' | 'OWNER_EDIT';

const unloadingView = (u: UnloadingRow) => ({
  id: u.id,
  vehicleNumber: u.vehicleNumber,
  driverName: u.driverName,
  driverMobile: u.driverMobile,
  vehicleOwnerName: u.vehicleOwnerName,
  startAt: u.startAt,
  endAt: u.endAt,
  durationMinutes: u.durationMinutes,
  ratePerHour: num(u.ratePerHour),
  totalCharges: num(u.totalCharges),
});

const logView = (l: LogRow) => ({
  id: l.id,
  logNumber: l.logNumber,
  girthIn: Number(l.girthIn),
  lengthFt: Number(l.lengthFt),
  cft: Number(l.cft),
});

/** Duration and charge for one unloading vehicle, using the shared formulas (same maths as the apps). */
function unloadingTotals(startAt: Date, endAt: Date | null, ratePerHour: number | null) {
  if (!endAt) return { durationMinutes: null, totalCharges: null };
  try {
    const minutes = durationMinutes(startAt, endAt);
    return { durationMinutes: minutes, totalCharges: ratePerHour == null ? null : unloadingCharges(minutes, ratePerHour) };
  } catch (err) {
    if (err instanceof UnloadingInputError) throw new BadRequestException(err.message);
    throw err;
  }
}

type FinancialsRow = typeof importFinancials.$inferSelect;

const financialsView = (f: FinancialsRow | undefined) => ({
  supplierId: f?.supplierId ?? null,
  purchaseRatePerCft: num(f?.purchaseRatePerCft),
  purchaseAmount: num(f?.purchaseAmount),
  transportCharges: num(f?.transportCharges),
  amountPaid: num(f?.amountPaid) ?? 0,
  paymentStatus: f?.paymentStatus ?? ('UNPAID' as const),
  notes: f?.notes ?? null,
});

@Injectable()
export class ImportsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  // ───────── loads ─────────

  async list(actor: AuthUser, q: ListImportsQuery) {
    const conditions: SQL[] = [eq(importLoads.millId, actor.millId)];
    // An accountant only ever sees their own entries.
    if (!hasPermission(actor.role, Permission.OPERATIONS_VIEW_ALL)) conditions.push(eq(importLoads.createdById, actor.id));
    if (q.status) conditions.push(eq(importLoads.status, q.status));
    if (q.open === '1') conditions.push(inArray(importLoads.status, [...ACCOUNTANT_EDITABLE_STATUSES]));
    const where = and(...conditions);

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select(SUMMARY)
        .from(importLoads)
        .innerJoin(users, eq(users.id, importLoads.createdById))
        .where(where)
        .orderBy(desc(importLoads.arrivalAt), desc(importLoads.createdAt))
        .limit(q.take)
        .offset(q.skip),
      this.db.select({ total: count() }).from(importLoads).where(where),
    ]);
    return { items: rows.map((r) => ({ ...r, totalCft: Number(r.totalCft) })), total, take: q.take, skip: q.skip };
  }

  async create(actor: AuthUser, dto: CreateImportDto) {
    const arrivalAt = dto.arrivalAt ? new Date(dto.arrivalAt) : new Date();
    const load = await this.db.transaction(async (tx) => {
      const code = await nextCode(tx, actor.millId, 'IMP');
      const [row] = await tx
        .insert(importLoads)
        .values({
          millId: actor.millId,
          code,
          arrivalAt,
          lorryNumber: dto.lorryNumber,
          woodType: dto.woodType,
          woodCategory: text(dto.woodCategory),
          driverName: text(dto.driverName),
          driverMobile: text(dto.driverMobile),
          lorryOwnerName: text(dto.lorryOwnerName),
          lorryOwnerMobile: text(dto.lorryOwnerMobile),
          originLocation: text(dto.originLocation),
          notes: text(dto.notes),
          createdById: actor.id,
        })
        .returning();
      await this.audit.log(
        { millId: actor.millId, userId: actor.id, action: 'CREATE', entityType: 'ImportLoad', entityId: row.id, after: row },
        tx,
      );
      return row;
    });
    return this.detail(actor, load.id);
  }

  async detail(actor: AuthUser, id: string) {
    const load = await this.findLoad(this.db, actor, id);
    const [creator, unloadings, logs, mill] = await Promise.all([
      this.db.select({ name: users.name }).from(users).where(eq(users.id, load.createdById)),
      this.db.select().from(unloadingEntries).where(eq(unloadingEntries.importLoadId, id)).orderBy(asc(unloadingEntries.startAt)),
      this.db.select().from(logMeasurements).where(eq(logMeasurements.importLoadId, id)).orderBy(asc(logMeasurements.logNumber)),
      this.db.select({ settings: mills.settings }).from(mills).where(eq(mills.id, actor.millId)),
    ]);
    return {
      id: load.id,
      code: load.code,
      arrivalAt: load.arrivalAt,
      lorryNumber: load.lorryNumber,
      woodType: load.woodType,
      woodCategory: load.woodCategory,
      driverName: load.driverName,
      driverMobile: load.driverMobile,
      lorryOwnerName: load.lorryOwnerName,
      lorryOwnerMobile: load.lorryOwnerMobile,
      originLocation: load.originLocation,
      notes: load.notes,
      totalLogs: load.totalLogs,
      totalCft: Number(load.totalCft),
      status: load.status,
      rejectionReason: load.rejectionReason,
      createdById: load.createdById,
      createdByName: creator[0]?.name ?? '',
      submittedAt: load.submittedAt,
      reviewedAt: load.reviewedAt,
      updatedAt: load.updatedAt,
      /** Can THIS user change it now (owner: always, audited; accountant: own Draft/Rejected). */
      editable: this.canEdit(actor, load),
      canSubmit: this.isEditable(load) && hasPermission(actor.role, Permission.OPERATIONS_SUBMIT),
      canReview: load.status === 'SUBMITTED' && hasPermission(actor.role, Permission.OPERATIONS_APPROVE),
      defaultUnloadingRate: mill[0]?.settings.defaultUnloadingRatePerHour ?? null,
      unloadings: unloadings.map(unloadingView),
      logs: logs.map(logView),
    };
  }

  async update(actor: AuthUser, id: string, dto: UpdateImportDto) {
    await this.db.transaction(async (tx) => {
      const { load: before, action } = await this.findEditableLoad(tx, actor, id);
      if (before.status === 'APPROVED' && dto.woodType && dto.woodType !== before.woodType) {
        // Production, exports and adjustments copied the old wood type onto their own
        // stock lines; moving only the import's raw stock would split the load across
        // two wood types. Allow the correction only while nothing else has used the load.
        const [used] = await tx
          .select({ n: count() })
          .from(stockMovements)
          .where(and(eq(stockMovements.importLoadId, id), ne(stockMovements.source, 'IMPORT')));
        if (used.n > 0) {
          throw new ConflictException(
            'The wood type cannot be changed: production, exports or stock adjustments already use this load.',
          );
        }
      }
      const [after] = await tx
        .update(importLoads)
        .set({
          arrivalAt: dto.arrivalAt ? new Date(dto.arrivalAt) : undefined,
          lorryNumber: dto.lorryNumber,
          woodType: dto.woodType,
          woodCategory: text(dto.woodCategory),
          driverName: text(dto.driverName),
          driverMobile: text(dto.driverMobile),
          lorryOwnerName: text(dto.lorryOwnerName),
          lorryOwnerMobile: text(dto.lorryOwnerMobile),
          originLocation: text(dto.originLocation),
          notes: text(dto.notes),
          updatedAt: new Date(),
        })
        .where(eq(importLoads.id, id))
        .returning();
      await this.audit.log(
        { millId: actor.millId, userId: actor.id, action, entityType: 'ImportLoad', entityId: id, before, after },
        tx,
      );
      // wood type may have changed on an approved load → move its stock
      if (before.status === 'APPROVED') await this.repostStock(tx, actor, id);
    });
    return this.detail(actor, id);
  }

  // ───────── unloading ─────────

  async addUnloading(actor: AuthUser, loadId: string, dto: CreateUnloadingDto) {
    return this.db.transaction(async (tx) => {
      const { action } = await this.findEditableLoad(tx, actor, loadId);
      const [mill] = await tx.select({ settings: mills.settings }).from(mills).where(eq(mills.id, actor.millId));
      const startAt = dto.startAt ? new Date(dto.startAt) : new Date();
      const endAt = dto.endAt ? new Date(dto.endAt) : null;
      const rate = dto.ratePerHour ?? mill?.settings.defaultUnloadingRatePerHour ?? null;
      const { durationMinutes, totalCharges } = unloadingTotals(startAt, endAt, rate);

      const [row] = await tx
        .insert(unloadingEntries)
        .values({
          importLoadId: loadId,
          vehicleNumber: dto.vehicleNumber,
          driverName: text(dto.driverName),
          driverMobile: text(dto.driverMobile),
          vehicleOwnerName: text(dto.vehicleOwnerName),
          startAt,
          endAt,
          durationMinutes,
          ratePerHour: rate == null ? null : String(rate),
          totalCharges: totalCharges == null ? null : String(totalCharges),
          createdById: actor.id,
        })
        .returning();
      await this.audit.log(
        { millId: actor.millId, userId: actor.id, action: action === 'OWNER_EDIT' ? 'OWNER_EDIT' : 'CREATE', entityType: 'UnloadingEntry', entityId: row.id, after: row },
        tx,
      );
      return unloadingView(row);
    });
  }

  async updateUnloading(actor: AuthUser, loadId: string, unloadingId: string, dto: UpdateUnloadingDto) {
    return this.db.transaction(async (tx) => {
      const { action } = await this.findEditableLoad(tx, actor, loadId);
      const before = await this.findUnloading(tx, loadId, unloadingId);
      const startAt = dto.startAt ? new Date(dto.startAt) : before.startAt;
      const endAt = dto.endAt ? new Date(dto.endAt) : before.endAt;
      const rate = dto.ratePerHour ?? num(before.ratePerHour);
      const { durationMinutes, totalCharges } = unloadingTotals(startAt, endAt, rate);

      const [after] = await tx
        .update(unloadingEntries)
        .set({
          vehicleNumber: dto.vehicleNumber,
          driverName: text(dto.driverName),
          driverMobile: text(dto.driverMobile),
          vehicleOwnerName: text(dto.vehicleOwnerName),
          startAt,
          endAt,
          durationMinutes,
          ratePerHour: rate == null ? null : String(rate),
          totalCharges: totalCharges == null ? null : String(totalCharges),
          updatedAt: new Date(),
        })
        .where(eq(unloadingEntries.id, unloadingId))
        .returning();
      await this.audit.log(
        { millId: actor.millId, userId: actor.id, action, entityType: 'UnloadingEntry', entityId: unloadingId, before, after },
        tx,
      );
      return unloadingView(after);
    });
  }

  async removeUnloading(actor: AuthUser, loadId: string, unloadingId: string) {
    await this.db.transaction(async (tx) => {
      const { action } = await this.findEditableLoad(tx, actor, loadId);
      const before = await this.findUnloading(tx, loadId, unloadingId);
      await tx.delete(unloadingEntries).where(eq(unloadingEntries.id, unloadingId));
      await this.audit.log(
        { millId: actor.millId, userId: actor.id, action: action === 'OWNER_EDIT' ? 'OWNER_EDIT' : 'DELETE', entityType: 'UnloadingEntry', entityId: unloadingId, before },
        tx,
      );
    });
  }

  // ───────── log measurements ─────────

  /**
   * Add the next log. The load row is locked first, so two phones measuring the
   * same lorry can never be given the same log number.
   * Adding a log is not audited row by row (a lorry carries hundreds); edits and
   * deletions of an existing log are.
   */
  async addLog(actor: AuthUser, loadId: string, dto: LogDto) {
    return this.db.transaction(async (tx) => {
      const { load, action } = await this.findEditableLoad(tx, actor, loadId);
      const [{ last }] = await tx
        .select({ last: max(logMeasurements.logNumber) })
        .from(logMeasurements)
        .where(eq(logMeasurements.importLoadId, loadId));
      const [row] = await tx
        .insert(logMeasurements)
        .values({
          importLoadId: loadId,
          logNumber: (last ?? 0) + 1,
          girthIn: String(dto.girthIn),
          lengthFt: String(dto.lengthFt),
          cft: String(importLogCft(dto.girthIn, dto.lengthFt)),
          createdById: actor.id,
        })
        .returning();
      // Routine measuring isn't audited per log, but the owner adding a missed log to a submitted/approved load is.
      if (action === 'OWNER_EDIT') {
        await this.audit.log(
          { millId: actor.millId, userId: actor.id, action, entityType: 'LogMeasurement', entityId: row.id, after: row },
          tx,
        );
      }
      return { log: logView(row), ...(await this.afterLogChange(tx, actor, load)) };
    });
  }

  async updateLog(actor: AuthUser, loadId: string, logId: string, dto: LogDto) {
    return this.db.transaction(async (tx) => {
      const { load, action } = await this.findEditableLoad(tx, actor, loadId);
      const before = await this.findLog(tx, loadId, logId);
      const [after] = await tx
        .update(logMeasurements)
        .set({
          girthIn: String(dto.girthIn),
          lengthFt: String(dto.lengthFt),
          cft: String(importLogCft(dto.girthIn, dto.lengthFt)),
          updatedAt: new Date(),
        })
        .where(eq(logMeasurements.id, logId))
        .returning();
      await this.audit.log(
        { millId: actor.millId, userId: actor.id, action, entityType: 'LogMeasurement', entityId: logId, before, after },
        tx,
      );
      return { log: logView(after), ...(await this.afterLogChange(tx, actor, load)) };
    });
  }

  /** Remaining logs keep their numbers; the count is always the number of rows. */
  async removeLog(actor: AuthUser, loadId: string, logId: string) {
    return this.db.transaction(async (tx) => {
      const { load, action } = await this.findEditableLoad(tx, actor, loadId);
      const before = await this.findLog(tx, loadId, logId);
      await tx.delete(logMeasurements).where(eq(logMeasurements.id, logId));
      await this.audit.log(
        { millId: actor.millId, userId: actor.id, action: action === 'OWNER_EDIT' ? 'OWNER_EDIT' : 'DELETE', entityType: 'LogMeasurement', entityId: logId, before },
        tx,
      );
      return this.afterLogChange(tx, actor, load);
    });
  }

  // ───────── approval workflow ─────────

  /** Draft/Rejected → Submitted. The accountant can no longer change it afterwards. */
  async submit(actor: AuthUser, id: string) {
    await this.db.transaction(async (tx) => {
      const before = await this.findLoad(tx, actor, id, true);
      if (!this.isEditable(before)) throw new ConflictException('This import has already been submitted');
      if (before.totalLogs === 0) throw new BadRequestException('Measure at least one log before submitting');
      const [after] = await tx
        .update(importLoads)
        .set({ status: 'SUBMITTED', submittedAt: new Date(), rejectionReason: null, updatedAt: new Date() })
        .where(eq(importLoads.id, id))
        .returning();
      await this.audit.log({ millId: actor.millId, userId: actor.id, action: 'SUBMIT', entityType: 'ImportLoad', entityId: id, before, after }, tx);
    });
    return this.detail(actor, id);
  }

  /**
   * Submitted → Approved. The measurement becomes official and the load's CFT is
   * added to raw stock — in the same transaction, so stock and status never disagree.
   */
  async approve(actor: AuthUser, id: string) {
    await this.db.transaction(async (tx) => {
      const before = await this.findLoad(tx, actor, id, true);
      if (before.status !== 'SUBMITTED') throw new ConflictException('Only submitted imports can be approved');
      const [after] = await tx
        .update(importLoads)
        .set({ status: 'APPROVED', reviewedById: actor.id, reviewedAt: new Date(), updatedAt: new Date() })
        .where(eq(importLoads.id, id))
        .returning();
      await this.repostStock(tx, actor, id);
      await this.audit.log({ millId: actor.millId, userId: actor.id, action: 'APPROVE', entityType: 'ImportLoad', entityId: id, before, after }, tx);
    });
    return this.detail(actor, id);
  }

  /** Submitted → Rejected, with the reason shown to the accountant. No stock is posted. */
  async reject(actor: AuthUser, id: string, reason: string) {
    await this.db.transaction(async (tx) => {
      const before = await this.findLoad(tx, actor, id, true);
      if (before.status !== 'SUBMITTED') throw new ConflictException('Only submitted imports can be rejected');
      const [after] = await tx
        .update(importLoads)
        .set({ status: 'REJECTED', rejectionReason: reason, reviewedById: actor.id, reviewedAt: new Date(), updatedAt: new Date() })
        .where(eq(importLoads.id, id))
        .returning();
      await this.audit.log({ millId: actor.millId, userId: actor.id, action: 'REJECT', entityType: 'ImportLoad', entityId: id, before, after }, tx);
    });
    return this.detail(actor, id);
  }

  // ───────── purchase details [OWNER-ONLY] ─────────

  async financials(actor: AuthUser, loadId: string) {
    await this.findLoad(this.db, actor, loadId);
    const [row] = await this.db.select().from(importFinancials).where(eq(importFinancials.importLoadId, loadId));
    return financialsView(row);
  }

  /** Create or replace the purchase side of a load. Payment status is derived, never typed in. */
  async saveFinancials(actor: AuthUser, loadId: string, dto: FinancialsDto) {
    return this.db.transaction(async (tx) => {
      await this.findLoad(tx, actor, loadId, true);
      if (dto.supplierId) {
        const [supplier] = await tx
          .select({ id: suppliers.id })
          .from(suppliers)
          .where(and(eq(suppliers.id, dto.supplierId), eq(suppliers.millId, actor.millId)));
        if (!supplier) throw new BadRequestException('Supplier not found');
      }
      const amount = dto.purchaseAmount ?? null;
      const paid = dto.amountPaid ?? 0;
      const paymentStatus = paid <= 0 ? 'UNPAID' : amount != null && paid >= amount ? 'PAID' : 'PARTIAL';
      const values = {
        supplierId: dto.supplierId ?? null,
        purchaseRatePerCft: dto.purchaseRatePerCft == null ? null : String(dto.purchaseRatePerCft),
        purchaseAmount: amount == null ? null : String(amount),
        transportCharges: dto.transportCharges == null ? null : String(dto.transportCharges),
        amountPaid: String(paid),
        paymentStatus,
        notes: dto.notes || null,
        updatedAt: new Date(),
      } as const;

      const [before] = await tx.select().from(importFinancials).where(eq(importFinancials.importLoadId, loadId));
      const [after] = await tx
        .insert(importFinancials)
        .values({ importLoadId: loadId, ...values })
        .onConflictDoUpdate({ target: importFinancials.importLoadId, set: values })
        .returning();
      await this.audit.log(
        {
          millId: actor.millId,
          userId: actor.id,
          action: before ? 'UPDATE' : 'CREATE',
          entityType: 'ImportFinancials',
          entityId: loadId,
          before,
          after,
        },
        tx,
      );
      return financialsView(after);
    });
  }

  // ───────── helpers ─────────

  /** Draft or Rejected: still being worked on by the accountant. */
  private isEditable(load: Pick<LoadRow, 'status'>) {
    return ACCOUNTANT_EDITABLE_STATUSES.includes(load.status);
  }

  /** Owner can always correct a load (audited); an accountant only their own Draft/Rejected one. */
  private canEdit(actor: AuthUser, load: Pick<LoadRow, 'status'>) {
    return hasPermission(actor.role, Permission.OPERATIONS_EDIT_APPROVED) || this.isEditable(load);
  }

  /** Tenant- and owner-scoped lookup: someone else's load is reported as "not found". */
  private async findLoad(db: DbOrTx, actor: AuthUser, id: string, lock = false): Promise<LoadRow> {
    const conditions: SQL[] = [eq(importLoads.id, id), eq(importLoads.millId, actor.millId)];
    if (!hasPermission(actor.role, Permission.OPERATIONS_VIEW_ALL)) conditions.push(eq(importLoads.createdById, actor.id));
    const query = db
      .select()
      .from(importLoads)
      .where(and(...conditions))
      .limit(1);
    const [load] = lock ? await query.for('update') : await query;
    if (!load) throw new NotFoundException('Import load not found');
    return load;
  }

  /**
   * Locks the load for the rest of the transaction and checks the user may change it.
   * Accountants: own Draft/Rejected loads only. Owner: any load; changes to a
   * submitted or approved load are audited as OWNER_EDIT.
   */
  private async findEditableLoad(tx: DbOrTx, actor: AuthUser, id: string): Promise<{ load: LoadRow; action: EditAction }> {
    const load = await this.findLoad(tx, actor, id, true);
    if (this.isEditable(load)) return { load, action: 'UPDATE' };
    if (hasPermission(actor.role, Permission.OPERATIONS_EDIT_APPROVED)) return { load, action: 'OWNER_EDIT' };
    throw new ConflictException('This import is submitted or approved and can no longer be changed');
  }

  private async findUnloading(tx: DbOrTx, loadId: string, id: string) {
    const [row] = await tx
      .select()
      .from(unloadingEntries)
      .where(and(eq(unloadingEntries.id, id), eq(unloadingEntries.importLoadId, loadId)));
    if (!row) throw new NotFoundException('Unloading entry not found');
    return row;
  }

  private async findLog(tx: DbOrTx, loadId: string, id: string) {
    const [row] = await tx
      .select()
      .from(logMeasurements)
      .where(and(eq(logMeasurements.id, id), eq(logMeasurements.importLoadId, loadId)));
    if (!row) throw new NotFoundException('Log not found');
    return row;
  }

  /** Log count and total CFT always come from the rows themselves. */
  private async recomputeTotals(tx: DbOrTx, loadId: string) {
    const [agg] = await tx
      .select({ totalLogs: count(), totalCft: sum(logMeasurements.cft) })
      .from(logMeasurements)
      .where(eq(logMeasurements.importLoadId, loadId));
    const totalCft = roundTo(Number(agg.totalCft ?? 0));
    await tx
      .update(importLoads)
      .set({ totalLogs: agg.totalLogs, totalCft: String(totalCft), updatedAt: new Date() })
      .where(eq(importLoads.id, loadId));
    return { totalLogs: agg.totalLogs, totalCft };
  }

  /** Recompute totals; if the load is already approved, correct its raw stock too. */
  private async afterLogChange(tx: DbOrTx, actor: AuthUser, load: LoadRow) {
    const totals = await this.recomputeTotals(tx, load.id);
    if (load.status === 'APPROVED') await this.repostStock(tx, actor, load.id);
    return totals;
  }

  /**
   * Make the raw-stock ledger match an approved load (the ledger posts only the
   * difference, and moves stock between wood types if the owner corrected it).
   * The load row is already locked by the caller. A correction that would leave
   * less raw CFT than production has already consumed is refused.
   */
  private async repostStock(tx: DbOrTx, actor: AuthUser, loadId: string) {
    const [load] = await tx.select().from(importLoads).where(eq(importLoads.id, loadId));
    await syncMovements(tx, {
      millId: load.millId,
      source: 'IMPORT',
      sourceId: load.id,
      postedById: actor.id,
      target: [
        {
          kind: 'RAW',
          woodType: load.woodType,
          importLoadId: load.id,
          thicknessIn: null,
          widthIn: null,
          lengthFt: null,
          pieces: load.totalLogs,
          cft: Number(load.totalCft),
        },
      ],
    });
    await assertStockNotNegative(tx, [load.id]);
  }
}

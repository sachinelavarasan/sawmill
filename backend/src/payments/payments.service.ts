import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { balanceDue, paymentStatusFor, roundMoney, withRunningBalance } from '@timbertrail/shared';
import { and, desc, eq, sum } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service';
import { localToday, millOffsetMinutes } from '../common/period';
import type { AuthUser } from '../common/types';
import { Database, DbOrTx, InjectDb } from '../db/db.module';
import { clients, exportFinancials, exportLoads, importFinancials, importLoads, payments, suppliers, users } from '../db/schema';
import { CreatePaymentDto } from './payments.dto';

/** IMPORT = paid to the supplier; EXPORT = received from the client. */
export type PaymentSide = 'IMPORT' | 'EXPORT';

type PaymentRow = typeof payments.$inferSelect;

const money = (v: string | number | null | undefined) => roundMoney(Number(v ?? 0));
const loadCol = (side: PaymentSide) => (side === 'IMPORT' ? payments.importLoadId : payments.exportLoadId);

const paymentView = (p: PaymentRow, createdByName?: string | null) => ({
  id: p.id,
  date: p.date,
  amount: Number(p.amount),
  mode: p.mode,
  reference: p.reference,
  notes: p.notes,
  createdByName: createdByName ?? null,
  createdAt: p.createdAt,
});

/**
 * [OWNER-ONLY] Payments against loads, and statements per supplier / client.
 *
 * Every change re-sums the load's payments into import_financials.amount_paid (or
 * export_financials.amount_received) and re-derives payment_status in the same
 * transaction, so dashboards, accounts and reports keep reading one figure per load.
 */
@Injectable()
export class PaymentsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  /** The load's payments (newest first) with the bill amount, total paid, status and balance. */
  async list(actor: AuthUser, side: PaymentSide, loadId: string) {
    await this.findLoad(this.db, actor, side, loadId);
    return this.summary(this.db, side, loadId);
  }

  async create(actor: AuthUser, side: PaymentSide, loadId: string, dto: CreatePaymentDto) {
    const today = localToday(await millOffsetMinutes(this.db, actor.millId));
    if (dto.date > today) throw new BadRequestException('The payment date cannot be in the future');
    return this.db.transaction(async (tx) => {
      await this.findLoad(tx, actor, side, loadId, true);
      const [row] = await tx
        .insert(payments)
        .values({
          millId: actor.millId,
          importLoadId: side === 'IMPORT' ? loadId : null,
          exportLoadId: side === 'EXPORT' ? loadId : null,
          date: dto.date,
          amount: String(dto.amount),
          mode: dto.mode,
          reference: dto.reference || null,
          notes: dto.notes || null,
          createdById: actor.id,
        })
        .returning();
      await this.resync(tx, side, loadId);
      await this.audit.log({ millId: actor.millId, userId: actor.id, action: 'CREATE', entityType: 'Payment', entityId: row.id, after: row }, tx);
      return this.summary(tx, side, loadId);
    });
  }

  async remove(actor: AuthUser, side: PaymentSide, loadId: string, paymentId: string) {
    return this.db.transaction(async (tx) => {
      await this.findLoad(tx, actor, side, loadId, true);
      const [before] = await tx
        .select()
        .from(payments)
        .where(and(eq(payments.id, paymentId), eq(payments.millId, actor.millId), eq(loadCol(side), loadId)));
      if (!before) throw new NotFoundException('Payment not found');
      await tx.delete(payments).where(eq(payments.id, paymentId));
      await this.resync(tx, side, loadId);
      await this.audit.log({ millId: actor.millId, userId: actor.id, action: 'DELETE', entityType: 'Payment', entityId: paymentId, before }, tx);
      return this.summary(tx, side, loadId);
    });
  }

  /**
   * A supplier's or client's account: each APPROVED load with a bill amount is a BILL on its
   * arrival / export day, each payment against those loads a PAYMENT, with the running balance.
   * Totals match Accounts → outstanding balances for the same party.
   */
  async statement(actor: AuthUser, side: PaymentSide, partyId: string) {
    const party = side === 'IMPORT' ? suppliers : clients;
    const [p] = await this.db
      .select({ id: party.id, name: party.name, phone: party.phone, address: party.address, gstNumber: party.gstNumber })
      .from(party)
      .where(and(eq(party.id, partyId), eq(party.millId, actor.millId)));
    if (!p) throw new NotFoundException(side === 'IMPORT' ? 'Supplier not found' : 'Client not found');

    const offset = await millOffsetMinutes(this.db, actor.millId);
    const localDay = (d: Date) => localToday(offset, d.getTime());

    type Entry = {
      date: string;
      type: 'BILL' | 'PAYMENT';
      amount: number;
      loadId: string;
      loadCode: string;
      cft: number | null;
      mode: PaymentRow['mode'] | null;
      reference: string | null;
    };
    const entries: Entry[] = [];

    if (side === 'IMPORT') {
      const approvedForParty = and(eq(importLoads.millId, actor.millId), eq(importLoads.status, 'APPROVED'), eq(importFinancials.supplierId, partyId));
      const [bills, paid] = await Promise.all([
        this.db
          .select({ id: importLoads.id, code: importLoads.code, at: importLoads.arrivalAt, cft: importLoads.totalCft, amount: importFinancials.purchaseAmount })
          .from(importFinancials)
          .innerJoin(importLoads, eq(importLoads.id, importFinancials.importLoadId))
          .where(approvedForParty),
        this.db
          .select({ p: payments, code: importLoads.code })
          .from(payments)
          .innerJoin(importFinancials, eq(importFinancials.importLoadId, payments.importLoadId))
          .innerJoin(importLoads, eq(importLoads.id, payments.importLoadId))
          .where(approvedForParty),
      ]);
      for (const b of bills) {
        if (b.amount == null) continue;
        entries.push({ date: localDay(b.at), type: 'BILL', amount: money(b.amount), loadId: b.id, loadCode: b.code, cft: Number(b.cft), mode: null, reference: null });
      }
      for (const { p: row, code } of paid) {
        entries.push({ date: row.date, type: 'PAYMENT', amount: money(row.amount), loadId: row.importLoadId!, loadCode: code, cft: null, mode: row.mode, reference: row.reference });
      }
    } else {
      const approvedForParty = and(eq(exportLoads.millId, actor.millId), eq(exportLoads.status, 'APPROVED'), eq(exportFinancials.clientId, partyId));
      const [bills, paid] = await Promise.all([
        this.db
          .select({ id: exportLoads.id, code: exportLoads.code, date: exportLoads.exportDate, cft: exportLoads.totalCft, amount: exportFinancials.saleAmount })
          .from(exportFinancials)
          .innerJoin(exportLoads, eq(exportLoads.id, exportFinancials.exportLoadId))
          .where(approvedForParty),
        this.db
          .select({ p: payments, code: exportLoads.code })
          .from(payments)
          .innerJoin(exportFinancials, eq(exportFinancials.exportLoadId, payments.exportLoadId))
          .innerJoin(exportLoads, eq(exportLoads.id, payments.exportLoadId))
          .where(approvedForParty),
      ]);
      for (const b of bills) {
        if (b.amount == null) continue;
        entries.push({ date: b.date, type: 'BILL', amount: money(b.amount), loadId: b.id, loadCode: b.code, cft: Number(b.cft), mode: null, reference: null });
      }
      for (const { p: row, code } of paid) {
        entries.push({ date: row.date, type: 'PAYMENT', amount: money(row.amount), loadId: row.exportLoadId!, loadCode: code, cft: null, mode: row.mode, reference: row.reference });
      }
    }

    const rows = withRunningBalance(entries);
    const billed = roundMoney(entries.filter((e) => e.type === 'BILL').reduce((s, e) => s + e.amount, 0));
    const paidTotal = roundMoney(entries.filter((e) => e.type === 'PAYMENT').reduce((s, e) => s + e.amount, 0));
    return { party: p, entries: rows, totals: { billed, paid: paidTotal, balance: roundMoney(billed - paidTotal) } };
  }

  // ───────── helpers ─────────

  /** A load in the actor's mill (any status: advances before approval are allowed). */
  private async findLoad(db: DbOrTx, actor: AuthUser, side: PaymentSide, id: string, lock = false) {
    const table = side === 'IMPORT' ? importLoads : exportLoads;
    const query = db
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.id, id), eq(table.millId, actor.millId)))
      .limit(1);
    const [load] = lock ? await query.for('update') : await query;
    if (!load) throw new NotFoundException(side === 'IMPORT' ? 'Import load not found' : 'Export load not found');
    return load;
  }

  /** Re-sum the load's payments into its financials row (creating it if needed) and re-derive the status. */
  private async resync(tx: DbOrTx, side: PaymentSide, loadId: string) {
    const [{ total }] = await tx.select({ total: sum(payments.amount) }).from(payments).where(eq(loadCol(side), loadId));
    const paid = money(total);
    if (side === 'IMPORT') {
      const [f] = await tx.select({ amount: importFinancials.purchaseAmount }).from(importFinancials).where(eq(importFinancials.importLoadId, loadId));
      const values = { amountPaid: String(paid), paymentStatus: paymentStatusFor(f?.amount == null ? null : Number(f.amount), paid), updatedAt: new Date() };
      await tx.insert(importFinancials).values({ importLoadId: loadId, ...values }).onConflictDoUpdate({ target: importFinancials.importLoadId, set: values });
    } else {
      const [f] = await tx.select({ amount: exportFinancials.saleAmount }).from(exportFinancials).where(eq(exportFinancials.exportLoadId, loadId));
      const values = { amountReceived: String(paid), paymentStatus: paymentStatusFor(f?.amount == null ? null : Number(f.amount), paid), updatedAt: new Date() };
      await tx.insert(exportFinancials).values({ exportLoadId: loadId, ...values }).onConflictDoUpdate({ target: exportFinancials.exportLoadId, set: values });
    }
  }

  private async summary(db: DbOrTx, side: PaymentSide, loadId: string) {
    const [rows, bill] = await Promise.all([
      db
        .select({ p: payments, createdByName: users.name })
        .from(payments)
        .innerJoin(users, eq(users.id, payments.createdById))
        .where(eq(loadCol(side), loadId))
        .orderBy(desc(payments.date), desc(payments.createdAt), desc(payments.id)),
      side === 'IMPORT'
        ? db.select({ amount: importFinancials.purchaseAmount }).from(importFinancials).where(eq(importFinancials.importLoadId, loadId))
        : db.select({ amount: exportFinancials.saleAmount }).from(exportFinancials).where(eq(exportFinancials.exportLoadId, loadId)),
    ]);
    const items = rows.map((r) => paymentView(r.p, r.createdByName));
    const totalPaid = roundMoney(items.reduce((s, p) => s + p.amount, 0));
    const billAmount = bill[0]?.amount == null ? null : Number(bill[0].amount);
    return {
      items,
      billAmount,
      totalPaid,
      paymentStatus: paymentStatusFor(billAmount, totalPaid),
      balance: balanceDue(billAmount, totalPaid),
      /** paid beyond the bill, e.g. an advance carried to the next load */
      overpaid: billAmount != null && totalPaid > billAmount ? roundMoney(totalPaid - billAmount) : 0,
    };
  }
}

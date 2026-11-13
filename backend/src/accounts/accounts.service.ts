import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { roundTo } from '@sawmill/shared';
import { and, asc, count, desc, eq, gte, lt, lte, sql, sum } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service';
import { millOffsetMinutes, Period, PeriodQuery, resolvePeriod } from '../common/period';
import type { AuthUser } from '../common/types';
import { Database, DbOrTx, InjectDb } from '../db/db.module';
import { clients, expenses, exportFinancials, exportLoads, importFinancials, importLoads, suppliers, unloadingEntries, users } from '../db/schema';
import { CreateExpenseDto, ListExpensesQuery, UpdateExpenseDto } from './accounts.dto';

const money = (v: string | number | null | undefined) => roundTo(Number(v ?? 0), 2);
type ExpenseRow = typeof expenses.$inferSelect;

/**
 * [OWNER-ONLY] Accounts: other expenses (labour, electricity, diesel …), the
 * profit & loss for a period, and what is still owed to suppliers / by clients.
 *
 * Figures use the same rules as the owner dashboard: only APPROVED imports and
 * exports count. Purchases, transport and unloading belong to the import's
 * arrival day; sales to the export date; other expenses to their own date.
 */
@Injectable()
export class AccountsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async period(actor: AuthUser, q: PeriodQuery): Promise<Period> {
    return resolvePeriod(q, await millOffsetMinutes(this.db, actor.millId));
  }

  // ───────── expenses ─────────

  async listExpenses(actor: AuthUser, q: ListExpensesQuery) {
    const p = await this.period(actor, q);
    const where = and(eq(expenses.millId, actor.millId), gte(expenses.date, p.from), lte(expenses.date, p.to), q.category ? eq(expenses.category, q.category) : undefined);
    const [rows, [{ total, amount }], categories] = await Promise.all([
      this.db
        .select({ e: expenses, importCode: importLoads.code, createdByName: users.name })
        .from(expenses)
        .leftJoin(importLoads, eq(importLoads.id, expenses.importLoadId))
        .innerJoin(users, eq(users.id, expenses.createdById))
        .where(where)
        .orderBy(desc(expenses.date), desc(expenses.createdAt))
        .limit(q.take)
        .offset(q.skip),
      this.db.select({ total: count(), amount: sum(expenses.amount) }).from(expenses).where(where),
      // every category ever used, for suggestions
      this.db.selectDistinct({ category: expenses.category }).from(expenses).where(eq(expenses.millId, actor.millId)).orderBy(asc(expenses.category)),
    ]);
    return {
      period: { from: p.from, to: p.to },
      items: rows.map((r) => ({ ...this.view(r.e), importCode: r.importCode, createdByName: r.createdByName })),
      total,
      totalAmount: money(amount),
      categories: categories.map((c) => c.category),
      take: q.take,
      skip: q.skip,
    };
  }

  async createExpense(actor: AuthUser, dto: CreateExpenseDto) {
    return this.db.transaction(async (tx) => {
      if (dto.importLoadId) await this.checkLoad(tx, actor, dto.importLoadId);
      const [row] = await tx
        .insert(expenses)
        .values({
          millId: actor.millId,
          date: dto.date,
          category: dto.category,
          amount: String(dto.amount),
          importLoadId: dto.importLoadId ?? null,
          notes: dto.notes || null,
          createdById: actor.id,
        })
        .returning();
      await this.audit.log({ millId: actor.millId, userId: actor.id, action: 'CREATE', entityType: 'Expense', entityId: row.id, after: row }, tx);
      return this.view(row);
    });
  }

  async updateExpense(actor: AuthUser, id: string, dto: UpdateExpenseDto) {
    return this.db.transaction(async (tx) => {
      const before = await this.findExpense(tx, actor, id);
      if (dto.importLoadId) await this.checkLoad(tx, actor, dto.importLoadId);
      const [after] = await tx
        .update(expenses)
        .set({
          date: dto.date,
          category: dto.category,
          amount: dto.amount == null ? undefined : String(dto.amount),
          importLoadId: dto.importLoadId === undefined ? undefined : dto.importLoadId,
          notes: dto.notes === undefined ? undefined : dto.notes || null,
          updatedAt: new Date(),
        })
        .where(eq(expenses.id, id))
        .returning();
      await this.audit.log({ millId: actor.millId, userId: actor.id, action: 'UPDATE', entityType: 'Expense', entityId: id, before, after }, tx);
      return this.view(after);
    });
  }

  async removeExpense(actor: AuthUser, id: string) {
    await this.db.transaction(async (tx) => {
      const before = await this.findExpense(tx, actor, id);
      await tx.delete(expenses).where(eq(expenses.id, id));
      await this.audit.log({ millId: actor.millId, userId: actor.id, action: 'DELETE', entityType: 'Expense', entityId: id, before }, tx);
    });
  }

  // ───────── summary ─────────

  /** Profit & loss for the period, plus everything still unpaid (all time). */
  async summary(actor: AuthUser, q: PeriodQuery) {
    const p = await this.period(actor, q);
    const [pnl, payables, receivables] = await Promise.all([this.profitAndLoss(actor.millId, p), this.payables(actor.millId), this.receivables(actor.millId)]);
    return { period: { from: p.from, to: p.to }, pnl, payables, receivables };
  }

  async profitAndLoss(millId: string, p: Period) {
    const importsIn = and(eq(importLoads.millId, millId), eq(importLoads.status, 'APPROVED'), gte(importLoads.arrivalAt, p.start), lt(importLoads.arrivalAt, p.end));
    const [[sales], [purchases], [unloading], byCategory] = await Promise.all([
      this.db
        .select({ amount: sum(exportFinancials.saleAmount), received: sum(exportFinancials.amountReceived) })
        .from(exportFinancials)
        .innerJoin(exportLoads, eq(exportLoads.id, exportFinancials.exportLoadId))
        .where(and(eq(exportLoads.millId, millId), eq(exportLoads.status, 'APPROVED'), gte(exportLoads.exportDate, p.from), lte(exportLoads.exportDate, p.to))),
      this.db
        .select({ amount: sum(importFinancials.purchaseAmount), transport: sum(importFinancials.transportCharges), paid: sum(importFinancials.amountPaid) })
        .from(importFinancials)
        .innerJoin(importLoads, eq(importLoads.id, importFinancials.importLoadId))
        .where(importsIn),
      this.db.select({ amount: sum(unloadingEntries.totalCharges) }).from(unloadingEntries).innerJoin(importLoads, eq(importLoads.id, unloadingEntries.importLoadId)).where(importsIn),
      this.db
        .select({ category: expenses.category, amount: sum(expenses.amount) })
        .from(expenses)
        .where(and(eq(expenses.millId, millId), gte(expenses.date, p.from), lte(expenses.date, p.to)))
        .groupBy(expenses.category)
        .orderBy(desc(sum(expenses.amount))),
    ]);
    const otherExpenses = byCategory.map((c) => ({ category: c.category, amount: money(c.amount) }));
    const other = money(otherExpenses.reduce((s, c) => s + c.amount, 0));
    const totalExpenses = money(money(purchases?.amount) + money(purchases?.transport) + money(unloading?.amount) + other);
    return {
      sales: money(sales?.amount),
      purchases: money(purchases?.amount),
      transport: money(purchases?.transport),
      unloading: money(unloading?.amount),
      otherExpenses,
      totalOtherExpenses: other,
      totalExpenses,
      profit: money(money(sales?.amount) - totalExpenses),
    };
  }

  /** Per supplier: purchase amount, paid, balance — approved imports, all time, only where something is owed. */
  async payables(millId: string) {
    const rows = await this.db
      .select({
        supplierId: importFinancials.supplierId,
        name: suppliers.name,
        loads: count(),
        amount: sum(importFinancials.purchaseAmount),
        paid: sum(importFinancials.amountPaid),
      })
      .from(importFinancials)
      .innerJoin(importLoads, eq(importLoads.id, importFinancials.importLoadId))
      .leftJoin(suppliers, eq(suppliers.id, importFinancials.supplierId))
      .where(and(eq(importLoads.millId, millId), eq(importLoads.status, 'APPROVED')))
      .groupBy(importFinancials.supplierId, suppliers.name)
      .having(sql`coalesce(sum(${importFinancials.purchaseAmount}), 0) - coalesce(sum(${importFinancials.amountPaid}), 0) <> 0`);
    return rows
      .map((r) => ({ id: r.supplierId, name: r.name, loads: r.loads, amount: money(r.amount), paid: money(r.paid), balance: money(money(r.amount) - money(r.paid)) }))
      .sort((a, b) => b.balance - a.balance);
  }

  /** Per client: sale amount, received, balance — approved exports, all time, only where something is due. */
  async receivables(millId: string) {
    const rows = await this.db
      .select({
        clientId: exportFinancials.clientId,
        name: clients.name,
        loads: count(),
        amount: sum(exportFinancials.saleAmount),
        received: sum(exportFinancials.amountReceived),
      })
      .from(exportFinancials)
      .innerJoin(exportLoads, eq(exportLoads.id, exportFinancials.exportLoadId))
      .leftJoin(clients, eq(clients.id, exportFinancials.clientId))
      .where(and(eq(exportLoads.millId, millId), eq(exportLoads.status, 'APPROVED')))
      .groupBy(exportFinancials.clientId, clients.name)
      .having(sql`coalesce(sum(${exportFinancials.saleAmount}), 0) - coalesce(sum(${exportFinancials.amountReceived}), 0) <> 0`);
    return rows
      .map((r) => ({ id: r.clientId, name: r.name, loads: r.loads, amount: money(r.amount), received: money(r.received), balance: money(money(r.amount) - money(r.received)) }))
      .sort((a, b) => b.balance - a.balance);
  }

  // ───────── helpers ─────────

  private view(e: ExpenseRow) {
    return { id: e.id, date: e.date, category: e.category, amount: Number(e.amount), importLoadId: e.importLoadId, notes: e.notes, createdAt: e.createdAt };
  }

  private async findExpense(tx: DbOrTx, actor: AuthUser, id: string) {
    const [row] = await tx
      .select()
      .from(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.millId, actor.millId)))
      .for('update');
    if (!row) throw new NotFoundException('Expense not found');
    return row;
  }

  private async checkLoad(tx: DbOrTx, actor: AuthUser, id: string) {
    const [load] = await tx.select({ id: importLoads.id }).from(importLoads).where(and(eq(importLoads.id, id), eq(importLoads.millId, actor.millId)));
    if (!load) throw new BadRequestException('Import load not found');
  }
}

/**
 * Reports: one definition per report (columns + rows), rendered as JSON for the
 * screen / print view and as an Excel file. Labels are translated here with the
 * shared EN/TA dictionary, so a download matches the language on screen.
 *
 * Operational reports never contain prices. Registers default to APPROVED
 * entries (the official figures); an accountant only ever sees their own entries,
 * the same rule as everywhere else.
 */
import { ForbiddenException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { hasPermission, Lang, Permission, recoveryPercent, roundTo, sizeLabel, TKey, translate } from '@sawmill/shared';
import ExcelJS from 'exceljs';
import { and, asc, eq, gte, lt, lte, SQL, sum } from 'drizzle-orm';
import { AccountsService } from '../accounts/accounts.service';
import { AuditService } from '../audit/audit.service';
import { millOffsetMinutes, Period, resolvePeriod } from '../common/period';
import type { AuthUser } from '../common/types';
import { Database, InjectDb } from '../db/db.module';
import { expenses, exportLoads, importLoads, mills, productionRuns, stockMovements, users } from '../db/schema';

export type ColType = 'text' | 'date' | 'datetime' | 'int' | 'cft' | 'money' | 'percent';
type Row = Record<string, string | number | null>;
interface ColumnDef {
  key: string;
  label: TKey;
  type: ColType;
  /** add up in the totals row */
  total?: boolean;
}

export const REPORT_KEYS = ['imports', 'production', 'exports', 'stock', 'pnl', 'payables', 'receivables', 'expenses'] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];

interface Ctx {
  actor: AuthUser;
  period: Period;
  /** APPROVED (default) or every status */
  approvedOnly: boolean;
  t: (key: TKey) => string;
}
interface ReportDef {
  title: TKey;
  group: 'operational' | 'financial';
  /** false = a snapshot "as of now" (stock, balances) */
  periodic: boolean;
  /** shows the Approved only / All entries switch */
  statusFilter: boolean;
  columns: ColumnDef[];
  rows: (ctx: Ctx) => Promise<Row[]>;
}

export interface ReportQuery {
  from?: string;
  to?: string;
  status?: 'APPROVED' | 'ALL';
  lang?: Lang;
}

const STATUS_KEY: Record<string, TKey> = { DRAFT: 'draft', SUBMITTED: 'pending', APPROVED: 'approved', REJECTED: 'rejected' };
const n = (v: string | number | null | undefined) => (v == null ? null : Number(v));

/** Upper bound for one report (screen or Excel), so a 5-year register can't exhaust memory. */
export const MAX_REPORT_ROWS = 20_000;

@Injectable()
export class ReportsService {
  private readonly defs: Record<ReportKey, ReportDef>;

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly accounts: AccountsService,
    private readonly audit: AuditService,
  ) {
    this.defs = {
      imports: {
        title: 'reportImports',
        group: 'operational',
        periodic: true,
        statusFilter: true,
        columns: [
          { key: 'code', label: 'importId', type: 'text' },
          { key: 'arrivalAt', label: 'arrival', type: 'datetime' },
          { key: 'lorryNumber', label: 'lorry', type: 'text' },
          { key: 'woodType', label: 'woodType', type: 'text' },
          { key: 'totalLogs', label: 'logs', type: 'int', total: true },
          { key: 'totalCft', label: 'totalCft', type: 'cft', total: true },
          { key: 'status', label: 'status', type: 'text' },
          { key: 'createdBy', label: 'createdBy', type: 'text' },
        ],
        rows: async ({ actor, period, approvedOnly, t }) => {
          const rows = await this.db
            .select({ i: importLoads, createdBy: users.name })
            .from(importLoads)
            .innerJoin(users, eq(users.id, importLoads.createdById))
            .where(and(...this.scope(actor, importLoads, approvedOnly), gte(importLoads.arrivalAt, period.start), lt(importLoads.arrivalAt, period.end)))
            .orderBy(asc(importLoads.arrivalAt));
          return rows.map(({ i, createdBy }) => ({
            code: i.code,
            arrivalAt: i.arrivalAt.toISOString(),
            lorryNumber: i.lorryNumber,
            woodType: i.woodType,
            totalLogs: i.totalLogs,
            totalCft: Number(i.totalCft),
            status: t(STATUS_KEY[i.status]),
            createdBy,
          }));
        },
      },
      production: {
        title: 'reportProduction',
        group: 'operational',
        periodic: true,
        statusFilter: true,
        columns: [
          { key: 'code', label: 'productionId', type: 'text' },
          { key: 'productionDate', label: 'date', type: 'date' },
          { key: 'importCode', label: 'importId', type: 'text' },
          { key: 'woodType', label: 'woodType', type: 'text' },
          { key: 'inputCft', label: 'inputCft', type: 'cft', total: true },
          { key: 'outputCft', label: 'outputCft', type: 'cft', total: true },
          { key: 'wasteCft', label: 'wasteCft', type: 'cft', total: true },
          { key: 'recovery', label: 'recovery', type: 'percent' },
          { key: 'status', label: 'status', type: 'text' },
        ],
        rows: async ({ actor, period, approvedOnly, t }) => {
          const rows = await this.db
            .select({ r: productionRuns, importCode: importLoads.code })
            .from(productionRuns)
            .innerJoin(importLoads, eq(importLoads.id, productionRuns.importLoadId))
            .where(and(...this.scope(actor, productionRuns, approvedOnly), gte(productionRuns.productionDate, period.from), lte(productionRuns.productionDate, period.to)))
            .orderBy(asc(productionRuns.productionDate), asc(productionRuns.code));
          return rows.map(({ r, importCode }) => ({
            code: r.code,
            productionDate: r.productionDate,
            importCode,
            woodType: r.woodType,
            inputCft: n(r.inputCft),
            outputCft: Number(r.outputCft),
            wasteCft: n(r.wasteCft),
            recovery: recoveryPercent(n(r.inputCft), Number(r.outputCft)),
            status: t(STATUS_KEY[r.status]),
          }));
        },
      },
      exports: {
        title: 'reportExports',
        group: 'operational',
        periodic: true,
        statusFilter: true,
        columns: [
          { key: 'code', label: 'exportId', type: 'text' },
          { key: 'exportDate', label: 'date', type: 'date' },
          { key: 'lorryNumber', label: 'lorry', type: 'text' },
          { key: 'woodType', label: 'woodType', type: 'text' },
          { key: 'totalPieces', label: 'pieces', type: 'int', total: true },
          { key: 'totalCft', label: 'totalCft', type: 'cft', total: true },
          { key: 'status', label: 'status', type: 'text' },
          { key: 'createdBy', label: 'createdBy', type: 'text' },
        ],
        rows: async ({ actor, period, approvedOnly, t }) => {
          const rows = await this.db
            .select({ e: exportLoads, createdBy: users.name })
            .from(exportLoads)
            .innerJoin(users, eq(users.id, exportLoads.createdById))
            .where(and(...this.scope(actor, exportLoads, approvedOnly), gte(exportLoads.exportDate, period.from), lte(exportLoads.exportDate, period.to)))
            .orderBy(asc(exportLoads.exportDate), asc(exportLoads.code));
          return rows.map(({ e, createdBy }) => ({
            code: e.code,
            exportDate: e.exportDate,
            lorryNumber: e.lorryNumber,
            woodType: e.woodType,
            totalPieces: e.totalPieces,
            totalCft: Number(e.totalCft),
            status: t(STATUS_KEY[e.status]),
            createdBy,
          }));
        },
      },
      stock: {
        title: 'reportStock',
        group: 'operational',
        periodic: false,
        statusFilter: false,
        columns: [
          { key: 'kind', label: 'stockKind', type: 'text' },
          { key: 'woodType', label: 'woodType', type: 'text' },
          { key: 'size', label: 'size', type: 'text' },
          { key: 'importCode', label: 'importId', type: 'text' },
          { key: 'pieces', label: 'pieces', type: 'int' },
          { key: 'cft', label: 'inStock', type: 'cft', total: true },
        ],
        rows: async ({ actor, t }) => {
          const rows = await this.db
            .select({
              kind: stockMovements.kind,
              woodType: stockMovements.woodType,
              thicknessIn: stockMovements.thicknessIn,
              widthIn: stockMovements.widthIn,
              lengthFt: stockMovements.lengthFt,
              importCode: importLoads.code,
              pieces: sum(stockMovements.piecesDelta),
              cft: sum(stockMovements.cftDelta),
            })
            .from(stockMovements)
            .innerJoin(importLoads, eq(importLoads.id, stockMovements.importLoadId))
            .where(eq(stockMovements.millId, actor.millId))
            .groupBy(stockMovements.kind, stockMovements.woodType, stockMovements.thicknessIn, stockMovements.widthIn, stockMovements.lengthFt, importLoads.code)
            .orderBy(asc(stockMovements.kind), asc(stockMovements.woodType), asc(stockMovements.thicknessIn), asc(stockMovements.widthIn), asc(stockMovements.lengthFt), asc(importLoads.code));
          return rows
            .map((r) => ({
              kind: t(r.kind === 'RAW' ? 'raw' : 'finished'),
              woodType: r.woodType,
              size: r.thicknessIn == null ? '—' : sizeLabel(Number(r.thicknessIn), Number(r.widthIn), Number(r.lengthFt)),
              importCode: r.importCode,
              pieces: Number(r.pieces ?? 0),
              cft: roundTo(Number(r.cft ?? 0)),
            }))
            .filter((r) => r.pieces !== 0 || r.cft !== 0);
        },
      },
      pnl: {
        title: 'reportPnl',
        group: 'financial',
        periodic: true,
        statusFilter: false,
        columns: [
          { key: 'item', label: 'item', type: 'text' },
          { key: 'amount', label: 'amount', type: 'money' },
        ],
        rows: async ({ actor, period, t }) => {
          const p = await this.accounts.profitAndLoss(actor.millId, period);
          return [
            { item: t('sales'), amount: p.sales },
            { item: t('purchases'), amount: -p.purchases },
            { item: t('transport'), amount: -p.transport },
            { item: t('unloadingCharges'), amount: -p.unloading },
            ...p.otherExpenses.map((e) => ({ item: `${t('otherExpenses')}: ${e.category}`, amount: -e.amount })),
            { item: t('totalExpenses'), amount: -p.totalExpenses },
            { item: t('profitLoss'), amount: p.profit },
          ];
        },
      },
      payables: {
        title: 'reportPayables',
        group: 'financial',
        periodic: false,
        statusFilter: false,
        columns: [
          { key: 'name', label: 'supplier', type: 'text' },
          { key: 'loads', label: 'loadsHeader', type: 'int', total: true },
          { key: 'amount', label: 'purchaseAmount', type: 'money', total: true },
          { key: 'paid', label: 'amountPaid', type: 'money', total: true },
          { key: 'balance', label: 'balance', type: 'money', total: true },
        ],
        rows: async ({ actor, t }) =>
          (await this.accounts.payables(actor.millId)).map((r) => ({ name: r.name ?? t('noSupplierName'), loads: r.loads, amount: r.amount, paid: r.paid, balance: r.balance })),
      },
      receivables: {
        title: 'reportReceivables',
        group: 'financial',
        periodic: false,
        statusFilter: false,
        columns: [
          { key: 'name', label: 'client', type: 'text' },
          { key: 'loads', label: 'loadsHeader', type: 'int', total: true },
          { key: 'amount', label: 'saleAmount', type: 'money', total: true },
          { key: 'received', label: 'amountReceived', type: 'money', total: true },
          { key: 'balance', label: 'balance', type: 'money', total: true },
        ],
        rows: async ({ actor, t }) =>
          (await this.accounts.receivables(actor.millId)).map((r) => ({ name: r.name ?? t('noClientName'), loads: r.loads, amount: r.amount, received: r.received, balance: r.balance })),
      },
      expenses: {
        title: 'reportExpenses',
        group: 'financial',
        periodic: true,
        statusFilter: false,
        columns: [
          { key: 'date', label: 'date', type: 'date' },
          { key: 'category', label: 'category', type: 'text' },
          { key: 'importCode', label: 'importId', type: 'text' },
          { key: 'notes', label: 'notes', type: 'text' },
          { key: 'amount', label: 'amount', type: 'money', total: true },
        ],
        rows: async ({ actor, period }) => {
          const rows = await this.db
            .select({ e: expenses, importCode: importLoads.code })
            .from(expenses)
            .leftJoin(importLoads, eq(importLoads.id, expenses.importLoadId))
            .where(and(eq(expenses.millId, actor.millId), gte(expenses.date, period.from), lte(expenses.date, period.to)))
            .orderBy(asc(expenses.date), asc(expenses.category));
          return rows.map(({ e, importCode }) => ({ date: e.date, category: e.category, importCode, notes: e.notes, amount: Number(e.amount) }));
        },
      },
    };
  }

  /** The reports this user may run, for the Reports page. */
  list(actor: AuthUser, lang: Lang = 'en') {
    const t = (k: TKey) => translate(lang, k);
    return REPORT_KEYS.filter((k) => this.allowed(actor, this.defs[k])).map((key) => {
      const d = this.defs[key];
      return { key, title: t(d.title), group: d.group, periodic: d.periodic, statusFilter: d.statusFilter };
    });
  }

  /** Run a report: columns (translated), rows, totals. */
  async run(actor: AuthUser, key: string, q: ReportQuery) {
    // own keys only — "constructor" or "__proto__" must not reach Object.prototype
    if (!(REPORT_KEYS as readonly string[]).includes(key)) throw new NotFoundException('Report not found');
    const def = this.defs[key as ReportKey];
    if (!this.allowed(actor, def)) throw new ForbiddenException('You do not have access to this report');
    const lang = q.lang ?? 'en';
    const t = (k: TKey) => translate(lang, k);
    const [period, [mill]] = await Promise.all([
      millOffsetMinutes(this.db, actor.millId).then((off) => resolvePeriod(q, off)),
      this.db.select({ name: mills.name }).from(mills).where(eq(mills.id, actor.millId)),
    ]);
    const approvedOnly = q.status !== 'ALL';
    const rows = await def.rows({ actor, period, approvedOnly, t });
    if (rows.length > MAX_REPORT_ROWS) {
      throw new PayloadTooLargeException(`This report has more than ${MAX_REPORT_ROWS.toLocaleString('en-IN')} rows. Choose a shorter period.`);
    }
    const totals: Record<string, number> = {};
    for (const c of def.columns.filter((c) => c.total)) {
      const s = rows.reduce((acc, r) => acc + (typeof r[c.key] === 'number' ? (r[c.key] as number) : 0), 0);
      totals[c.key] = c.type === 'money' ? roundTo(s, 2) : c.type === 'cft' ? roundTo(s) : s;
    }
    return {
      key,
      title: t(def.title),
      millName: mill?.name ?? '',
      group: def.group,
      periodic: def.periodic,
      statusFilter: def.statusFilter,
      period: def.periodic ? { from: period.from, to: period.to } : null,
      approvedOnly: def.statusFilter ? approvedOnly : null,
      generatedAt: new Date().toISOString(),
      columns: def.columns.map((c) => ({ key: c.key, label: t(c.label), type: c.type, total: !!c.total })),
      rows,
      totals,
      totalLabel: t('total'),
    };
  }

  /** The same report as an .xlsx workbook. */
  async excel(actor: AuthUser, key: string, q: ReportQuery): Promise<{ filename: string; buffer: Buffer }> {
    const r = await this.run(actor, key, q);
    if (r.group === 'financial') {
      // money leaving the system as a file is worth a line in the audit log
      await this.audit.log({ millId: actor.millId, userId: actor.id, action: 'DOWNLOAD_REPORT', entityType: 'Report', entityId: key, after: { period: r.period } });
    }
    const t = (k: TKey) => translate(q.lang ?? 'en', k);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SAWMILL PRO';
    wb.created = new Date();
    const ws = wb.addWorksheet(r.title.slice(0, 31), { views: [{ state: 'frozen', ySplit: 5 }] });

    ws.addRow([r.millName]).font = { bold: true, size: 14 };
    ws.addRow([r.title]).font = { bold: true, size: 12 };
    const meta: string[] = [];
    if (r.period) meta.push(`${t('period')}: ${r.period.from} – ${r.period.to}`);
    if (r.approvedOnly != null) meta.push(t(r.approvedOnly ? 'approvedOnly' : 'allEntries'));
    meta.push(`${t('generatedOn')}: ${new Date(r.generatedAt).toISOString().slice(0, 16).replace('T', ' ')} UTC`);
    ws.addRow([meta.join(' · ')]).font = { color: { argb: 'FF666666' } };
    ws.addRow([]);

    const header = ws.addRow(r.columns.map((c) => c.label));
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4332' } };
    });

    const FORMAT: Partial<Record<ColType, string>> = { int: '#,##0', cft: '#,##0.000', money: '#,##0.00', percent: '0.0"%"', date: 'dd-mmm-yyyy', datetime: 'dd-mmm-yyyy hh:mm' };
    for (const row of r.rows) {
      ws.addRow(
        r.columns.map((c) => {
          const v = row[c.key];
          if (v == null) return null;
          if (c.type === 'date') return new Date(`${v}T00:00:00Z`);
          if (c.type === 'datetime') return new Date(String(v));
          return v;
        }),
      );
    }
    if (Object.keys(r.totals).length) {
      const totalRow = ws.addRow(r.columns.map((c, i) => (i === 0 ? r.totalLabel : (r.totals[c.key] ?? null))));
      totalRow.font = { bold: true };
      totalRow.eachCell((cell) => {
        cell.border = { top: { style: 'thin' } };
      });
    }

    r.columns.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      if (FORMAT[c.type]) col.numFmt = FORMAT[c.type]!;
      const longest = Math.max(c.label.length, ...r.rows.map((row) => String(row[c.key] ?? '').length));
      col.width = Math.min(Math.max(longest + 2, c.type === 'datetime' ? 18 : 10), 50);
    });

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const stamp = r.period ? `${r.period.from}_${r.period.to}` : new Date().toISOString().slice(0, 10);
    return { filename: `${key}_${stamp}.xlsx`, buffer };
  }

  // ───────── helpers ─────────

  private allowed(actor: AuthUser, def: ReportDef) {
    return hasPermission(actor.role, def.group === 'financial' ? Permission.REPORTS_FINANCIAL : Permission.REPORTS_OPERATIONAL);
  }

  /** Mill + (approved only) + (own entries for accountants). */
  private scope(actor: AuthUser, t: typeof importLoads | typeof productionRuns | typeof exportLoads, approvedOnly: boolean): SQL[] {
    const c: SQL[] = [eq(t.millId, actor.millId)];
    if (approvedOnly) c.push(eq(t.status, 'APPROVED'));
    if (!hasPermission(actor.role, Permission.OPERATIONS_VIEW_ALL)) c.push(eq(t.createdById, actor.id));
    return c;
  }
}

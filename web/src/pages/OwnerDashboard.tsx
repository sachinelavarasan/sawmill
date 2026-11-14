import { Permission } from '@sawmill/shared';
import {
  ActivityIcon,
  AlertTriangleIcon,
  ArrowDownLeftIcon,
  ArrowDownToLineIcon,
  ArrowUpFromLineIcon,
  ArrowUpRightIcon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  FactoryIcon,
  FileDownIcon,
  GaugeIcon,
  IndianRupeeIcon,
  LayersIcon,
  LogInIcon,
  type LucideIcon,
  PackageIcon,
  PencilIcon,
  PlusIcon,
  ReceiptTextIcon,
  RefreshCwIcon,
  RulerIcon,
  ScissorsIcon,
  SendIcon,
  ShoppingCartIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  TrendingDownIcon,
  TrendingUpIcon,
  WalletIcon,
  XCircleIcon,
} from 'lucide-react';
import { ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { api } from '../api';
import { useAuth } from '../auth';
import { ChartCard, ColumnChart, LineChart, Sparkline, StackedBars } from '../components/charts';
import { Reveal } from '../components/depth';
import { dateTime, money, num3, useLoad } from '../components/common';
import { LinkRow, LoadState, numCell, OwnerOnly, Page, PageHeader, Section, Stat, StatGrid, TableCard, useClientPaging, wide } from '../components/page';
import { periodQuery, type PeriodValue, presets } from '../components/period';
import { QuickActions } from '../components/quick-actions';
import { StatusBadge } from '../components/status-badge';
import { type TKey, useI18n } from '../i18n';
import { type ApprovalItem, type ApprovalQueue, KINDS, PAGE_PATH } from './Approvals';
import { ACTIONS, ENTITIES, recordName } from './AuditLog';
import type { ImportSummary } from './Imports';
import type { ProductionSummary } from './Production';

// ───────── what the dashboard reads (all existing endpoints; nothing here is invented) ─────────

interface OwnerDashboardData {
  kpis: {
    totalImportLoads: number;
    totalExportLoads: number;
    rawStockCft: number;
    finishedStockCft: number;
    todayImports: number;
    todayExports: number;
    pendingApprovals: number;
    totalSales: number;
    totalExpenses: number;
    pendingReceivables: number;
    pendingPayables: number;
    profitLoss: number;
  };
  accountantActivity: {
    accountantId: string;
    accountantName: string;
    isActive: boolean;
    lastEntryType: string | null;
    lastEntryAt: string | null;
    logsMeasured: number;
    totalCft: number;
    draftEntries: number;
    pendingEntries: number;
    approvedEntries: number;
    rejectedEntries: number;
  }[];
}
/** The profit-and-loss figures /accounts/summary gives for any period. */
interface Pnl {
  sales: number;
  purchases: number;
  totalExpenses: number;
  profit: number;
}
interface OwnerCharts {
  flow: { day: string; receivedCft: number; shippedCft: number }[];
  stockByWood: { woodType: string; rawCft: number; finishedCft: number }[];
  cash: { month: string; sales: number; expenses: number }[];
}
interface Movement {
  id: string;
  createdAt: string;
  kind: 'RAW' | 'FINISHED';
  woodType: string;
  cftDelta: number;
  source: 'IMPORT' | 'PRODUCTION_INPUT' | 'PRODUCTION_OUTPUT' | 'EXPORT' | 'ADJUSTMENT';
  sourceId: string;
  sourceCode: string;
}
interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  notes: string | null;
}

export const shortDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const shortMonth = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
const rupeesCompact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 });

/** Dates as the mill's local calendar days (YYYY-MM-DD), and simple day arithmetic on them. */
const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + n);
  return iso(d);
};
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`)) / 86_400_000) + 1;
/** The period just before `p`, of the same length: what "vs previous period" compares against. */
const previousOf = (p: PeriodValue): PeriodValue => {
  const len = daysBetween(p.from, p.to);
  const to = addDays(p.from, -1);
  return { from: addDays(to, -(len - 1)), to };
};
/** The Monday that starts the week holding `day`. */
const weekStart = (day: string) => {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
};

/** The periods the dashboard offers; the figures and comparisons follow the one chosen. */
const PERIODS = ['thisMonth', 'lastMonth', 'thisQuarter', 'thisYear'] as const;
type PeriodKey = (typeof PERIODS)[number];
/** How many months the monthly charts cover, and how many weeks the production charts cover. */
const MONTHS = 6;
const WEEKS = 12;
/** Approved runs read for the production figures: the newest, enough for twelve weeks at any mill this size. */
const RUN_SCAN = 200;

const QUEUE_PREVIEW = 4;
const LIST_PREVIEW = 5;
const kindKey = Object.fromEntries(KINDS);
const queueCft = (i: ApprovalItem) => (i.type === 'PRODUCTION' ? i.outputCft : i.type === 'ADJUSTMENT' ? i.cftDelta : i.totalCft);

// ───────── recent activity (from the audit log) ─────────

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
  user: { name: string } | null;
}
/** Sign-ins and token housekeeping are in the audit log, but they aren't mill activity. */
const SESSION_NOISE = /^(LOGIN|LOGOUT|REFRESH)/;
/** How far back to look: the most the API gives at once, since sign-ins can crowd a short page out. */
const ACTIVITY_SCAN = 200;
const ACTION_ICON: Record<string, LucideIcon> = {
  CREATE: PlusIcon,
  UPDATE: PencilIcon,
  OWNER_EDIT: PencilIcon,
  DELETE: Trash2Icon,
  SUBMIT: SendIcon,
  APPROVE: CheckCircle2Icon,
  REJECT: XCircleIcon,
  DOWNLOAD_REPORT: FileDownIcon,
  RESET_PASSWORD: LogInIcon,
};
/** For codes the app has no words for: 'OWNER_EDIT' → 'Owner edit', 'ImportLoad' → 'Import load' */
const readable = (code: string) => {
  const words = code.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const MOVE_LABEL: Record<Movement['source'], TKey> = {
  IMPORT: 'srcImport',
  PRODUCTION_INPUT: 'srcProductionIn',
  PRODUCTION_OUTPUT: 'srcProductionOut',
  EXPORT: 'srcExport',
  ADJUSTMENT: 'srcAdjustment',
};
const MOVE_ICON: Record<Movement['source'], LucideIcon> = {
  IMPORT: ArrowDownToLineIcon,
  PRODUCTION_INPUT: ScissorsIcon,
  PRODUCTION_OUTPUT: PackageIcon,
  EXPORT: ArrowUpFromLineIcon,
  ADJUSTMENT: SlidersHorizontalIcon,
};
const MOVE_PATH: Partial<Record<Movement['source'], (id: string) => string>> = {
  IMPORT: (id) => `/imports/${id}`,
  PRODUCTION_INPUT: (id) => `/production/${id}`,
  PRODUCTION_OUTPUT: (id) => `/production/${id}`,
  EXPORT: (id) => `/exports/${id}`,
  ADJUSTMENT: () => '/stock?tab=adjustments',
};

// ───────── building blocks ─────────

/** A titled card: the same frame as a chart card, for lists and small summaries. */
export function Panel({ title, tools, children, className, flush }: { title: ReactNode; tools?: ReactNode; children: ReactNode; className?: string; /** content runs edge to edge (a table or list) */ flush?: boolean }) {
  return (
    <Card className={cn('min-w-0 gap-4 py-6', flush && 'pb-0', className)}>
      <CardHeader className="flex min-h-8 flex-row items-center justify-between gap-3 px-5 sm:px-6">
        <CardTitle className="flex min-w-0 items-center gap-2 text-base">{title}</CardTitle>
        {tools}
      </CardHeader>
      <CardContent className={cn('flex flex-1 flex-col', flush ? 'px-0' : 'px-5 sm:px-6')}>{children}</CardContent>
    </Card>
  );
}

/** One line of an operational list: an icon tile, what it is, a second line, and a figure on the right. */
function ListLine({ to, icon, tone, primary, secondary, value }: { to?: string; icon: ReactNode; tone?: string; primary: ReactNode; secondary?: ReactNode; value?: ReactNode }) {
  const body = (
    <>
      <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg [&_svg]:size-4', tone ?? 'bg-muted text-muted-foreground')} aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.8125rem] font-semibold">{primary}</span>
        {secondary && <span className="block truncate text-xs text-muted-foreground">{secondary}</span>}
      </span>
      {value != null && <span className="shrink-0 text-right text-[0.8125rem] font-semibold tabular-nums">{value}</span>}
    </>
  );
  const cls = 'flex items-center gap-3 px-5 py-3 sm:px-6';
  return (
    <li>
      {to ? (
        <Link to={to} className={cn(cls, 'transition-colors duration-200 outline-none hover:bg-muted/50 focus-visible:bg-muted/60')}>
          {body}
        </Link>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  );
}

/** A panel holding a short list, with a link to the full page, and a quiet line when there is nothing. */
function ListPanel({ title, icon, to, loading, empty, children }: { title: string; icon: ReactNode; to: string; loading: boolean; empty: boolean; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <Panel
      flush
      title={
        <>
          <span className="text-muted-foreground [&_svg]:size-[1.125rem]">{icon}</span>
          {title}
        </>
      }
      tools={
        <Button asChild variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground">
          <Link to={to}>{t('viewAll')}</Link>
        </Button>
      }
    >
      {empty ? (
        <p className="grid flex-1 place-items-center px-5 pt-2 pb-8 text-sm text-muted-foreground">{loading ? t('loading') : t('noData')}</p>
      ) : (
        <ul className="divide-y divide-border/70 border-t border-border/70 pb-1">{children}</ul>
      )}
    </Panel>
  );
}

/** Something that needs the owner, with the way to it. Only things the data shows are ever raised. */
interface Alert {
  key: string;
  tone: 'warn' | 'bad' | 'info';
  icon: LucideIcon;
  title: string;
  sub: string;
  to: string;
}
const ALERT_TONE: Record<Alert['tone'], string> = {
  warn: 'bg-warning-soft text-warning',
  bad: 'bg-destructive-soft text-destructive',
  info: 'bg-info-soft text-info',
};

// ───────── the dashboard ─────────

export function OwnerDashboard() {
  const { t, lang } = useI18n();
  const { user, can } = useAuth();
  const canFinance = can(Permission.FINANCE_VIEW);
  const canAudit = can(Permission.AUDIT_VIEW);
  const locale = lang === 'ta' ? 'ta-IN' : 'en-IN';
  const todayIso = iso(new Date());

  // the period every figure and comparison follows
  const [periodKey, setPeriodKey] = useState<PeriodKey>('thisMonth');
  const period = presets()[periodKey];
  const prev = previousOf(period);
  const pq = periodQuery(period);
  const prevQ = periodQuery(prev);

  // standing figures: stock, balances, the accountants
  const { data, loading, error, reload } = useLoad(() => api<OwnerDashboardData>('/dashboard/owner'));
  const charts = useLoad(() => api<OwnerCharts>('/dashboard/owner/charts'));
  const queue = useLoad(() => api<ApprovalQueue>('/approvals'));
  // money for the chosen period, and the one before it
  const pnl = useLoad(() => (canFinance ? api<{ pnl: Pnl }>(`/accounts/summary?${pq}`).then((r) => r.pnl) : Promise.resolve(null)), [canFinance, pq]);
  const pnlPrev = useLoad(() => (canFinance ? api<{ pnl: Pnl }>(`/accounts/summary?${prevQ}`).then((r) => r.pnl) : Promise.resolve(null)), [canFinance, prevQ]);
  // money by month: one summary per month (the same figures as the Accounts page)
  const monthly = useLoad(async () => {
    if (!canFinance) return null;
    const now = new Date();
    const months = Array.from({ length: MONTHS }, (_, i) => new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1 - i), 1));
    return Promise.all(
      months.map(async (m) => {
        const from = iso(m);
        const last = iso(new Date(m.getFullYear(), m.getMonth() + 1, 0));
        const to = last > todayIso ? todayIso : last;
        const r = await api<{ pnl: Pnl }>(`/accounts/summary?${periodQuery({ from, to })}`);
        return { month: from.slice(0, 7), sales: r.pnl.sales, purchases: r.pnl.purchases, expenses: r.pnl.totalExpenses, profit: r.pnl.profit };
      }),
    );
  }, [canFinance]);
  // production: approved runs for the trends, drafts for what is unfinished
  const runs = useLoad(() => api<{ items: ProductionSummary[] }>(`/production?status=APPROVED&take=${RUN_SCAN}&skip=0`).then((r) => r.items));
  const drafts = useLoad(() => api<{ items: ProductionSummary[] }>(`/production?status=DRAFT&take=${RUN_SCAN}&skip=0`).then((r) => r.items));
  // operations
  const arrivals = useLoad(() => api<{ items: ImportSummary[] }>(`/imports?take=${LIST_PREVIEW}&skip=0`).then((r) => r.items));
  const measuring = useLoad(() => api<{ total: number }>('/imports?take=1&skip=0&open=1').then((r) => r.total));
  const latestRuns = useLoad(() => api<{ items: ProductionSummary[] }>(`/production?take=${LIST_PREVIEW}&skip=0`).then((r) => r.items));
  const movements = useLoad(() => api<{ items: Movement[] }>(`/stock/movements?take=${LIST_PREVIEW + 1}&skip=0`).then((r) => r.items));
  const expenses = useLoad(() => (canFinance ? api<{ items: Expense[] }>(`/expenses?${pq}&take=${LIST_PREVIEW}`).then((r) => r.items) : Promise.resolve(null)), [canFinance, pq]);
  const audit = useLoad(() => (canAudit ? api<{ items: AuditRow[] }>(`/audit-logs?take=${ACTIVITY_SCAN}`) : Promise.resolve(null)), [canAudit]);

  const all = [charts, queue, pnl, pnlPrev, monthly, runs, drafts, arrivals, measuring, latestRuns, movements, expenses, audit];
  const refreshing = loading || all.some((l) => l.loading);
  const refresh = () => {
    reload();
    all.forEach((l) => l.reload());
  };

  const k = data?.kpis;
  const c = charts.data;
  const waiting = queue.data?.items ?? [];
  const pending = queue.data?.counts.total ?? k?.pendingApprovals ?? 0;
  const activity = useClientPaging(data?.accountantActivity ?? [], 10);
  const recent = (audit.data?.items ?? []).filter((a) => !SESSION_NOISE.test(a.action)).slice(0, LIST_PREVIEW);
  const HOLD = ' ';

  // ── comparisons ──
  /** Now against the period before, as the pill under a figure. `upIsGood` says which way is good news. */
  const trendOf = (now: number | undefined | null, before: number | undefined | null, upIsGood: boolean) => {
    if (now == null || before == null || before === 0) return undefined;
    const pct = Math.round(((now - before) / Math.abs(before)) * 100);
    const dir = pct > 0 ? ('up' as const) : pct < 0 ? ('down' as const) : ('flat' as const);
    return { dir, good: dir === 'flat' ? undefined : (dir === 'up') === upIsGood, label: t('vsPrevPeriod', { pct: `${pct > 0 ? '+' : ''}${pct}%` }) };
  };

  // ── production, from approved runs ──
  const inRange = (r: ProductionSummary, p: PeriodValue) => r.productionDate >= p.from && r.productionDate <= p.to;
  const produce = (p: PeriodValue) => {
    const rs = (runs.data ?? []).filter((r) => inRange(r, p));
    const out = rs.reduce((a, r) => a + r.outputCft, 0);
    const withInput = rs.filter((r) => r.inputCft != null && r.inputCft > 0);
    const used = withInput.reduce((a, r) => a + (r.inputCft ?? 0), 0);
    const made = withInput.reduce((a, r) => a + r.outputCft, 0);
    return { runs: rs.length, out, eff: used > 0 ? (made / used) * 100 : null };
  };
  const prodNow = produce(period);
  const prodPrev = produce(prev);
  const elapsed = Math.max(1, daysBetween(period.from, period.to > todayIso ? todayIso : period.to));
  const effTrend =
    prodNow.eff != null && prodPrev.eff != null
      ? (() => {
          const pts = Math.round((prodNow.eff - prodPrev.eff) * 10) / 10;
          const dir = pts > 0 ? ('up' as const) : pts < 0 ? ('down' as const) : ('flat' as const);
          return { dir, good: dir === 'flat' ? undefined : dir === 'up', label: t('pointsVsPrev', { pts: `${pts > 0 ? '+' : ''}${pts}` }) };
        })()
      : undefined;
  // the last 14 days of finished output, for the production sparkline
  const dailyOut = Array.from({ length: 14 }, (_, i) => {
    const day = addDays(todayIso, i - 13);
    return (runs.data ?? []).filter((r) => r.productionDate === day).reduce((a, r) => a + r.outputCft, 0);
  });
  // the last twelve weeks, for the production and efficiency charts
  const weeks = Array.from({ length: WEEKS }, (_, i) => addDays(weekStart(todayIso), (i - (WEEKS - 1)) * 7));
  const weekly = weeks.map((w) => {
    const rs = (runs.data ?? []).filter((r) => weekStart(r.productionDate) === w);
    const withInput = rs.filter((r) => r.inputCft != null && r.inputCft > 0);
    const used = withInput.reduce((a, r) => a + (r.inputCft ?? 0), 0);
    const made = withInput.reduce((a, r) => a + r.outputCft, 0);
    return { week: w, input: Math.round(used * 1000) / 1000, output: Math.round(rs.reduce((a, r) => a + r.outputCft, 0) * 1000) / 1000, eff: used > 0 ? Math.round((made / used) * 1000) / 10 : 0, runs: rs.length };
  });
  const effWeeks = weekly.filter((w) => w.runs > 0);

  // ── alerts: each one only when the data shows it ──
  const alerts: Alert[] = [];
  if (pending > 0) {
    const oldest = waiting[0]?.submittedAt;
    const hours = oldest ? (Date.now() - Date.parse(oldest)) / 3_600_000 : 0;
    const age =
      hours >= 24
        ? new Intl.NumberFormat(locale, { style: 'unit', unit: 'day', unitDisplay: 'long' }).format(Math.floor(hours / 24))
        : new Intl.NumberFormat(locale, { style: 'unit', unit: 'hour', unitDisplay: 'long' }).format(Math.max(1, Math.floor(hours)));
    alerts.push({ key: 'approvals', tone: 'warn', icon: ClipboardCheckIcon, title: t('alertApprovals', { n: pending }), sub: oldest ? t('alertApprovalsSub', { age }) : '', to: '/approvals' });
  }
  if ((measuring.data ?? 0) > 0) alerts.push({ key: 'measuring', tone: 'info', icon: RulerIcon, title: t('alertMeasuring', { n: measuring.data! }), sub: t('alertMeasuringSub'), to: '/measurement' });
  const incomplete = (drafts.data ?? []).filter((r) => r.inputCft == null || r.outputCft === 0);
  if (incomplete.length) alerts.push({ key: 'incomplete', tone: 'info', icon: FactoryIcon, title: t('alertIncomplete', { n: incomplete.length }), sub: t('alertIncompleteSub'), to: '/production' });
  const over = [...(runs.data ?? []).filter((r) => r.productionDate >= weeks[0]), ...(drafts.data ?? [])].filter((r) => r.wasteCft != null && r.wasteCft < 0);
  if (over.length) alerts.push({ key: 'over', tone: 'bad', icon: AlertTriangleIcon, title: t('alertOverRecovery', { n: over.length }), sub: t('alertOverRecoverySub'), to: '/production' });
  const adjustments = queue.data?.counts.ADJUSTMENT ?? 0;
  if (adjustments > 0) alerts.push({ key: 'adjustments', tone: 'warn', icon: SlidersHorizontalIcon, title: t('alertAdjustments', { n: adjustments }), sub: t('alertAdjustmentsSub'), to: '/stock?tab=adjustments' });
  if (canFinance && k && k.pendingPayables > 0) alerts.push({ key: 'payables', tone: 'warn', icon: ArrowUpRightIcon, title: t('alertPayables', { amount: money(k.pendingPayables) }), sub: t('alertBalancesSub'), to: '/accounts' });
  if (canFinance && k && k.pendingReceivables > 0) alerts.push({ key: 'receivables', tone: 'info', icon: ArrowDownLeftIcon, title: t('alertReceivables', { amount: money(k.pendingReceivables) }), sub: t('alertBalancesSub'), to: '/accounts' });

  // ── chart series ──
  const m = monthly.data ?? [];
  const SALES = { key: 'sales', label: t('sales'), color: 'var(--chart-1)' };
  const PURCH = { key: 'purchases', label: t('purchases'), color: 'var(--chart-2)' };
  const EXP = { key: 'expenses', label: t('totalExpenses'), color: 'var(--chart-2)' };
  const USED = { key: 'input', label: t('rawUsed'), color: 'var(--chart-1)' };
  const MADE = { key: 'output', label: t('finishedMade'), color: 'var(--chart-2)' };
  const EFF = { key: 'eff', label: t('conversion'), color: 'var(--chart-1)' };
  const RAW = { key: 'raw', label: t('raw'), color: 'var(--chart-1)' };
  const FIN = { key: 'finished', label: t('finished'), color: 'var(--chart-2)' };
  const cft = (n: number) => `${num3(n)} CFT`;
  const p = pnl.data;
  const pp = pnlPrev.data;

  return (
    <Page>
      <PageHeader
        eyebrow={user?.mill.name}
        title={`${t('welcome')}, ${user?.name ?? ''}`}
        subtitle={t('ownerDashSub')}
        actions={
          <>
            <Select value={periodKey} onValueChange={(v) => setPeriodKey(v as PeriodKey)}>
              <SelectTrigger className="w-44" aria-label={t('period')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {t(key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="print:hidden" onClick={refresh} disabled={refreshing} aria-label={t('refresh')} title={t('refresh')}>
              <RefreshCwIcon className={cn(refreshing && 'animate-spin')} />
            </Button>
          </>
        }
      />

      <LoadState loading={loading && !data} error={error} onRetry={reload} />

      {k && (
        <>
          {/* ── what needs the owner, from the data ── */}
          {alerts.length > 0 ? (
            <Section title={t('secAttention')}>
              <div className="stagger grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
                {alerts.map((a) => (
                  <Link key={a.key} to={a.to} className="hover-lift group flex items-start gap-3.5 rounded-xl bg-card p-4 shadow-card outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:p-5">
                    <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg [&_svg]:size-[1.125rem]', ALERT_TONE[a.tone])} aria-hidden>
                      <a.icon />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm leading-snug font-semibold">{a.title}</span>
                      {a.sub && <span className="mt-0.5 block text-xs text-pretty text-muted-foreground">{a.sub}</span>}
                    </span>
                    <ArrowUpRightIcon className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100" aria-hidden />
                  </Link>
                ))}
              </div>
            </Section>
          ) : (
            <p className="flex items-center gap-2 rounded-xl bg-success-soft px-4 py-3 text-sm font-medium text-success">
              <CheckCircle2Icon className="size-4 shrink-0" aria-hidden />
              {t('noAlerts')}
            </p>
          )}

          {/* ── money, for the chosen period ── */}
          {canFinance && (
            <Section
              title={
                <>
                  {t('secPerformance')} <OwnerOnly />
                </>
              }
            >
              <StatGrid>
                <Stat
                  icon={<ShoppingCartIcon />}
                  label={t('purchases')}
                  info={t('infoPurchases')}
                  value={p ? money(p.purchases) : HOLD}
                  trend={trendOf(p?.purchases, pp?.purchases, false)}
                  spark={m.length > 1 && <Sparkline values={m.map((x) => x.purchases)} color="var(--chart-2)" />}
                />
                <Stat
                  icon={<IndianRupeeIcon />}
                  label={t('totalSales')}
                  info={t('infoSales')}
                  value={p ? money(p.sales) : HOLD}
                  trend={trendOf(p?.sales, pp?.sales, true)}
                  spark={m.length > 1 && <Sparkline values={m.map((x) => x.sales)} />}
                />
                <Stat
                  icon={<ReceiptTextIcon />}
                  label={t('totalExpenses')}
                  info={t('infoExpensesAll')}
                  value={p ? money(p.totalExpenses) : HOLD}
                  trend={trendOf(p?.totalExpenses, pp?.totalExpenses, false)}
                  spark={m.length > 1 && <Sparkline values={m.map((x) => x.expenses)} color="var(--chart-2)" />}
                />
                {/* the one figure that takes a colour: green in profit, red in loss */}
                <Stat
                  to="/accounts"
                  icon={p && p.profit < 0 ? <TrendingDownIcon /> : <TrendingUpIcon />}
                  label={t(p && p.profit < 0 ? 'netLoss' : 'netProfit')}
                  info={t('infoProfit')}
                  value={p ? money(p.profit) : HOLD}
                  tone={p ? (p.profit < 0 ? 'bad' : p.profit > 0 ? 'good' : undefined) : undefined}
                  trend={trendOf(p?.profit, pp?.profit, true)}
                  spark={m.length > 1 && <Sparkline values={m.map((x) => x.profit)} />}
                />
              </StatGrid>
            </Section>
          )}

          {/* ── wood: what is on hand, and what the saws made in the period ── */}
          <Section title={t('secStockProduction')}>
            <StatGrid>
              <Stat to="/stock" icon={<LayersIcon />} label={t('rawStock')} info={t('infoRawStock')} value={num3(k.rawStockCft)} unit="CFT" hint={c ? t('woodTypesCount', { n: c.stockByWood.filter((w) => w.rawCft > 0).length }) : HOLD} />
              <Stat
                to="/stock?tab=finished"
                icon={<PackageIcon />}
                label={t('finishedStock')}
                info={t('infoFinishedStock')}
                value={num3(k.finishedStockCft)}
                unit="CFT"
                hint={c ? t('woodTypesCount', { n: c.stockByWood.filter((w) => w.finishedCft > 0).length }) : HOLD}
              />
              <Stat
                to="/production"
                icon={<FactoryIcon />}
                label={t('productionInPeriod')}
                info={t('infoProduction')}
                value={runs.data ? num3(prodNow.out) : HOLD}
                unit="CFT"
                trend={runs.data ? trendOf(prodNow.out, prodPrev.out, true) : undefined}
                hint={runs.data ? t('perDayAvg', { cft: num3(prodNow.out / elapsed) }) : undefined}
                spark={runs.data && <Sparkline values={dailyOut} color="var(--chart-2)" />}
              />
              <Stat
                icon={<GaugeIcon />}
                label={t('conversion')}
                info={t('infoConversion')}
                value={prodNow.eff != null ? `${(Math.round(prodNow.eff * 10) / 10).toFixed(1)}` : runs.data ? '—' : HOLD}
                unit={prodNow.eff != null ? '%' : undefined}
                trend={effTrend}
                hint={runs.data ? (prodNow.runs ? t('fromRuns', { n: prodNow.runs }) : t('noRunsInPeriod')) : undefined}
                spark={effWeeks.length > 1 && <Sparkline values={effWeeks.map((w) => w.eff)} />}
              />
            </StatGrid>
          </Section>

          <QuickActions />

          {/* ── analytics ── */}
          <Reveal>
            <Section title={t('secAnalytics')}>
              <div className="grid gap-5 lg:grid-cols-2">
                {canFinance && (
                  <ChartCard
                    title={t('chartPurchaseSales')}
                    subtitle={t('chartPurchaseSalesSub')}
                    series={[SALES, PURCH]}
                    empty={m.length === 0 || m.every((x) => !x.sales && !x.purchases)}
                    table={{ columns: [t('month'), SALES.label, PURCH.label], rows: m.map((x) => [shortMonth(x.month), money(x.sales), money(x.purchases)]) }}
                  >
                    {m.length > 0 && <ColumnChart data={m} xKey="month" series={[SALES, PURCH]} formatX={shortMonth} formatValue={money} formatAxis={(n) => rupeesCompact.format(n)} ariaLabel={t('chartPurchaseSales')} />}
                  </ChartCard>
                )}
                <ChartCard
                  title={t('chartCashTitle')}
                  subtitle={t('chartCashSub')}
                  series={[SALES, EXP]}
                  empty={!c || c.cash.every((x) => !x.sales && !x.expenses)}
                  table={{ columns: [t('month'), SALES.label, EXP.label], rows: (c?.cash ?? []).map((x) => [shortMonth(x.month), money(x.sales), money(x.expenses)]) }}
                >
                  {c && <ColumnChart data={c.cash} xKey="month" series={[SALES, EXP]} formatX={shortMonth} formatValue={money} formatAxis={(n) => rupeesCompact.format(n)} ariaLabel={t('chartCashTitle')} />}
                </ChartCard>
                <ChartCard
                  title={t('chartProductionTitle')}
                  subtitle={t('chartProductionSub')}
                  series={[USED, MADE]}
                  empty={!runs.data || weekly.every((w) => !w.input && !w.output)}
                  table={{ columns: [t('weekOf'), USED.label, MADE.label], rows: weekly.map((w) => [shortDay(w.week), num3(w.input), num3(w.output)]) }}
                >
                  {runs.data && <ColumnChart data={weekly} xKey="week" series={[USED, MADE]} formatX={shortDay} formatValue={cft} ariaLabel={t('chartProductionTitle')} />}
                </ChartCard>
                <ChartCard
                  title={t('chartRecoveryTitle')}
                  subtitle={t('chartRecoverySub')}
                  empty={effWeeks.length === 0}
                  table={{ columns: [t('weekOf'), EFF.label], rows: effWeeks.map((w) => [shortDay(w.week), `${w.eff}%`]) }}
                >
                  {effWeeks.length > 0 && <LineChart data={effWeeks} xKey="week" series={[EFF]} formatX={shortDay} formatValue={(n) => `${n}%`} ariaLabel={t('chartRecoveryTitle')} />}
                </ChartCard>
                <ChartCard
                  className="lg:col-span-2"
                  title={t('chartStockTitle')}
                  subtitle={t('chartStockSub')}
                  series={[RAW, FIN]}
                  empty={!c || c.stockByWood.length === 0}
                  table={{ columns: [t('woodType'), RAW.label, FIN.label], rows: (c?.stockByWood ?? []).map((w) => [w.woodType, num3(w.rawCft), num3(w.finishedCft)]) }}
                >
                  {c && <StackedBars rows={c.stockByWood.slice(0, 8).map((w) => ({ label: w.woodType, values: { raw: w.rawCft, finished: w.finishedCft } }))} series={[RAW, FIN]} formatValue={cft} ariaLabel={t('chartStockTitle')} />}
                </ChartCard>
              </div>
            </Section>
          </Reveal>

          {/* ── operations: the latest of each kind of work ── */}
          <Reveal>
            <Section title={t('secOperations')}>
              <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
                {/* the approvals queue leads: it is the owner's own work */}
                <Panel
                  className="shadow-widget lg:col-span-2 xl:col-span-2"
                  flush={waiting.length > 0}
                  title={
                    <>
                      <ClipboardCheckIcon className={cn('size-[1.125rem] shrink-0', pending ? 'text-warning' : 'text-muted-foreground')} aria-hidden />
                      {t('pendingApprovals')}
                      <span className={cn('min-w-6 rounded-full px-2 text-center text-xs leading-6 font-bold tabular-nums', pending ? 'bg-warning-soft text-warning' : 'bg-muted text-muted-foreground')}>{pending}</span>
                    </>
                  }
                  tools={
                    <Button asChild size="sm" variant={pending ? 'default' : 'outline'}>
                      <Link to="/approvals">{t('review')}</Link>
                    </Button>
                  }
                >
                  {waiting.length > 0 ? (
                    <>
                      <Table>
                        <TableBody>
                          {waiting.slice(0, QUEUE_PREVIEW).map((i) => (
                            <LinkRow key={`${i.type}-${i.id}`} to={PAGE_PATH[i.type](i.id)}>
                              <TableCell className="pl-5 sm:pl-6">
                                <Link className="font-semibold text-primary hover:underline" to={PAGE_PATH[i.type](i.id)}>
                                  {i.code}
                                </Link>
                                <div className="text-xs text-muted-foreground">
                                  {i.createdByName} · {dateTime(i.submittedAt)}
                                </div>
                              </TableCell>
                              <TableCell className={wide}>
                                <Badge variant="secondary">{t(kindKey[i.type])}</Badge>
                              </TableCell>
                              <TableCell className={wide}>{i.woodType}</TableCell>
                              <TableCell className={cn(numCell, 'pr-5 font-semibold sm:pr-6')}>
                                {num3(queueCft(i))} <span className="text-xs font-medium text-muted-foreground">CFT</span>
                              </TableCell>
                            </LinkRow>
                          ))}
                        </TableBody>
                      </Table>
                      {pending > QUEUE_PREVIEW ? (
                        <Link to="/approvals" className="mt-auto border-t border-border/70 px-5 py-3.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:px-6">
                          {t('moreWaiting', { n: pending - QUEUE_PREVIEW })}
                        </Link>
                      ) : (
                        <div className="h-2" />
                      )}
                    </>
                  ) : pending > 0 ? (
                    <p className="flex flex-1 items-center gap-2 text-sm font-medium text-warning">{t('approvalsWaiting', { n: pending })}</p>
                  ) : (
                    <p className="flex flex-1 items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2Icon className="size-4 shrink-0 text-success" aria-hidden />
                      {t('nothingToApprove')}
                    </p>
                  )}
                </Panel>

                <ListPanel title={t('recentArrivals')} icon={<ArrowDownToLineIcon />} to="/imports" loading={arrivals.loading} empty={!arrivals.data?.length}>
                  {(arrivals.data ?? []).map((i) => (
                    <ListLine
                      key={i.id}
                      to={`/imports/${i.id}`}
                      icon={<ArrowDownToLineIcon />}
                      primary={i.code}
                      secondary={`${i.lorryNumber} · ${i.woodType} · ${dateTime(i.arrivalAt)}`}
                      value={
                        <>
                          <span className="block">{num3(i.totalCft)}</span>
                          <StatusBadge status={i.status} className="mt-0.5 py-0 text-[0.6875rem]" />
                        </>
                      }
                    />
                  ))}
                </ListPanel>

                <ListPanel title={t('latestProduction')} icon={<FactoryIcon />} to="/production" loading={latestRuns.loading} empty={!latestRuns.data?.length}>
                  {(latestRuns.data ?? []).map((r) => (
                    <ListLine
                      key={r.id}
                      to={`/production/${r.id}`}
                      icon={<FactoryIcon />}
                      primary={r.code}
                      secondary={`${r.importCode} · ${r.woodType} · ${shortDay(r.productionDate)}`}
                      value={
                        <>
                          <span className="block">{num3(r.outputCft)}</span>
                          <StatusBadge status={r.status} className="mt-0.5 py-0 text-[0.6875rem]" />
                        </>
                      }
                    />
                  ))}
                </ListPanel>

                <ListPanel title={t('recentMovements')} icon={<LayersIcon />} to="/stock?tab=movements" loading={movements.loading} empty={!movements.data?.length}>
                  {(movements.data ?? []).map((mv) => {
                    const Icon = MOVE_ICON[mv.source];
                    const incoming = mv.cftDelta > 0;
                    return (
                      <ListLine
                        key={mv.id}
                        to={MOVE_PATH[mv.source]?.(mv.sourceId)}
                        icon={<Icon />}
                        tone={incoming ? 'bg-success-soft text-success' : 'bg-destructive-soft text-destructive'}
                        primary={t(MOVE_LABEL[mv.source])}
                        secondary={`${mv.sourceCode} · ${t(mv.kind === 'RAW' ? 'raw' : 'finished')} · ${mv.woodType}`}
                        value={<span className={incoming ? 'text-success' : 'text-destructive'}>{`${incoming ? '+' : ''}${num3(mv.cftDelta)}`}</span>}
                      />
                    );
                  })}
                </ListPanel>

                {canFinance && (
                  <ListPanel title={t('recentExpenses')} icon={<WalletIcon />} to="/accounts" loading={expenses.loading} empty={!expenses.data?.length}>
                    {(expenses.data ?? []).map((e) => (
                      <ListLine key={e.id} icon={<ReceiptTextIcon />} primary={e.category} secondary={[shortDay(e.date), e.notes].filter(Boolean).join(' · ')} value={money(e.amount)} />
                    ))}
                  </ListPanel>
                )}

                {canAudit && (
                  <ListPanel title={t('recentActivity')} icon={<ActivityIcon />} to="/audit" loading={audit.loading} empty={recent.length === 0}>
                    {recent.map((a) => {
                      const Icon = ACTION_ICON[a.action] ?? ActivityIcon;
                      const act = ACTIONS[a.action];
                      const ent = ENTITIES[a.entityType];
                      const name = recordName(a);
                      return (
                        <ListLine
                          key={a.id}
                          to={a.entityId ? ent?.page?.(a.entityId) : undefined}
                          icon={<Icon />}
                          tone={act?.tone}
                          primary={
                            <>
                              {act ? t(act.label) : readable(a.action)} <span className="font-normal text-muted-foreground">· {ent ? t(ent.label) : readable(a.entityType)}</span>
                              {name && <span className="ml-1.5 text-primary">{name}</span>}
                            </>
                          }
                          secondary={`${a.user?.name ?? '—'} · ${dateTime(a.createdAt)}`}
                        />
                      );
                    })}
                  </ListPanel>
                )}
              </div>
            </Section>
          </Reveal>

          {/* ── the people doing the measuring ── */}
          <Reveal>
            <Section title={t('accountantActivity')}>
              <TableCard empty={data!.accountantActivity.length === 0} emptyText={t('noAccountants')} pager={activity.pager}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">{t('accountant')}</TableHead>
                      <TableHead className={wide}>{t('lastEntry')}</TableHead>
                      <TableHead className={cn(numCell, wide)}>{t('logsMeasured')}</TableHead>
                      <TableHead className={cn(numCell, wide)}>{t('totalCft')}</TableHead>
                      <TableHead className={cn(numCell, 'hidden lg:table-cell')}>{t('draft')}</TableHead>
                      <TableHead className={numCell}>{t('pending')}</TableHead>
                      <TableHead className={numCell}>{t('approved')}</TableHead>
                      <TableHead className={cn(numCell, 'pr-4')}>{t('rejected')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activity.rows.map((a) => (
                      <TableRow key={a.accountantId}>
                        <TableCell className="pl-4">
                          <div className="flex items-center gap-2">
                            <Avatar size="sm" className="max-sm:hidden">
                              <AvatarFallback className="bg-primary-soft text-xs font-semibold text-primary">{a.accountantName.charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{a.accountantName}</span>
                            {!a.isActive && (
                              <Badge variant="secondary" className="rounded-full border-transparent bg-destructive-soft font-semibold text-destructive">
                                {t('disabled')}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground md:hidden">
                            {a.logsMeasured} {t('logs')} · {num3(a.totalCft)} CFT
                          </div>
                        </TableCell>
                        <TableCell className={wide}>
                          {a.lastEntryType ? (
                            <>
                              <div className="font-medium">{kindKey[a.lastEntryType] ? t(kindKey[a.lastEntryType]) : a.lastEntryType}</div>
                              <div className="text-xs text-muted-foreground">{dateTime(a.lastEntryAt)}</div>
                            </>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className={cn(numCell, wide)}>{a.logsMeasured}</TableCell>
                        <TableCell className={cn(numCell, wide)}>{num3(a.totalCft)}</TableCell>
                        <TableCell className={cn(numCell, 'hidden lg:table-cell')}>{a.draftEntries}</TableCell>
                        <TableCell className={cn(numCell, a.pendingEntries && 'font-semibold text-warning')}>{a.pendingEntries}</TableCell>
                        <TableCell className={cn(numCell, a.approvedEntries && 'font-semibold text-success')}>{a.approvedEntries}</TableCell>
                        <TableCell className={cn(numCell, 'pr-4', a.rejectedEntries && 'font-semibold text-destructive')}>{a.rejectedEntries}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableCard>
            </Section>
          </Reveal>
        </>
      )}
    </Page>
  );
}

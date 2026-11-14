import { Permission } from '@sawmill/shared';
import {
  ActivityIcon,
  ArrowDownToLineIcon,
  ArrowUpFromLineIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  FileDownIcon,
  IndianRupeeIcon,
  LayersIcon,
  LogInIcon,
  type LucideIcon,
  PackageIcon,
  PencilIcon,
  PlusIcon,
  ReceiptTextIcon,
  RefreshCwIcon,
  SendIcon,
  Trash2Icon,
  TrendingDownIcon,
  TrendingUpIcon,
  WalletIcon,
  XCircleIcon,
} from 'lucide-react';
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { api } from '../api';
import { useAuth } from '../auth';
import { ChartCard, ColumnChart, StackedBars } from '../components/charts';
import { dateTime, money, num3, useLoad } from '../components/common';
import { LinkRow, LoadState, numCell, OwnerOnly, Page, PageHeader, Section, Stat, StatGrid, TableCard, useClientPaging, wide } from '../components/page';
import { periodQuery, presets } from '../components/period';
import { QuickActions } from '../components/quick-actions';
import { useI18n } from '../i18n';
import { type ApprovalItem, type ApprovalQueue, KINDS, PAGE_PATH } from './Approvals';

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
/** The part of /accounts/summary the dashboard draws: where the money went. */
interface AccountsSummary {
  pnl: { purchases: number; transport: number; unloading: number; otherExpenses: { category: string; amount: number }[] };
}
/** How many expense rows the chart shows; anything beyond is folded into one "other" row. */
const EXPENSE_ROWS = 6;
interface OwnerCharts {
  flow: { day: string; receivedCft: number; shippedCft: number }[];
  stockByWood: { woodType: string; rawCft: number; finishedCft: number }[];
  cash: { month: string; sales: number; expenses: number }[];
}

export const shortDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const shortMonth = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
/** How many waiting records the dashboard previews before sending the owner to the full queue. */
const QUEUE_PREVIEW = 3;
const kindKey = Object.fromEntries(KINDS);
/** The one CFT figure that sums a waiting record up. */
const queueCft = (i: ApprovalItem) => (i.type === 'PRODUCTION' ? i.outputCft : i.type === 'ADJUSTMENT' ? i.cftDelta : i.totalCft);

const rupeesCompact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 });

// ───────── recent activity (from the audit log) ─────────

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  createdAt: string;
  user: { name: string } | null;
}
/** How many audit entries the dashboard shows; the rest are on the Audit Log page. */
const ACTIVITY_PREVIEW = 5;
/** Sign-ins and token housekeeping are in the audit log, but they aren't mill activity. */
const SESSION_NOISE = /^(LOGIN|LOGOUT|REFRESH)/;
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
/** 'OWNER_EDIT' → 'Owner edit', 'ImportLoad' → 'Import load' */
const readable = (code: string) => {
  const words = code.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

// ───────── building blocks ─────────

/** A titled card: the same frame as a chart card, for lists and small summaries. */
export function Panel({ title, tools, children, className, flush }: { title: ReactNode; tools?: ReactNode; children: ReactNode; className?: string; /** content runs edge to edge (a table or list) */ flush?: boolean }) {
  return (
    <Card className={cn('min-w-0 gap-3 py-5', flush && 'pb-0', className)}>
      <CardHeader className="flex min-h-8 flex-row items-center justify-between gap-3 px-5">
        <CardTitle className="flex min-w-0 items-center gap-2 text-base">{title}</CardTitle>
        {tools}
      </CardHeader>
      <CardContent className={cn('flex flex-1 flex-col', flush ? 'px-0' : 'px-5')}>{children}</CardContent>
    </Card>
  );
}

/** One of today's counts: a quiet tile with an icon, a label and a large number. */
export function TodayFigure({ icon, label, value, to }: { icon: ReactNode; label: string; value: number; to: string }) {
  return (
    <Link
      to={to}
      className="flex min-w-0 flex-1 flex-col justify-center gap-3 rounded-lg bg-muted/60 p-4 transition-colors duration-200 outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0">
        {icon}
        {label}
      </span>
      <span className="text-3xl leading-none font-bold tracking-[-0.02em] tabular-nums">{value}</span>
    </Link>
  );
}

export function OwnerDashboard() {
  const { t, lang } = useI18n();
  const { user, can } = useAuth();
  const { data, loading, error, reload } = useLoad(() => api<OwnerDashboardData>('/dashboard/owner'));
  const charts = useLoad(() => api<OwnerCharts>('/dashboard/owner/charts'));
  const queue = useLoad(() => api<ApprovalQueue>('/approvals'));
  const canAudit = can(Permission.AUDIT_VIEW);
  const audit = useLoad(() => (canAudit ? api<{ items: AuditRow[] }>('/audit-logs?take=40') : Promise.resolve(null)), [canAudit]);
  const canFinance = can(Permission.FINANCE_VIEW);
  const yearQuery = periodQuery(presets().thisYear);
  const accounts = useLoad(() => (canFinance ? api<AccountsSummary>(`/accounts/summary?${yearQuery}`) : Promise.resolve(null)), [canFinance, yearQuery]);
  const waiting = queue.data?.items ?? [];
  const k = data?.kpis;
  const c = charts.data;
  const activity = useClientPaging(data?.accountantActivity ?? [], 10);
  const recent = (audit.data?.items ?? []).filter((a) => !SESSION_NOISE.test(a.action)).slice(0, ACTIVITY_PREVIEW);

  const locale = lang === 'ta' ? 'ta-IN' : 'en-IN';
  const now = new Date();
  const refreshing = loading || charts.loading || queue.loading || audit.loading || accounts.loading;
  const refresh = () => {
    reload();
    charts.reload();
    queue.reload();
    audit.reload();
    accounts.reload();
  };
  // the queue's own count once it has loaded; the KPI's until then
  const pending = queue.data?.counts.total ?? k?.pendingApprovals ?? 0;

  // second lines under the big numbers, from the chart series (same approved-only basis as the totals);
  // a blank line holds the space until the series arrive, so the cards don't jump
  const HOLD = '\u00a0';
  const sumOf = (rows: number[]) => rows.reduce((a, b) => a + b, 0);
  const in30 = c ? `${t('last30Days')} · ${num3(sumOf(c.flow.map((d) => d.receivedCft)))} CFT` : HOLD;
  const out30 = c ? `${t('last30Days')} · ${num3(sumOf(c.flow.map((d) => d.shippedCft)))} CFT` : HOLD;
  const rawWoods = c ? t('woodTypesCount', { n: c.stockByWood.filter((w) => w.rawCft > 0).length }) : HOLD;
  const finWoods = c ? t('woodTypesCount', { n: c.stockByWood.filter((w) => w.finishedCft > 0).length }) : HOLD;
  const month = c?.cash[c.cash.length - 1];
  const thisMonth = (n: number | undefined) => (n == null ? HOLD : `${t('thisMonth')} · ${money(n)}`);

  // this year's expenses, largest first; a long tail of small categories becomes one row
  const pnl = accounts.data?.pnl;
  const spent = pnl
    ? [
        { label: t('purchases'), amount: pnl.purchases },
        { label: t('transport'), amount: pnl.transport },
        { label: t('unloadingCharges'), amount: pnl.unloading },
        ...pnl.otherExpenses.map((e) => ({ label: e.category, amount: e.amount })),
      ]
        .filter((e) => e.amount > 0)
        .sort((a, b) => b.amount - a.amount)
    : [];
  const expenseRows =
    spent.length > EXPENSE_ROWS
      ? [...spent.slice(0, EXPENSE_ROWS - 1), { label: t('otherExpenses'), amount: sumOf(spent.slice(EXPENSE_ROWS - 1).map((e) => e.amount)) }]
      : spent;
  const SPENT = { key: 'amount', label: t('totalExpenses'), color: 'var(--chart-1)' };

  const RAW = { key: 'raw', label: t('raw'), color: 'var(--chart-1)' };
  const FIN = { key: 'finished', label: t('finished'), color: 'var(--chart-2)' };
  const IN = { key: 'receivedCft', label: t('receivedCft'), color: 'var(--chart-1)' };
  const OUT = { key: 'shippedCft', label: t('shippedCft'), color: 'var(--chart-2)' };
  const SALES = { key: 'sales', label: t('sales'), color: 'var(--chart-1)' };
  const EXP = { key: 'expenses', label: t('totalExpenses'), color: 'var(--chart-2)' };

  return (
    <Page>
      <PageHeader
        eyebrow={user?.mill.name}
        title={`${t('welcome')}, ${user?.name ?? ''}`}
        subtitle={t('dashboardSub')}
        actions={
          <>
            <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-card px-3 text-sm font-medium shadow-card">
              <CalendarDaysIcon className="size-4 text-muted-foreground" aria-hidden />
              <time dateTime={now.toISOString().slice(0, 10)}>{now.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</time>
            </span>
            <Button variant="outline" size="icon" className="size-9 print:hidden" onClick={refresh} disabled={refreshing} aria-label={t('refresh')} title={t('refresh')}>
              <RefreshCwIcon className={cn(refreshing && 'animate-spin')} />
            </Button>
          </>
        }
      />

      <LoadState loading={loading && !data} error={error} onRetry={reload} />

      {k && (
        <>
          {/* the four standing numbers: loads handled and wood on hand */}
          <StatGrid>
            <Stat to="/imports" icon={<ArrowDownToLineIcon />} label={t('totalImportLoads')} value={k.totalImportLoads.toLocaleString('en-IN')} hint={in30} />
            <Stat to="/exports" icon={<ArrowUpFromLineIcon />} label={t('totalExportLoads')} value={k.totalExportLoads.toLocaleString('en-IN')} hint={out30} />
            <Stat to="/stock" icon={<LayersIcon />} label={t('rawStock')} value={num3(k.rawStockCft)} unit="CFT" hint={rawWoods} />
            <Stat to="/stock" icon={<PackageIcon />} label={t('finishedStock')} value={num3(k.finishedStockCft)} unit="CFT" hint={finWoods} />
          </StatGrid>

          {/* today, and what is waiting for the owner */}
          <div className="grid gap-4 lg:grid-cols-5">
            <Panel
              className="lg:col-span-2"
              title={t('today')}
              tools={<span className="text-sm text-muted-foreground">{now.toLocaleDateString(locale, { day: 'numeric', month: 'long' })}</span>}
            >
              <div className="flex flex-1 gap-3">
                <TodayFigure to="/imports" icon={<ArrowDownToLineIcon />} label={t('todayImports')} value={k.todayImports} />
                <TodayFigure to="/exports" icon={<ArrowUpFromLineIcon />} label={t('todayExports')} value={k.todayExports} />
              </div>
            </Panel>

            <Panel
              className="lg:col-span-3"
              flush={waiting.length > 0}
              title={
                <>
                  <ClipboardCheckIcon className={cn('size-[1.125rem] shrink-0', pending ? 'text-warning' : 'text-muted-foreground')} aria-hidden />
                  {t('pendingApprovals')}
                  <span
                    className={cn(
                      'min-w-6 rounded-full px-2 text-center text-xs leading-6 font-bold tabular-nums',
                      pending ? 'bg-warning-soft text-warning' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {pending}
                  </span>
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
                          <TableCell className="pl-5">
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
                          <TableCell className={cn(numCell, 'pr-5 font-semibold')}>
                            {num3(queueCft(i))} <span className="text-xs font-medium text-muted-foreground">CFT</span>
                          </TableCell>
                        </LinkRow>
                      ))}
                    </TableBody>
                  </Table>
                  {pending > QUEUE_PREVIEW ? (
                    <Link to="/approvals" className="mt-auto border-t border-border/70 px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                      {t('moreWaiting', { n: pending - QUEUE_PREVIEW })}
                    </Link>
                  ) : (
                    <div className="h-2" />
                  )}
                </>
              ) : pending > 0 ? (
                // the count is known but the queue itself hasn't loaded (or failed to)
                <p className="flex flex-1 items-center gap-2 text-sm font-medium text-warning">{t('approvalsWaiting', { n: pending })}</p>
              ) : (
                <p className="flex flex-1 items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2Icon className="size-4 shrink-0 text-success" aria-hidden />
                  {t('nothingToApprove')}
                </p>
              )}
            </Panel>
          </div>

          <QuickActions />

          <Section
            title={
              <>
                {t('financials')} <OwnerOnly />
              </>
            }
          >
            {/* rupee figures are long: one per row on a phone */}
            <StatGrid className="grid-cols-1 sm:grid-cols-2">
              <Stat icon={<IndianRupeeIcon />} label={t('totalSales')} value={money(k.totalSales)} hint={thisMonth(month?.sales)} />
              <Stat icon={<ReceiptTextIcon />} label={t('totalExpenses')} value={money(k.totalExpenses)} hint={thisMonth(month?.expenses)} />
              {/* the one figure on the page that takes a colour: green in profit, red in loss */}
              <Stat
                icon={k.profitLoss < 0 ? <TrendingDownIcon /> : <TrendingUpIcon />}
                label={t('profitLoss')}
                value={money(k.profitLoss)}
                tone={k.profitLoss < 0 ? 'bad' : k.profitLoss > 0 ? 'good' : undefined}
                hint={thisMonth(month && month.sales - month.expenses)}
              />
              <Link to="/accounts" className="group/stat min-w-0 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                <Card className="h-full gap-3 py-5 transition-shadow duration-200 group-hover/stat:shadow-lift">
                  <CardHeader className="flex flex-row items-center gap-3 px-5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary [&_svg]:size-[1.125rem]">
                      <WalletIcon />
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-medium text-muted-foreground">{t('pendingPayments')}</span>
                  </CardHeader>
                  <CardContent className="grid gap-2.5 px-5">
                    {(
                      [
                        [t('pendingReceivables'), k.pendingReceivables],
                        [t('pendingPayables'), k.pendingPayables],
                      ] as const
                    ).map(([label, amount]) => (
                      <div key={label} className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate text-[0.8125rem] text-muted-foreground" title={label}>
                          {label}
                        </span>
                        <span className={cn('text-[0.9375rem] font-bold whitespace-nowrap tabular-nums', amount > 0 && 'text-warning')}>{money(amount)}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </Link>
            </StatGrid>

          </Section>

          {/* three across, like a report page: money first, then wood */}
          <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard
            className={canFinance ? undefined : 'lg:col-span-2'}
            title={t('chartCashTitle')}
            subtitle={t('chartCashSub')}
            series={[SALES, EXP]}
            empty={!c || c.cash.every((m) => !m.sales && !m.expenses)}
            table={{ columns: [t('month'), SALES.label, EXP.label], rows: (c?.cash ?? []).map((m) => [shortMonth(m.month), money(m.sales), money(m.expenses)]) }}
          >
            {c && (
              <ColumnChart
                data={c.cash}
                xKey="month"
                series={[SALES, EXP]}
                formatX={shortMonth}
                formatValue={money}
                formatAxis={(n) => rupeesCompact.format(n)}
                ariaLabel={t('chartCashTitle')}
              />
            )}
          </ChartCard>
          {canFinance && (
            <ChartCard
              title={t('chartExpensesTitle')}
              subtitle={t('thisYear')}
              empty={expenseRows.length === 0}
              table={{ columns: [t('category'), t('totalExpenses')], rows: spent.map((e) => [e.label, money(e.amount)]) }}
            >
              {/* bars, not a donut: the categories are read against each other, largest first */}
              <StackedBars rows={expenseRows.map((e) => ({ label: e.label, values: { amount: e.amount } }))} series={[SPENT]} formatValue={money} ariaLabel={t('chartExpensesTitle')} />
            </ChartCard>
          )}
          <ChartCard
            title={t('chartStockTitle')}
            subtitle={t('chartStockSub')}
            series={[RAW, FIN]}
            empty={!c || c.stockByWood.length === 0}
            table={{ columns: [t('woodType'), RAW.label, FIN.label], rows: (c?.stockByWood ?? []).map((w) => [w.woodType, num3(w.rawCft), num3(w.finishedCft)]) }}
          >
            {c && (
              <StackedBars
                rows={c.stockByWood.slice(0, 7).map((w) => ({ label: w.woodType, values: { raw: w.rawCft, finished: w.finishedCft } }))}
                series={[RAW, FIN]}
                formatValue={(n) => `${num3(n)} CFT`}
                ariaLabel={t('chartStockTitle')}
              />
            )}
          </ChartCard>
          <ChartCard
            className={canAudit ? 'lg:col-span-2' : 'lg:col-span-3'}
            title={t('chartFlowTitle')}
            subtitle={t('chartFlowSub')}
            series={[IN, OUT]}
            empty={!c || c.flow.every((d) => !d.receivedCft && !d.shippedCft)}
            table={{ columns: [t('day'), IN.label, OUT.label], rows: (c?.flow ?? []).map((d) => [shortDay(d.day), num3(d.receivedCft), num3(d.shippedCft)]) }}
          >
            {/* columns, not a line: each day is its own amount, and many days have none */}
            {c && <ColumnChart data={c.flow} xKey="day" series={[IN, OUT]} formatX={shortDay} formatValue={(n) => `${num3(n)} CFT`} ariaLabel={t('chartFlowTitle')} />}
          </ChartCard>
          {canAudit && (
            <Panel
              title={t('recentActivity')}
              tools={
                <Button asChild variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
                  <Link to="/audit">{t('viewAll')}</Link>
                </Button>
              }
            >
              {recent.length === 0 ? (
                <p className="grid flex-1 place-items-center py-8 text-sm text-muted-foreground">{audit.error ?? (audit.loading ? t('loading') : t('noData'))}</p>
              ) : (
                <ul className="-my-1 divide-y divide-border/70">
                  {recent.map((a) => {
                    const Icon = ACTION_ICON[a.action] ?? ActivityIcon;
                    return (
                      <li key={a.id} className="flex items-center gap-3 py-2.5">
                        <span
                          className={cn(
                            'grid size-8 shrink-0 place-items-center rounded-lg [&_svg]:size-4',
                            a.action === 'REJECT' ? 'bg-destructive-soft text-destructive' : a.action === 'APPROVE' ? 'bg-success-soft text-success' : 'bg-muted text-muted-foreground',
                          )}
                        >
                          <Icon aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">
                            <span className="font-medium">{readable(a.action)}</span> <span className="text-muted-foreground">· {readable(a.entityType)}</span>
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {a.user?.name ?? '—'} · {dateTime(a.createdAt)}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          )}
          </div>

          <Section title={t('accountantActivity')}>
            <TableCard empty={data!.accountantActivity.length === 0} emptyText={t('noAccountants')} pager={activity.pager}>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="pl-4">{t('accountant')}</TableHead>
                    <TableHead className={wide}>{t('lastEntry')}</TableHead>
                    <TableHead className={cn(numCell, wide)}>{t('logsMeasured')}</TableHead>
                    <TableHead className={cn(numCell, wide)}>{t('totalCft')}</TableHead>
                    <TableHead className={cn(numCell, wide)}>{t('draft')}</TableHead>
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
                            {a.lastEntryType} <span className="text-xs text-muted-foreground">{dateTime(a.lastEntryAt)}</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className={cn(numCell, wide)}>{a.logsMeasured}</TableCell>
                      <TableCell className={cn(numCell, wide)}>{num3(a.totalCft)}</TableCell>
                      <TableCell className={cn(numCell, wide)}>{a.draftEntries}</TableCell>
                      <TableCell className={cn(numCell, a.pendingEntries && 'font-semibold text-warning')}>{a.pendingEntries}</TableCell>
                      <TableCell className={cn(numCell, a.approvedEntries && 'font-semibold text-success')}>{a.approvedEntries}</TableCell>
                      <TableCell className={cn(numCell, 'pr-4', a.rejectedEntries && 'font-semibold text-destructive')}>{a.rejectedEntries}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableCard>
          </Section>
        </>
      )}
    </Page>
  );
}

import {
  BellIcon,
  LayersIcon,
  PackageIcon,
  TrendingUpIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { api } from '../api';
import { useAuth } from '../auth';
import { ChartCard, ColumnChart, StackedBars } from '../components/charts';
import { dateTime, money, num3, useLoad } from '../components/common';
import { FigureStrip, LinkRow, LoadState, Notice, numCell, OwnerOnly, Page, PageHeader, Section, Stat, StatGrid, TableCard, useClientPaging, wide } from '../components/page';
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
interface OwnerCharts {
  flow: { day: string; receivedCft: number; shippedCft: number }[];
  stockByWood: { woodType: string; rawCft: number; finishedCft: number }[];
  cash: { month: string; sales: number; expenses: number }[];
}

export const shortDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const shortMonth = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
/** How many waiting records the dashboard previews before sending the owner to the full queue. */
const QUEUE_PREVIEW = 5;
const kindKey = Object.fromEntries(KINDS);
/** The one CFT figure that sums a waiting record up. */
const queueCft = (i: ApprovalItem) => (i.type === 'PRODUCTION' ? i.outputCft : i.type === 'ADJUSTMENT' ? i.cftDelta : i.totalCft);

const rupeesCompact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 });

export function OwnerDashboard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { data, loading, error, reload } = useLoad(() => api<OwnerDashboardData>('/dashboard/owner'));
  const charts = useLoad(() => api<OwnerCharts>('/dashboard/owner/charts'));
  const queue = useLoad(() => api<ApprovalQueue>('/approvals'));
  const waiting = queue.data?.items ?? [];
  const k = data?.kpis;
  const c = charts.data;
  const activity = useClientPaging(data?.accountantActivity ?? [], 10);

  const RAW = { key: 'raw', label: t('raw'), color: 'var(--chart-1)' };
  const FIN = { key: 'finished', label: t('finished'), color: 'var(--chart-2)' };
  const IN = { key: 'receivedCft', label: t('receivedCft'), color: 'var(--chart-1)' };
  const OUT = { key: 'shippedCft', label: t('shippedCft'), color: 'var(--chart-2)' };
  const SALES = { key: 'sales', label: t('sales'), color: 'var(--chart-1)' };
  const EXP = { key: 'expenses', label: t('totalExpenses'), color: 'var(--chart-2)' };

  return (
    <Page>
      <PageHeader title={t('dashboard')} subtitle={`${t('welcome')}, ${user?.name ?? ''}`} />

      <QuickActions />

      {/* until the queue itself has loaded (or if it fails), a one-line reminder */}
      {!!k?.pendingApprovals && waiting.length === 0 && (
        <Notice tone="warn" className="justify-between">
          <span className="flex items-center gap-2 font-medium">
            <BellIcon className="size-4" />
            {t('approvalsWaiting', { n: k.pendingApprovals })}
          </span>
          <Button asChild size="sm">
            <Link to="/approvals">{t('review')}</Link>
          </Button>
        </Notice>
      )}

      <LoadState loading={loading && !data} error={error} onRetry={reload} />

      {k && (
        <>
          {/* the four numbers the owner checks first */}
          <StatGrid>
            <Stat
              hero
              icon={<TrendingUpIcon />}
              label={t('profitLoss')}
              value={money(k.profitLoss)}
              tone={k.profitLoss < 0 ? 'bad' : undefined}
              hint={`${t('totalSales')} ${money(k.totalSales)} − ${t('totalExpenses')} ${money(k.totalExpenses)}`}
            />
            <Stat icon={<LayersIcon />} label={t('rawStock')} value={num3(k.rawStockCft)} unit="CFT" />
            <Stat icon={<PackageIcon />} label={t('finishedStock')} value={num3(k.finishedStockCft)} unit="CFT" />
          </StatGrid>

          {/* what is waiting for the owner, oldest first */}
          {waiting.length > 0 && (
            <Section
              title={
                <>
                  {t('pendingApprovals')}
                  <span className="min-w-6 rounded-full bg-warning-soft px-2 text-center text-xs leading-6 font-bold text-warning tabular-nums">{queue.data!.counts.total}</span>
                </>
              }
              tools={
                <Button asChild size="sm">
                  <Link to="/approvals">{t('review')}</Link>
                </Button>
              }
            >
              <TableCard>
                <Table>
                  <TableBody>
                    {waiting.slice(0, QUEUE_PREVIEW).map((i) => (
                      <LinkRow key={`${i.type}-${i.id}`} to={PAGE_PATH[i.type](i.id)}>
                        <TableCell className="pl-4">
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
                        <TableCell className={cn(numCell, 'pr-4 font-semibold')}>
                          {num3(queueCft(i))} <span className="text-xs font-medium text-muted-foreground">CFT</span>
                        </TableCell>
                      </LinkRow>
                    ))}
                  </TableBody>
                </Table>
              </TableCard>
            </Section>
          )}

          {/* charts */}
          <div className="grid gap-4 lg:grid-cols-5">
            <ChartCard
              className="lg:col-span-3"
              title={t('chartFlowTitle')}
              subtitle={t('chartFlowSub')}
              series={[IN, OUT]}
              empty={!c || c.flow.every((d) => !d.receivedCft && !d.shippedCft)}
              table={{ columns: [t('day'), IN.label, OUT.label], rows: (c?.flow ?? []).map((d) => [shortDay(d.day), num3(d.receivedCft), num3(d.shippedCft)]) }}
            >
              {/* columns, not a line: each day is its own amount, and many days have none */}
              {c && <ColumnChart data={c.flow} xKey="day" series={[IN, OUT]} formatX={shortDay} formatValue={(n) => `${num3(n)} CFT`} ariaLabel={t('chartFlowTitle')} />}
            </ChartCard>
            <ChartCard
              className="lg:col-span-2"
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
          </div>

          <Section title={t('operations')}>
            {/* pending approvals has its own section above, so it isn't repeated here */}
            <FigureStrip
              items={[
                { label: t('todayImports'), value: k.todayImports },
                { label: t('todayExports'), value: k.todayExports },
                { label: t('totalImportLoads'), value: k.totalImportLoads },
                { label: t('totalExportLoads'), value: k.totalExportLoads },
              ]}
            />
          </Section>

          <Section
            title={
              <>
                {t('financials')} <OwnerOnly />
              </>
            }
          >
            <div className="grid gap-4 lg:grid-cols-5">
              <ChartCard
                className="lg:col-span-3"
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
              {/* total sales and expenses are already on the profit card at the top */}
              <div className="grid grid-cols-2 content-start gap-3 lg:col-span-2 lg:grid-cols-1">
                <Stat label={t('pendingReceivables')} value={money(k.pendingReceivables)} tone={k.pendingReceivables > 0 ? 'warn' : undefined} />
                <Stat label={t('pendingPayables')} value={money(k.pendingPayables)} tone={k.pendingPayables > 0 ? 'warn' : undefined} />
              </div>
            </div>
          </Section>

          <Section title={t('accountantActivity')}>
            <TableCard empty={data!.accountantActivity.length === 0} emptyText={t('noAccountants')} pager={activity.pager}>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="pl-4">{t('accountant')}</TableHead>
                    <TableHead className={wide}>{t('lastEntry')}</TableHead>
                    <TableHead className={cn(numCell, wide)}>{t('logsMeasured')}</TableHead>
                    <TableHead className={cn(numCell, wide)}>{t('totalCft')}</TableHead>
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

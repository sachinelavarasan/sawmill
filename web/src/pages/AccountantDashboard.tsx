import { ArrowDownToLineIcon, ArrowUpFromLineIcon, CalendarDaysIcon, CheckCircle2Icon, RefreshCwIcon, RulerIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { api } from '../api';
import { useAuth } from '../auth';
import { ChartCard, ColumnChart } from '../components/charts';
import { num3, useLoad } from '../components/common';
import { LinkRow, LoadState, numCell, Page, PageHeader, Section, Stat, TableCard, wide } from '../components/page';
import { QuickActions } from '../components/quick-actions';
import { StatusBadge } from '../components/status-badge';
import { type TKey, useI18n } from '../i18n';
import type { ExportSummary } from './Exports';
import type { ImportSummary } from './Imports';
import { Panel, shortDay } from './OwnerDashboard';
import type { ProductionSummary } from './Production';

interface AccountantDashboardData {
  kpis: {
    todayImports: number;
    todayExports: number;
    draftEntries: number;
    pendingSubmissions: number;
    approvedEntries: number;
    rejectedEntries: number;
  };
  measurementProgress: {
    id: string;
    code: string;
    lorryNumber: string;
    woodType: string;
    totalLogs: number;
    totalCft: number;
    status: string;
    rejectionReason: string | null;
  }[];
}

/** One row of "Recent entries": an import, production run or export, whichever is newest. */
interface Entry {
  key: string;
  to: string;
  code: string;
  kind: TKey;
  woodType: string;
  /** when it happened, for sorting and display */
  at: number;
  cft: number;
  status: string;
  rejectionReason: string | null;
}
/** How many entries of each kind are fetched, and how many rows the merged list shows. */
const RECENT_EACH = 6;
const RECENT_ROWS = 8;
/** Loads still being measured that the dashboard lists before pointing at the full page. */
const OPEN_LOADS = 4;

const list = <T,>(path: string) => api<{ items: T[] }>(`${path}?take=${RECENT_EACH}&skip=0`).then((r) => r.items);
/** Date-only values ('2026-11-14') are the mill's calendar day, not midnight UTC. */
const dayMs = (d: string) => new Date(d.length === 10 ? `${d}T00:00:00` : d).getTime();

export function AccountantDashboard() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { data, loading, error, reload } = useLoad(() => api<AccountantDashboardData>('/dashboard/accountant'));
  const charts = useLoad(() => api<{ logsByDay: { day: string; logs: number; cft: number }[] }>('/dashboard/accountant/charts'));
  // the same lists the Imports / Production / Exports pages show (an accountant's own entries), newest first
  const entries = useLoad(async (): Promise<Entry[]> => {
    const [imports, runs, exports] = await Promise.all([list<ImportSummary>('/imports'), list<ProductionSummary>('/production'), list<ExportSummary>('/exports')]);
    return [
      ...imports.map((i) => ({ key: `i${i.id}`, to: `/imports/${i.id}`, code: i.code, kind: 'imports' as const, woodType: i.woodType, at: dayMs(i.arrivalAt), cft: i.totalCft, status: i.status, rejectionReason: i.rejectionReason })),
      ...runs.map((p) => ({ key: `p${p.id}`, to: `/production/${p.id}`, code: p.code, kind: 'production' as const, woodType: p.woodType, at: dayMs(p.productionDate), cft: p.outputCft, status: p.status, rejectionReason: p.rejectionReason })),
      ...exports.map((e) => ({ key: `e${e.id}`, to: `/exports/${e.id}`, code: e.code, kind: 'exports' as const, woodType: e.woodType, at: dayMs(e.exportDate), cft: e.totalCft, status: e.status, rejectionReason: null })),
    ]
      .sort((a, b) => b.at - a.at)
      .slice(0, RECENT_ROWS);
  });

  const logs = charts.data?.logsByDay ?? [];
  const LOGS = { key: 'logs', label: t('logsMeasured'), color: 'var(--chart-1)' };
  const k = data?.kpis;
  const open = data?.measurementProgress ?? [];
  const locale = lang === 'ta' ? 'ta-IN' : 'en-IN';
  const now = new Date();
  const today = now.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
  const refreshing = loading || charts.loading || entries.loading;
  const refresh = () => {
    reload();
    charts.reload();
    entries.reload();
  };

  // where every entry stands; the colours are the same ones the status badges use
  const statuses = k
    ? [
        { label: t('draftEntries'), n: k.draftEntries, bar: 'bg-muted-foreground/45', text: '' },
        { label: t('pendingSubmissions'), n: k.pendingSubmissions, bar: 'bg-warning', text: 'text-warning' },
        { label: t('approvedEntries'), n: k.approvedEntries, bar: 'bg-success', text: 'text-success' },
        { label: t('rejectedEntries'), n: k.rejectedEntries, bar: 'bg-destructive', text: 'text-destructive' },
      ]
    : [];
  const totalEntries = statuses.reduce((a, s) => a + s.n, 0);

  return (
    <Page>
      <PageHeader
        eyebrow={user?.mill.name}
        title={`${t('welcome')}, ${user?.name ?? ''}`}
        subtitle={t('accountantDashSub')}
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

      {/* the work starts here: one tap to a new import, measuring, production or export */}
      <QuickActions />

      <LoadState loading={loading && !data} error={error} onRetry={reload} />

      {k && (
        <>
          {/* today's two counts beside where every entry stands (the same frame as the owner's dashboard) */}
          <div className="grid gap-3 sm:gap-4 lg:grid-cols-4">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-1">
              <Stat to="/imports" icon={<ArrowDownToLineIcon />} label={t('todayImports')} value={k.todayImports.toLocaleString('en-IN')} hint={today} />
              <Stat to="/exports" icon={<ArrowUpFromLineIcon />} label={t('todayExports')} value={k.todayExports.toLocaleString('en-IN')} hint={today} />
            </div>

            <Panel
              className="lg:col-span-3"
              title={t('entryStatus')}
              tools={
                <span className="text-sm text-muted-foreground">
                  {t('total')} <span className="font-semibold text-foreground tabular-nums">{totalEntries}</span>
                </span>
              }
            >
              {/* one bar split by status: how much of the work is through approval */}
              <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={statuses.map((s) => `${s.label}: ${s.n}`).join(', ')}>
                {statuses
                  .filter((s) => s.n > 0)
                  .map((s) => (
                    <span key={s.label} className={cn('min-w-1.5', s.bar)} style={{ flexGrow: s.n }} />
                  ))}
              </div>
              <dl className="mt-4 grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
                {statuses.map((s) => (
                  <div key={s.label} className="flex min-w-0 flex-col justify-center gap-2.5 rounded-lg bg-muted/60 p-3.5">
                    <dt className="flex items-start gap-2 text-[0.8125rem] leading-snug font-medium text-muted-foreground">
                      <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', s.bar)} aria-hidden />
                      {s.label}
                    </dt>
                    <dd className={cn('text-2xl leading-none font-bold tracking-[-0.02em] tabular-nums sm:text-[1.7rem]', s.n > 0 && s.text)}>{s.n}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </div>

          <div className="grid gap-3 sm:gap-4 lg:grid-cols-5">
            {/* loads still open: drafts to keep measuring, rejected ones to fix */}
            <Panel
              className="lg:col-span-3"
              flush={open.length > 0}
              title={
                <>
                  {t('measurementProgress')}
                  <span className={cn('min-w-6 rounded-full px-2 text-center text-xs leading-6 font-bold tabular-nums', open.length ? 'bg-warning-soft text-warning' : 'bg-muted text-muted-foreground')}>
                    {open.length}
                  </span>
                </>
              }
              tools={
                <Button asChild size="sm" variant="outline">
                  <Link to="/measurement">{t('viewAll')}</Link>
                </Button>
              }
            >
              {open.length === 0 ? (
                <p className="flex flex-1 items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2Icon className="size-4 shrink-0 text-success" aria-hidden />
                  {t('noData')}
                </p>
              ) : (
                <ul className="divide-y divide-border/70 border-t border-border/70">
                  {open.slice(0, OPEN_LOADS).map((l) => (
                    <li key={l.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <Link className="font-semibold text-primary hover:underline" to={`/imports/${l.id}`}>
                            {l.code}
                          </Link>
                          <StatusBadge status={l.status} />
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {l.lorryNumber} · {l.woodType} · {l.totalLogs} {t('logs')} · {num3(l.totalCft)} CFT
                        </div>
                        {l.rejectionReason && <div className="mt-1 text-xs text-destructive">{l.rejectionReason}</div>}
                      </div>
                      <Button asChild size="sm" variant={l.status === 'REJECTED' ? 'outline' : 'default'} className="shrink-0">
                        <Link to={`/imports/${l.id}`}>
                          <RulerIcon />
                          {l.status === 'REJECTED' ? t('open') : t('measure')}
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <ChartCard
              className="lg:col-span-2"
              title={t('chartLogsTitle')}
              subtitle={t('chartLogsSub')}
              empty={!charts.data || logs.every((d) => !d.logs)}
              table={{ columns: [t('day'), t('logsMeasured'), 'CFT'], rows: logs.map((d) => [shortDay(d.day), d.logs, num3(d.cft)]) }}
            >
              <ColumnChart data={logs} xKey="day" series={[LOGS]} formatX={shortDay} formatValue={(n) => `${n} ${t('logs').toLowerCase()}`} ariaLabel={t('chartLogsTitle')} height={180} />
            </ChartCard>
          </div>

          <Section
            title={t('recentEntries')}
            tools={
              <Button asChild size="sm" variant="outline">
                <Link to="/my-entries">{t('viewAll')}</Link>
              </Button>
            }
          >
            <TableCard empty={(entries.data ?? []).length === 0} emptyText={entries.error ?? (entries.loading ? t('loading') : t('noData'))} busy={entries.loading && !!entries.data}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">ID</TableHead>
                    <TableHead className={wide}>{t('type')}</TableHead>
                    <TableHead className={wide}>{t('woodType')}</TableHead>
                    <TableHead className={wide}>{t('date')}</TableHead>
                    <TableHead className={numCell}>{t('totalCft')}</TableHead>
                    <TableHead className="pr-4">{t('status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(entries.data ?? []).map((e) => {
                    const day = new Date(e.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                    return (
                      <LinkRow key={e.key} to={e.to}>
                        <TableCell className="pl-4">
                          <Link className="font-semibold text-primary hover:underline" to={e.to}>
                            {e.code}
                          </Link>
                          <div className="text-xs text-muted-foreground md:hidden">
                            {t(e.kind)} · {e.woodType} · {day}
                          </div>
                        </TableCell>
                        <TableCell className={wide}>
                          <Badge variant="secondary">{t(e.kind)}</Badge>
                        </TableCell>
                        <TableCell className={wide}>{e.woodType}</TableCell>
                        <TableCell className={cn(wide, 'text-muted-foreground')}>{day}</TableCell>
                        <TableCell className={cn(numCell, 'font-semibold')}>{num3(e.cft)}</TableCell>
                        <TableCell className="pr-4 whitespace-normal">
                          <StatusBadge status={e.status} />
                          {e.rejectionReason && <div className="mt-1 max-w-56 text-xs text-destructive">{e.rejectionReason}</div>}
                        </TableCell>
                      </LinkRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableCard>
          </Section>
        </>
      )}
    </Page>
  );
}

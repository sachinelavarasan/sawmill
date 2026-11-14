import { CheckCircle2Icon, ClockIcon, FilePenIcon, TruckIcon, XCircleIcon } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { api } from '../api';
import { useAuth } from '../auth';
import { ChartCard, ColumnChart } from '../components/charts';
import { num3, useLoad } from '../components/common';
import { LoadState, numCell, Page, PageHeader, Section, Stat, StatGrid, TableCard, useClientPaging, wide } from '../components/page';
import { QuickActions } from '../components/quick-actions';
import { StatusBadge } from '../components/status-badge';
import { useI18n } from '../i18n';
import { shortDay } from './OwnerDashboard';

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

export function AccountantDashboard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { data, loading, error, reload } = useLoad(() => api<AccountantDashboardData>('/dashboard/accountant'));
  const charts = useLoad(() => api<{ logsByDay: { day: string; logs: number; cft: number }[] }>('/dashboard/accountant/charts'));
  const logs = charts.data?.logsByDay ?? [];
  const LOGS = { key: 'logs', label: t('logsMeasured'), color: 'var(--chart-1)' };
  const k = data?.kpis;
  const progress = useClientPaging(data?.measurementProgress ?? [], 10);

  return (
    <Page>
      <PageHeader title={t('dashboard')} subtitle={`${t('welcome')}, ${user?.name ?? ''}`} />
      <QuickActions />
      <LoadState loading={loading && !data} error={error} onRetry={reload} />

      {k && (
        <>
          <StatGrid className="lg:grid-cols-3">
            <Stat icon={<TruckIcon />} label={t('todayImports')} value={k.todayImports} />
            <Stat icon={<TruckIcon />} label={t('todayExports')} value={k.todayExports} />
            <Stat icon={<FilePenIcon />} label={t('draftEntries')} value={k.draftEntries} />
            <Stat icon={<ClockIcon />} label={t('pendingSubmissions')} value={k.pendingSubmissions} tone={k.pendingSubmissions ? 'warn' : undefined} />
            <Stat icon={<CheckCircle2Icon />} label={t('approvedEntries')} value={k.approvedEntries} tone="good" />
            <Stat icon={<XCircleIcon />} label={t('rejectedEntries')} value={k.rejectedEntries} tone={k.rejectedEntries ? 'bad' : undefined} />
          </StatGrid>

          <ChartCard
            title={t('chartLogsTitle')}
            subtitle={t('chartLogsSub')}
            empty={!charts.data || logs.every((d) => !d.logs)}
            table={{ columns: [t('day'), t('logsMeasured'), 'CFT'], rows: logs.map((d) => [shortDay(d.day), d.logs, num3(d.cft)]) }}
          >
            <ColumnChart data={logs} xKey="day" series={[LOGS]} formatX={shortDay} formatValue={(n) => `${n} ${t('logs').toLowerCase()}`} ariaLabel={t('chartLogsTitle')} height={180} />
          </ChartCard>

          <Section title={t('measurementProgress')}>
            <TableCard empty={data!.measurementProgress.length === 0} emptyText={t('noData')} pager={progress.pager}>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="pl-4">ID</TableHead>
                    <TableHead className={wide}>{t('lorry')}</TableHead>
                    <TableHead className={wide}>{t('woodType')}</TableHead>
                    <TableHead className={cn(numCell, wide)}>{t('logs')}</TableHead>
                    <TableHead className={numCell}>{t('totalCft')}</TableHead>
                    <TableHead className="pr-4">{t('status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {progress.rows.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="pl-4 font-medium">
                        {l.code}
                        <div className="text-xs font-normal text-muted-foreground md:hidden">
                          {l.lorryNumber} · {l.woodType} · {l.totalLogs} {t('logs')}
                        </div>
                      </TableCell>
                      <TableCell className={wide}>{l.lorryNumber}</TableCell>
                      <TableCell className={wide}>{l.woodType}</TableCell>
                      <TableCell className={cn(numCell, wide)}>{l.totalLogs}</TableCell>
                      <TableCell className={cn(numCell, 'font-semibold')}>{l.totalCft.toFixed(3)}</TableCell>
                      <TableCell className="pr-4 whitespace-normal">
                        <StatusBadge status={l.status} />
                        {l.rejectionReason && <div className="mt-1 max-w-56 text-xs text-destructive">{l.rejectionReason}</div>}
                      </TableCell>
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

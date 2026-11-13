import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { api } from '../api';
import { dateTime, useLoad } from '../components/common';
import { LoadState, Page, PageHeader, usePaging, TableCard, wide } from '../components/page';
import { useI18n } from '../i18n';

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  ip: string | null;
  createdAt: string;
  user: { name: string; username: string; role: string } | null;
}


export function AuditLogPage() {
  const { t } = useI18n();
  const paging = usePaging();
  const { data, loading, error, reload } = useLoad(
    () => api<{ items: AuditRow[]; total: number }>(`/audit-logs?take=${paging.take}&skip=${paging.skip}`),
    [paging.skip, paging.take],
  );

  return (
    <Page>
      <PageHeader title={t('auditLog')} />
      <LoadState loading={loading && !data} error={error} onRetry={reload} />
      {data && (
        <>
          <TableCard empty={data.items.length === 0} emptyText={t('noData')} pager={paging.pager(data.total)}>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className={cn(wide, 'pl-4')}>{t('time')}</TableHead>
                  <TableHead className="max-md:pl-4">{t('action')}</TableHead>
                  <TableHead className={wide}>{t('user')}</TableHead>
                  <TableHead className="max-md:pr-4">{t('record')}</TableHead>
                  <TableHead className={cn(wide, 'pr-4')}>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((r) => {
                  const who = r.user ? `${r.user.name} (${r.user.username})` : '—';
                  return (
                    <TableRow key={r.id}>
                      <TableCell className={cn(wide, 'pl-4 text-muted-foreground')}>{dateTime(r.createdAt)}</TableCell>
                      <TableCell className="max-md:pl-4">
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{r.action}</code>
                        <div className="mt-1 text-xs text-muted-foreground md:hidden">
                          {dateTime(r.createdAt)} · {who}
                        </div>
                      </TableCell>
                      <TableCell className={wide}>{who}</TableCell>
                      <TableCell className="max-md:pr-4">{r.entityType}</TableCell>
                      <TableCell className={cn(wide, 'pr-4 text-xs text-muted-foreground')}>{r.ip ?? '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableCard>
        </>
      )}
    </Page>
  );
}

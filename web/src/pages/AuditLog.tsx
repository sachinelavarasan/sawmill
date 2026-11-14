import { useMemo } from 'react';
import { dateTime, useApi } from '../components/common';
import { type Column, DataTable } from '../components/data-table';
import { LoadState, Page, PageHeader, usePaging } from '../components/page';
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

const who = (r: AuditRow) => (r.user ? `${r.user.name} (${r.user.username})` : '—');

export function AuditLogPage() {
  const { t } = useI18n();
  const paging = usePaging();
  const { data, loading, error, reload } = useApi<{ items: AuditRow[]; total: number }>(`/audit-logs?take=${paging.take}&skip=${paging.skip}`);

  const columns = useMemo(
    (): Column<AuditRow>[] => [
      { id: 'time', header: t('time'), from: 'md', className: 'text-muted-foreground', cell: (r) => dateTime(r.createdAt) },
      {
        id: 'action',
        header: t('action'),
        cell: (r) => (
          <>
            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">{r.action}</code>
            <div className="mt-1 text-xs text-muted-foreground md:hidden">
              {dateTime(r.createdAt)} · {who(r)}
            </div>
          </>
        ),
      },
      { id: 'user', header: t('user'), from: 'md', cell: who },
      { id: 'record', header: t('record'), cell: (r) => r.entityType },
      { id: 'ip', header: 'IP', from: 'md', className: 'text-xs text-muted-foreground', cell: (r) => r.ip ?? '—' },
    ],
    [t],
  );

  return (
    <Page>
      <PageHeader title={t('auditLog')} />
      <LoadState loading={loading && !data} error={error} onRetry={reload} />
      {data && <DataTable data={data.items} columns={columns} rowKey={(r) => r.id} empty={t('noData')} pager={paging.pager(data.total)} busy={loading} />}
    </Page>
  );
}

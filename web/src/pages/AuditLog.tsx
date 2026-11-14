import { ChevronRightIcon, ScrollTextIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { dateTime, useApi } from '../components/common';
import { type Column, DataTable } from '../components/data-table';
import { ALL, LoadState, Page, PageHeader, usePaging } from '../components/page';
import { Box, Boxes, QuickPanel, Tag } from '../components/quick-panel';
import { TKey, useI18n } from '../i18n';

type Json = Record<string, unknown> | null;
interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  before: Json;
  after: Json;
  ip: string | null;
  createdAt: string;
  user: { name: string; username: string; role: string } | null;
}

/** What happened, in words, and how loudly to show it. Actions not listed are shown as recorded. */
const ACTIONS: Record<string, { label: TKey; tone: string }> = {
  CREATE: { label: 'auditActCreate', tone: 'bg-info-soft text-info' },
  UPDATE: { label: 'auditActUpdate', tone: 'bg-muted text-foreground' },
  OWNER_EDIT: { label: 'auditActOwnerEdit', tone: 'bg-muted text-foreground' },
  DELETE: { label: 'auditActDelete', tone: 'bg-destructive-soft text-destructive' },
  SUBMIT: { label: 'auditActSubmit', tone: 'bg-warning-soft text-warning' },
  APPROVE: { label: 'auditActApprove', tone: 'bg-success-soft text-success' },
  REJECT: { label: 'auditActReject', tone: 'bg-destructive-soft text-destructive' },
  LOGIN: { label: 'auditActLogin', tone: 'bg-muted text-muted-foreground' },
  LOGOUT: { label: 'auditActLogout', tone: 'bg-muted text-muted-foreground' },
  LOGIN_LOCKED: { label: 'auditActLoginLocked', tone: 'bg-warning-soft text-warning' },
  REFRESH_TOKEN_REUSE: { label: 'auditActTokenReuse', tone: 'bg-warning-soft text-warning' },
  RESET_PASSWORD: { label: 'auditActResetPassword', tone: 'bg-warning-soft text-warning' },
  DOWNLOAD_REPORT: { label: 'auditActDownloadReport', tone: 'bg-muted text-muted-foreground' },
};
/** The kinds of record the log speaks of; `page` is where such a record opens, when it has a page of its own. */
const ENTITIES: Record<string, { label: TKey; page?: (id: string) => string }> = {
  ImportLoad: { label: 'auditEntImportLoad', page: (id) => `/imports/${id}` },
  LogMeasurement: { label: 'auditEntLogMeasurement' },
  UnloadingEntry: { label: 'auditEntUnloadingEntry' },
  ImportFinancials: { label: 'auditEntImportFinancials' },
  ProductionRun: { label: 'auditEntProductionRun', page: (id) => `/production/${id}` },
  ProductionOutput: { label: 'auditEntProductionOutput' },
  ExportLoad: { label: 'auditEntExportLoad', page: (id) => `/exports/${id}` },
  ExportMeasurement: { label: 'auditEntExportMeasurement' },
  ExportFinancials: { label: 'auditEntExportFinancials' },
  StockAdjustment: { label: 'auditEntStockAdjustment' },
  Expense: { label: 'auditEntExpense' },
  Client: { label: 'auditEntClient' },
  Supplier: { label: 'auditEntSupplier' },
  User: { label: 'auditEntUser' },
  Mill: { label: 'auditEntMill' },
  Report: { label: 'auditEntReport' },
};

/** The record's own name where the event carries one (its code, a person's or party's name), so it can be recognised without its ID. */
function recordName(r: AuditRow): string | null {
  for (const data of [r.after, r.before]) {
    if (!data) continue;
    for (const k of ['code', 'name', 'username', 'category', 'key']) {
      const v = data[k];
      if (typeof v === 'string' && v) return v;
    }
  }
  return null;
}
const shortId = (id: string) => id.slice(0, 8);
const localDay = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};
const exactTime = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' });
/** A stored value as text: plain values as they are, anything nested as compact JSON. */
const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** [OWNER-ONLY] Every recorded action, newest first. Read-only. */
export function AuditLogPage() {
  const { t } = useI18n();
  const paging = usePaging(50);
  // sent to the server: they apply to the whole log
  const [userId, setUserId] = useState('');
  const [entityType, setEntityType] = useState('');
  // applied here, to the page that is loaded: the server cannot filter by these
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [peekId, setPeekId] = useState<string | null>(null);

  const query = `take=${paging.take}&skip=${paging.skip}${userId ? `&userId=${userId}` : ''}${entityType ? `&entityType=${entityType}` : ''}`;
  const { data, loading, error, reload } = useApi<{ items: AuditRow[]; total: number }>(`/audit-logs?${query}`);
  const users = useApi<{ id: string; name: string; username: string }[]>('/users');

  const actionLabel = (a: string) => (ACTIONS[a] ? t(ACTIONS[a].label) : a);
  const entityLabel = (e: string) => (ENTITIES[e] ? t(ENTITIES[e].label) : e);

  const pageFiltered = !!action || !!from || !!to;
  const rows = useMemo(
    () => (data?.items ?? []).filter((r) => (!action || r.action === action) && (!from || localDay(r.createdAt) >= from) && (!to || localDay(r.createdAt) <= to)),
    [data, action, from, to],
  );
  const peek = data?.items.find((r) => r.id === peekId) ?? null;
  const anyFilter = pageFiltered || !!userId || !!entityType;
  const clear = () => {
    setUserId('');
    setEntityType('');
    setAction('');
    setFrom('');
    setTo('');
    paging.reset();
  };

  const columns = useMemo(
    (): Column<AuditRow>[] => [
      {
        id: 'time',
        header: t('time'),
        from: 'md',
        className: 'tabular-nums',
        cell: (r) => (
          <span title={exactTime(r.createdAt)} className="text-muted-foreground">
            {dateTime(r.createdAt)}
          </span>
        ),
      },
      {
        id: 'action',
        header: t('eventType'),
        cell: (r) => (
          <>
            <span className={cn('inline-block rounded-md px-2 py-0.5 text-[0.8125rem] font-medium', ACTIONS[r.action]?.tone ?? 'bg-muted')}>{actionLabel(r.action)}</span>
            <div className="mt-1 text-xs text-muted-foreground md:hidden">
              {dateTime(r.createdAt)} · {r.user?.name ?? t('systemUser')}
            </div>
          </>
        ),
      },
      {
        id: 'record',
        header: t('record'),
        cell: (r) => {
          const name = recordName(r);
          return (
            <>
              <div className="font-medium">{entityLabel(r.entityType)}</div>
              {(name || r.entityId) && (
                <div className="max-w-52 truncate text-xs text-muted-foreground" title={r.entityId ?? undefined}>
                  {name ?? <span className="font-mono">{shortId(r.entityId!)}…</span>}
                </div>
              )}
            </>
          );
        },
      },
      {
        id: 'user',
        header: t('user'),
        from: 'md',
        cell: (r) =>
          r.user ? (
            <div className="flex items-center gap-2">
              <Avatar size="sm">
                <AvatarFallback className="bg-muted text-xs font-semibold">{r.user.name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="max-w-36 truncate">{r.user.name}</div>
                <div className="text-xs text-muted-foreground">{t(r.user.role === 'OWNER' ? 'owner' : 'accountant')}</div>
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground">{t('systemUser')}</span>
          ),
      },
      { id: 'ip', header: t('ipAddress'), from: 'md', className: 'font-mono text-xs text-muted-foreground', cell: (r) => r.ip ?? '—' },
      {
        id: 'open',
        header: <span className="sr-only">{t('actions')}</span>,
        className: 'w-px text-right',
        cell: (r) => (
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={`${t('viewDetails')}: ${actionLabel(r.action)} · ${entityLabel(r.entityType)}`} title={t('viewDetails')} onClick={() => setPeekId(r.id)}>
            <ChevronRightIcon />
          </Button>
        ),
      },
    ],
    // the label helpers only read `t`
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  );

  const selectClass = 'w-full sm:w-44';
  const toolbar = (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {users.data && (
          <Select
            value={userId || ALL}
            onValueChange={(v) => {
              setUserId(v === ALL ? '' : v);
              paging.reset();
            }}
          >
            <SelectTrigger size="sm" className={selectClass} aria-label={t('user')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('allUsers')}</SelectItem>
              {users.data.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select
          value={entityType || ALL}
          onValueChange={(v) => {
            setEntityType(v === ALL ? '' : v);
            paging.reset();
          }}
        >
          <SelectTrigger size="sm" className={selectClass} aria-label={t('recordType')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('allRecordTypes')}</SelectItem>
            {Object.entries(ENTITIES).map(([k, e]) => (
              <SelectItem key={k} value={k}>
                {t(e.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={action || ALL} onValueChange={(v) => setAction(v === ALL ? '' : v)}>
          <SelectTrigger size="sm" className={selectClass} aria-label={t('eventType')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('allEvents')}</SelectItem>
            {Object.entries(ACTIONS).map(([k, a]) => (
              <SelectItem key={k} value={k}>
                {t(a.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <Input type="date" aria-label={t('from')} title={t('from')} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="h-8 w-[9.25rem]" />
          <span className="text-muted-foreground">–</span>
          <Input type="date" aria-label={t('to')} title={t('to')} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="h-8 w-[9.25rem]" />
        </div>
        {anyFilter && (
          <Button variant="ghost" size="sm" onClick={clear}>
            {t('clearFilters')}
          </Button>
        )}
      </div>
      {pageFiltered && data && <p className="text-xs text-muted-foreground">{t('auditPageFilterNote', { n: data.items.length })}</p>}
    </div>
  );

  // before / after, field by field: what changed first
  const fields = peek ? [...new Set([...Object.keys(peek.before ?? {}), ...Object.keys(peek.after ?? {})])] : [];
  const changed = (k: string) => show(peek?.before?.[k]) !== show(peek?.after?.[k]);
  const both = !!peek?.before && !!peek?.after;
  const page = peek?.entityId ? ENTITIES[peek.entityType]?.page?.(peek.entityId) : undefined;

  return (
    <Page>
      <PageHeader title={t('auditLog')} subtitle={t('auditSub')} />
      <LoadState loading={loading && !data} error={error} onRetry={reload} />
      {data && (
        <DataTable
          data={rows}
          columns={columns}
          rowKey={(r) => r.id}
          onRowClick={(r) => setPeekId(r.id)}
          selectedKey={peek?.id}
          empty={pageFiltered ? t('auditNoMatch') : t('noData')}
          pager={paging.pager(data.total)}
          busy={loading}
          toolbar={toolbar}
        />
      )}

      <QuickPanel
        open={!!peek}
        onClose={() => setPeekId(null)}
        title={t('auditEvent')}
        icon={<ScrollTextIcon aria-hidden />}
        code={peek ? actionLabel(peek.action) : undefined}
        sub={peek && [entityLabel(peek.entityType), recordName(peek)].filter(Boolean).join(' · ')}
        fullTo={page}
        tags={peek && <Tag>{exactTime(peek.createdAt)}</Tag>}
      >
        {peek && (
          <>
            <Boxes>
              <Box label={t('user')}>{peek.user ? `${peek.user.name} (@${peek.user.username})` : t('systemUser')}</Box>
              <Box label={t('role')}>{peek.user && t(peek.user.role === 'OWNER' ? 'owner' : 'accountant')}</Box>
              <Box label={t('recordType')}>{entityLabel(peek.entityType)}</Box>
              <Box label={t('ipAddress')}>{peek.ip && <span className="font-mono text-xs">{peek.ip}</span>}</Box>
              <Box label={t('recordId')} wide>
                {peek.entityId && <span className="font-mono text-xs break-all">{peek.entityId}</span>}
              </Box>
            </Boxes>

            <div>
              <div className="mb-1.5 text-[0.8125rem] font-medium">{t(both ? 'changesMade' : 'recordedData')}</div>
              {fields.length === 0 ? (
                <p className="rounded-xl border px-4 py-4 text-sm text-muted-foreground">{t('noChangeData')}</p>
              ) : (
                <ChangeTable fields={fields} before={peek.before} after={peek.after} changed={changed} />
              )}
            </div>
          </>
        )}
      </QuickPanel>
    </Page>
  );
}

/**
 * Field | Before | After. When the event holds both sides, the fields that changed come
 * first and are marked; the rest are folded away until asked for. With one side only
 * (a creation or a deletion) it is a plain list of what was recorded.
 */
function ChangeTable({ fields, before, after, changed }: { fields: string[]; before: Json; after: Json; changed: (k: string) => boolean }) {
  const { t } = useI18n();
  const [all, setAll] = useState(false);
  const both = !!before && !!after;
  const moved = both ? fields.filter(changed) : fields;
  const same = both ? fields.filter((k) => !changed(k)) : [];
  const shown = all ? [...moved, ...same] : moved;
  const cell = 'px-3 py-2 align-top break-words';
  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs">
            <th className="w-[34%] px-3 py-2 font-medium">{t('fieldName')}</th>
            {before && <th className="px-3 py-2 font-medium">{t('beforeValue')}</th>}
            {after && <th className="px-3 py-2 font-medium">{t('afterValue')}</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {shown.map((k) => {
            const isChanged = both && changed(k);
            return (
              <tr key={k}>
                <th scope="row" className={cn(cell, 'text-left font-mono text-xs font-normal text-muted-foreground')}>
                  {k}
                </th>
                {before && <td className={cn(cell, isChanged && 'bg-destructive-soft/60 text-destructive')}>{show(before[k])}</td>}
                {after && <td className={cn(cell, isChanged && 'bg-success-soft/60 font-medium text-success')}>{show(after[k])}</td>}
              </tr>
            );
          })}
          {shown.length === 0 && (
            <tr>
              <td colSpan={3} className="px-3 py-3 text-muted-foreground">
                {t('noChangeData')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {same.length > 0 && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          aria-expanded={all}
          className="w-full border-t px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-muted/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          {all ? t('hideUnchanged') : t('showUnchanged', { n: same.length })}
        </button>
      )}
    </div>
  );
}

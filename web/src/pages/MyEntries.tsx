import { ArrowDownToLineIcon, ArrowUpFromLineIcon, EyeIcon, FactoryIcon, type LucideIcon, PencilIcon, PlusIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { dateTime, num3 } from '../components/common';
import { type Column, DataTable } from '../components/data-table';
import { FilterChips, LoadState, Notice, Page, PageHeader, SearchBox } from '../components/page';
import { quietSearch, useRecordList } from '../components/record-list';
import { StatusBadge } from '../components/status-badge';
import { type TKey, useI18n } from '../i18n';
import type { ExportSummary } from './Exports';
import type { ImportSummary } from './Imports';
import { dateOnly, type ProductionSummary } from './Production';

type Kind = 'imports' | 'production' | 'exports';
const KINDS: Kind[] = ['imports', 'production', 'exports'];
const KIND_ICON: Record<Kind, LucideIcon> = { imports: ArrowDownToLineIcon, production: FactoryIcon, exports: ArrowUpFromLineIcon };
const NEW: Record<Kind, { to: string; label: TKey; none: TKey; search: TKey }> = {
  imports: { to: '/imports/new', label: 'newImport', none: 'noImports', search: 'searchRecords' },
  production: { to: '/production/new', label: 'newProduction', none: 'noProduction', search: 'searchProduction' },
  exports: { to: '/exports/new', label: 'newExport', none: 'noExports', search: 'searchRecords' },
};

/** One entry of any kind, reduced to what this page shows. */
interface Entry {
  id: string;
  code: string;
  to: string;
  /** a line that tells this entry from its neighbours: its lorry, wood, source load */
  what: string;
  /** the day the work was done (arrival, production or export date) */
  day: string;
  /** when the record was last touched, where the list reports it (imports only, today) */
  updatedAt?: string | null;
  cft: number;
  status: string;
  rejectionReason: string | null;
}

type WithUpdated<T> = T & { updatedAt?: string | null };
const STATUS_FILTERS: [string, TKey, string][] = [
  ['DRAFT', 'draft', 'bg-muted-foreground'],
  ['SUBMITTED', 'pending', 'bg-warning'],
  ['APPROVED', 'approved', 'bg-success'],
  ['REJECTED', 'rejected', 'bg-destructive'],
];
/** An accountant may change an entry only before it is submitted, or after it comes back rejected. The record pages enforce this themselves. */
const canChange = (status: string) => status === 'DRAFT' || status === 'REJECTED';

/**
 * The accountant's own records in one place: imports, production runs and exports, each with its
 * status. The lists come from the same endpoints as the record pages, which the server already
 * scopes to whoever is signed in.
 */
export function MyEntriesPage() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const tab = (KINDS.includes(params.get('tab') as Kind) ? params.get('tab') : 'imports') as Kind;

  const imports = useRecordList<WithUpdated<ImportSummary>>({ path: '/imports', name: 'my-imports' });
  const production = useRecordList<WithUpdated<ProductionSummary>>({ path: '/production', name: 'my-production' });
  const exports = useRecordList<WithUpdated<ExportSummary> & { rejectionReason?: string | null }>({ path: '/exports', name: 'my-exports' });
  const lists = { imports, production, exports };
  const list = lists[tab];

  // one status filter for the whole page: it follows you from tab to tab
  const [status, setStatusState] = useState('');
  const setStatus = (s: string) => {
    setStatusState(s);
    KINDS.forEach((k) => lists[k].pickStatus(s));
  };
  const clearAll = () => {
    list.setQ('');
    setStatus('');
  };
  const rejected = KINDS.reduce((n, k) => n + (lists[k].counts.REJECTED ?? 0), 0);
  /** the first tab holding a rejected entry: where "Show rejected" lands */
  const firstRejected = KINDS.find((k) => (lists[k].counts.REJECTED ?? 0) > 0) ?? tab;

  const rows: Record<Kind, Entry[]> = {
    imports: (imports.data?.items ?? []).map((i) => ({
      id: i.id,
      code: i.code,
      to: `/imports/${i.id}`,
      what: `${i.lorryNumber} · ${i.woodType} · ${i.totalLogs} ${t('logs').toLowerCase()}`,
      day: i.arrivalAt.slice(0, 10),
      updatedAt: i.updatedAt,
      cft: i.totalCft,
      status: i.status,
      rejectionReason: i.rejectionReason,
    })),
    production: (production.data?.items ?? []).map((p) => ({
      id: p.id,
      code: p.code,
      to: `/production/${p.id}`,
      what: `${p.importCode} · ${p.woodType}`,
      day: p.productionDate,
      updatedAt: p.updatedAt,
      cft: p.outputCft,
      status: p.status,
      rejectionReason: p.rejectionReason,
    })),
    exports: (exports.data?.items ?? []).map((e) => ({
      id: e.id,
      code: e.code,
      to: `/exports/${e.id}`,
      what: `${e.lorryNumber} · ${e.woodType} · ${t('piecesCount', { n: e.totalPieces })}`,
      day: e.exportDate,
      updatedAt: e.updatedAt,
      cft: e.totalCft,
      status: e.status,
      rejectionReason: e.rejectionReason ?? null,
    })),
  };
  const hasUpdated = rows[tab].some((r) => r.updatedAt);

  const Icon = KIND_ICON[tab];
  const columns: Column<Entry>[] = [
    {
      id: 'code',
      header: t('record'),
      className: 'whitespace-normal',
      cell: (r) => (
        <div className="flex items-start gap-3">
          <span
            className={cn('grid size-9 shrink-0 place-items-center rounded-lg max-sm:hidden', r.status === 'REJECTED' ? 'bg-destructive-soft text-destructive' : 'bg-muted text-foreground/80')}
            aria-hidden
          >
            <Icon className="size-[1.125rem]" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <Link className="font-semibold text-primary hover:underline" to={r.to}>
              {r.code}
            </Link>
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{t(tab)}</span> · {r.what}
            </div>
            {/* on phones the date folds in here */}
            <div className="text-xs text-muted-foreground md:hidden">{dateOnly(r.day)}</div>
            {/* why it came back: the first thing to read on a rejected entry */}
            {r.status === 'REJECTED' && r.rejectionReason && (
              <div className="mt-2 max-w-md rounded-md bg-destructive-soft px-3 py-2 text-xs text-destructive">
                <span className="font-semibold">{t('rejectReason')}:</span> {r.rejectionReason}
              </div>
            )}
          </div>
        </div>
      ),
    },
    { id: 'day', header: t('date'), from: 'md', className: 'text-muted-foreground tabular-nums', cell: (r) => dateOnly(r.day) },
    ...(hasUpdated
      ? [{ id: 'updated', header: t('lastUpdated'), from: 'lg', className: 'text-muted-foreground tabular-nums', cell: (r) => (r.updatedAt ? dateTime(r.updatedAt) : '—') } satisfies Column<Entry>]
      : []),
    { id: 'cft', header: t('totalCft'), from: 'sm', numeric: true, className: 'font-semibold', cell: (r) => num3(r.cft) },
    { id: 'status', header: t('status'), cell: (r) => <StatusBadge status={r.status} /> },
    {
      id: 'open',
      header: <span className="sr-only">{t('actions')}</span>,
      className: 'w-px text-right',
      cell: (r) => {
        // Edit where the entry can still be changed; otherwise it can only be looked at
        const change = canChange(r.status);
        const label = r.status === 'REJECTED' ? t('correctEntry') : change ? t('continueEntry') : t('view');
        return (
          <Button asChild size="sm" variant={r.status === 'REJECTED' ? 'default' : 'outline'} className="max-md:size-9 max-md:px-0">
            <Link to={r.to} aria-label={`${label} ${r.code}`} title={change ? undefined : t('entryLocked')}>
              {change ? <PencilIcon /> : <EyeIcon />}
              <span className="max-md:sr-only">{label}</span>
            </Link>
          </Button>
        );
      },
    },
  ];

  const go = (k: Kind) => setParams({ tab: k }, { replace: true });

  return (
    <Page>
      <PageHeader
        title={t('myEntries')}
        subtitle={t('myEntriesSub')}
        actions={
          <Button asChild>
            <Link to={NEW[tab].to}>
              <PlusIcon /> {t(NEW[tab].label)}
            </Link>
          </Button>
        }
      />

      {/* rejected entries are work waiting to be redone: said once, at the top, with the way to them */}
      {rejected > 0 && status !== 'REJECTED' && (
        <Notice tone="error" className="justify-between">
          <span className="flex-1">
            <span className="font-semibold">{t('needsCorrection', { n: rejected })}</span>
            <span className="max-sm:hidden"> — {t('needsCorrectionSub')}</span>
          </span>
          <Button
            size="sm"
            variant="outline"
            className="border-destructive/30 bg-card text-destructive hover:bg-card"
            onClick={() => {
              setStatus('REJECTED');
              go(firstRejected);
            }}
          >
            {t('showRejected')}
          </Button>
        </Notice>
      )}

      <Tabs value={tab} onValueChange={(v) => go(v as Kind)} className="gap-5">
        <TabsList variant="line" className="scroll-quiet h-auto! w-full justify-start gap-1 overflow-x-auto overflow-y-hidden">
          {KINDS.map((k) => {
            const KIcon = KIND_ICON[k];
            const n = lists[k].counts[status];
            return (
              <TabsTrigger key={k} value={k} className="h-10 flex-none gap-2 rounded-lg px-3.5 transition-colors after:inset-x-3! after:bottom-0! hover:bg-muted/50 data-[state=active]:bg-muted/70! data-[state=active]:text-foreground">
                <KIcon aria-hidden className={cn(tab === k ? 'text-foreground' : 'text-muted-foreground')} />
                {t(k)}
                {n != null && (
                  <span
                    className={cn(
                      'min-w-5 rounded-full px-1.5 text-center text-xs leading-5 font-semibold tabular-nums',
                      status === 'REJECTED' && n > 0 ? 'bg-destructive-soft text-destructive' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {n}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {KINDS.map((k) => (
          <TabsContent key={k} value={k} className="flex flex-col gap-4">
            {k === tab && (
              <>
                <LoadState loading={list.loading && !list.data} error={list.error} onRetry={list.reload} />
                {list.data && (
                  <DataTable
                    data={rows[tab]}
                    columns={columns}
                    rowKey={(r) => r.id}
                    rowTo={(r) => r.to}
                    pager={list.paging.pager(list.data.total)}
                    busy={list.loading}
                    emptyIcon={<Icon />}
                    empty={
                      <>
                        {list.q ? t('noMatches', { q: list.q }) : status ? t('noneWithStatus') : t(NEW[tab].none)}
                        <span className="mt-4 flex justify-center">
                          {list.q || status ? (
                            <Button variant="outline" size="sm" onClick={clearAll}>
                              {t('clearFilters')}
                            </Button>
                          ) : (
                            <Button asChild size="sm">
                              <Link to={NEW[tab].to}>
                                <PlusIcon /> {t(NEW[tab].label)}
                              </Link>
                            </Button>
                          )}
                        </span>
                      </>
                    }
                    toolbar={
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
                        <SearchBox className={quietSearch} value={list.q} onChange={list.setQ} placeholder={t(NEW[tab].search)} />
                        <FilterChips
                          label={t('status')}
                          value={status}
                          onChange={setStatus}
                          options={[
                            { value: '', label: t('all'), count: list.counts[''], quiet: true },
                            ...STATUS_FILTERS.map(([v, key, dot]) => ({ value: v, label: t(key), dot, count: list.counts[v], quiet: v !== 'REJECTED' })),
                          ]}
                        />
                        {(list.q || status) && (
                          <Button variant="ghost" className="h-10 px-3 text-muted-foreground" onClick={clearAll}>
                            <XIcon /> {t('clearFilters')}
                          </Button>
                        )}
                      </div>
                    }
                  />
                )}
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </Page>
  );
}

/**
 * The pieces every record list (Imports, Production, Exports) shares: the list's state
 * (search, status filter, paging, column choice, per-status counts) and the quiet toolbar
 * above the table — Columns, Filter, Search, and where you are in the list.
 */
import { CheckCircle2Icon, ChevronLeftIcon, ChevronRightIcon, ClipboardListIcon, ClockIcon, Columns3Icon, ListFilterIcon, PlusIcon, XCircleIcon, XIcon } from 'lucide-react';
import { ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { type TKey, useI18n } from '../i18n';
import { num3, useApi } from './common';
import type { Column } from './data-table';
import { SearchBox, usePaging } from './page';

/** The search box in a table's toolbar: bordered, a little shorter than a form field. */
export const quietSearch = 'sm:w-72 [&_input]:h-10';

const STATUS_VALUES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'] as const;
const STATUS_LABEL: Record<(typeof STATUS_VALUES)[number], TKey> = { DRAFT: 'draft', SUBMITTED: 'pending', APPROVED: 'approved', REJECTED: 'rejected' };

/** A table column that can be switched off: `label` is its name in the Columns menu (none = always shown). */
export type ListColumn<T> = Column<T> & { label?: string };

function savedHidden(key: string, fallback: string[]): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (Array.isArray(v)) return v.filter((x) => typeof x === 'string');
  } catch {
    /* ignore */
  }
  return fallback;
}

/**
 * State for a list the server pages at `path` (?take=&skip=&status=&q=).
 * `fixedQuery` replaces the status filter with a fixed one (e.g. `open=1`).
 * `name` keys the remembered column choice on this device.
 */
export function useRecordList<T>({ path, name, hiddenByDefault = [], fixedQuery }: { path: string; name: string; hiddenByDefault?: string[]; fixedQuery?: string }) {
  const storageKey = `sawmill.${name}.hiddenColumns`;
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [hidden, setHidden] = useState(() => savedHidden(storageKey, hiddenByDefault));
  const paging = usePaging();
  const search = q ? `&q=${encodeURIComponent(q)}` : '';
  const scope = fixedQuery ? `&${fixedQuery}` : status ? `&status=${status}` : '';
  const { data, loading, error, reload } = useApi<{ items: T[]; total: number }>(`${path}?take=${paging.take}&skip=${paging.skip}${scope}${search}`);

  // how many records each status holds, for the current search (one tiny request each; the server scopes them like the list)
  const countPath = (s: string) => (fixedQuery ? null : `${path}?take=1&skip=0${s ? `&status=${s}` : ''}${search}`);
  const totals = [useApi<{ total: number }>(countPath('')), ...STATUS_VALUES.map((s) => useApi<{ total: number }>(countPath(s)))];
  const counts: Record<string, number | undefined> = { '': totals[0].data?.total };
  STATUS_VALUES.forEach((s, i) => (counts[s] = totals[i + 1].data?.total));

  const pickStatus = (v: string) => {
    setStatus(v);
    paging.reset();
  };
  return {
    data,
    loading,
    error,
    reload,
    /** reload the rows and the counts, after a record changed */
    refresh: () => {
      reload();
      totals.forEach((c) => c.reload());
    },
    paging,
    q,
    setQ: (v: string) => {
      setQ(v);
      paging.reset();
    },
    status,
    pickStatus,
    /** false when the list has a fixed scope and so no status filter */
    hasStatusFilter: !fixedQuery,
    counts,
    filtered: !!q || !!status,
    clearFilters: () => {
      setQ('');
      pickStatus('');
    },
    hidden,
    toggleColumn: (id: string) =>
      setHidden((h) => {
        const next = h.includes(id) ? h.filter((x) => x !== id) : [...h, id];
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      }),
  };
}
type RecordList = ReturnType<typeof useRecordList<unknown>>;

/**
 * The list at a glance, above the table: how many records there are and how many sit in each
 * approval state. Each card also filters the table to that state (press again to clear).
 */
export function StatusCards({ list, totalLabel }: { list: RecordList; totalLabel: string }) {
  const { t } = useI18n();
  const cards = [
    { status: '', label: totalLabel, icon: ClipboardListIcon, tile: 'bg-primary-soft text-primary' },
    { status: 'SUBMITTED', label: t('pending'), icon: ClockIcon, tile: 'bg-warning-soft text-warning' },
    { status: 'APPROVED', label: t('approved'), icon: CheckCircle2Icon, tile: 'bg-success-soft text-success' },
    { status: 'REJECTED', label: t('rejected'), icon: XCircleIcon, tile: 'bg-destructive-soft text-destructive' },
  ];
  return (
    <div className="stagger grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 print:hidden">
      {cards.map((c) => {
        const on = list.status === c.status && c.status !== '';
        return (
          <button
            key={c.status}
            type="button"
            aria-pressed={on}
            onClick={() => list.pickStatus(on ? '' : c.status)}
            className={cn(
              'flex items-center gap-3.5 rounded-xl bg-card px-5 py-4 text-left shadow-card hover-lift outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:py-5',
              on && 'ring-2 ring-brand',
            )}
          >
            <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg [&_svg]:size-5', c.tile)}>
              <c.icon aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="line-clamp-2 text-[0.8125rem] leading-snug font-medium text-muted-foreground">{c.label}</span>
              <span className="block text-[1.625rem] leading-tight font-semibold tracking-[-0.025em] tabular-nums">{list.counts[c.status]?.toLocaleString('en-IN') ?? '–'}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The row above a list: search first, then the status filter; on the right, where you are in the list and the column choice. */
export function ListToolbar<T>({ list, columns, searchPlaceholder }: { list: RecordList; columns: ListColumn<T>[]; searchPlaceholder: string }) {
  const { t } = useI18n();
  const { status, counts } = list;
  const pager = list.data ? list.paging.pager(list.data.total) : null;
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <SearchBox className="sm:w-80 [&_input]:h-10" value={list.q} onChange={list.setQ} placeholder={searchPlaceholder} />

      {list.hasStatusFilter && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-10 px-3.5">
              <ListFilterIcon /> {t('filterMenu')}
              {status && <span className="-mr-1 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">{t(STATUS_LABEL[status as keyof typeof STATUS_LABEL])}</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-64 p-2">
            <DropdownMenuLabel className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">{t('status')}</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={status} onValueChange={list.pickStatus}>
              {(['', ...STATUS_VALUES] as const).map((s) => (
                <DropdownMenuRadioItem key={s} value={s}>
                  <span className="flex-1">{s ? t(STATUS_LABEL[s]) : t('all')}</span>
                  <span className="min-w-6 rounded-full bg-muted px-1.5 text-center text-xs leading-5 font-medium text-muted-foreground tabular-nums">{counts[s] ?? ''}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {list.filtered && (
        <Button variant="ghost" className="h-10 px-3 text-muted-foreground" onClick={list.clearFilters}>
          <XIcon /> {t('clearFilters')}
        </Button>
      )}

      <div className="ml-auto flex items-center gap-2">
        {pager && pager.total > 0 && (
          <div className="flex items-center gap-1 text-[0.8125rem]">
            <span className="px-1 text-muted-foreground tabular-nums">{t('rangeOf', { from: pager.skip + 1, to: Math.min(pager.skip + pager.page, pager.total), total: pager.total })}</span>
            <Button variant="ghost" size="icon-sm" disabled={pager.skip <= 0} onClick={() => pager.onSkip(Math.max(0, pager.skip - pager.page))} aria-label={t('previous')} title={t('previous')}>
              <ChevronLeftIcon />
            </Button>
            <Button variant="ghost" size="icon-sm" disabled={pager.skip + pager.page >= pager.total} onClick={() => pager.onSkip(pager.skip + pager.page)} aria-label={t('next')} title={t('next')}>
              <ChevronRightIcon />
            </Button>
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-10 px-3.5 max-md:hidden">
              <Columns3Icon /> {t('columnsMenu')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56 p-2">
            <DropdownMenuLabel className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">{t('columnsMenu')}</DropdownMenuLabel>
            {columns
              .filter((c) => c.label)
              .map((c) => (
                <DropdownMenuCheckboxItem key={c.id} checked={!list.hidden.includes(c.id)} onCheckedChange={() => list.toggleColumn(c.id)} onSelect={(e) => e.preventDefault()}>
                  {c.label}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

/** The empty message: why the list is empty, and the one thing to do about it. */
export function ListEmpty({ list, none, newTo, newLabel }: { list: RecordList; /** shown when there are no records at all */ none: ReactNode; newTo: string; newLabel: string }) {
  const { t } = useI18n();
  return (
    <>
      {list.q ? t('noMatches', { q: list.q }) : list.status ? t('noneWithStatus') : none}
      <span className="mt-4 flex justify-center">
        {list.filtered ? (
          <Button variant="outline" size="sm" onClick={list.clearFilters}>
            {t('clearFilters')}
          </Button>
        ) : (
          <Button asChild size="sm">
            <Link to={newTo}>
              <PlusIcon /> {newLabel}
            </Link>
          </Button>
        )}
      </span>
    </>
  );
}

/** The closing line under the rows: this page's CFT total. */
export function PageSum({ cft }: { cft: number }) {
  const { t } = useI18n();
  return (
    <>
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('pageSum')}</span> <span className="ml-1 font-semibold tabular-nums">{num3(cft)} CFT</span>
    </>
  );
}

/** The chevron at the end of a row that opens the full record. */
export function openColumn<T>(to: (row: T) => string, code: (row: T) => string, t: (k: TKey) => string): ListColumn<T> {
  return {
    id: 'open',
    header: <span className="sr-only">{t('actions')}</span>,
    className: 'w-px text-right',
    cell: (r) => (
      <Button asChild variant="ghost" size="icon-sm" className="text-muted-foreground">
        <Link to={to(r)} aria-label={`${t('view')} ${code(r)}`} title={t('view')}>
          <ChevronRightIcon />
        </Link>
      </Button>
    ),
  };
}

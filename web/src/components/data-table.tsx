/**
 * The app's list table, on TanStack Table (v9): typed columns, click-to-sort headers,
 * columns that fold away on phones, rows that open a record, an empty state and paging.
 * Below `sm` the rows are drawn as stacked cards (the record, its status, then label/value pairs),
 * so nothing has to squeeze side by side on a phone.
 *
 * Sorting is done in the browser, so offer it (give a column `sort`) only when the
 * whole list is loaded — not on lists the server pages, where it would sort one page.
 */
import { createSortedRowModel, rowSortingFeature, sortFn_alphanumeric, sortFn_basic, tableFeatures, useTable, type ColumnDef, type RowData } from '@tanstack/react-table';
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from 'lucide-react';
import { MouseEvent, ReactNode, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { LinkRow, type PagerProps, TableCard, useClientPaging } from './page';

export interface Column<T> {
  id: string;
  header?: ReactNode;
  cell: (row: T) => ReactNode;
  /** The value this column sorts by. Giving it makes the header a sort button. */
  sort?: (row: T) => string | number | null | undefined;
  /** Right-aligned with tabular figures. */
  numeric?: boolean;
  /** Hide below this breakpoint (the first column repeats the detail meanwhile). The sidebar takes 250px, so secondary columns want `lg` or `xl`. */
  from?: 'sm' | 'md' | 'lg' | 'xl';
  /** Extra classes for the body cells / the header cell. */
  className?: string;
  headClassName?: string;
}

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
});

const FROM = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell', xl: 'hidden xl:table-cell' } as const;
const EMPTY: never[] = [];
/** Long lists: sentence-case headers (easier to read across many columns). No lines between columns: spacing does that. */
export const gridTable = '[&_th]:text-[0.8125rem] [&_th]:font-medium [&_th]:tracking-normal [&_th]:normal-case';
/** The open row: an opaque tint so it can sit above a panel's backdrop (z-50) without the dimming showing through, and a bar on its left edge. */
const SELECTED = 'relative z-[55] bg-primary-soft hover:bg-primary-soft data-[state=selected]:bg-primary-soft [&>td:first-child]:shadow-[inset_3px_0_0_var(--color-primary)]';

export function DataTable<T extends RowData>({
  data,
  columns,
  rowKey,
  rowTo,
  onRowClick,
  selectedKey,
  empty,
  emptyIcon,
  pager,
  pageSize,
  busy,
  toolbar,
  footer,
  grid,
  className,
}: {
  data: readonly T[] | null | undefined;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** Makes the whole row open this path. */
  rowTo?: (row: T) => string;
  /** Does something else when a row is clicked (e.g. opens a side panel). Links and buttons in the row keep their own behaviour. */
  onRowClick?: (row: T) => void;
  /** The row (by `rowKey`) that is open elsewhere, e.g. in a side panel: it is tinted, marked on its left edge and lifted above the panel's backdrop. */
  selectedKey?: string | null;
  /** Message when there are no rows. */
  empty: ReactNode;
  emptyIcon?: ReactNode;
  /** Page controls for a list the server pages. Leave out to page the loaded rows here. */
  pager?: PagerProps;
  /** Rows per page when paging here. */
  pageSize?: number;
  /** A refresh is in flight: rows dim and a progress line runs along the top. */
  busy?: boolean;
  /** Heading, search and filters, shown inside the card above the table. */
  toolbar?: ReactNode;
  /** A closing line under the rows, e.g. a sum. */
  footer?: ReactNode;
  /** Spreadsheet look for long lists: sentence-case headers and a hairline between columns. */
  grid?: boolean;
  className?: string;
}) {
  const rowsIn = (data ?? EMPTY) as T[];
  const defs = useMemo(
    () =>
      columns.map(
        (c): ColumnDef<typeof features, T> => ({
          id: c.id,
          accessorFn: (row: T) => c.sort?.(row) ?? null,
          enableSorting: !!c.sort,
          sortUndefined: 'last',
        }),
      ),
    [columns],
  );
  const table = useTable({ features, columns: defs, data: rowsIn, getRowId: rowKey, enableSortingRemoval: true });
  const sorted = table.getRowModel().rows;
  const local = useClientPaging(sorted, pageSize);
  const rows = pager ? sorted : local.rows;

  // a new order starts again from the first page
  const sortKey = JSON.stringify(table.state.sorting);
  const { reset } = local;
  useEffect(reset, [sortKey, reset]);

  const byId = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);
  const headers = table.getHeaderGroups()[0]?.headers ?? [];
  const navigate = useNavigate();

  // the phone cards: the first column leads; a last, non-numeric column (the status) sits top-right;
  // the other columns a phone shows (no `from`) follow as label/value pairs. Folded columns already
  // appear under the record ID (IdCell's `sub`).
  const [lead, ...restCols] = columns;
  const last = restCols.length > 0 && !restCols[restCols.length - 1].numeric && !restCols[restCols.length - 1].from ? restCols[restCols.length - 1] : null;
  const pairs = restCols.filter((c) => !c.from && c !== last);
  /** A click on a card opens its record, as a row would; links, buttons and fields inside keep their own clicks. */
  const openCard = (row: T) => (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('a, button, input, select, textarea, label, [role="combobox"]')) return;
    if (window.getSelection()?.toString()) return;
    if (rowTo) {
      const to = rowTo(row);
      if (e.metaKey || e.ctrlKey) window.open(to, '_blank', 'noopener');
      else navigate(to);
    } else onRowClick?.(row);
  };

  return (
    <TableCard empty={rowsIn.length === 0} emptyText={empty} emptyIcon={emptyIcon} pager={pager ?? local.pager} busy={busy} toolbar={toolbar} className={className}>
      {/* phones: each row a small card */}
      <ul className="divide-y divide-border/70 sm:hidden">
        {rows.map((r) => {
          const selected = r.id === selectedKey;
          const clickable = !!(rowTo || onRowClick);
          return (
            <li
              key={r.id}
              onClick={clickable ? openCard(r.original) : undefined}
              aria-current={selected || undefined}
              className={cn('flex flex-col gap-2.5 px-4 py-3.5 transition-colors duration-200', clickable && 'cursor-pointer active:bg-secondary/70', selected && 'bg-primary-soft shadow-[inset_3px_0_0_var(--color-primary)]')}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">{lead?.cell(r.original)}</div>
                {last && <div className="shrink-0">{last.cell(r.original)}</div>}
              </div>
              {pairs.length > 0 && (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[0.8125rem]">
                  {pairs.map((c) => (
                    <div key={c.id} className={cn('min-w-0', !c.header && 'col-span-2')}>
                      {c.header && <dt className="text-xs text-muted-foreground">{c.header}</dt>}
                      <dd className={cn('[overflow-wrap:anywhere]', c.numeric && 'font-semibold tabular-nums')}>{c.cell(r.original)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          );
        })}
      </ul>

      {/* tablets and up: the table */}
      <Table
        className={cn(
          'max-sm:hidden [&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4',
          grid && gridTable,
        )}
      >
        <TableHeader>
          <TableRow>
            {headers.map((h) => {
              const c = byId.get(h.column.id)!;
              const dir = h.column.getCanSort() ? h.column.getIsSorted() : false;
              const SortIcon = dir === 'asc' ? ArrowUpIcon : dir === 'desc' ? ArrowDownIcon : ChevronsUpDownIcon;
              return (
                <TableHead
                  key={h.id}
                  aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : undefined}
                  className={cn(c.numeric && 'text-right', c.from && FROM[c.from], c.headClassName)}
                >
                  {h.column.getCanSort() ? (
                    <button
                      type="button"
                      onClick={h.column.getToggleSortingHandler()}
                      className={cn(
                        '-mx-2 inline-flex h-7 items-center gap-1 rounded-md px-2 tracking-[inherit] [text-transform:inherit] transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
                        c.numeric && 'flex-row-reverse',
                        dir && 'text-foreground',
                      )}
                    >
                      {c.header}
                      <SortIcon className={cn('size-3.5 transition-opacity', !dir && 'opacity-40')} />
                    </button>
                  ) : (
                    c.header
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const cells = columns.map((c) => (
              <TableCell key={c.id} className={cn(c.numeric && 'text-right tabular-nums whitespace-nowrap', c.from && FROM[c.from], c.className)}>
                {c.cell(r.original)}
              </TableCell>
            ));
            return rowTo ? (
              <LinkRow key={r.id} to={rowTo(r.original)}>
                {cells}
              </LinkRow>
            ) : onRowClick ? (
              <TableRow
                key={r.id}
                data-state={r.id === selectedKey ? 'selected' : undefined}
                aria-selected={r.id === selectedKey || undefined}
                className={cn('cursor-pointer', r.id === selectedKey && SELECTED)}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('a, button, input, select, textarea, label, [role="combobox"]')) return;
                  if (window.getSelection()?.toString()) return;
                  onRowClick(r.original);
                }}
              >
                {cells}
              </TableRow>
            ) : (
              <TableRow key={r.id}>{cells}</TableRow>
            );
          })}
        </TableBody>
      </Table>
      {footer && <div className="border-t border-border/70 px-4 py-3.5 text-right text-sm">{footer}</div>}
    </TableCard>
  );
}

/** The record ID in the first column: a real link, with the folded-away columns under it on phones. */
export function IdCell({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <>
      <div className="font-semibold">{children}</div>
      {sub && <div className="mt-0.5 text-xs font-normal text-muted-foreground md:hidden">{sub}</div>}
    </>
  );
}

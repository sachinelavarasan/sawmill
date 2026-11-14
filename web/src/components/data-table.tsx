/**
 * The app's list table, on TanStack Table (v9): typed columns, click-to-sort headers,
 * columns that fold away on phones, rows that open a record, an empty state and paging.
 *
 * Sorting is done in the browser, so offer it (give a column `sort`) only when the
 * whole list is loaded — not on lists the server pages, where it would sort one page.
 */
import { createSortedRowModel, rowSortingFeature, sortFn_alphanumeric, sortFn_basic, tableFeatures, useTable, type ColumnDef, type RowData } from '@tanstack/react-table';
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from 'lucide-react';
import { ReactNode, useEffect, useMemo } from 'react';
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
  /** Hide below this breakpoint (the first column usually repeats the detail on phones). */
  from?: 'sm' | 'md';
  /** Extra classes for the body cells / the header cell. */
  className?: string;
  headClassName?: string;
}

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
});

const FROM = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell' } as const;
const EMPTY: never[] = [];

export function DataTable<T extends RowData>({
  data,
  columns,
  rowKey,
  rowTo,
  empty,
  emptyIcon,
  pager,
  pageSize,
  busy,
  className,
}: {
  data: readonly T[] | null | undefined;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** Makes the whole row open this path. */
  rowTo?: (row: T) => string;
  /** Message when there are no rows. */
  empty: ReactNode;
  emptyIcon?: ReactNode;
  /** Page controls for a list the server pages. Leave out to page the loaded rows here. */
  pager?: PagerProps;
  /** Rows per page when paging here. */
  pageSize?: number;
  /** A refresh is in flight: rows dim and a progress line runs along the top. */
  busy?: boolean;
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

  return (
    <TableCard empty={rowsIn.length === 0} emptyText={empty} emptyIcon={emptyIcon} pager={pager ?? local.pager} busy={busy} className={className}>
      <Table className="[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4">
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
                        '-mx-2 inline-flex h-7 items-center gap-1 rounded-md px-2 tracking-[inherit] uppercase transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
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
              <TableCell key={c.id} className={cn(c.numeric && 'text-right tabular-nums', c.from && FROM[c.from], c.className)}>
                {c.cell(r.original)}
              </TableCell>
            ));
            return rowTo ? (
              <LinkRow key={r.id} to={rowTo(r.original)}>
                {cells}
              </LinkRow>
            ) : (
              <TableRow key={r.id}>{cells}</TableRow>
            );
          })}
        </TableBody>
      </Table>
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

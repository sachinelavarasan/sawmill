/**
 * Stock — the reference page for the shadcn/ui migration. Built only from
 * src/components/ui, src/components/page.tsx and Tailwind classes.
 */
import { exportPieceCft, Permission, sizeLabel } from '@sawmill/shared';
import { ArrowDownLeftIcon, ArrowDownToLineIcon, ArrowUpFromLineIcon, ArrowUpRightIcon, BoxesIcon, ChevronDownIcon, HistoryIcon, LayersIcon, type LucideIcon, PackageIcon, PlusIcon, ScissorsIcon, SlidersHorizontalIcon, TruckIcon, XIcon } from 'lucide-react';
import { FormEvent, Fragment, ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { api } from '../api';
import { useAuth } from '../auth';
import { dateTime, num3, useLoad } from '../components/common';
import { StatusBadge } from '../components/status-badge';
import { gridTable } from '../components/data-table';
import { ALL, Field, FilterChips, FormSection, LoadState, Notice, numCell, Page, PageHeader, SearchBox, useClientPaging, usePaging, TableCard, wide } from '../components/page';
import { WorkflowBar } from '../components/workflow';
import { TKey, useI18n } from '../i18n';
import type { RawStockRow } from './Production';

interface FinishedRow {
  woodType: string;
  thicknessIn: number;
  widthIn: number;
  lengthFt: number;
  importLoadId: string;
  importCode: string;
  pieces: number;
  cft: number;
}
interface Balances {
  totals: { rawCft: number; rawLoads: number; finishedCft: number; finishedPieces: number };
  raw: RawStockRow[];
  finished: FinishedRow[];
}
interface Movement {
  id: string;
  createdAt: string;
  kind: 'RAW' | 'FINISHED';
  woodType: string;
  importLoadId: string;
  importCode: string;
  thicknessIn: number | null;
  widthIn: number | null;
  lengthFt: number | null;
  piecesDelta: number;
  cftDelta: number;
  source: 'IMPORT' | 'PRODUCTION_INPUT' | 'PRODUCTION_OUTPUT' | 'EXPORT' | 'ADJUSTMENT';
  sourceId: string;
  sourceCode: string;
  postedByName: string;
}
interface Adjustment {
  id: string;
  code: string;
  kind: 'RAW' | 'FINISHED';
  woodType: string;
  importLoadId: string;
  importCode: string;
  thicknessIn: number | null;
  widthIn: number | null;
  lengthFt: number | null;
  piecesDelta: number;
  cftDelta: number;
  reason: string;
  status: string;
  rejectionReason: string | null;
  createdByName: string;
  createdAt: string;
  editable: boolean;
  canSubmit: boolean;
  canReview: boolean;
}

type Tab = 'raw' | 'finished' | 'adjustments' | 'movements';
const TABS: [Tab, TKey][] = [
  ['raw', 'raw'],
  ['finished', 'finished'],
  ['adjustments', 'adjustments'],
  ['movements', 'movements'],
];

const SOURCE_LABEL: Record<Movement['source'], TKey> = {
  IMPORT: 'srcImport',
  PRODUCTION_INPUT: 'srcProductionIn',
  PRODUCTION_OUTPUT: 'srcProductionOut',
  EXPORT: 'srcExport',
  ADJUSTMENT: 'srcAdjustment',
};
const SOURCE_PATH: Partial<Record<Movement['source'], string>> = {
  IMPORT: '/imports/',
  PRODUCTION_INPUT: '/production/',
  PRODUCTION_OUTPUT: '/production/',
  EXPORT: '/exports/',
};

const signed = (n: number, fmt: (n: number) => string = String) => (n > 0 ? `+${fmt(n)}` : fmt(n));
const deltaClass = (n: number) => (n > 0 ? 'text-success font-semibold' : n < 0 ? 'text-destructive font-semibold' : '');
const sizeOf = (r: { thicknessIn: number | null; widthIn: number | null; lengthFt: number | null }) =>
  r.thicknessIn != null && r.widthIn != null && r.lengthFt != null ? sizeLabel(r.thicknessIn, r.widthIn, r.lengthFt) : '—';

/** What kind of movement a ledger line is: its label, its icon. Direction comes from the sign of the change. */
const SOURCE_ICON: Record<Movement['source'], LucideIcon> = {
  IMPORT: ArrowDownToLineIcon,
  PRODUCTION_INPUT: ScissorsIcon,
  PRODUCTION_OUTPUT: PackageIcon,
  EXPORT: ArrowUpFromLineIcon,
  ADJUSTMENT: SlidersHorizontalIcon,
};

/** In (green, arrow down-left) or Out (red, arrow up-right): the same mark wherever stock moves. */
function Direction({ delta, className }: { delta: number; className?: string }) {
  const { t } = useI18n();
  const incoming = delta > 0;
  const Icon = incoming ? ArrowDownLeftIcon : ArrowUpRightIcon;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full py-0.5 pr-2 pl-1.5 text-xs font-semibold', incoming ? 'bg-success-soft text-success' : 'bg-destructive-soft text-destructive', className)}>
      <Icon className="size-3.5" aria-hidden />
      {t(incoming ? 'stockIn' : 'stockOut')}
    </span>
  );
}

/**
 * One kind of stock at a glance: its total in CFT and the count that goes with it.
 * Raw and finished each keep one colour here and in the charts, so they are never confused.
 */
function StockSummary({ icon, label, cft, color, figures }: { icon: ReactNode; label: string; cft: number; color: string; figures: { icon: ReactNode; label: string; value: string }[] }) {
  return (
    <Card className="relative gap-0 overflow-hidden py-4">
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: color }} aria-hidden />
      <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary [&_svg]:size-5">{icon}</span>
          <div className="min-w-0">
            <div className="text-[0.8125rem] font-medium text-muted-foreground">{label}</div>
            <div className="text-[1.7rem] leading-tight font-bold tracking-[-0.02em] whitespace-nowrap tabular-nums">
              {num3(cft)}
              <span className="ml-1.5 text-sm font-medium tracking-normal text-muted-foreground">CFT</span>
            </div>
          </div>
        </div>
        {figures.map((f) => (
          <div key={f.label} className="flex items-center gap-2.5 border-l pl-5 max-sm:basis-full max-sm:border-t max-sm:border-l-0 max-sm:pt-3 max-sm:pl-0">
            <span className="text-muted-foreground [&_svg]:size-4">{f.icon}</span>
            <div>
              <div className="text-lg leading-tight font-bold tabular-nums">{f.value}</div>
              <div className="text-xs text-muted-foreground">{f.label}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function StockPage() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'raw') as Tab;
  const loadFilter = params.get('load') ?? '';
  const { data, loading, error, reload } = useLoad(() => api<Balances>('/stock'), []);

  const go = (next: Tab, load?: string) => setParams(load ? { tab: next, load } : { tab: next }, { replace: true });

  // every load that holds (or held) stock, for the adjustment and movement pickers
  const loads = useMemo(() => {
    const m = new Map<string, { id: string; code: string; woodType: string }>();
    data?.raw.forEach((r) => m.set(r.importLoadId, { id: r.importLoadId, code: r.importCode, woodType: r.woodType }));
    data?.finished.forEach((f) => m.has(f.importLoadId) || m.set(f.importLoadId, { id: f.importLoadId, code: f.importCode, woodType: f.woodType }));
    return [...m.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [data]);

  // the four views, and how much the two stock lists hold
  const sizeCount = data ? new Set(data.finished.map((f) => `${f.woodType}|${f.thicknessIn}|${f.widthIn}|${f.lengthFt}`)).size : 0;
  const views: { key: Tab; icon: LucideIcon; title: string; count?: number }[] = [
    { key: 'raw', icon: LayersIcon, title: t('rawByLoad'), count: data?.totals.rawLoads },
    { key: 'finished', icon: PackageIcon, title: t('finishedBySize'), count: sizeCount },
    { key: 'movements', icon: HistoryIcon, title: t('movementHistory') },
    { key: 'adjustments', icon: SlidersHorizontalIcon, title: t('adjustments') },
  ];

  return (
    <Page>
      <PageHeader
        title={t('stock')}
        subtitle={t('stockSub')}
        actions={
          <Button onClick={() => setParams({ tab: 'adjustments', new: '1' }, { replace: true })}>
            <PlusIcon /> {t('newAdjustment')}
          </Button>
        }
      />

      <LoadState loading={loading && !data} error={error} onRetry={reload} />

      {data && (
        <>
          <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
            <StockSummary
              icon={<LayersIcon />}
              label={t('rawStock')}
              cft={data.totals.rawCft}
              color="var(--chart-1)"
              figures={[{ icon: <TruckIcon />, label: t('loadsWithRaw'), value: data.totals.rawLoads.toLocaleString('en-IN') }]}
            />
            <StockSummary
              icon={<PackageIcon />}
              label={t('finishedStock')}
              cft={data.totals.finishedCft}
              color="var(--chart-2)"
              figures={[{ icon: <BoxesIcon />, label: t('finishedPieces'), value: data.totals.finishedPieces.toLocaleString('en-IN') }]}
            />
          </div>

          <Tabs value={tab} onValueChange={(v) => go(v as Tab)} className="gap-4">
            {/* the four views as one tab strip (scrolls sideways on a phone) */}
            <TabsList variant="line" className="scroll-quiet h-auto! w-full justify-start gap-1 overflow-x-auto overflow-y-hidden border-b p-0">
              {views.map((v) => (
                <TabsTrigger key={v.key} value={v.key} className="h-10 flex-none gap-2 rounded-none px-3 after:bottom-0! data-[state=active]:text-foreground">
                  <v.icon aria-hidden className={cn(tab === v.key ? 'text-foreground' : 'text-muted-foreground')} />
                  {v.title}
                  {v.count != null && <span className="min-w-5 rounded-full bg-muted px-1.5 text-center text-xs leading-5 font-semibold text-muted-foreground tabular-nums">{v.count}</span>}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="raw">
              <RawTab rows={data.raw} onHistory={(id) => go('movements', id)} />
            </TabsContent>
            <TabsContent value="finished">
              <FinishedTab rows={data.finished} />
            </TabsContent>
            <TabsContent value="adjustments">
              <AdjustmentsTab loads={loads} finished={data.finished} onStockChanged={reload} startNew={params.get('new') === '1'} onStarted={() => go('adjustments')} />
            </TabsContent>
            <TabsContent value="movements">
              <MovementsTab loads={loads} load={loadFilter} onLoad={(id) => go('movements', id || undefined)} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </Page>
  );
}

// ───────── tabs ─────────

/** The heading and search inside a stock table's card. */
function TableTop({ title, count, q, onQ, placeholder, filter }: { title: string; count: number; q: string; onQ: (v: string) => void; placeholder: string; filter?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <h2 className="flex items-center gap-2 pl-1 text-[0.9375rem] font-semibold">
        {title}
        <span className="min-w-6 rounded-full bg-muted px-2 text-center text-xs leading-6 font-bold text-muted-foreground tabular-nums">{count}</span>
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        {filter}
        <SearchBox className="sm:w-64 [&_input]:h-9" value={q} onChange={onQ} placeholder={placeholder} />
      </div>
    </div>
  );
}

function RawTab({ rows, onHistory }: { rows: RawStockRow[]; onHistory: (loadId: string) => void }) {
  const { t } = useI18n();
  const { can } = useAuth();
  const canOpenAll = can(Permission.OPERATIONS_VIEW_ALL);
  const [q, setQ] = useState('');
  // most loads on the ledger are used up; the list opens on the ones that still hold raw wood
  const [scope, setScope] = useState<'stock' | 'all'>('stock');
  const inStock = useMemo(() => rows.filter((r) => r.cft > 0), [rows]);
  const shown = useMemo(() => {
    const k = q.toLowerCase();
    const base = scope === 'stock' ? inStock : rows;
    return k ? base.filter((r) => r.importCode.toLowerCase().includes(k) || r.woodType.toLowerCase().includes(k)) : base;
  }, [rows, inStock, scope, q]);
  const paged = useClientPaging(shown);
  return (
    <TableCard
      empty={shown.length === 0}
      emptyText={q ? t('noMatches', { q }) : t('noStock')}
      pager={paged.pager}
      toolbar={
        <TableTop
          title={t('rawByLoad')}
          count={shown.length}
          q={q}
          onQ={setQ}
          placeholder={t('searchLoads')}
          filter={
            <FilterChips
              label={t('rawByLoad')}
              value={scope}
              onChange={setScope}
              options={[
                { value: 'stock', label: t('inStock'), count: inStock.length, quiet: true },
                { value: 'all', label: t('all'), count: rows.length, quiet: true },
              ]}
            />
          }
        />
      }
    >
      <Table className={gridTable}>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">{t('importId')}</TableHead>
            <TableHead className={wide}>{t('woodType')}</TableHead>
            <TableHead className={wide}>{t('arrival')}</TableHead>
            <TableHead>{t('inStockOfReceived')}</TableHead>
            <TableHead className={cn(numCell, wide)}>{t('logs')}</TableHead>
            <TableHead className="pr-4" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.rows.map((r) => {
            // how much of what the load brought is still raw stock
            const share = r.receivedCft > 0 ? Math.min(100, Math.max(0, (r.cft / r.receivedCft) * 100)) : 0;
            return (
              <TableRow key={r.importLoadId} className="hover:bg-muted">
                <TableCell className="pl-4 font-semibold">
                  {canOpenAll ? (
                    <Link className="text-primary hover:underline" to={`/imports/${r.importLoadId}`}>
                      {r.importCode}
                    </Link>
                  ) : (
                    r.importCode
                  )}
                  <div className="text-xs font-normal text-muted-foreground md:hidden">{r.woodType}</div>
                </TableCell>
                <TableCell className={wide}>{r.woodType}</TableCell>
                <TableCell className={cn(wide, 'text-muted-foreground')}>{dateTime(r.arrivalAt)}</TableCell>
                <TableCell className="min-w-40 max-md:min-w-28">
                  <div className="tabular-nums">
                    <span className="font-semibold">{num3(r.cft)}</span>
                    <span className="text-muted-foreground"> / {num3(r.receivedCft)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-chart-1" style={{ width: `${share}%` }} />
                  </div>
                </TableCell>
                <TableCell className={cn(numCell, wide)}>{r.logs}</TableCell>
                <TableCell className="w-px pr-4 text-right">
                  <div className="flex justify-end gap-1">
                    {r.cft > 0 && (
                      <Button asChild variant="outline" size="sm" className="max-md:size-8 max-md:px-0">
                        <Link to={`/production/new?load=${r.importLoadId}`} aria-label={t('production')} title={t('production')}>
                          <ScissorsIcon />
                          <span className="max-md:sr-only">{t('production')}</span>
                        </Link>
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="max-md:size-8 max-md:px-0" onClick={() => onHistory(r.importLoadId)} aria-label={t('movements')} title={t('movements')}>
                      <HistoryIcon />
                      <span className="max-md:sr-only">{t('movements')}</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableCard>
  );
}

/** Finished stock grouped by wood type and size, with the import loads it came from. */
function FinishedTab({ rows }: { rows: FinishedRow[] }) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const byWood = useMemo(() => {
    const groups = new Map<string, { woodType: string; size: string; pieces: number; cft: number; loads: string[] }>();
    for (const r of rows) {
      const size = sizeLabel(r.thicknessIn, r.widthIn, r.lengthFt);
      const key = `${r.woodType}|${size}`;
      const g = groups.get(key) ?? { woodType: r.woodType, size, pieces: 0, cft: 0, loads: [] };
      g.pieces += r.pieces;
      g.cft += r.cft;
      g.loads.push(r.importCode);
      groups.set(key, g);
    }
    const m = new Map<string, (typeof groups extends Map<string, infer V> ? V : never)[]>();
    groups.forEach((g) => m.set(g.woodType, [...(m.get(g.woodType) ?? []), g]));
    return [...m.entries()];
  }, [rows]);
  // paged by size row; each page repeats the wood-type heading (with its full total) above its sizes
  const flat = useMemo(() => {
    const k = q.toLowerCase();
    return byWood.flatMap(([wood, sizes]) => sizes.filter((g) => !k || wood.toLowerCase().includes(k) || g.size.toLowerCase().includes(k)).map((g) => ({ wood, sizes, g })));
  }, [byWood, q]);
  const paged = useClientPaging(flat);
  // the largest size in stock sets the full width of the bars
  const maxCft = Math.max(1, ...flat.map((f) => f.g.cft));

  return (
    <TableCard
      empty={flat.length === 0}
      emptyText={q ? t('noMatches', { q }) : t('noStock')}
      pager={paged.pager}
      toolbar={<TableTop title={t('finishedBySize')} count={flat.length} q={q} onQ={setQ} placeholder={t('searchSizes')} />}
    >
      <Table className={gridTable}>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">{t('size')}</TableHead>
            <TableHead className={numCell}>{t('pieces')}</TableHead>
            <TableHead>CFT</TableHead>
            <TableHead className={cn(wide, 'pr-4')}>{t('importId')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.rows.map(({ wood, sizes, g }, i) => (
            <Fragment key={`${wood}|${g.size}`}>
              {(i === 0 || paged.rows[i - 1].wood !== wood) && (
                <TableRow className="bg-secondary hover:bg-secondary">
                  <TableCell className="pl-4 font-semibold">{wood}</TableCell>
                  <TableCell className={cn(numCell, 'font-semibold')}>{sizes.reduce((s, x) => s + x.pieces, 0)}</TableCell>
                  <TableCell className="font-semibold tabular-nums">{num3(sizes.reduce((s, x) => s + x.cft, 0))}</TableCell>
                  <TableCell className={wide} />
                </TableRow>
              )}
              <TableRow className="hover:bg-muted">
                <TableCell className="pl-8">{g.size}</TableCell>
                <TableCell className={numCell}>{g.pieces}</TableCell>
                <TableCell className="min-w-44">
                  <div className="flex items-center gap-3">
                    <span className="w-20 shrink-0 tabular-nums">{num3(g.cft)}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted max-sm:hidden">
                      <div className="h-full rounded-full bg-chart-1" style={{ width: `${Math.max(2, (g.cft / maxCft) * 100)}%` }} />
                    </div>
                  </div>
                </TableCell>
                <TableCell className={cn(wide, 'max-w-64 truncate pr-4 text-xs text-muted-foreground')} title={g.loads.join(', ')}>
                  {g.loads.join(', ')}
                </TableCell>
              </TableRow>
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  );
}

function MovementsTab({ loads, load, onLoad }: { loads: { id: string; code: string }[]; load: string; onLoad: (id: string) => void }) {
  const { t } = useI18n();
  const { can } = useAuth();
  const canOpenAll = can(Permission.OPERATIONS_VIEW_ALL);
  const [kind, setKind] = useState(ALL);
  const [direction, setDirection] = useState(ALL);
  const paging = usePaging();
  const query = `take=${paging.take}&skip=${paging.skip}${load ? `&importLoadId=${load}` : ''}${kind !== ALL ? `&kind=${kind}` : ''}${direction !== ALL ? `&direction=${direction}` : ''}`;
  const { data, loading, error, reload } = useLoad(() => api<{ items: Movement[]; total: number }>(`/stock/movements?${query}`), [query]);
  const filtered = !!load || kind !== ALL || direction !== ALL;
  const pageIn = (data?.items ?? []).reduce((a, m) => a + Math.max(0, m.cftDelta), 0);
  const pageOut = (data?.items ?? []).reduce((a, m) => a + Math.max(0, -m.cftDelta), 0);

  const filter = (label: string, value: string, onChange: (v: string) => void, options: [string, string][]) => (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[0.6875rem] font-semibold tracking-wider text-muted-foreground uppercase">{label}</span>
      <Select
        value={value}
        onValueChange={(v) => {
          paging.reset();
          onChange(v);
        }}
      >
        <SelectTrigger className="w-full sm:w-48" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([v, text]) => (
            <SelectItem key={v} value={v}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );

  return (
    <div className="flex flex-col gap-3">
      <LoadState loading={loading && !data} error={error} onRetry={reload} />
      <TableCard
        empty={!!data && data.items.length === 0}
        emptyText={t('noMovements')}
        pager={data ? paging.pager(data.total) : undefined}
        busy={loading && !!data}
        toolbar={
          <div className="flex flex-wrap items-end gap-x-3 gap-y-2.5 py-1.5">
            {filter(t('importId'), load || ALL, (v) => onLoad(v === ALL ? '' : v), [[ALL, t('allLoads')], ...loads.map((l): [string, string] => [l.id, l.code])])}
            {filter(t('stockKind'), kind, setKind, [
              [ALL, `${t('raw')} + ${t('finished')}`],
              ['RAW', t('raw')],
              ['FINISHED', t('finished')],
            ])}
            {filter(t('direction'), direction, setDirection, [
              [ALL, t('allDirections')],
              ['in', t('stockIn')],
              ['out', t('stockOut')],
            ])}
            {filtered && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-muted-foreground"
                onClick={() => {
                  paging.reset();
                  setKind(ALL);
                  setDirection(ALL);
                  onLoad('');
                }}
              >
                <XIcon /> {t('clearFilters')}
              </Button>
            )}
            {data && <span className="ml-auto self-center text-sm text-muted-foreground tabular-nums">{t('rangeOf', { from: data.total ? paging.skip + 1 : 0, to: Math.min(paging.skip + paging.take, data.total), total: data.total })}</span>}
          </div>
        }
      >
        <Table className={gridTable}>
          <TableHeader>
            <TableRow>
              <TableHead className={cn(wide, 'pl-4')}>{t('time')}</TableHead>
              <TableHead className="max-md:pl-4">{t('source')}</TableHead>
              <TableHead className={wide}>{t('importId')}</TableHead>
              <TableHead className="hidden lg:table-cell">{t('stockKind')}</TableHead>
              <TableHead className="hidden lg:table-cell">{t('size')}</TableHead>
              <TableHead>{t('direction')}</TableHead>
              <TableHead className={cn(numCell, 'hidden lg:table-cell')}>{t('pieces')}</TableHead>
              <TableHead className={cn(numCell, 'max-md:pr-4')}>CFT</TableHead>
              <TableHead className="hidden pr-4 xl:table-cell">{t('user')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items ?? []).map((m) => {
              const path = SOURCE_PATH[m.source];
              const Icon = SOURCE_ICON[m.source];
              return (
                <TableRow key={m.id} className="hover:bg-muted">
                  <TableCell className={cn(wide, 'pl-4 text-muted-foreground')}>{dateTime(m.createdAt)}</TableCell>
                  <TableCell className="max-md:pl-4">
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
                        <Icon aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium">{t(SOURCE_LABEL[m.source])}</div>
                        <div className="text-xs">
                          {path && canOpenAll ? (
                            <Link className="text-primary hover:underline" to={`${path}${m.sourceId}`}>
                              {m.sourceCode}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">{m.sourceCode}</span>
                          )}
                          <span className="text-muted-foreground md:hidden">
                            {' '}
                            · {m.importCode} · {m.woodType}
                          </span>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className={wide}>{m.importCode}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {t(m.kind === 'RAW' ? 'raw' : 'finished')} · {m.woodType}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">{sizeOf(m)}</TableCell>
                  <TableCell>
                    <Direction delta={m.cftDelta} />
                  </TableCell>
                  <TableCell className={cn(numCell, 'hidden lg:table-cell', deltaClass(m.piecesDelta))}>{m.piecesDelta ? signed(m.piecesDelta) : '—'}</TableCell>
                  <TableCell className={cn(numCell, 'max-md:pr-4', deltaClass(m.cftDelta))}>{signed(m.cftDelta, num3)}</TableCell>
                  <TableCell className="hidden max-w-36 truncate pr-4 xl:table-cell">{m.postedByName}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {data && data.items.length > 0 && (
          <div className="border-t border-border/70 bg-muted/40 px-4 py-2.5 text-right text-sm text-muted-foreground tabular-nums">{t('pageInOut', { in: num3(pageIn), out: num3(pageOut) })}</div>
        )}
      </TableCard>
    </div>
  );
}

// ───────── adjustments ─────────

interface AdjForm {
  kind: 'RAW' | 'FINISHED';
  importLoadId: string;
  woodType: string;
  thickness: string;
  width: string;
  length: string;
  pieces: string;
  cft: string;
  reason: string;
}
const emptyAdj = (): AdjForm => ({ kind: 'FINISHED', importLoadId: '', woodType: '', thickness: '', width: '', length: '', pieces: '', cft: '', reason: '' });

/** A non-zero whole number (pieces may be negative). */
const wholeNonZero = (v: string) => {
  const n = Number(v);
  return v.trim() !== '' && Number.isInteger(n) && n !== 0 ? n : null;
};
const positive = (v: string) => {
  const n = Number(v);
  return v.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null;
};

function adjPreview(f: AdjForm): { cft: number; body: Record<string, unknown> } | null {
  if (!f.importLoadId || f.reason.trim().length < 3) return null;
  if (f.kind === 'RAW') {
    const cft = Number(f.cft);
    const pieces = f.pieces.trim() === '' ? 0 : wholeNonZero(f.pieces);
    if (f.cft.trim() === '' || !Number.isFinite(cft) || cft === 0 || pieces == null) return null;
    return { cft, body: { kind: 'RAW', importLoadId: f.importLoadId, cftDelta: cft, piecesDelta: pieces, reason: f.reason } };
  }
  const tIn = positive(f.thickness);
  const wIn = positive(f.width);
  const lFt = positive(f.length);
  const pcs = wholeNonZero(f.pieces);
  if (tIn == null || wIn == null || lFt == null || pcs == null) return null;
  const cft = Math.sign(pcs) * exportPieceCft(tIn, wIn, lFt, Math.abs(pcs));
  return {
    cft,
    body: { kind: 'FINISHED', importLoadId: f.importLoadId, woodType: f.woodType || undefined, thicknessIn: tIn, widthIn: wIn, lengthFt: lFt, piecesDelta: pcs, reason: f.reason },
  };
}

function AdjustmentsTab({
  loads,
  finished,
  onStockChanged,
  startNew,
  onStarted,
}: {
  loads: { id: string; code: string; woodType: string }[];
  finished: FinishedRow[];
  onStockChanged: () => void;
  /** open the form straight away (the page's "New Adjustment" button) */
  startNew?: boolean;
  onStarted?: () => void;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const isOwner = user?.role === 'OWNER';
  const paging = usePaging();
  const { data, loading, error, reload } = useLoad(
    () => api<{ items: Adjustment[]; total: number }>(`/stock-adjustments?take=${paging.take}&skip=${paging.skip}`),
    [paging.take, paging.skip],
  );
  const [form, setForm] = useState<AdjForm | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!startNew) return;
    setForm((f) => f ?? emptyAdj());
    onStarted?.(); // drop the flag from the address so a refresh doesn't reopen the form
  }, [startNew, onStarted]);

  const preview = form && adjPreview(form);
  const set = (k: keyof AdjForm) => (e: { target: { value: string } }) => setForm((f) => (f ? { ...f, [k]: e.target.value } : f));
  // sizes already in finished stock for the chosen load: one click fills the size
  const sizes = form ? finished.filter((r) => r.importLoadId === form.importLoadId) : [];

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!preview) return;
    setBusy(true);
    setFormError(null);
    try {
      const created = await api<Adjustment>('/stock-adjustments', { method: 'POST', body: JSON.stringify(preview.body) });
      setForm(null);
      setOpen(created.id);
      reload();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const changeText = (a: Pick<Adjustment, 'kind' | 'piecesDelta' | 'cftDelta'>) =>
    a.kind === 'FINISHED' ? `${signed(a.piecesDelta)} ${t('pieces')} (${signed(a.cftDelta, num3)} CFT)` : `${signed(a.cftDelta, num3)} CFT`;
  const cols = isOwner ? 7 : 6;

  return (
    <div className="flex flex-col gap-3">
      {/* what an adjustment is and when it takes effect: stock moves only on approval */}
      <Card className="gap-3 py-5">
        <CardContent className="px-5">
          <h2 className="text-[0.9375rem] font-semibold">{t('adjHowTitle')}</h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-3">
            {(
              [
                ['adjStep1', 'adjStep1Sub'],
                ['adjStep2', 'adjStep2Sub'],
                ['adjStep3', 'adjStep3Sub'],
              ] as const
            ).map(([title, sub], n) => (
              <li key={title} className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary tabular-nums">{n + 1}</span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{t(title)}</div>
                  <p className="mt-0.5 text-sm text-pretty text-muted-foreground">{t(sub)}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {form && (
        <Card className="py-6">
          <CardHeader className="px-5 sm:px-6">
            <CardTitle>{t('newAdjustment')}</CardTitle>
          </CardHeader>
          <CardContent className="px-5 sm:px-6">
            <form onSubmit={create} className="grid gap-6">
              <FormSection step={1} title={t('adjWhich')} description={t('adjWhichSub')}>
                <Field label={t('stockKind')} required className="sm:col-span-2">
                  {/* two tiles rather than a dropdown: the choice changes the rest of the form */}
                  <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={t('stockKind')}>
                    {(
                      [
                        ['FINISHED', t('finished'), PackageIcon],
                        ['RAW', t('raw'), LayersIcon],
                      ] as const
                    ).map(([k, label, Icon]) => (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={form.kind === k}
                        onClick={() => setForm({ ...form, kind: k })}
                        className={cn(
                          'flex items-center gap-3 rounded-lg border-2 bg-card px-3.5 py-3 text-left text-sm font-semibold transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                          form.kind === k ? 'border-primary' : 'border-border hover:border-foreground/25',
                        )}
                      >
                        <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg [&_svg]:size-[1.125rem]', form.kind === k ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                          <Icon aria-hidden />
                        </span>
                        {label}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label={t('importId')} required className={form.kind === 'RAW' ? 'sm:col-span-2' : undefined}>
                  <Select value={form.importLoadId} onValueChange={(v) => setForm({ ...form, importLoadId: v, woodType: loads.find((x) => x.id === v)?.woodType ?? '' })}>
                    <SelectTrigger className="w-full" aria-label={t('importId')}>
                      <SelectValue placeholder={t('pickLoad')} />
                    </SelectTrigger>
                    <SelectContent>
                      {loads.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.code} · {l.woodType}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {form.kind === 'FINISHED' && (
                  <Field id="adj-wood" label={t('woodType')}>
                    <Input id="adj-wood" value={form.woodType} onChange={set('woodType')} minLength={2} maxLength={60} />
                  </Field>
                )}
              </FormSection>

              <FormSection step={2} title={t('adjChange')} description={t('adjChangeSub')}>
                {form.kind === 'RAW' ? (
                  <>
                    <Field id="adj-cft" label={t('cftChange')} required>
                      <Input id="adj-cft" type="number" value={form.cft} onChange={set('cft')} step="0.001" inputMode="decimal" required className="tabular-nums" />
                    </Field>
                    <Field id="adj-logs" label={t('logsChange')}>
                      <Input id="adj-logs" type="number" value={form.pieces} onChange={set('pieces')} step="1" inputMode="numeric" className="tabular-nums" />
                    </Field>
                  </>
                ) : (
                  <>
                    {sizes.length > 0 && (
                      <Field label={t('size')} className="sm:col-span-2">
                        <div className="flex flex-wrap gap-1.5">
                          {sizes.map((s) => {
                            const on = form.thickness === String(s.thicknessIn) && form.width === String(s.widthIn) && form.length === String(s.lengthFt);
                            return (
                              <Button
                                type="button"
                                key={`${s.woodType}|${s.thicknessIn}|${s.widthIn}|${s.lengthFt}`}
                                variant={on ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setForm({ ...form, woodType: s.woodType, thickness: String(s.thicknessIn), width: String(s.widthIn), length: String(s.lengthFt) })}
                              >
                                {sizeLabel(s.thicknessIn, s.widthIn, s.lengthFt)}
                                <span className={cn('text-xs', on ? 'opacity-80' : 'text-muted-foreground')}>{s.pieces}</span>
                              </Button>
                            );
                          })}
                        </div>
                      </Field>
                    )}
                    <div className="grid grid-cols-3 gap-3 sm:col-span-2">
                      <Field id="adj-t" label={t('thickness')} required>
                        <Input id="adj-t" type="number" value={form.thickness} onChange={set('thickness')} min={0.01} step="0.01" inputMode="decimal" required className="tabular-nums" />
                      </Field>
                      <Field id="adj-w" label={t('width')} required>
                        <Input id="adj-w" type="number" value={form.width} onChange={set('width')} min={0.01} step="0.01" inputMode="decimal" required className="tabular-nums" />
                      </Field>
                      <Field id="adj-l" label={t('lengthFt')} required>
                        <Input id="adj-l" type="number" value={form.length} onChange={set('length')} min={0.01} step="0.01" inputMode="decimal" required className="tabular-nums" />
                      </Field>
                    </div>
                    <Field id="adj-pcs" label={t('piecesChange')} required>
                      <Input id="adj-pcs" type="number" value={form.pieces} onChange={set('pieces')} step="1" inputMode="numeric" required className="tabular-nums" />
                    </Field>
                  </>
                )}
                {/* what this will do to stock once approved */}
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg bg-muted/60 px-4 py-3 text-sm sm:col-span-2" aria-live="polite">
                  <span className="text-muted-foreground">{t('change')}</span>
                  <span className="flex items-center gap-2.5">
                    {preview && <Direction delta={preview.cft} />}
                    <span className={cn('text-lg tabular-nums', preview ? deltaClass(preview.cft) : 'font-semibold text-muted-foreground')}>{preview ? `${signed(preview.cft, num3)} CFT` : '—'}</span>
                  </span>
                </div>
              </FormSection>

              <FormSection step={3} title={t('adjWhy')} description={t('adjWhySub')}>
                <Field id="adj-reason" label={t('reason')} required hint={t('adjReasonHint')} className="sm:col-span-2">
                  <Textarea id="adj-reason" value={form.reason} onChange={set('reason')} required minLength={3} maxLength={500} rows={2} />
                </Field>
              </FormSection>

              {formError && <Notice tone="error">{formError}</Notice>}

              <div className="flex flex-col-reverse gap-2 border-t border-border/70 pt-5 sm:flex-row sm:items-center">
                <p className="text-sm text-muted-foreground sm:mr-auto">{t('adjustHint')}</p>
                <Button type="button" variant="ghost" onClick={() => setForm(null)}>
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={busy || !preview}>
                  {t('adjSaveDraft')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <LoadState loading={loading && !data} error={error} onRetry={reload} />
      {data && (
        <TableCard empty={data.items.length === 0} emptyText={t('noAdjustments')} pager={paging.pager(data.total)}>
          <Table className={gridTable}>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">ID</TableHead>
                <TableHead className={wide}>{t('importId')}</TableHead>
                <TableHead className={wide}>{t('size')}</TableHead>
                <TableHead className={numCell}>{t('change')}</TableHead>
                <TableHead className="hidden xl:table-cell">{t('reason')}</TableHead>
                <TableHead className="hidden sm:table-cell max-md:pr-4">{t('status')}</TableHead>
                {isOwner && <TableHead className="hidden pr-4 xl:table-cell">{t('createdBy')}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((a) => {
                const expanded = open === a.id;
                return (
                  <Fragment key={a.id}>
                    <TableRow data-state={expanded ? 'selected' : undefined} className="cursor-pointer" onClick={() => setOpen(expanded ? null : a.id)}>
                      <TableCell className="pl-4">
                        <button type="button" className="inline-flex items-center gap-1 font-medium text-primary" aria-expanded={expanded}>
                          <ChevronDownIcon className={cn('size-4 transition-transform', !expanded && '-rotate-90')} />
                          {a.code}
                        </button>
                        <div className="pl-5 text-xs text-muted-foreground">
                          {t(a.kind === 'RAW' ? 'raw' : 'finished')} · {a.woodType}
                        </div>
                        <StatusBadge status={a.status} className="mt-1 ml-5 sm:hidden" />
                      </TableCell>
                      <TableCell className={wide}>{a.importCode}</TableCell>
                      <TableCell className={wide}>{sizeOf(a)}</TableCell>
                      <TableCell className={cn(numCell, 'max-sm:pr-4')}>
                        <div className="flex items-center justify-end gap-2">
                          <Direction delta={a.cftDelta} className="max-md:hidden" />
                          <span className={deltaClass(a.cftDelta)}>{changeText(a)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden max-w-56 truncate xl:table-cell" title={a.reason}>
                        {a.reason}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell max-md:pr-4">
                        <StatusBadge status={a.status} />
                      </TableCell>
                      {isOwner && <TableCell className="hidden pr-4 xl:table-cell">{a.createdByName}</TableCell>}
                    </TableRow>
                    {expanded && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={cols} className="bg-muted/30 px-4 py-3 whitespace-normal">
                          <div className="flex flex-col gap-2">
                            <p className="text-sm text-muted-foreground xl:hidden">
                              {a.importCode} · {sizeOf(a)} · {a.reason}
                            </p>
                            {a.rejectionReason && a.status === 'REJECTED' && (
                              <div className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{a.rejectionReason}</div>
                            )}
                            <WorkflowBar
                              base={`/stock-adjustments/${a.id}`}
                              status={a.status}
                              canSubmit={a.canSubmit}
                              canReview={a.canReview}
                              confirmApprove={t('confirmApproveAdjustment', { code: a.code, change: changeText(a) })}
                              onDone={() => {
                                reload();
                                onStockChanged();
                              }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
            {data.items.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={cols} className="pl-4 text-xs font-normal text-muted-foreground">
                    {data.total} {t('adjustments').toLowerCase()}
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </TableCard>
      )}
    </div>
  );
}

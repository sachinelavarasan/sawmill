/**
 * Stock — the reference page for the shadcn/ui migration. Built only from
 * src/components/ui, src/components/page.tsx and Tailwind classes.
 */
import { exportPieceCft, Permission, sizeLabel } from '@sawmill/shared';
import { ChevronDownIcon, HistoryIcon, LayersIcon, PackageIcon, PlusIcon, ScissorsIcon } from 'lucide-react';
import { FormEvent, Fragment, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { api } from '../api';
import { useAuth } from '../auth';
import { dateTime, num3, useLoad } from '../components/common';
import { StatusBadge } from '../components/status-badge';
import { ALL, Field, LoadState, numCell, Page, PageHeader, useClientPaging, usePaging, Stat, StatGrid, TableCard, wide } from '../components/page';
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

  return (
    <Page>
      <PageHeader title={t('stock')} />

      <LoadState loading={loading && !data} error={error} onRetry={reload} />

      {data && (
        <>
          <StatGrid className="lg:grid-cols-2">
            <Stat icon={<LayersIcon />} label={t('rawStock')} value={num3(data.totals.rawCft)} unit="CFT" hint={t('loadsCount', { n: data.totals.rawLoads })} />
            <Stat icon={<PackageIcon />} label={t('finishedStock')} value={num3(data.totals.finishedCft)} unit="CFT" hint={t('piecesCount', { n: data.totals.finishedPieces })} />
          </StatGrid>

          <Tabs value={tab} onValueChange={(v) => go(v as Tab)} className="gap-4">
            <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
              {TABS.map(([key, label]) => (
                <TabsTrigger key={key} value={key} className="px-3">
                  {t(label)}
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
              <AdjustmentsTab loads={loads} finished={data.finished} onStockChanged={reload} />
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

function RawTab({ rows, onHistory }: { rows: RawStockRow[]; onHistory: (loadId: string) => void }) {
  const { t } = useI18n();
  const { can } = useAuth();
  const canOpenAll = can(Permission.OPERATIONS_VIEW_ALL);
  const paged = useClientPaging(rows);
  return (
    <TableCard empty={rows.length === 0} emptyText={t('noStock')} pager={paged.pager}>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="pl-4">{t('importId')}</TableHead>
            <TableHead className={wide}>{t('woodType')}</TableHead>
            <TableHead className={wide}>{t('arrival')}</TableHead>
            <TableHead className={cn(numCell, wide)}>{t('received')}</TableHead>
            <TableHead className={numCell}>{t('inStock')}</TableHead>
            <TableHead className={cn(numCell, wide)}>{t('logs')}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.rows.map((r) => (
            <TableRow key={r.importLoadId}>
              <TableCell className="pl-4 font-medium">
                {canOpenAll ? (
                  <Link className="text-primary hover:underline" to={`/imports/${r.importLoadId}`}>
                    {r.importCode}
                  </Link>
                ) : (
                  r.importCode
                )}
                <div className="text-xs text-muted-foreground md:hidden">{r.woodType}</div>
              </TableCell>
              <TableCell className={wide}>{r.woodType}</TableCell>
              <TableCell className={cn(wide, 'text-muted-foreground')}>{dateTime(r.arrivalAt)}</TableCell>
              <TableCell className={cn(numCell, wide, 'text-muted-foreground')}>{num3(r.receivedCft)}</TableCell>
              <TableCell className={cn(numCell, 'font-semibold')}>{num3(r.cft)}</TableCell>
              <TableCell className={cn(numCell, wide)}>{r.logs}</TableCell>
              <TableCell className="pr-4 text-right">
                <div className="flex justify-end gap-1">
                  {r.cft > 0 && (
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/production/new?load=${r.importLoadId}`} aria-label={t('production')}>
                        <ScissorsIcon />
                        <span className="max-md:sr-only">{t('production')}</span>
                      </Link>
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => onHistory(r.importLoadId)} aria-label={t('movements')}>
                    <HistoryIcon />
                    <span className="max-md:sr-only">{t('movements')}</span>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  );
}

/** Finished stock grouped by wood type and size, with the import loads it came from. */
function FinishedTab({ rows }: { rows: FinishedRow[] }) {
  const { t } = useI18n();
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
  const flat = useMemo(() => byWood.flatMap(([wood, sizes]) => sizes.map((g) => ({ wood, sizes, g }))), [byWood]);
  const paged = useClientPaging(flat);

  return (
    <TableCard empty={byWood.length === 0} emptyText={t('noStock')} pager={paged.pager}>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="pl-4">{t('size')}</TableHead>
            <TableHead className={numCell}>{t('pieces')}</TableHead>
            <TableHead className={numCell}>CFT</TableHead>
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
                  <TableCell className={cn(numCell, 'font-semibold')}>{num3(sizes.reduce((s, x) => s + x.cft, 0))}</TableCell>
                  <TableCell className={wide} />
                </TableRow>
              )}
              <TableRow>
                <TableCell className="pl-8">{g.size}</TableCell>
                <TableCell className={numCell}>{g.pieces}</TableCell>
                <TableCell className={numCell}>{num3(g.cft)}</TableCell>
                <TableCell className={cn(wide, 'pr-4 text-xs text-muted-foreground')}>{g.loads.join(', ')}</TableCell>
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
  const paging = usePaging();
  const query = `take=${paging.take}&skip=${paging.skip}${load ? `&importLoadId=${load}` : ''}${kind !== ALL ? `&kind=${kind}` : ''}`;
  const { data, loading, error, reload } = useLoad(() => api<{ items: Movement[]; total: number }>(`/stock/movements?${query}`), [query]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Select
          value={load || ALL}
          onValueChange={(v) => {
            paging.reset();
            onLoad(v === ALL ? '' : v);
          }}
        >
          <SelectTrigger className="w-44 bg-card" aria-label={t('importId')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('allLoads')}</SelectItem>
            {loads.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={kind}
          onValueChange={(v) => {
            paging.reset();
            setKind(v);
          }}
        >
          <SelectTrigger className="w-44 bg-card" aria-label={t('stockKind')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>
              {t('raw')} + {t('finished')}
            </SelectItem>
            <SelectItem value="RAW">{t('raw')}</SelectItem>
            <SelectItem value="FINISHED">{t('finished')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <LoadState loading={loading && !data} error={error} onRetry={reload} />
      {data && (
        <>
          <TableCard empty={data.items.length === 0} emptyText={t('noMovements')} pager={paging.pager(data.total)}>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className={cn(wide, 'pl-4')}>{t('time')}</TableHead>
                  <TableHead className="max-md:pl-4">{t('source')}</TableHead>
                  <TableHead className={wide}>{t('importId')}</TableHead>
                  <TableHead className={wide}>{t('stockKind')}</TableHead>
                  <TableHead className={wide}>{t('size')}</TableHead>
                  <TableHead className={numCell}>{t('pieces')}</TableHead>
                  <TableHead className={cn(numCell, 'max-md:pr-4')}>CFT</TableHead>
                  <TableHead className={cn(wide, 'pr-4')}>{t('user')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((m) => {
                  const path = SOURCE_PATH[m.source];
                  return (
                    <TableRow key={m.id}>
                      <TableCell className={cn(wide, 'pl-4 text-muted-foreground')}>{dateTime(m.createdAt)}</TableCell>
                      <TableCell className="max-md:pl-4">
                        {t(SOURCE_LABEL[m.source])}{' '}
                        {path && canOpenAll ? (
                          <Link className="font-medium text-primary hover:underline" to={`${path}${m.sourceId}`}>
                            {m.sourceCode}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">{m.sourceCode}</span>
                        )}
                        <div className="text-xs text-muted-foreground md:hidden">
                          {m.importCode} · {m.woodType}
                        </div>
                      </TableCell>
                      <TableCell className={wide}>{m.importCode}</TableCell>
                      <TableCell className={wide}>
                        {t(m.kind === 'RAW' ? 'raw' : 'finished')} · {m.woodType}
                      </TableCell>
                      <TableCell className={wide}>{sizeOf(m)}</TableCell>
                      <TableCell className={cn(numCell, deltaClass(m.piecesDelta))}>{m.piecesDelta ? signed(m.piecesDelta) : '—'}</TableCell>
                      <TableCell className={cn(numCell, 'max-md:pr-4', deltaClass(m.cftDelta))}>{signed(m.cftDelta, num3)}</TableCell>
                      <TableCell className={cn(wide, 'pr-4')}>{m.postedByName}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableCard>
        </>
      )}
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
}: {
  loads: { id: string; code: string; woodType: string }[];
  finished: FinishedRow[];
  onStockChanged: () => void;
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t('adjustHint')}</p>
        {!form && (
          <Button onClick={() => setForm(emptyAdj())}>
            <PlusIcon /> {t('newAdjustment')}
          </Button>
        )}
      </div>

      {form && (
        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle>{t('newAdjustment')}</CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            <form onSubmit={create} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label={`${t('stockKind')} *`}>
                  <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as AdjForm['kind'] })}>
                    <SelectTrigger className="w-full" aria-label={t('stockKind')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FINISHED">{t('finished')}</SelectItem>
                      <SelectItem value="RAW">{t('raw')}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={`${t('importId')} *`}>
                  <Select
                    value={form.importLoadId}
                    onValueChange={(v) => setForm({ ...form, importLoadId: v, woodType: loads.find((x) => x.id === v)?.woodType ?? '' })}
                  >
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

                {form.kind === 'RAW' ? (
                  <>
                    <Field id="adj-cft" label={`${t('cftChange')} *`}>
                      <Input id="adj-cft" type="number" value={form.cft} onChange={set('cft')} step="0.001" inputMode="decimal" required />
                    </Field>
                    <Field id="adj-logs" label={t('logsChange')}>
                      <Input id="adj-logs" type="number" value={form.pieces} onChange={set('pieces')} step="1" inputMode="numeric" />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field id="adj-wood" label={t('woodType')}>
                      <Input id="adj-wood" value={form.woodType} onChange={set('woodType')} minLength={2} maxLength={60} />
                    </Field>
                    {sizes.length > 0 && (
                      <Field label={t('size')} className="sm:col-span-2 lg:col-span-3">
                        <div className="flex flex-wrap gap-1.5">
                          {sizes.map((s) => {
                            const on = form.thickness === String(s.thicknessIn) && form.width === String(s.widthIn) && form.length === String(s.lengthFt);
                            return (
                              <Button
                                type="button"
                                key={`${s.woodType}|${s.thicknessIn}|${s.widthIn}|${s.lengthFt}`}
                                variant={on ? 'default' : 'outline'}
                                size="sm"
                                onClick={() =>
                                  setForm({ ...form, woodType: s.woodType, thickness: String(s.thicknessIn), width: String(s.widthIn), length: String(s.lengthFt) })
                                }
                              >
                                {sizeLabel(s.thicknessIn, s.widthIn, s.lengthFt)}
                                <span className={cn('text-xs', on ? 'opacity-80' : 'text-muted-foreground')}>{s.pieces}</span>
                              </Button>
                            );
                          })}
                        </div>
                      </Field>
                    )}
                    <Field id="adj-t" label={`${t('thickness')} *`}>
                      <Input id="adj-t" type="number" value={form.thickness} onChange={set('thickness')} min={0.01} step="0.01" inputMode="decimal" required />
                    </Field>
                    <Field id="adj-w" label={`${t('width')} *`}>
                      <Input id="adj-w" type="number" value={form.width} onChange={set('width')} min={0.01} step="0.01" inputMode="decimal" required />
                    </Field>
                    <Field id="adj-l" label={`${t('lengthFt')} *`}>
                      <Input id="adj-l" type="number" value={form.length} onChange={set('length')} min={0.01} step="0.01" inputMode="decimal" required />
                    </Field>
                    <Field id="adj-pcs" label={`${t('piecesChange')} *`}>
                      <Input id="adj-pcs" type="number" value={form.pieces} onChange={set('pieces')} step="1" inputMode="numeric" required />
                    </Field>
                  </>
                )}
                <Field id="adj-reason" label={`${t('reason')} *`} className="sm:col-span-2 lg:col-span-3">
                  <Input id="adj-reason" value={form.reason} onChange={set('reason')} required minLength={3} maxLength={500} />
                </Field>
              </div>

              {formError && <div className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{formError}</div>}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                <div className="text-sm text-muted-foreground sm:mr-auto">
                  {t('change')}:{' '}
                  <span className={cn('tabular-nums', preview ? deltaClass(preview.cft) : 'text-foreground')}>
                    {preview ? `${signed(preview.cft, num3)} CFT` : '—'}
                  </span>
                </div>
                <Button type="button" variant="ghost" onClick={() => setForm(null)}>
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={busy || !preview}>
                  {t('save')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <LoadState loading={loading && !data} error={error} onRetry={reload} />
      {data && (
        <TableCard empty={data.items.length === 0} emptyText={t('noAdjustments')} pager={paging.pager(data.total)}>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="pl-4">ID</TableHead>
                <TableHead className={wide}>{t('importId')}</TableHead>
                <TableHead className={wide}>{t('size')}</TableHead>
                <TableHead className={numCell}>{t('change')}</TableHead>
                <TableHead className={wide}>{t('reason')}</TableHead>
                <TableHead className="hidden sm:table-cell max-md:pr-4">{t('status')}</TableHead>
                {isOwner && <TableHead className={cn(wide, 'pr-4')}>{t('createdBy')}</TableHead>}
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
                      <TableCell className={cn(numCell, 'max-sm:pr-4', deltaClass(a.cftDelta))}>{changeText(a)}</TableCell>
                      <TableCell className={cn(wide, 'max-w-56 truncate')} title={a.reason}>
                        {a.reason}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell max-md:pr-4">
                        <StatusBadge status={a.status} />
                      </TableCell>
                      {isOwner && <TableCell className={cn(wide, 'pr-4')}>{a.createdByName}</TableCell>}
                    </TableRow>
                    {expanded && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={cols} className="bg-muted/30 px-4 py-3 whitespace-normal">
                          <div className="flex flex-col gap-2">
                            <p className="text-sm text-muted-foreground md:hidden">
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

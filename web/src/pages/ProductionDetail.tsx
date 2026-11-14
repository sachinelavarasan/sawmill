import { exportPieceCft, productionWaste, sizeLabel, totalCft } from '@sawmill/shared';
import { ArrowUpRightIcon, CheckIcon, EqualIcon, MinusIcon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
import { ReactNode } from 'react';
import { FormEvent, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { api } from '../api';
import { dateTime, num3, useLoad } from '../components/common';
import { StatusBadge } from '../components/status-badge';
import { FormActions, FormCard, LoadState, Notice, numCell, Page, PageHeader, Section, TableCard, useClientPaging } from '../components/page';
import { WorkflowBar } from '../components/workflow';
import { useConfirmDelete } from '../components/confirm';
import { useI18n } from '../i18n';
import { toLocalInput } from './Imports';
import { dateOnly, ProductionFields, ProductionForm, productionBody } from './Production';

export interface Output {
  id: string;
  thicknessIn: number;
  widthIn: number;
  lengthFt: number;
  pieces: number;
  cft: number;
}
export interface ProductionDetail {
  id: string;
  code: string;
  importLoadId: string;
  importCode: string;
  importLorryNumber: string;
  woodType: string;
  productionDate: string;
  cuttingMachine: string | null;
  machineOperator: string | null;
  workerDetails: string | null;
  startAt: string | null;
  endAt: string | null;
  inputCft: number | null;
  outputCft: number;
  wasteCft: number | null;
  wasteNotes: string | null;
  recoveryPercent: number | null;
  rawAvailableCft: number;
  status: string;
  rejectionReason: string | null;
  createdByName: string;
  editable: boolean;
  canSubmit: boolean;
  canReview: boolean;
  outputs: Output[];
}

const positive = (v: string) => {
  const n = Number(v);
  return v.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null;
};
const wholePositive = (v: string) => {
  const n = positive(v);
  return n != null && Number.isInteger(n) ? n : null;
};
const errorText = (e: unknown) => (e as Error).message;

export function ProductionDetailPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const { data: run, loading, error, reload } = useLoad(() => api<ProductionDetail>(`/production/${id}`), [id]);

  const blocked = run && (run.inputCft == null || run.outputs.length === 0) ? t('needInputAndOutput') : null;

  return (
    <Page>
      <PageHeader
        title={run?.code ?? t('productionDetails')}
        back={{ to: '/production', label: t('production') }}
        badge={run && <StatusBadge status={run.status} />}
        subtitle={
          run && (
            <>
              <Link className="font-medium text-primary hover:underline" to={`/imports/${run.importLoadId}`}>
                {run.importCode}
              </Link>{' '}
              · {run.woodType} · {dateOnly(run.productionDate)}
            </>
          )
        }
      />

      <LoadState loading={loading && !run} error={error} onRetry={reload} />

      {run && (
        <>
          {!run.editable && run.status !== 'SUBMITTED' && <Notice>{t('lockedRecord')}</Notice>}
          {run.rejectionReason && <Notice tone="error">{run.rejectionReason}</Notice>}

          {/* the run as a sum: raw wood in, finished wood out, and what was lost between them */}
          <div className="grid items-stretch gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
            <Figure label={t('inputCft')} value={run.inputCft != null ? num3(run.inputCft) : '—'} sub={`${run.importCode} · ${run.woodType}`} />
            <Sign>
              <MinusIcon aria-label="−" />
            </Sign>
            <Figure
              filled
              label={t('outputCft')}
              value={num3(run.outputCft)}
              sub={`${t('piecesCount', { n: run.outputs.reduce((a, o) => a + o.pieces, 0) })} · ${t('sizesCount', { n: run.outputs.length })}`}
            />
            <Sign>
              <EqualIcon aria-label="=" />
            </Sign>
            <Figure label={t('wasteCft')} value={run.wasteCft != null ? num3(run.wasteCft) : '—'} bad={run.wasteCft != null && run.wasteCft < 0} sub={run.wasteNotes || undefined}>
              {/* how much of the raw wood came out as finished wood */}
              <div className="mt-3">
                <div className="h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${t('recovery')}: ${run.recoveryPercent != null ? `${run.recoveryPercent}%` : '—'}`}>
                  <div
                    className={cn('h-full rounded-full', run.recoveryPercent != null && run.recoveryPercent > 100 ? 'bg-destructive' : 'bg-chart-1')}
                    style={{ width: `${Math.min(100, Math.max(0, run.recoveryPercent ?? 0))}%` }}
                  />
                </div>
                <div className="mt-1.5 text-xs text-muted-foreground">{run.recoveryPercent != null ? t('recoveryLine', { n: run.recoveryPercent }) : `${t('recovery')}: —`}</div>
              </div>
            </Figure>
          </div>
          {run.wasteCft != null && run.wasteCft < 0 && <Notice tone="error">{t('outputExceedsInput')}</Notice>}

          <WorkflowBar
            base={`/production/${run.id}`}
            status={run.status}
            canSubmit={run.canSubmit}
            canReview={run.canReview}
            submitBlocked={blocked}
            confirmApprove={t('confirmApproveProduction', { code: run.code, input: num3(run.inputCft ?? 0), output: num3(run.outputCft) })}
            approvedNote={run.editable ? t('approvedProductionNote') : undefined}
            onDone={reload}
          />

          <DetailsSection run={run} onSaved={reload} />
          <OutputsSection run={run} onChanged={reload} />
        </>
      )}
    </Page>
  );
}

/** One term of the run's sum: a label, a large CFT figure and a line of context. `filled` marks the one that matters most. */
function Figure({ label, value, sub, filled, bad, children }: { label: string; value: string; sub?: string; filled?: boolean; bad?: boolean; children?: ReactNode }) {
  return (
    <Card className={cn('gap-0 py-5', filled && 'bg-primary text-primary-foreground dark:bg-primary-soft dark:text-foreground')}>
      <CardContent className="px-5">
        <div className={cn('text-sm font-medium', filled ? 'opacity-80' : 'text-muted-foreground')}>{label}</div>
        <div className={cn('mt-1 text-4xl leading-none font-bold tracking-[-0.03em] tabular-nums', bad && 'text-destructive')}>
          {value}
          <span className={cn('ml-1.5 text-sm font-medium tracking-normal', filled ? 'opacity-75' : 'text-muted-foreground')}>CFT</span>
        </div>
        {sub && <div className={cn('mt-2 truncate text-sm', filled ? 'opacity-80' : 'text-muted-foreground')}>{sub}</div>}
        {children}
      </CardContent>
    </Card>
  );
}

/** The − and = between the figures (hidden when the cards stack on a phone). */
function Sign({ children }: { children: ReactNode }) {
  return <span className="grid place-items-center text-muted-foreground max-md:hidden [&_svg]:size-5">{children}</span>;
}

/** Label / value pairs in a card. */
function Facts({ items, className }: { items: [string, ReactNode][]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-2 gap-x-4 gap-y-4', className)}>
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 font-medium break-words">{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

function DetailsSection({ run, onSaved }: { run: ProductionDetail; onSaved: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState<ProductionForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const startEdit = () =>
    setForm({
      productionDate: run.productionDate,
      cuttingMachine: run.cuttingMachine ?? '',
      machineOperator: run.machineOperator ?? '',
      workerDetails: run.workerDetails ?? '',
      startAt: toLocalInput(run.startAt),
      endAt: toLocalInput(run.endAt),
      inputCft: run.inputCft != null ? String(run.inputCft) : '',
      wasteNotes: run.wasteNotes ?? '',
    });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/production/${run.id}`, { method: 'PATCH', body: JSON.stringify(productionBody(form)) });
      setForm(null);
      onSaved();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  // Once approved, this run's own input is already out of the balance, so it can use up to balance + its input.
  const available = run.status === 'APPROVED' ? run.rawAvailableCft + (run.inputCft ?? 0) : run.rawAvailableCft;

  const editButton = run.editable && !form && (
    <Button variant="outline" size="sm" onClick={startEdit}>
      <PencilIcon /> {t('edit')}
    </Button>
  );

  if (form)
    return (
      <Section title={t('productionDetails')}>
        <FormCard onSubmit={submit}>
          <ProductionFields form={form} onChange={setForm} availableCft={available} />
          {error && <Notice tone="error">{error}</Notice>}
          <FormActions>
            <Button type="button" variant="ghost" onClick={() => setForm(null)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={busy}>
              {t('save')}
            </Button>
          </FormActions>
        </FormCard>
      </Section>
    );

  return (
    <div className="grid items-start gap-x-4 gap-y-5 lg:grid-cols-2">
      {/* what went in: the load the raw wood came from, and how much of it this run used */}
      <Section title={t('secRawInput')} tools={editButton}>
        <Card className="gap-4 py-5">
          <CardContent className="px-5">
            <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-4 py-3">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">{t('sourceLoad')}</div>
                <Link className="text-lg leading-tight font-bold text-primary hover:underline" to={`/imports/${run.importLoadId}`}>
                  {run.importCode}
                </Link>
                <div className="mt-0.5 truncate text-sm text-muted-foreground">
                  {t('lorry')} {run.importLorryNumber} · {run.woodType}
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link to={`/imports/${run.importLoadId}`}>
                  <ArrowUpRightIcon /> {t('openLoad')}
                </Link>
              </Button>
            </div>
          </CardContent>
          <CardContent className="px-5">
            <Facts
              items={[
                [t('inputCft'), run.inputCft != null ? `${num3(run.inputCft)} CFT` : null],
                [t('rawLeftInLoad'), `${num3(run.rawAvailableCft)} CFT`],
              ]}
            />
          </CardContent>
        </Card>
      </Section>

      {/* how the run was done */}
      <Section title={t('runDetails')}>
        <Card className="py-5">
          <CardContent className="px-5">
            <Facts
              items={[
                [t('date'), dateOnly(run.productionDate)],
                [t('createdBy'), run.createdByName],
                [t('cuttingMachine'), run.cuttingMachine],
                [t('machineOperator'), run.machineOperator],
                [t('startTime'), run.startAt ? dateTime(run.startAt) : null],
                [t('endTime'), run.endAt ? dateTime(run.endAt) : null],
                [t('workerDetails'), run.workerDetails],
                [t('wasteNotes'), run.wasteNotes],
              ]}
            />
          </CardContent>
        </Card>
      </Section>
    </div>
  );
}

type SizeForm = { thickness: string; width: string; length: string; pieces: string };
const emptySize: SizeForm = { thickness: '', width: '', length: '', pieces: '' };

/** Live CFT for a size row, or null while incomplete. */
function sizeCft(f: SizeForm) {
  const tIn = positive(f.thickness);
  const wIn = positive(f.width);
  const lFt = positive(f.length);
  const pcs = wholePositive(f.pieces);
  if (tIn == null || wIn == null || lFt == null || pcs == null) return null;
  return { cft: exportPieceCft(tIn, wIn, lFt, pcs), body: { thicknessIn: tIn, widthIn: wIn, lengthFt: lFt, pieces: pcs } };
}

function OutputsSection({ run, onChanged }: { run: ProductionDetail; onChanged: () => void }) {
  const { t } = useI18n();
  const confirmDelete = useConfirmDelete();
  const [entry, setEntry] = useState<SizeForm>(emptySize);
  const [editing, setEditing] = useState<(SizeForm & { id: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);

  const live = sizeCft(entry);
  const set = (k: keyof SizeForm) => (e: { target: { value: string } }) => setEntry({ ...entry, [k]: e.target.value });

  async function act(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  function add(e: FormEvent) {
    e.preventDefault();
    if (!live) return;
    act(async () => {
      await api(`/production/${run.id}/outputs`, { method: 'POST', body: JSON.stringify(live.body) });
      // the next size usually shares thickness × width; keep them, clear the rest
      setEntry({ ...entry, length: '', pieces: '' });
      firstRef.current?.focus();
    });
  }

  function saveEdit(e: FormEvent) {
    e.preventDefault();
    const calc = editing && sizeCft(editing);
    if (!editing || !calc) return;
    act(async () => {
      await api(`/production/${run.id}/outputs/${editing.id}`, { method: 'PATCH', body: JSON.stringify(calc.body) });
      setEditing(null);
    });
  }

  const remove = (o: Output) => {
    confirmDelete().then((ok) => {
      if (ok) act(() => api(`/production/${run.id}/outputs/${o.id}`, { method: 'DELETE' }));
    });
  };

  const totalPieces = run.outputs.reduce((s, o) => s + o.pieces, 0);
  // previews while typing, by the shared rules: totals are the sum of the rounded lines; waste = raw used − finished
  const afterOutput = live ? totalCft([run.outputCft, live.cft]) : run.outputCft;
  const afterWaste = run.inputCft != null ? productionWaste(run.inputCft, afterOutput) : null;
  const outputs = useClientPaging(run.outputs);
  const editCalc = editing && sizeCft(editing);
  const cell = (k: keyof SizeForm, label: string, step = '0.01') =>
    editing && (
      <Input
        type="number"
        aria-label={label}
        className="h-8 w-20 text-right tabular-nums"
        value={editing[k]}
        onChange={(e) => setEditing({ ...editing, [k]: e.target.value })}
        min={step === '1' ? 1 : 0.01}
        step={step}
        inputMode={step === '1' ? 'numeric' : 'decimal'}
        required
      />
    );

  return (
    <Section
      title={
        <>
          {t('secFinishedOutput')}
          <span className="min-w-6 rounded-full bg-muted px-2 text-center text-xs leading-6 font-bold text-muted-foreground tabular-nums">{run.outputs.length}</span>
        </>
      }
    >
      {run.editable && (
        <Card className="py-5">
          <CardContent className="px-5">
            <form onSubmit={add} className="grid gap-4">
              <p className="text-xs text-muted-foreground">{t('sizeHint')}</p>
              <div className="grid gap-x-6 gap-y-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
                {/* the size: three measurements that belong together */}
                <fieldset className="min-w-0">
                  <legend className="mb-1.5 text-sm font-semibold">{t('size')}</legend>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {(
                      [
                        ['thickness', t('thickness')],
                        ['width', t('width')],
                        ['length', t('lengthFt')],
                      ] as const
                    ).map(([k, label], n) => (
                      <label key={k} className="flex min-w-0 flex-col gap-1.5">
                        <span className="truncate text-xs text-muted-foreground">{label}</span>
                        <Input
                          ref={n === 0 ? firstRef : undefined}
                          type="number"
                          value={entry[k]}
                          onChange={set(k)}
                          min={0.01}
                          max={999}
                          step="0.01"
                          inputMode="decimal"
                          required
                          className="h-14 px-3 text-2xl font-bold tabular-nums md:text-2xl"
                        />
                      </label>
                    ))}
                  </div>
                </fieldset>
                {/* how many of that size */}
                <fieldset className="min-w-0">
                  <legend className="mb-1.5 text-sm font-semibold">{t('pieces')}</legend>
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-xs text-muted-foreground">{t('piecesCount', { n: wholePositive(entry.pieces) ?? 0 })}</span>
                    <Input type="number" aria-label={t('pieces')} value={entry.pieces} onChange={set('pieces')} min={1} step="1" inputMode="numeric" required className="h-14 px-3 text-2xl font-bold tabular-nums md:text-2xl" />
                  </label>
                </fieldset>
              </div>

              {/* what this size comes to, and what it does to the run's totals */}
              <div className="grid gap-3 rounded-lg bg-muted/60 px-4 py-3 sm:grid-cols-3">
                {(
                  [
                    [t('thisSize'), live ? live.cft : null, false],
                    [t('finishedAfterSize'), afterOutput, false],
                    [t('wasteAfterSize'), afterWaste, afterWaste != null && afterWaste < 0],
                  ] as const
                ).map(([label, value, bad]) => (
                  <div key={label}>
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className={cn('mt-0.5 text-2xl leading-tight font-bold tabular-nums', !live && 'text-muted-foreground', bad && 'text-destructive')}>
                      {value != null ? num3(value) : '—'} <span className="text-sm font-medium text-muted-foreground">CFT</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <Button type="submit" size="lg" className="h-12 max-sm:w-full sm:min-w-48" disabled={busy || !live}>
                  <PlusIcon /> {t('addSize')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      <TableCard compactEmpty empty={run.outputs.length === 0} emptyText={t('noOutputs')} pager={outputs.pager}>
        <form onSubmit={saveEdit}>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="pl-4">{t('size')}</TableHead>
                <TableHead className={numCell}>{t('pieces')}</TableHead>
                <TableHead className={numCell}>CFT</TableHead>
                <TableHead className="pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {outputs.rows.map((o) =>
                editing?.id === o.id ? (
                  <TableRow key={o.id} data-state="selected">
                    <TableCell className="pl-4">
                      <div className="flex flex-wrap items-center gap-1">
                        {cell('thickness', t('thickness'))} × {cell('width', t('width'))} × {cell('length', t('lengthFt'))}
                      </div>
                    </TableCell>
                    <TableCell className={numCell}>
                      <div className="flex justify-end">{cell('pieces', t('pieces'), '1')}</div>
                    </TableCell>
                    <TableCell className={cn(numCell, 'font-semibold')}>{editCalc ? num3(editCalc.cft) : '—'}</TableCell>
                    <TableCell className="pr-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button type="submit" size="sm" disabled={busy || !editCalc} aria-label={t('save')}>
                          <CheckIcon />
                          <span className="max-md:sr-only">{t('save')}</span>
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)} aria-label={t('cancel')}>
                          <XIcon />
                          <span className="max-md:sr-only">{t('cancel')}</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={o.id}>
                    <TableCell className="pl-4 font-medium">{sizeLabel(o.thicknessIn, o.widthIn, o.lengthFt)}</TableCell>
                    <TableCell className={numCell}>{o.pieces}</TableCell>
                    <TableCell className={numCell}>{num3(o.cft)}</TableCell>
                    <TableCell className="pr-4 text-right">
                      {run.editable && (
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            aria-label={t('edit')}
                            onClick={() =>
                              setEditing({ id: o.id, thickness: String(o.thicknessIn), width: String(o.widthIn), length: String(o.lengthFt), pieces: String(o.pieces) })
                            }
                          >
                            <PencilIcon />
                            <span className="max-md:sr-only">{t('edit')}</span>
                          </Button>
                          <Button type="button" variant="ghost" size="sm" aria-label={t('delete')} onClick={() => remove(o)}>
                            <Trash2Icon />
                            <span className="max-md:sr-only">{t('delete')}</span>
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ),
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="pl-4">{t('total')}</TableCell>
                <TableCell className={cn(numCell, 'font-semibold')}>{totalPieces}</TableCell>
                <TableCell className={cn(numCell, 'text-base font-bold')}>{num3(run.outputCft)}</TableCell>
                <TableCell className="pr-4" />
              </TableRow>
            </TableFooter>
          </Table>
        </form>
      </TableCard>
    </Section>
  );
}

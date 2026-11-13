import { exportPieceCft, sizeLabel } from '@sawmill/shared';
import { CheckIcon, PencilIcon, Trash2Icon, XIcon } from 'lucide-react';
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
import { EntryField, EntryRow, FormActions, FormCard, LoadState, Notice, numCell, Page, PageHeader, Section, Stat, StatGrid, TableCard, useClientPaging } from '../components/page';
import { WorkflowBar } from '../components/workflow';
import { useConfirmDelete } from '../components/confirm';
import { useI18n } from '../i18n';
import { toLocalInput } from './Imports';
import { dateOnly, ProductionFields, ProductionForm, productionBody } from './Production';

interface Output {
  id: string;
  thicknessIn: number;
  widthIn: number;
  lengthFt: number;
  pieces: number;
  cft: number;
}
interface ProductionDetail {
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

          <StatGrid>
            <Stat label={t('inputCft')} value={run.inputCft != null ? num3(run.inputCft) : '—'} unit={run.inputCft != null ? 'CFT' : undefined} />
            <Stat label={t('outputCft')} value={num3(run.outputCft)} unit="CFT" />
            <Stat
              label={t('wasteCft')}
              value={run.wasteCft != null ? num3(run.wasteCft) : '—'}
              unit={run.wasteCft != null ? 'CFT' : undefined}
              tone={run.wasteCft != null && run.wasteCft < 0 ? 'bad' : undefined}
            />
            <Stat label={t('recovery')} value={run.recoveryPercent != null ? `${run.recoveryPercent}%` : '—'} />
          </StatGrid>
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

  const facts: [string, string | null][] = [
    [t('cuttingMachine'), run.cuttingMachine],
    [t('machineOperator'), run.machineOperator],
    [t('startTime'), run.startAt ? dateTime(run.startAt) : null],
    [t('endTime'), run.endAt ? dateTime(run.endAt) : null],
    [t('workerDetails'), run.workerDetails],
    [t('wasteNotes'), run.wasteNotes],
    [t('rawLeftInLoad'), `${num3(run.rawAvailableCft)} CFT`],
    [t('createdBy'), run.createdByName],
  ];

  return (
    <Section
      title={t('productionDetails')}
      tools={
        run.editable &&
        !form && (
          <Button variant="outline" size="sm" onClick={startEdit}>
            <PencilIcon /> {t('edit')}
          </Button>
        )
      }
    >
      {form ? (
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
      ) : (
        <Card className="py-4">
          <CardContent className="px-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
              {facts.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="font-medium break-words">{value || '—'}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}
    </Section>
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
    <Section title={t('outputSizes')}>
      {run.editable && (
        <EntryRow onSubmit={add} resultLabel="CFT" result={live ? num3(live.cft) : '0.000'} submitLabel={t('addSize')} submitDisabled={busy || !live}>
          <EntryField
            inputRef={firstRef}
            label={t('thickness')}
            value={entry.thickness}
            onChange={set('thickness')}
            min={0.01}
            max={999}
            step="0.01"
            inputMode="decimal"
            required
          />
          <EntryField label={t('width')} value={entry.width} onChange={set('width')} min={0.01} max={999} step="0.01" inputMode="decimal" required />
          <EntryField label={t('lengthFt')} value={entry.length} onChange={set('length')} min={0.01} max={999} step="0.01" inputMode="decimal" required />
          <EntryField label={t('pieces')} value={entry.pieces} onChange={set('pieces')} min={1} step="1" inputMode="numeric" required />
        </EntryRow>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      <TableCard empty={run.outputs.length === 0} emptyText={t('noOutputs')} pager={outputs.pager}>
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
                <TableCell className={numCell}>{totalPieces}</TableCell>
                <TableCell className={numCell}>{num3(run.outputCft)}</TableCell>
                <TableCell className="pr-4" />
              </TableRow>
            </TableFooter>
          </Table>
        </form>
      </TableCard>
    </Section>
  );
}

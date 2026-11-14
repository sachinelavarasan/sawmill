import { exportPieceCft, Permission, sizeLabel } from '@sawmill/shared';
import { CheckIcon, PencilIcon, Trash2Icon, XIcon } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { api } from '../api';
import { useAuth } from '../auth';
import { dateTime, money, num3, useLoad } from '../components/common';
import { ALL, EntryField, EntryRow, Field, FigureStrip, FormActions, FormCard, FormGrid, LoadState, Notice, numCell, OwnerOnly, Page, PageHeader, Section, TableCard, useClientPaging } from '../components/page';
import { StatusBadge } from '../components/status-badge';
import { WorkflowBar } from '../components/workflow';
import { useConfirmDelete } from '../components/confirm';
import { useI18n } from '../i18n';
import { ExportFields, ExportForm, exportBody, FinishedStockRow } from './Exports';
import { toLocalInput } from './Imports';
import { dateOnly } from './Production';

interface Line {
  id: string;
  lineNumber: number;
  importLoadId: string | null;
  importCode: string;
  thicknessIn: number;
  widthIn: number;
  lengthFt: number;
  pieces: number;
  cft: number;
  availablePieces: number;
}
interface ExportDetail {
  id: string;
  code: string;
  exportDate: string;
  lorryNumber: string;
  woodType: string;
  driverName: string | null;
  driverMobile: string | null;
  lorryOwnerName: string | null;
  lorryOwnerMobile: string | null;
  startAt: string | null;
  endAt: string | null;
  importLoadId: string | null;
  importCode: string | null;
  notes: string | null;
  totalPieces: number;
  totalCft: number;
  status: string;
  rejectionReason: string | null;
  createdByName: string;
  editable: boolean;
  canSubmit: boolean;
  canReview: boolean;
  lines: Line[];
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
const positionKey = (l: { importLoadId: string | null; thicknessIn: number; widthIn: number; lengthFt: number }) =>
  `${l.importLoadId}|${l.thicknessIn}|${l.widthIn}|${l.lengthFt}`;

export function ExportDetailPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const { can } = useAuth();
  const { data: exp, loading, error, reload } = useLoad(() => api<ExportDetail>(`/exports/${id}`), [id]);
  const stock = useLoad(() => api<{ finished: FinishedStockRow[] }>('/stock'), []);
  const refresh = () => {
    reload();
    stock.reload();
  };

  return (
    <Page>
      <PageHeader
        title={exp?.code ?? t('exportDetails')}
        back={{ to: '/exports', label: t('exports') }}
        badge={exp && <StatusBadge status={exp.status} />}
        subtitle={
          exp && (
            <>
              {t('lorry')} {exp.lorryNumber} · {exp.woodType} · {dateOnly(exp.exportDate)}
            </>
          )
        }
      />

      <LoadState loading={loading && !exp} error={error} onRetry={reload} />

      {exp && (
        <>
          {!exp.editable && exp.status !== 'SUBMITTED' && <Notice>{t('lockedRecord')}</Notice>}
          {exp.rejectionReason && <Notice tone="error">{exp.rejectionReason}</Notice>}

          <FigureStrip
            className="lg:grid-cols-2"
            items={[
              { label: t('totalPieces'), value: exp.totalPieces },
              { label: t('totalCft'), value: `${num3(exp.totalCft)} CFT` },
            ]}
          />

          <WorkflowBar
            base={`/exports/${exp.id}`}
            status={exp.status}
            canSubmit={exp.canSubmit}
            canReview={exp.canReview}
            submitBlocked={exp.lines.length === 0 ? t('needLinesToSubmit') : null}
            confirmApprove={t('confirmApproveExport', { code: exp.code, pieces: exp.totalPieces, cft: num3(exp.totalCft) })}
            approvedNote={exp.editable ? t('approvedExportNote') : undefined}
            onDone={refresh}
          />

          <DetailsSection exp={exp} finished={stock.data?.finished ?? []} onSaved={refresh} />
          {can(Permission.FINANCE_VIEW) && <SaleSection exp={exp} canPickClient={can(Permission.CLIENTS_MANAGE)} />}
          <LinesSection exp={exp} finished={stock.data?.finished ?? []} onChanged={refresh} />
        </>
      )}
    </Page>
  );
}

function DetailsSection({ exp, finished, onSaved }: { exp: ExportDetail; finished: FinishedStockRow[]; onSaved: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState<ExportForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const startEdit = () =>
    setForm({
      exportDate: exp.exportDate,
      lorryNumber: exp.lorryNumber,
      woodType: exp.woodType,
      importLoadId: exp.importLoadId ?? '',
      driverName: exp.driverName ?? '',
      driverMobile: exp.driverMobile ?? '',
      lorryOwnerName: exp.lorryOwnerName ?? '',
      lorryOwnerMobile: exp.lorryOwnerMobile ?? '',
      startAt: toLocalInput(exp.startAt),
      endAt: toLocalInput(exp.endAt),
      notes: exp.notes ?? '',
    });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/exports/${exp.id}`, { method: 'PATCH', body: exportBody(form) });
      setForm(null);
      onSaved();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const facts: [string, string | null][] = [
    [t('driverName'), exp.driverName],
    [t('driverMobile'), exp.driverMobile],
    [t('lorryOwnerName'), exp.lorryOwnerName],
    [t('lorryOwnerMobile'), exp.lorryOwnerMobile],
    [t('startTime'), exp.startAt ? dateTime(exp.startAt) : null],
    [t('endTime'), exp.endAt ? dateTime(exp.endAt) : null],
    [t('defaultLoad'), exp.importCode],
    [t('createdBy'), exp.createdByName],
    [t('notes'), exp.notes],
  ];

  return (
    <Section
      title={t('exportDetails')}
      tools={
        exp.editable &&
        !form && (
          <Button variant="outline" size="sm" onClick={startEdit}>
            <PencilIcon /> {t('edit')}
          </Button>
        )
      }
    >
      {form ? (
        <FormCard onSubmit={submit}>
          <ExportFields form={form} onChange={setForm} finished={finished} />
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
        <Card className="py-5">
          <CardContent className="px-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-4">
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

// ───────── measurement lines ─────────

type LineForm = { importLoadId: string; thickness: string; width: string; length: string; pieces: string };

function LinesSection({ exp, finished, onChanged }: { exp: ExportDetail; finished: FinishedStockRow[]; onChanged: () => void }) {
  const { t } = useI18n();
  const confirmDelete = useConfirmDelete();
  const blank = (): LineForm => ({ importLoadId: exp.importLoadId ?? '', thickness: '', width: '', length: '', pieces: '' });
  const [entry, setEntry] = useState<LineForm>(blank);
  const [editing, setEditing] = useState<{ id: string; pieces: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const piecesRef = useRef<HTMLInputElement>(null);
  // after picking from stock, focus goes to pieces (not back to the select trigger)
  const focusPieces = useRef(false);

  // a newly chosen default load becomes the default for the next line
  useEffect(() => setEntry((e) => (e.importLoadId ? e : { ...e, importLoadId: exp.importLoadId ?? '' })), [exp.importLoadId]);

  const sameWood = finished.filter((f) => f.woodType === exp.woodType);
  const loads = new Map<string, string>();
  sameWood.forEach((f) => loads.set(f.importLoadId, f.importCode));
  const chosenKey = `${entry.importLoadId}|${entry.thickness}|${entry.width}|${entry.length}`;
  const stockKey = (f: FinishedStockRow) => `${f.importLoadId}|${f.thicknessIn}|${f.widthIn}|${f.lengthFt}`;
  const picked = sameWood.find((f) => stockKey(f) === chosenKey);

  const tIn = positive(entry.thickness);
  const wIn = positive(entry.width);
  const lFt = positive(entry.length);
  const pcs = wholePositive(entry.pieces);
  const liveCft = tIn != null && wIn != null && lFt != null && pcs != null ? exportPieceCft(tIn, wIn, lFt, pcs) : null;
  const set = (k: keyof LineForm) => (e: { target: { value: string } }) => setEntry({ ...entry, [k]: e.target.value });

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
    if (liveCft == null) return;
    act(async () => {
      await api(`/exports/${exp.id}/measurements`, {
        method: 'POST',
        body: JSON.stringify({ importLoadId: entry.importLoadId || undefined, thicknessIn: tIn, widthIn: wIn, lengthFt: lFt, pieces: pcs }),
      });
      setEntry({ ...entry, pieces: '' }); // same size again is common; just clear the count
      piecesRef.current?.focus();
    });
  }

  function saveEdit(e: FormEvent, line: Line) {
    e.preventDefault();
    const p = editing && wholePositive(editing.pieces);
    if (!p) return;
    act(async () => {
      await api(`/exports/${exp.id}/measurements/${line.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ importLoadId: line.importLoadId ?? undefined, thicknessIn: line.thicknessIn, widthIn: line.widthIn, lengthFt: line.lengthFt, pieces: p }),
      });
      setEditing(null);
    });
  }

  const remove = (l: Line) => {
    confirmDelete().then((ok) => {
      if (ok) act(() => api(`/exports/${exp.id}/measurements/${l.id}`, { method: 'DELETE' }));
    });
  };

  // Before approval, warn when the lines ask for more of a size than the load holds.
  const wanted = new Map<string, number>();
  exp.lines.forEach((l) => wanted.set(positionKey(l), (wanted.get(positionKey(l)) ?? 0) + l.pieces));
  const short = (l: Line) => exp.status !== 'APPROVED' && (wanted.get(positionKey(l)) ?? 0) > l.availablePieces;

  const lines = useClientPaging(exp.lines);
  return (
    <Section title={t('exportMeasurement')}>
      {exp.editable && (
        <EntryRow
          onSubmit={add}
          result={liveCft != null ? num3(liveCft) : '0.000'}
          resultLabel="CFT"
          submitLabel={t('addLine')}
          submitDisabled={busy || liveCft == null || !entry.importLoadId}
        >
          <div className="col-span-2 grid gap-3 sm:basis-full sm:grid-cols-[2fr_1fr]">
            <Field id="line-stock" label={t('fromStock')}>
              <Select
                value={picked ? chosenKey : ALL}
                onValueChange={(v) => {
                  const f = sameWood.find((x) => stockKey(x) === v);
                  if (f) setEntry({ ...entry, importLoadId: f.importLoadId, thickness: String(f.thicknessIn), width: String(f.widthIn), length: String(f.lengthFt) });
                  focusPieces.current = true;
                }}
              >
                <SelectTrigger id="line-stock" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  onCloseAutoFocus={(e) => {
                    if (!focusPieces.current) return;
                    focusPieces.current = false;
                    e.preventDefault();
                    piecesRef.current?.focus();
                  }}
                >
                  <SelectItem value={ALL}>{sameWood.length ? t('pickStock') : t('noFinishedOfWood', { wood: exp.woodType })}</SelectItem>
                  {sameWood.map((f) => (
                    <SelectItem key={stockKey(f)} value={stockKey(f)}>
                      {f.importCode} · {sizeLabel(f.thicknessIn, f.widthIn, f.lengthFt)} · {t('piecesCount', { n: f.pieces })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="line-load" label={`${t('importId')} *`}>
              <Select value={entry.importLoadId} onValueChange={(v) => setEntry({ ...entry, importLoadId: v })} required>
                <SelectTrigger id="line-load" className="w-full">
                  <SelectValue placeholder={t('pickLoad')} />
                </SelectTrigger>
                <SelectContent>
                  {[...loads].map(([id, code]) => (
                    <SelectItem key={id} value={id}>
                      {code}
                    </SelectItem>
                  ))}
                  {entry.importLoadId && !loads.has(entry.importLoadId) && <SelectItem value={entry.importLoadId}>{exp.importCode ?? '…'}</SelectItem>}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <EntryField label={t('thickness')} value={entry.thickness} onChange={set('thickness')} min={0.01} max={999} step="0.01" inputMode="decimal" required />
          <EntryField label={t('width')} value={entry.width} onChange={set('width')} min={0.01} max={999} step="0.01" inputMode="decimal" required />
          <EntryField label={t('lengthFt')} value={entry.length} onChange={set('length')} min={0.01} max={999} step="0.01" inputMode="decimal" required />
          <EntryField
            label={
              <>
                {t('pieces')}
                {picked && <span className="text-muted-foreground/80"> / {picked.pieces}</span>}
              </>
            }
            inputRef={piecesRef}
            value={entry.pieces}
            onChange={set('pieces')}
            min={1}
            max={picked?.pieces}
            step="1"
            inputMode="numeric"
            required
          />
        </EntryRow>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      <TableCard compactEmpty empty={exp.lines.length === 0} emptyText={t('noLines')} pager={lines.pager}>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12 pl-4">{t('lineNo')}</TableHead>
              <TableHead>{t('size')}</TableHead>
              <TableHead className={numCell}>{t('pieces')}</TableHead>
              <TableHead className={cn(numCell, !exp.editable && 'pr-4')}>CFT</TableHead>
              {exp.editable && <TableHead className="pr-4" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.rows.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="pl-4 text-muted-foreground">{l.lineNumber}</TableCell>
                <TableCell className="whitespace-normal">
                  <div className="font-medium whitespace-nowrap">{sizeLabel(l.thicknessIn, l.widthIn, l.lengthFt)}</div>
                  <div className="text-xs text-muted-foreground">{l.importCode}</div>
                  {short(l) && (
                    <div className="text-xs text-destructive">
                      {t('moreThanStock')}: {l.availablePieces}
                    </div>
                  )}
                </TableCell>
                <TableCell className={numCell}>
                  {editing?.id === l.id ? (
                    <form id={`edit-${l.id}`} onSubmit={(e) => saveEdit(e, l)} className="flex justify-end">
                      <Input
                        className="h-8 w-20 text-right"
                        type="number"
                        aria-label={t('pieces')}
                        value={editing.pieces}
                        onChange={(e) => setEditing({ ...editing, pieces: e.target.value })}
                        min={1}
                        step="1"
                        required
                        autoFocus
                      />
                    </form>
                  ) : (
                    l.pieces
                  )}
                </TableCell>
                <TableCell className={cn(numCell, !exp.editable && 'pr-4')}>{num3(l.cft)}</TableCell>
                {exp.editable && (
                  <TableCell className="pr-4 text-right">
                    <div className="flex justify-end gap-1">
                      {editing?.id === l.id ? (
                        <>
                          <Button type="submit" form={`edit-${l.id}`} size="sm" disabled={busy} aria-label={t('save')}>
                            <CheckIcon />
                            <span className="max-md:sr-only">{t('save')}</span>
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)} aria-label={t('cancel')}>
                            <XIcon />
                            <span className="max-md:sr-only">{t('cancel')}</span>
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button type="button" variant="outline" size="sm" aria-label={t('edit')} onClick={() => setEditing({ id: l.id, pieces: String(l.pieces) })}>
                            <PencilIcon />
                            <span className="max-md:sr-only">{t('edit')}</span>
                          </Button>
                          <Button type="button" variant="ghost" size="sm" aria-label={t('delete')} onClick={() => remove(l)}>
                            <Trash2Icon />
                            <span className="max-md:sr-only">{t('delete')}</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2} className="pl-4">
                {t('total')}
              </TableCell>
              <TableCell className={numCell}>{exp.totalPieces}</TableCell>
              <TableCell className={cn(numCell, !exp.editable && 'pr-4')}>{num3(exp.totalCft)}</TableCell>
              {exp.editable && <TableCell className="pr-4" />}
            </TableRow>
          </TableFooter>
        </Table>
      </TableCard>
    </Section>
  );
}

// ───────── sale details (owner only) ─────────

interface Financials {
  clientId: string | null;
  sellingRatePerCft: number | null;
  saleAmount: number | null;
  amountReceived: number;
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
  notes: string | null;
}

const str = (n: number | null) => (n == null ? '' : String(n));
const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

const PAY_BADGE = {
  UNPAID: { key: 'unpaid', className: 'bg-muted text-muted-foreground' },
  PARTIAL: { key: 'partial', className: 'bg-warning-soft text-warning' },
  PAID: { key: 'paid', className: 'bg-success-soft text-success' },
} as const;

function SaleSection({ exp, canPickClient }: { exp: ExportDetail; canPickClient: boolean }) {
  const { t } = useI18n();
  const { data, loading, error, reload } = useLoad(() => api<Financials>(`/exports/${exp.id}/financials`), [exp.id]);
  const clients = useLoad(() => (canPickClient ? api<{ id: string; name: string }[]>('/clients') : Promise.resolve([])), [canPickClient]);
  const [form, setForm] = useState<Record<'clientId' | 'rate' | 'amount' | 'received' | 'notes', string> | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (data)
      setForm({
        clientId: data.clientId ?? '',
        rate: str(data.sellingRatePerCft),
        amount: str(data.saleAmount),
        received: data.amountReceived ? String(data.amountReceived) : '',
        notes: data.notes ?? '',
      });
  }, [data]);

  const set = (k: keyof NonNullable<typeof form>) => (e: { target: { value: string } }) => setForm((f) => (f ? { ...f, [k]: e.target.value } : f));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setMessage(null);
    try {
      await api(`/exports/${exp.id}/financials`, {
        method: 'PUT',
        body: JSON.stringify({
          clientId: form.clientId || null,
          sellingRatePerCft: numOrNull(form.rate),
          saleAmount: numOrNull(form.amount),
          amountReceived: numOrNull(form.received),
          notes: form.notes,
        }),
      });
      setMessage({ kind: 'ok', text: t('saved') });
      reload();
    } catch (err) {
      setMessage({ kind: 'error', text: errorText(err) });
    }
  }

  const rate = form ? positive(form.rate) : null;
  const fillAmount = () => rate != null && setForm((f) => (f ? { ...f, amount: (rate * exp.totalCft).toFixed(2) } : f));
  const balance = data?.saleAmount != null ? data.saleAmount - data.amountReceived : null;
  const pay = PAY_BADGE[data?.paymentStatus ?? 'UNPAID'];

  return (
    <Section
      title={
        <>
          {t('saleDetails')} <OwnerOnly />
        </>
      }
    >
      <LoadState loading={loading && !data} error={error} onRetry={reload} />
      {form && (
        <FormCard onSubmit={submit}>
          <FormGrid>
            <Field id="sale-client" label={t('client')}>
              <Select value={form.clientId || ALL} onValueChange={(v) => setForm((f) => (f ? { ...f, clientId: v === ALL ? '' : v } : f))}>
                <SelectTrigger id="sale-client" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t('notSet')}</SelectItem>
                  {clients.data?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="sale-rate" label={t('sellingRate')}>
              <Input id="sale-rate" type="number" value={form.rate} onChange={set('rate')} min={0} step="0.01" inputMode="decimal" />
            </Field>
            <Field id="sale-amount" label={t('saleAmount')}>
              <Input id="sale-amount" type="number" value={form.amount} onChange={set('amount')} min={0} step="0.01" inputMode="decimal" />
              <Button type="button" variant="link" size="sm" className="h-auto justify-start p-0" disabled={rate == null} onClick={fillAmount}>
                {t('rateTimesCft')}
                {rate != null && ` = ${money(rate * exp.totalCft)}`}
              </Button>
            </Field>
            <Field id="sale-received" label={t('amountReceived')}>
              <Input id="sale-received" type="number" value={form.received} onChange={set('received')} min={0} step="0.01" inputMode="decimal" />
            </Field>
            <Field id="sale-notes" label={t('notes')} className="sm:col-span-full">
              <Input id="sale-notes" value={form.notes} onChange={set('notes')} maxLength={1000} />
            </Field>
          </FormGrid>
          {message && <Notice tone={message.kind}>{message.text}</Notice>}
          <FormActions
            summary={
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {t('paymentStatus')}:
                <Badge variant="secondary" className={cn('rounded-full border-transparent font-semibold', pay.className)}>
                  {t(pay.key)}
                </Badge>
                {balance != null && (
                  <span>
                    · {t('balance')}: <strong className="text-foreground tabular-nums">{money(balance)}</strong>
                  </span>
                )}
              </span>
            }
          >
            <Button type="submit">{t('save')}</Button>
          </FormActions>
        </FormCard>
      )}
    </Section>
  );
}

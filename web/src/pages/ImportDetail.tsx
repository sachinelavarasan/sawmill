import { formatDuration, importLogCft, Permission, totalCft } from '@timbertrail/shared';
import { ArrowLeftIcon, CheckCircle2Icon, CheckIcon, ClockIcon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { api } from '../api';
import { useAuth } from '../auth';
import { dateTime, money, num3, useLoad } from '../components/common';
import { useConfirmDelete } from '../components/confirm';
import { useEditGuard } from '../components/leave-guard';
import { Field, FigureStrip, FormActions, FormCard, FormGrid, LoadState, MoreDetails, Notice, numCell, OwnerOnly, Page, PageHeader, Section, TableCard, useClientPaging, wide } from '../components/page';
import { StatusBadge } from '../components/status-badge';
import { PartyPicker, type PartyOption } from '../components/party-picker';
import { PaymentsPanel } from '../components/payments';
import { WorkflowBar } from '../components/workflow';
import { useToast } from '../components/toast';
import { type TKey, useI18n } from '../i18n';
import { fromLocalInput, ImportFields, ImportForm, importFormBody, ImportSummary, sawingLink, toLocalInput } from './Imports';
import { asEvent, DateTimePicker } from '../components/date-picker';
import { CalcModeSwitch, CalcPad, useCalcMode } from '../components/calc-pad';

export interface Unloading {
  id: string;
  vehicleNumber: string;
  driverName: string | null;
  startAt: string;
  endAt: string | null;
  durationMinutes: number | null;
  ratePerHour: number | null;
  totalCharges: number | null;
}
export interface Log {
  id: string;
  logNumber: number;
  girthIn: number;
  lengthFt: number;
  cft: number;
}
export interface ImportDetail extends ImportSummary {
  woodCategory: string | null;
  driverName: string | null;
  driverMobile: string | null;
  lorryOwnerName: string | null;
  lorryOwnerMobile: string | null;
  originLocation: string | null;
  notes: string | null;
  editable: boolean;
  canSubmit: boolean;
  canReview: boolean;
  defaultUnloadingRate: number | null;
  unloadings: Unloading[];
  logs: Log[];
}

/** A positive number typed by the user, or null while the field is empty / invalid. */
const positive = (v: string) => {
  const n = Number(v);
  return v.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null;
};
const errorText = (e: unknown) => (e as Error).message;
/**
 * What is wrong with a typed girth / length, in words — the same limits the inputs and the
 * server enforce (greater than 0, at most 999, at most 2 decimals). Null while empty or fine.
 */
const measureProblem = (v: string): TKey | null => {
  const s = v.trim();
  if (s === '') return null;
  if (positive(s) == null) return 'errPositive';
  if (Number(s) > 999) return 'errMax999';
  if (!/^\d*(\.\d{0,2})?$/.test(s)) return 'errTwoDecimals';
  return null;
};

export function ImportDetailPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const { can, simple } = useAuth();
  const { hash } = useLocation();
  // loaded in for a sawing: the way back, with this load chosen as its raw wood
  const [params] = useSearchParams();
  const sawing = sawingLink(params);
  const backToSawing = sawing && (() => {
    const [path, query = ''] = sawing.split('?');
    const q = new URLSearchParams(query);
    q.set('load', id ?? '');
    return `${path}?${q}`;
  })();
  const { data: load, loading, error, reload } = useLoad(() => api<ImportDetail>(`/imports/${id}`), [id]);

  // Arriving from the Measurement list: jump straight to log entry.
  const loaded = !!load;
  useEffect(() => {
    if (loaded && hash === '#logs') document.getElementById('logs')?.scrollIntoView();
  }, [loaded, hash]);

  const unloadingTotal = load?.unloadings.reduce((sum, u) => sum + (u.totalCharges ?? 0), 0) ?? 0;

  // send for approval / approve: above the record normally, after the measuring in the simple view
  const workflow = load && (
    <WorkflowBar
      base={`/imports/${load.id}`}
      status={load.status}
      canSubmit={load.canSubmit}
      canReview={load.canReview}
      submitBlocked={load.totalLogs === 0 ? t('needLogsToSubmit') : null}
      confirmApprove={t('confirmApprove', { code: load.code, cft: num3(load.totalCft) })}
      approvedNote={load.editable ? t('approvedStockNote') : undefined}
      onDone={reload}
    />
  );

  return (
    <Page>
      <PageHeader
        title={load?.code ?? t('importDetails')}
        back={
          // opened from Measure Logs: back goes there, not to Load In
          params.get('from') === 'measure'
            ? { to: '/measurement', label: t(simple ? 'simpleMeasure' : 'measurement') }
            : { to: '/imports', label: t(simple ? 'simpleLoadIn' : 'imports') }
        }
        badge={load && <StatusBadge status={load.status} />}
        subtitle={
          load && (
            <>
              {t('lorry')} {load.lorryNumber} · {load.woodType} · {dateTime(load.arrivalAt)}
            </>
          )
        }
      />

      <LoadState shape="detail" loading={loading && !load} error={error} onRetry={reload} />

      {load && (
        <>
          {backToSawing && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-primary-soft px-5 py-3">
              <span className="text-sm font-medium">{t('loadInForSawing')}</span>
              <Button asChild size="lg" className="h-12">
                <Link to={backToSawing}>
                  <ArrowLeftIcon /> {t('backToSawing')}
                </Link>
              </Button>
            </div>
          )}
          {!load.editable && load.status !== 'SUBMITTED' && <Notice>{t('lockedRecord')}</Notice>}
          {load.rejectionReason && <Notice tone="error">{load.rejectionReason}</Notice>}

          {/* the simple view leaves the figures to the measuring panel, which shows them large */}
          {!simple && (
            <FigureStrip
              className="grid-cols-1 sm:grid-cols-3 lg:grid-cols-3"
              items={[
                { label: t('logsMeasured'), value: load.totalLogs },
                { label: t('totalCft'), value: `${num3(load.totalCft)} CFT` },
                { label: t('totalUnloadingCharges'), value: money(unloadingTotal) },
              ]}
            />
          )}

          {!simple && workflow}

          {simple ? (
            // the simple view: measure, then send it (or approve it), then the money; everything else folded away
            <>
              <LogsSection load={load} onChanged={reload} />
              {workflow}
              {can(Permission.FINANCE_VIEW) && <PurchaseSection load={load} canPickSupplier={can(Permission.SUPPLIERS_MANAGE)} />}
              <MoreDetails>
                <DetailsSection load={load} onSaved={reload} />
                <UnloadingSection load={load} onChanged={reload} />
              </MoreDetails>
            </>
          ) : (
            <>
              <DetailsSection load={load} onSaved={reload} />
              <UnloadingSection load={load} onChanged={reload} />
              {can(Permission.FINANCE_VIEW) && <PurchaseSection load={load} canPickSupplier={can(Permission.SUPPLIERS_MANAGE)} />}
              <LogsSection load={load} onChanged={reload} />
            </>
          )}
        </>
      )}
    </Page>
  );
}

// ───────── details ─────────

function DetailsSection({ load, onSaved }: { load: ImportDetail; onSaved: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState<ImportForm | null>(null);
  // ask before leaving with unsaved edits
  useEditGuard(form);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const startEdit = () =>
    setForm({
      arrivalAt: toLocalInput(load.arrivalAt),
      lorryNumber: load.lorryNumber,
      woodType: load.woodType,
      woodCategory: load.woodCategory ?? '',
      driverName: load.driverName ?? '',
      driverMobile: load.driverMobile ?? '',
      lorryOwnerName: load.lorryOwnerName ?? '',
      lorryOwnerMobile: load.lorryOwnerMobile ?? '',
      originLocation: load.originLocation ?? '',
      notes: load.notes ?? '',
    });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/imports/${load.id}`, { method: 'PATCH', body: importFormBody(form) });
      setForm(null);
      toast(t('saved'), 'ok');
      onSaved();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const groups: { title: string; facts: [string, string | null][] }[] = [
    {
      title: t('lorryAndDriver'),
      facts: [
        [t('lorryNumber'), load.lorryNumber],
        [t('driverName'), load.driverName],
        [t('driverMobile'), load.driverMobile],
        [t('lorryOwnerName'), load.lorryOwnerName],
        [t('lorryOwnerMobile'), load.lorryOwnerMobile],
      ],
    },
    {
      title: t('secImportInfo'),
      facts: [
        [t('woodType'), load.woodType],
        [t('woodCategory'), load.woodCategory],
        [t('originLocation'), load.originLocation],
        [t('createdBy'), load.createdByName],
        [t('notes'), load.notes],
      ],
    },
  ];

  return (
    <Section
      title={t('importDetails')}
      tools={
        load.editable &&
        !form && (
          <Button variant="outline" size="sm" onClick={startEdit}>
            <PencilIcon /> {t('edit')}
          </Button>
        )
      }
    >
      {form ? (
        <FormCard onSubmit={submit} className="[&_form]:gap-6">
          <ImportFields form={form} onChange={setForm} />
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
        <Card className="gap-0 py-0 lg:flex-row">
          {groups.map((g) => (
            <section key={g.title} className="min-w-0 flex-1 px-5 py-6 not-first:border-t sm:px-6 lg:not-first:border-t-0 lg:not-first:border-l">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{g.title}</h3>
              <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-3">
                {g.facts.map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-1 font-medium break-words">{value || '—'}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </Card>
      )}
    </Section>
  );
}

// ───────── unloading ─────────

function UnloadingSection({ load, onChanged }: { load: ImportDetail; onChanged: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const confirmDelete = useConfirmDelete();
  const blank = () => ({
    vehicleNumber: '',
    driverName: '',
    startAt: toLocalInput(new Date()),
    endAt: '',
    ratePerHour: load.defaultUnloadingRate != null ? String(load.defaultUnloadingRate) : '',
  });
  const [form, setForm] = useState<ReturnType<typeof blank> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof ReturnType<typeof blank>) => (e: { target: { value: string } }) =>
    setForm((f) => (f ? { ...f, [k]: e.target.value } : f));

  const [busy, setBusy] = useState(false);
  /** set at once (state updates later): a second tap or Enter while saving is ignored, not sent again */
  const inFlight = useRef(false);
  async function run(action: () => Promise<unknown>, ok?: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
      if (ok) toast(ok, 'ok'); // every change says it happened
      onChanged();
    } catch (err) {
      setError(errorText(err));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form || inFlight.current) return;
    run(async () => {
      await api(`/imports/${load.id}/unloading`, {
        method: 'POST',
        body: JSON.stringify({
          vehicleNumber: form.vehicleNumber,
          driverName: form.driverName,
          startAt: fromLocalInput(form.startAt),
          endAt: fromLocalInput(form.endAt),
          ratePerHour: form.ratePerHour === '' ? undefined : Number(form.ratePerHour),
        }),
      });
      setForm(null);
    }, t('unloadingAddedToast'));
  }

  const endNow = (u: Unloading) =>
    run(() => api(`/imports/${load.id}/unloading/${u.id}`, { method: 'PATCH', body: JSON.stringify({ endAt: new Date().toISOString() }) }), t('unloadingEndedToast'));
  const remove = (u: Unloading) => {
    confirmDelete().then((ok) => {
      if (ok) run(() => api(`/imports/${load.id}/unloading/${u.id}`, { method: 'DELETE' }), t('unloadingDeletedToast'));
    });
  };

  const unloadings = useClientPaging(load.unloadings, 10);

  return (
    <Section
      title={t('unloading')}
      tools={
        load.editable &&
        !form && (
          <Button variant="outline" size="sm" onClick={() => setForm(blank())}>
            <PlusIcon /> {t('addUnloading')}
          </Button>
        )
      }
    >
      {error && <Notice tone="error">{error}</Notice>}
      {form && (
        <FormCard onSubmit={submit}>
          <FormGrid>
            <Field id="unl-vehicle" label={`${t('vehicleNumber')} *`}>
              <Input id="unl-vehicle" value={form.vehicleNumber} onChange={set('vehicleNumber')} required minLength={2} maxLength={20} autoFocus />
            </Field>
            <Field id="unl-driver" label={t('driverName')}>
              <Input id="unl-driver" value={form.driverName} onChange={set('driverName')} maxLength={100} />
            </Field>
            <Field id="unl-start" label={t('startTime')}>
              <DateTimePicker id="unl-start" value={form.startAt} onChange={asEvent(set('startAt'))} required />
            </Field>
            <Field id="unl-end" label={t('endTime')}>
              <DateTimePicker id="unl-end" value={form.endAt} onChange={asEvent(set('endAt'))} min={form.startAt} />
            </Field>
            <Field id="unl-rate" label={t('ratePerHour')} hint={t('calcFromRate')}>
              <Input id="unl-rate" type="number" value={form.ratePerHour} onChange={set('ratePerHour')} min={0} step="0.01" inputMode="decimal" />
            </Field>
          </FormGrid>
          <FormActions>
            <Button type="button" variant="ghost" onClick={() => setForm(null)} disabled={busy}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={busy}>
              {t('save')}
            </Button>
          </FormActions>
        </FormCard>
      )}
      <TableCard compactEmpty empty={load.unloadings.length === 0} emptyText={t('noUnloading')} pager={unloadings.pager}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">{t('vehicleNumber')}</TableHead>
              <TableHead className={wide}>{t('startTime')}</TableHead>
              <TableHead className={wide}>{t('endTime')}</TableHead>
              <TableHead className={numCell}>{t('duration')}</TableHead>
              <TableHead className={cn(numCell, wide)}>{t('ratePerHour')}</TableHead>
              <TableHead className={numCell}>{t('totalCharges')}</TableHead>
              <TableHead className="pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {unloadings.rows.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="pl-4 font-medium">
                  {u.vehicleNumber}
                  {u.driverName && <div className="text-xs font-normal text-muted-foreground">{u.driverName}</div>}
                  <div className="text-xs font-normal text-muted-foreground md:hidden">{dateTime(u.startAt)}</div>
                </TableCell>
                <TableCell className={cn(wide, 'text-muted-foreground')}>{dateTime(u.startAt)}</TableCell>
                <TableCell className={cn(wide, 'text-muted-foreground')}>{u.endAt ? dateTime(u.endAt) : '—'}</TableCell>
                <TableCell className={numCell}>
                  {u.durationMinutes != null ? (
                    formatDuration(u.durationMinutes)
                  ) : (
                    <Badge variant="secondary" className="rounded-full border-transparent bg-warning-soft font-semibold text-warning">
                      {t('inProgress')}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className={cn(numCell, wide)}>{u.ratePerHour != null ? money(u.ratePerHour) : '—'}</TableCell>
                <TableCell className={cn(numCell, 'font-semibold')}>{u.totalCharges != null ? money(u.totalCharges) : '—'}</TableCell>
                <TableCell className="pr-4 text-right">
                  {load.editable && (
                    <div className="flex justify-end gap-1">
                      {!u.endAt && (
                        <Button variant="outline" size="sm" className="max-lg:size-9 max-lg:px-0" onClick={() => endNow(u)} disabled={busy} aria-label={t('endNow')} title={t('endNow')}>
                          <ClockIcon />
                          <span className="max-lg:sr-only">{t('endNow')}</span>
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="max-lg:size-9 max-lg:px-0" aria-label={t('delete')} title={t('delete')} onClick={() => remove(u)} disabled={busy}>
                        <Trash2Icon />
                        <span className="max-lg:sr-only">{t('delete')}</span>
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>
    </Section>
  );
}

// ───────── purchase details (owner only) ─────────

interface Financials {
  supplierId: string | null;
  purchaseRatePerCft: number | null;
  purchaseAmount: number | null;
  transportCharges: number | null;
  amountPaid: number;
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
  notes: string | null;
}
type PurchaseForm = Record<'supplierId' | 'rate' | 'amount' | 'transport' | 'notes', string>;

const str = (n: number | null) => (n == null ? '' : String(n));
const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));
const purchaseForm = (d: Financials): PurchaseForm => ({
  supplierId: d.supplierId ?? '',
  rate: str(d.purchaseRatePerCft),
  amount: str(d.purchaseAmount),
  transport: str(d.transportCharges),
  notes: d.notes ?? '',
});

function PurchaseSection({ load, canPickSupplier }: { load: ImportDetail; canPickSupplier: boolean }) {
  const { t } = useI18n();
  const { data, loading, error, reload } = useLoad(() => api<Financials>(`/imports/${load.id}/financials`), [load.id]);
  const suppliers = useLoad(() => (canPickSupplier ? api<PartyOption[]>('/suppliers') : Promise.resolve([])), [canPickSupplier]);
  const [form, setForm] = useState<PurchaseForm | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const toast = useToast();
  /** bumped after saving, so the payments panel re-reads the bill amount */
  const [paymentsKey, setPaymentsKey] = useState(0);

  // Filled once from what is saved; later reloads (after a payment) refresh the figures, not the half-typed form.
  useEffect(() => {
    if (data) setForm((f) => f ?? purchaseForm(data));
  }, [data]);

  const set = (k: keyof NonNullable<typeof form>) => (e: { target: { value: string } }) =>
    setForm((f) => (f ? { ...f, [k]: e.target.value } : f));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setMessage(null);
    try {
      const saved = await api<Financials>(`/imports/${load.id}/financials`, {
        method: 'PUT',
        body: JSON.stringify({
          supplierId: form.supplierId || null,
          purchaseRatePerCft: numOrNull(form.rate),
          purchaseAmount: numOrNull(form.amount),
          transportCharges: numOrNull(form.transport),
          notes: form.notes,
        }),
      });
      setForm(purchaseForm(saved));
      setPaymentsKey((k) => k + 1);
      setMessage(null);
      toast(t('saved'));
      reload();
    } catch (err) {
      setMessage({ kind: 'error', text: errorText(err) });
    }
  }

  const rate = form ? positive(form.rate) : null;
  const fillAmount = () => rate != null && setForm((f) => (f ? { ...f, amount: (rate * load.totalCft).toFixed(2) } : f));

  return (
    <Section
      title={
        <>
          {t('purchaseDetails')} <OwnerOnly />
        </>
      }
    >
      <LoadState shape="form" loading={loading && !data} error={error} onRetry={reload} />
      {form && (
        <FormCard onSubmit={submit}>
          <FormGrid>
            <Field label={t('supplier')}>
              <PartyPicker
                path="/suppliers"
                items={suppliers.data}
                value={form.supplierId}
                onChange={(supplierId) => setForm((f) => (f ? { ...f, supplierId } : f))}
                onCreated={suppliers.reload}
                noneLabel={t('noSupplier')}
              />
            </Field>
            <Field id="pur-rate" label={t('purchaseRate')}>
              <Input id="pur-rate" type="number" value={form.rate} onChange={set('rate')} min={0} step="0.01" inputMode="decimal" />
            </Field>
            <Field
              id="pur-amount"
              label={t('purchaseAmount')}
              hint={
                <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" disabled={rate == null} onClick={fillAmount}>
                  {t('rateTimesCft')}
                  {rate != null && ` = ${money(rate * load.totalCft)}`}
                </Button>
              }
            >
              <Input id="pur-amount" type="number" value={form.amount} onChange={set('amount')} min={0} step="0.01" inputMode="decimal" />
            </Field>
            <Field id="pur-transport" label={t('transportCharges')}>
              <Input id="pur-transport" type="number" value={form.transport} onChange={set('transport')} min={0} step="0.01" inputMode="decimal" />
            </Field>
            <Field id="pur-notes" label={t('notes')}>
              <Input id="pur-notes" value={form.notes} onChange={set('notes')} maxLength={1000} />
            </Field>
          </FormGrid>
          {message && <Notice tone={message.kind}>{message.text}</Notice>}
          {/* what has been paid, and what is left, is worked out from the payments below */}
          <FormActions>
            <Button type="submit">{t('save')}</Button>
          </FormActions>
        </FormCard>
      )}
      {data && <PaymentsPanel key={paymentsKey} kind="imports" loadId={load.id} onChanged={reload} />}
    </Section>
  );
}

// ───────── log measurement ─────────

function LogsSection({ load, onChanged }: { load: ImportDetail; onChanged: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const confirmDelete = useConfirmDelete();
  const [girth, setGirth] = useState('');
  const [length, setLength] = useState('');
  const [editing, setEditing] = useState<{ id: string; girth: string; length: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** the first box (length): the cursor goes back here for the next log */
  const firstRef = useRef<HTMLInputElement>(null);

  const g = positive(girth);
  const l = positive(length);
  const girthProblem = measureProblem(girth);
  const lengthProblem = measureProblem(length);
  const liveCft = g != null && l != null ? importLogCft(g, l) : null;
  const canSave = liveCft != null && !girthProblem && !lengthProblem;
  /** the figure shown while typing: only for a measurement that could actually be saved */
  const previewCft = canSave ? liveCft : null;
  /** the log just saved, confirmed under the form until the next one is typed */
  const [saved, setSaved] = useState<{ n: number; cft: number } | null>(null);
  const nextNo = (load.logs[load.logs.length - 1]?.logNumber ?? 0) + 1;

  /** set at once (state updates later): a second tap while saving is ignored, not sent again */
  const inFlight = useRef(false);
  async function run(action: () => Promise<unknown>, ok?: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
      if (ok) toast(ok, 'ok'); // every change says it happened
      onChanged();
    } catch (err) {
      setError(errorText(err));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function saveLog() {
    if (g == null || l == null || !canSave) return;
    // correcting a saved log from the calculator
    if (calcEdit) {
      const id = calcEdit.id;
      return run(async () => {
        await api(`/imports/${load.id}/logs/${id}`, { method: 'PATCH', body: JSON.stringify({ girthIn: g, lengthFt: l }) });
        setSaved({ n: calcEdit.logNumber, cft: importLogCft(g, l) });
        setCalcEdit(null);
        setGirth('');
        setLength('');
      }, t('logUpdatedToast', { n: calcEdit.logNumber }));
    }
    const done = { n: nextNo, cft: importLogCft(g, l) };
    return run(async () => {
      await api(`/imports/${load.id}/logs`, { method: 'POST', body: JSON.stringify({ girthIn: g, lengthFt: l }) });
      setSaved(done);
      setGirth('');
      setLength('');
      logs.reset(); // the new log is the first row of page 1
      firstRef.current?.focus(); // ready for the next log without touching the mouse
    }, t('logAddedToast', { n: done.n, cft: num3(done.cft) }));
  }
  function add(e: FormEvent) {
    e.preventDefault();
    void saveLog();
  }
  const [calc, setCalc] = useCalcMode();
  const [calcField, setCalcField] = useState(0);
  /** a saved log loaded into the calculator to be corrected */
  const [calcEdit, setCalcEdit] = useState<Log | null>(null);
  const editLog = (log: Log) => {
    setCalcEdit(log);
    setGirth(String(log.girthIn));
    setLength(String(log.lengthFt));
    setSaved(null);
    setCalcField(0);
  };
  const cancelEdit = () => {
    setCalcEdit(null);
    setGirth('');
    setLength('');
    setCalcField(0);
  };

  function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const eg = positive(editing.girth);
    const el = positive(editing.length);
    if (eg == null || el == null) return;
    run(async () => {
      await api(`/imports/${load.id}/logs/${editing.id}`, { method: 'PATCH', body: JSON.stringify({ girthIn: eg, lengthFt: el }) });
      setEditing(null);
    }, t('logUpdatedToast', { n: load.logs.find((x) => x.id === editing.id)?.logNumber ?? '' }));
  }

  const remove = (log: Log) => {
    confirmDelete().then((ok) => {
      if (ok) run(() => api(`/imports/${load.id}/logs/${log.id}`, { method: 'DELETE' }), t('logDeletedToast', { n: log.logNumber }));
    });
  };

  const newestFirst = [...load.logs].reverse();
  const logs = useClientPaging(newestFirst);
  const cellInput = 'ml-auto h-9 w-24 text-right tabular-nums max-md:w-16';

  const history = (
    <>
          <h3 className="mt-4 flex items-center gap-2 text-base font-semibold">
            {t('measurementHistory')}
            <span className="min-w-6 rounded-full bg-muted px-2 text-center text-xs leading-6 font-bold text-muted-foreground tabular-nums">{load.totalLogs}</span>
          </h3>
      <TableCard compactEmpty empty={load.logs.length === 0} emptyText={t('noLogs')} pager={logs.pager}>
        <form onSubmit={saveEdit}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">{t('logNo')}</TableHead>
                <TableHead className={numCell}>{t('girth')}</TableHead>
                <TableHead className={numCell}>{t('lengthFt')}</TableHead>
                <TableHead className={numCell}>CFT</TableHead>
                <TableHead className="pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.rows.map((log) =>
                editing?.id === log.id ? (
                  <TableRow key={log.id} data-state="selected">
                    <TableCell className="pl-4 font-medium">{log.logNumber}</TableCell>
                    <TableCell className={numCell}>
                      <Input
                        className={cellInput}
                        type="number"
                        aria-label={t('girth')}
                        value={editing.girth}
                        onChange={(e) => setEditing({ ...editing, girth: e.target.value })}
                        min={0.01}
                        max={999}
                        step="0.01"
                        inputMode="decimal"
                        required
                        autoFocus
                      />
                    </TableCell>
                    <TableCell className={numCell}>
                      <Input
                        className={cellInput}
                        type="number"
                        aria-label={t('lengthFt')}
                        value={editing.length}
                        onChange={(e) => setEditing({ ...editing, length: e.target.value })}
                        min={0.01}
                        max={999}
                        step="0.01"
                        inputMode="decimal"
                        required
                      />
                    </TableCell>
                    <TableCell className={cn(numCell, 'font-semibold')}>
                      {positive(editing.girth) != null && positive(editing.length) != null
                        ? num3(importLogCft(positive(editing.girth)!, positive(editing.length)!))
                        : '—'}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button type="submit" size="sm" className="max-md:size-9 max-md:px-0" disabled={busy} aria-label={t('save')}>
                          <CheckIcon />
                          <span className="max-md:sr-only">{t('save')}</span>
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="max-md:size-9 max-md:px-0" onClick={() => setEditing(null)} aria-label={t('cancel')}>
                          <XIcon />
                          <span className="max-md:sr-only">{t('cancel')}</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={log.id}>
                    <TableCell className="pl-4 font-medium">{log.logNumber}</TableCell>
                    <TableCell className={numCell}>{log.girthIn}</TableCell>
                    <TableCell className={numCell}>{log.lengthFt}</TableCell>
                    <TableCell className={cn(numCell, 'font-semibold')}>{num3(log.cft)}</TableCell>
                    <TableCell className="pr-4 text-right">
                      {load.editable && (
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="max-md:size-9 max-md:px-0"
                            aria-label={t('edit')}
                            onClick={() => setEditing({ id: log.id, girth: String(log.girthIn), length: String(log.lengthFt) })}
                          >
                            <PencilIcon />
                            <span className="max-md:sr-only">{t('edit')}</span>
                          </Button>
                          <Button type="button" variant="ghost" size="sm" className="max-md:size-9 max-md:px-0" aria-label={t('delete')} onClick={() => remove(log)}>
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
                <TableCell colSpan={3} className="pl-4">
                  {t('logsMeasured')}: {load.totalLogs}
                </TableCell>
                <TableCell className={numCell}>{num3(load.totalCft)}</TableCell>
                <TableCell className="pr-4" />
              </TableRow>
            </TableFooter>
          </Table>
        </form>
      </TableCard>
    </>
  );

  return (
    <Section id="logs" title={t('measurement')} tools={load.editable && <CalcModeSwitch calc={calc} onChange={setCalc} />}>
      {calc && load.editable ? (
        // the calculator view: the keypad and the tape, then the full list
        <div className="flex flex-col gap-4">
          <CalcPad
            title={`${t('logNo')} ${nextNo}`}
            editing={calcEdit && { key: calcEdit.id, label: `${t('edit')} · ${t('logNo')} ${calcEdit.logNumber}`, onCancel: cancelEdit }}
            fields={[
              { key: 'length', label: t('lengthFt'), unit: 'ft', value: length },
              { key: 'girth', label: t('girth'), unit: 'in', value: girth },
            ]}
            onChange={(k, v) => {
              (k === 'girth' ? setGirth : setLength)(v);
              setSaved(null);
            }}
            active={calcField}
            setActive={setCalcField}
            result={previewCft}
            formula={g != null && l != null ? `${l} × ${g} × ${g} ÷ 2304` : `${t('lengthFt')} × ${t('girth')} × ${t('girth')} ÷ 2304`}
            total={
              previewCft != null
                ? totalCft([calcEdit ? load.totalCft - calcEdit.cft : load.totalCft, previewCft])
                : load.totalCft
            }
            totalLabel={t('totalAfterLog')}
            problem={lengthProblem ? t(lengthProblem) : girthProblem ? t(girthProblem) : null}
            canSave={canSave}
            busy={busy}
            onSave={saveLog}
            saveLabel={calcEdit ? t('save') : t('saveLog', { n: nextNo })}
            afterSave={0}
            entriesTitle={t('measurementHistory')}
            entries={newestFirst.map((x) => ({
              key: x.id,
              no: x.logNumber,
              label: `${x.lengthFt} ft × ${x.girthIn} in`,
              cft: x.cft,
              onEdit: () => editLog(x),
              onDelete: () => remove(x),
            }))}
            entriesTotal={load.totalCft}
          />
          {/* saved / changed / deleted is said by a toast (and the list beside the keys) */}
          {error && <Notice tone="error">{error}</Notice>}
        </div>
      ) : (
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
        {/* the running total: beside the form on a wide screen, above it on a tablet or phone */}
        <Card className="gap-0 bg-primary py-6 text-primary-foreground lg:sticky lg:top-24 lg:order-last dark:bg-primary-soft dark:text-foreground">
          <CardContent className="px-6">
            <div className="text-sm font-medium opacity-80">{t('totalCft')}</div>
            <div className="mt-2 text-5xl leading-none font-semibold tracking-[-0.03em] tabular-nums font-display" aria-live="polite">
              {num3(load.totalCft)}
              <span className="ml-2 text-base font-medium tracking-normal opacity-75">CFT</span>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-current/15 pt-4">
              <div>
                <dt className="text-xs opacity-75">{t('logsMeasured')}</dt>
                <dd className="mt-0.5 text-2xl leading-tight font-bold tabular-nums font-display">{load.totalLogs}</dd>
              </div>
              {load.editable && (
                <div>
                  <dt className="text-xs opacity-75">{t('nextLog')}</dt>
                  <dd className="mt-0.5 text-2xl leading-tight font-bold tabular-nums font-display">#{nextNo}</dd>
                </div>
              )}
            </dl>
            <div className="mt-4 truncate text-xs opacity-75">
              {load.code} · {load.lorryNumber} · {load.woodType}
            </div>
          </CardContent>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          {load.editable && (
            <Card className="py-6">
              <CardContent className="px-5 sm:px-6">
                <form onSubmit={add} className="grid gap-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2.5 text-base font-semibold">
                      <span className="rounded-lg bg-primary-soft px-2.5 py-1 text-sm font-bold text-primary tabular-nums">
                        {t('logNo')} {nextNo}
                      </span>
                    </h3>
                    <p className="text-xs text-muted-foreground">{t('measureHint')}</p>
                  </div>

                  {/* the two measurements, side by side at every width */}
                  <div className="grid grid-cols-2 gap-3">
                    {(
                      [
                        { key: 'length', label: t('lengthFt'), value: length, set: setLength, problem: lengthProblem, ref: firstRef },
                        { key: 'girth', label: t('girth'), value: girth, set: setGirth, problem: girthProblem, ref: undefined },
                      ] as const
                    ).map((f) => (
                      <label key={f.key} className="flex min-w-0 flex-col gap-1.5">
                        <span className="text-sm font-medium">{f.label}</span>
                        <Input
                          ref={f.ref}
                          type="number"
                          value={f.value}
                          onChange={(e) => {
                            f.set(e.target.value);
                            setSaved(null);
                          }}
                          min={0.01}
                          max={999}
                          step="0.01"
                          inputMode="decimal"
                          required
                          aria-invalid={!!f.problem || undefined}
                          aria-describedby={f.problem ? `log-${f.key}-error` : undefined}
                          className="h-16 px-4 text-3xl font-bold tabular-nums md:text-3xl"
                        />
                        <span id={`log-${f.key}-error`} className="min-h-4 text-xs font-medium text-destructive" role={f.problem ? 'alert' : undefined}>
                          {f.problem && t(f.problem)}
                        </span>
                      </label>
                    ))}
                  </div>

                  {/* what this log comes to, and what it makes the load */}
                  <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/60 px-4 py-3">
                    <div>
                      <div className="text-xs text-muted-foreground">{t('thisLog')}</div>
                      <div className={cn('mt-0.5 text-2xl leading-tight font-bold tabular-nums font-display', previewCft == null && 'text-muted-foreground')}>
                        {previewCft != null ? num3(previewCft) : '0.000'} <span className="text-sm font-medium text-muted-foreground">CFT</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">{t('totalAfterLog')}</div>
                      <div className={cn('mt-0.5 text-2xl leading-tight font-bold tabular-nums font-display', previewCft == null && 'text-muted-foreground')}>
                        {num3(previewCft != null ? totalCft([load.totalCft, previewCft]) : load.totalCft)} <span className="text-sm font-medium text-muted-foreground">CFT</span>
                      </div>
                    </div>
                    {/* the working, with the numbers just typed, so anyone can check it on paper */}
                    <div className="col-span-2 border-t border-border/70 pt-2 text-sm text-muted-foreground" aria-live="polite">
                      {t('cftFormulaLabel')}:{' '}
                      <span className="font-semibold text-foreground tabular-nums">
                        {g != null && l != null && previewCft != null
                          ? `${l} × ${g} × ${g} ÷ 2304 = ${num3(previewCft)} CFT`
                          : `${t('lengthFt')} × ${t('girth')} × ${t('girth')} ÷ 2304`}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                    <div className="flex min-h-5 flex-1 items-center gap-1.5 text-sm font-medium text-success" aria-live="polite">
                      {saved && (
                        <>
                          <CheckCircle2Icon className="size-4 shrink-0" aria-hidden />
                          {t('logSavedLine', { n: saved.n, cft: num3(saved.cft) })}
                        </>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      className="h-12"
                      disabled={busy || (!girth && !length)}
                      onClick={() => {
                        setGirth('');
                        setLength('');
                        firstRef.current?.focus();
                      }}
                    >
                      {t('clear')}
                    </Button>
                    <Button type="submit" size="lg" className="h-12 sm:min-w-52" disabled={busy || !canSave}>
                      <PlusIcon /> {t('saveLog', { n: nextNo })}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
          {error && <Notice tone="error">{error}</Notice>}

          {history}
        </div>
      </div>
      )}
    </Section>
  );
}

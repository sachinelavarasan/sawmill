import { durationMinutes, formatDuration, Permission, unloadingCharges } from '@sawmill/shared';
import { PlusIcon, RulerIcon, SaveIcon } from 'lucide-react';
import { FormEvent, ReactNode, useId, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '../api';
import { useAuth } from '../auth';
import { money, num3, useLoad } from '../components/common';
import { DataTable } from '../components/data-table';
import { ListEmpty, ListToolbar, openColumn, PageSum, StatusCards, useRecordList, type ListColumn } from '../components/record-list';
import { StatusBadge } from '../components/status-badge';
import { useToast } from '../components/toast';
import { Field, FormActions, FormCard, FormSection, LoadState, Notice, Page, PageHeader } from '../components/page';
import { useI18n } from '../i18n';
import { ImportQuickView } from './QuickViews';

export interface ImportSummary {
  id: string;
  code: string;
  arrivalAt: string;
  lorryNumber: string;
  driverName: string | null;
  originLocation: string | null;
  /** only sent to people who may see finance (the owner) */
  supplierName: string | null;
  woodType: string;
  totalLogs: number;
  totalCft: number;
  status: string;
  rejectionReason: string | null;
  createdByName: string;
}

/** The fields a person types for an import load. Empty string = not filled in. */
export interface ImportForm {
  arrivalAt: string; // datetime-local value
  lorryNumber: string;
  woodType: string;
  woodCategory: string;
  driverName: string;
  driverMobile: string;
  lorryOwnerName: string;
  lorryOwnerMobile: string;
  originLocation: string;
  notes: string;
}

/** ISO timestamp → value for <input type="datetime-local"> in the browser's time zone. */
export function toLocalInput(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : undefined);

export const emptyImportForm = (): ImportForm => ({
  arrivalAt: toLocalInput(new Date()),
  lorryNumber: '',
  woodType: '',
  woodCategory: '',
  driverName: '',
  driverMobile: '',
  lorryOwnerName: '',
  lorryOwnerMobile: '',
  originLocation: '',
  notes: '',
});

export const importFormBody = (f: ImportForm) => JSON.stringify({ ...f, arrivalAt: fromLocalInput(f.arrivalAt) });


const arrivalAt = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const arrivalDay = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const arrivalTime = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

/** `/imports` lists every load; `/measurement` (openOnly) lists the ones still being measured. */
export function ImportsPage({ openOnly = false }: { openOnly?: boolean }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const isOwner = user?.role === 'OWNER';
  const list = useRecordList<ImportSummary>({ path: '/imports', name: 'imports', hiddenByDefault: ['driver', 'origin'], fixedQuery: openOnly ? 'open=1' : undefined });
  const { data, loading, error, reload } = list;
  /** the load shown in the side panel, if any */
  const [peek, setPeek] = useState<ImportSummary | null>(null);

  const allColumns = useMemo(() => {
    const cols: ListColumn<ImportSummary>[] = [
      {
        id: 'code',
        header: t('importId'),
        cell: (l) => (
          <>
            <Link className="font-semibold text-primary hover:underline" to={`/imports/${l.id}`}>
              {l.code}
            </Link>
            <div className="mt-0.5 text-xs whitespace-normal text-muted-foreground md:hidden">
              {l.lorryNumber} · {l.woodType} · {arrivalAt(l.arrivalAt)}
            </div>
          </>
        ),
      },
      {
        id: 'arrival',
        label: t('arrival'),
        header: t('arrival'),
        from: 'md',
        cell: (l) => (
          <>
            {arrivalDay(l.arrivalAt)} <span className="ml-1 text-xs text-muted-foreground">{arrivalTime(l.arrivalAt)}</span>
          </>
        ),
      },
      { id: 'lorry', label: t('lorry'), header: t('lorry'), from: 'md', className: 'font-medium', cell: (l) => l.lorryNumber },
      { id: 'driver', label: t('driverName'), header: t('driverName'), from: 'xl', className: 'max-w-40 truncate', cell: (l) => l.driverName ?? '—' },
    ];
    // the supplier belongs to the purchase record, which only the owner sees
    if (isOwner) cols.push({ id: 'supplier', label: t('supplier'), header: t('supplier'), from: 'xl', className: 'max-w-40 truncate', cell: (l) => l.supplierName ?? '—' });
    cols.push(
      { id: 'origin', label: t('originLocation'), header: t('originLocation'), from: 'xl', className: 'max-w-48 truncate', cell: (l) => l.originLocation ?? '—' },
      { id: 'wood', label: t('woodType'), header: t('woodType'), from: 'lg', cell: (l) => l.woodType },
      { id: 'logs', label: t('logs'), header: t('logs'), from: 'lg', numeric: true, cell: (l) => l.totalLogs },
      { id: 'cft', header: t('totalCft'), numeric: true, className: 'font-semibold', cell: (l) => num3(l.totalCft) },
      { id: 'status', header: t('status'), cell: (l) => <StatusBadge status={l.status} /> },
    );
    if (isOwner) cols.push({ id: 'by', label: t('createdBy'), header: t('createdBy'), from: 'xl', className: 'max-w-32 truncate', cell: (l) => l.createdByName });
    cols.push(
      openOnly
        ? {
            id: 'open',
            header: <span className="sr-only">{t('actions')}</span>,
            className: 'w-px text-right',
            cell: (l) => (
              <Button asChild variant="outline" size="sm">
                <Link to={`/imports/${l.id}#logs`} aria-label={t('measure')}>
                  <RulerIcon />
                  <span className="max-md:sr-only">{t('measure')}</span>
                </Link>
              </Button>
            ),
          }
        : openColumn<ImportSummary>(
            (l) => `/imports/${l.id}`,
            (l) => l.code,
            t,
          ),
    );
    return cols;
  }, [t, isOwner, openOnly]);
  const columns = useMemo(() => allColumns.filter((c) => !list.hidden.includes(c.id)), [allColumns, list.hidden]);

  return (
    <Page>
      <PageHeader
        title={t(openOnly ? 'measurement' : 'imports')}
        subtitle={t(openOnly ? 'measurementSub' : 'importsSub')}
        actions={
          <Button asChild>
            <Link to="/imports/new">
              <PlusIcon /> {t('newImport')}
            </Link>
          </Button>
        }
      />

      {!openOnly && <StatusCards list={list} totalLabel={t('totalImportLoads')} />}

      <LoadState loading={loading && !data} error={error} onRetry={reload} />

      {data && (
        <DataTable
          grid
          data={data.items}
          columns={columns}
          rowKey={(l) => l.id}
          // the measurement list goes straight to log entry; the full list opens a quick view first
          rowTo={openOnly ? (l) => `/imports/${l.id}#logs` : undefined}
          onRowClick={openOnly ? undefined : setPeek}
          selectedKey={peek?.id}
          empty={<ListEmpty list={list} none={t(openOnly ? 'noOpenLoads' : 'noImports')} newTo="/imports/new" newLabel={t('newImport')} />}
          pager={list.paging.pager(data.total)}
          busy={loading}
          toolbar={<ListToolbar list={list} columns={allColumns} searchPlaceholder={t('searchRecords')} />}
          footer={<PageSum cft={data.items.reduce((a, l) => a + l.totalCft, 0)} />}
        />
      )}

      <ImportQuickView row={peek} onClose={() => setPeek(null)} onChanged={list.refresh} />
    </Page>
  );
}

/**
 * The import form, in numbered sections, shared by "New Import" and the edit panel on the
 * detail page. `supplier` and `unloading` are extra parts only the new-import screen has
 * (on an existing load they have their own sections on the page).
 */
export function ImportFields({ form, onChange, supplier, unloading }: { form: ImportForm; onChange: (f: ImportForm) => void; supplier?: ReactNode; unloading?: ReactNode }) {
  const { t } = useI18n();
  const uid = useId();
  const id = (k: keyof ImportForm) => `${uid}-${k}`;
  const set = (k: keyof ImportForm) => (e: { target: { value: string } }) => onChange({ ...form, [k]: e.target.value });
  let step = 0;
  return (
    <>
      <FormSection step={++step} title={t('secImportInfo')} description={t('secImportInfoSub')}>
        <Field id={id('arrivalAt')} label={t('arrivalDateTime')} required>
          <Input id={id('arrivalAt')} type="datetime-local" value={form.arrivalAt} onChange={set('arrivalAt')} required />
        </Field>
        <Field id={id('woodType')} label={t('woodType')} required hint={t('woodTypeHint')}>
          <Input id={id('woodType')} value={form.woodType} onChange={set('woodType')} required minLength={2} maxLength={60} />
        </Field>
        <Field id={id('woodCategory')} label={t('woodCategory')}>
          <Input id={id('woodCategory')} value={form.woodCategory} onChange={set('woodCategory')} maxLength={60} />
        </Field>
        <Field id={id('originLocation')} label={t('originLocation')}>
          <Input id={id('originLocation')} value={form.originLocation} onChange={set('originLocation')} maxLength={120} />
        </Field>
      </FormSection>

      <FormSection step={++step} title={t(supplier ? 'secSupplierLorry' : 'secLorry')} description={t('secLorrySub')}>
        {supplier}
        <Field id={id('lorryNumber')} label={t('lorryNumber')} required hint={t('lorryNumberHint')} className={supplier ? undefined : 'sm:col-span-2'}>
          <Input id={id('lorryNumber')} value={form.lorryNumber} onChange={set('lorryNumber')} required minLength={4} maxLength={20} autoCapitalize="characters" placeholder="TN 45 AB 1234" className="uppercase placeholder:normal-case" />
        </Field>
        <Field id={id('driverName')} label={t('driverName')}>
          <Input id={id('driverName')} value={form.driverName} onChange={set('driverName')} maxLength={100} autoComplete="off" />
        </Field>
        <Field id={id('driverMobile')} label={t('driverMobile')} hint={t('mobileHint')}>
          <Input id={id('driverMobile')} type="tel" value={form.driverMobile} onChange={set('driverMobile')} inputMode="tel" maxLength={15} pattern={MOBILE} autoComplete="off" />
        </Field>
        <Field id={id('lorryOwnerName')} label={t('lorryOwnerName')}>
          <Input id={id('lorryOwnerName')} value={form.lorryOwnerName} onChange={set('lorryOwnerName')} maxLength={100} autoComplete="off" />
        </Field>
        <Field id={id('lorryOwnerMobile')} label={t('lorryOwnerMobile')} hint={t('mobileHint')}>
          <Input id={id('lorryOwnerMobile')} type="tel" value={form.lorryOwnerMobile} onChange={set('lorryOwnerMobile')} inputMode="tel" maxLength={15} pattern={MOBILE} autoComplete="off" />
        </Field>
      </FormSection>

      {unloading && (
        <FormSection step={++step} title={t('secUnloading')} description={t('secUnloadingSub')}>
          {unloading}
        </FormSection>
      )}

      <FormSection step={++step} title={t('secAdditional')} description={t('secAdditionalSub')}>
        <Field id={id('notes')} label={t('notes')} hint={t('notesHint')} className="sm:col-span-2">
          <Textarea id={id('notes')} value={form.notes} onChange={set('notes')} maxLength={1000} rows={3} />
        </Field>
      </FormSection>
    </>
  );
}
/** The same rule the server applies to mobile numbers (empty is allowed: the fields are optional). */
const MOBILE = '[0-9+ ]{7,15}';

/** Radix Select can't hold '', so "no supplier" is this sentinel in the picker. */
const NO_SUPPLIER = 'none';
const emptyUnloading = () => ({ vehicleNumber: '', startAt: '', endAt: '', ratePerHour: '' });

export function NewImportPage() {
  const { t } = useI18n();
  const { can } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(emptyImportForm);
  const [unl, setUnl] = useState(emptyUnloading);
  const [supplierId, setSupplierId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** where the pressed button goes after saving: the record, or straight to log entry */
  const next = useRef<'record' | 'logs'>('record');

  // the supplier sits on the purchase record, which only the owner may see or set
  const canSupplier = can(Permission.FINANCE_VIEW) && can(Permission.SUPPLIERS_MANAGE);
  const suppliers = useLoad(() => (canSupplier ? api<{ id: string; name: string }[]>('/suppliers') : Promise.resolve([])), [canSupplier]);

  const setU = (k: keyof ReturnType<typeof emptyUnloading>) => (e: { target: { value: string } }) => setUnl((u) => ({ ...u, [k]: e.target.value }));
  const hasUnloading = unl.vehicleNumber.trim() !== '';
  // the same formulas the server uses: whole minutes between the times, rate × minutes / 60
  let minutes: number | null = null;
  let charges: number | null = null;
  try {
    if (unl.startAt && unl.endAt) minutes = durationMinutes(new Date(unl.startAt), new Date(unl.endAt));
    if (minutes != null && unl.ratePerHour.trim() !== '') charges = unloadingCharges(minutes, Number(unl.ratePerHour));
  } catch {
    minutes = charges = null; // end before start, or a bad rate: the inputs say so themselves
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const goTo = next.current;
    next.current = 'record';
    setBusy(true);
    setError(null);
    try {
      const created = await api<{ id: string }>('/imports', { method: 'POST', body: importFormBody(form) });
      // the load now exists; the optional parts are saved onto it, and a failure there must not lose it
      const missed: string[] = [];
      if (hasUnloading)
        await api(`/imports/${created.id}/unloading`, {
          method: 'POST',
          body: JSON.stringify({
            vehicleNumber: unl.vehicleNumber,
            startAt: fromLocalInput(unl.startAt),
            endAt: fromLocalInput(unl.endAt),
            ratePerHour: unl.ratePerHour.trim() === '' ? undefined : Number(unl.ratePerHour),
          }),
        }).catch((err) => missed.push(`${t('secUnloading')} (${(err as Error).message})`));
      if (supplierId)
        await api(`/imports/${created.id}/financials`, { method: 'PUT', body: JSON.stringify({ supplierId }) }).catch((err) => missed.push(`${t('supplier')} (${(err as Error).message})`));
      if (missed.length) toast(t('savedButNot', { what: missed.join(', ') }), 'warn');
      navigate(`/imports/${created.id}${goTo === 'logs' ? '#logs' : ''}`, { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Page className="max-w-5xl">
      <PageHeader title={t('newImport')} subtitle={t('requiredNote')} back={{ to: '/imports', label: t('imports') }} />
      <FormCard onSubmit={submit} className="py-7 [&_form]:gap-7">
        <ImportFields
          form={form}
          onChange={setForm}
          supplier={
            canSupplier && (
              <Field id="imp-supplier" label={t('supplier')} hint={t('supplierHint')}>
                <Select value={supplierId || NO_SUPPLIER} onValueChange={(v) => setSupplierId(v === NO_SUPPLIER ? '' : v)}>
                  <SelectTrigger id="imp-supplier" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SUPPLIER}>{t('noSupplier')}</SelectItem>
                    {(suppliers.data ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )
          }
          unloading={
            <>
              <Field id="imp-unl-vehicle" label={t('vehicleNumber')} hint={t('unloadingVehicleHint')}>
                <Input
                  id="imp-unl-vehicle"
                  value={unl.vehicleNumber}
                  onChange={setU('vehicleNumber')}
                  // only needed once any other unloading detail is filled in
                  required={!!(unl.startAt || unl.endAt || unl.ratePerHour)}
                  minLength={2}
                  maxLength={20}
                  autoCapitalize="characters"
                  className="uppercase"
                />
              </Field>
              <Field id="imp-unl-rate" label={t('ratePerHour')} hint={t('unloadingRateHint')}>
                <Input id="imp-unl-rate" type="number" value={unl.ratePerHour} onChange={setU('ratePerHour')} min={0} max={1000000} step="0.01" inputMode="decimal" className="tabular-nums" />
              </Field>
              <Field id="imp-unl-start" label={t('startTime')}>
                <Input id="imp-unl-start" type="datetime-local" value={unl.startAt} onChange={setU('startAt')} />
              </Field>
              <Field id="imp-unl-end" label={t('endTime')}>
                <Input id="imp-unl-end" type="datetime-local" value={unl.endAt} onChange={setU('endAt')} min={unl.startAt || undefined} />
              </Field>
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 rounded-lg bg-muted/60 px-4 py-3 text-sm sm:col-span-2" aria-live="polite">
                <span className="text-muted-foreground">
                  {t('duration')}: <span className="font-semibold text-foreground tabular-nums">{minutes != null ? formatDuration(minutes) : '—'}</span>
                </span>
                <span className="text-muted-foreground">
                  {t('estimatedCharges')}: <span className="font-semibold text-foreground tabular-nums">{charges != null ? money(charges) : '—'}</span>
                </span>
              </div>
            </>
          }
        />
        {error && <Notice tone="error">{error}</Notice>}
        <div className="border-t border-border/70 pt-5">
          <FormActions summary={t('draftHint')}>
            <Button asChild variant="ghost">
              <Link to="/imports">{t('cancel')}</Link>
            </Button>
            <Button type="submit" variant="outline" disabled={busy} onClick={() => (next.current = 'record')}>
              <SaveIcon /> {t('saveDraft')}
            </Button>
            <Button type="submit" disabled={busy} onClick={() => (next.current = 'logs')}>
              <RulerIcon /> {t('saveAndMeasure')}
            </Button>
          </FormActions>
        </div>
      </FormCard>
    </Page>
  );
}

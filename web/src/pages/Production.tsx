import { recoveryPercent } from '@sawmill/shared';
import { PlusIcon } from 'lucide-react';
import { FormEvent, ReactNode, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { api } from '../api';
import { useAuth } from '../auth';
import { num3, useLoad } from '../components/common';
import { DataTable } from '../components/data-table';
import { ListEmpty, ListToolbar, openColumn, PageSum, StatusCards, useRecordList, type ListColumn } from '../components/record-list';
import { StatusBadge } from '../components/status-badge';
import { Field, FormActions, FormCard, FormSection, LoadState, Notice, Page, PageHeader } from '../components/page';
import { useI18n } from '../i18n';
import { fromLocalInput, toLocalInput } from './Imports';
import { ProductionQuickView } from './QuickViews';

export interface ProductionSummary {
  id: string;
  code: string;
  productionDate: string;
  importLoadId: string;
  importCode: string;
  woodType: string;
  inputCft: number | null;
  outputCft: number;
  wasteCft: number | null;
  status: string;
  rejectionReason: string | null;
  createdByName: string;
}

/** One approved import load that still has raw stock (from GET /stock). */
export interface RawStockRow {
  importLoadId: string;
  importCode: string;
  woodType: string;
  arrivalAt: string;
  receivedLogs: number;
  receivedCft: number;
  logs: number;
  cft: number;
}

/** The fields typed for a production run. Empty string = not filled in. */
export interface ProductionForm {
  productionDate: string;
  cuttingMachine: string;
  machineOperator: string;
  workerDetails: string;
  startAt: string; // datetime-local
  endAt: string;
  inputCft: string;
  wasteNotes: string;
}

export const todayLocal = () => toLocalInput(new Date()).slice(0, 10);
export const dateOnly = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { dateStyle: 'medium' });

export const productionBody = (f: ProductionForm) => ({
  productionDate: f.productionDate,
  cuttingMachine: f.cuttingMachine,
  machineOperator: f.machineOperator,
  workerDetails: f.workerDetails,
  startAt: fromLocalInput(f.startAt) ?? null,
  endAt: fromLocalInput(f.endAt) ?? null,
  inputCft: f.inputCft.trim() === '' ? null : Number(f.inputCft),
  wasteNotes: f.wasteNotes,
});


export function ProductionPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const isOwner = user?.role === 'OWNER';
  const list = useRecordList<ProductionSummary>({ path: '/production', name: 'production', hiddenByDefault: ['waste'] });
  const { data, loading, error, reload } = list;
  /** the run shown in the side panel, if any */
  const [peek, setPeek] = useState<ProductionSummary | null>(null);

  const allColumns = useMemo(() => {
    const cols: ListColumn<ProductionSummary>[] = [
      {
        id: 'code',
        header: t('productionId'),
        cell: (r) => (
          <>
            <Link className="font-semibold text-primary hover:underline" to={`/production/${r.id}`}>
              {r.code}
            </Link>
            <div className="mt-0.5 text-xs whitespace-normal text-muted-foreground md:hidden">
              {r.importCode} · {r.woodType} · {dateOnly(r.productionDate)}
            </div>
          </>
        ),
      },
      { id: 'date', label: t('date'), header: t('date'), from: 'md', cell: (r) => dateOnly(r.productionDate) },
      {
        id: 'import',
        label: t('sourceLoad'),
        header: t('sourceLoad'),
        from: 'md',
        cell: (r) => (
          <Link className="font-medium text-primary hover:underline" to={`/imports/${r.importLoadId}`}>
            {r.importCode}
          </Link>
        ),
      },
      { id: 'wood', label: t('woodType'), header: t('woodType'), from: 'lg', cell: (r) => r.woodType },
      { id: 'input', label: t('inputCft'), header: t('inputCft'), from: 'lg', numeric: true, cell: (r) => (r.inputCft != null ? num3(r.inputCft) : '—') },
      { id: 'output', header: t('outputCft'), numeric: true, className: 'font-semibold', cell: (r) => num3(r.outputCft) },
      {
        id: 'recovery',
        label: t('recovery'),
        header: t('recovery'),
        from: 'xl',
        className: 'min-w-32',
        // the share of the raw wood that came out finished, as a bar (the same formula the server reports)
        cell: (r) => {
          const pct = recoveryPercent(r.inputCft, r.outputCft);
          return (
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className={cn('h-full rounded-full', pct != null && pct > 100 ? 'bg-destructive' : 'bg-chart-1')} style={{ width: `${Math.min(100, Math.max(0, pct ?? 0))}%` }} />
              </div>
              <span className="w-11 text-right text-xs text-muted-foreground tabular-nums">{pct != null ? `${pct}%` : '—'}</span>
            </div>
          );
        },
      },
      {
        id: 'waste',
        label: t('wasteCft'),
        header: t('wasteCft'),
        from: 'xl',
        numeric: true,
        cell: (r) => <span className={cn(r.wasteCft != null && r.wasteCft < 0 && 'font-semibold text-destructive')}>{r.wasteCft != null ? num3(r.wasteCft) : '—'}</span>,
      },
      { id: 'status', header: t('status'), cell: (r) => <StatusBadge status={r.status} /> },
    ];
    if (isOwner) cols.push({ id: 'by', label: t('createdBy'), header: t('createdBy'), from: 'xl', className: 'max-w-36 truncate', cell: (r) => r.createdByName });
    cols.push(
      openColumn<ProductionSummary>(
        (r) => `/production/${r.id}`,
        (r) => r.code,
        t,
      ),
    );
    return cols;
  }, [t, isOwner]);
  const columns = useMemo(() => allColumns.filter((c) => !list.hidden.includes(c.id)), [allColumns, list.hidden]);

  return (
    <Page>
      <PageHeader
        title={t('production')}
        subtitle={t('productionSub')}
        actions={
          <Button asChild>
            <Link to="/production/new">
              <PlusIcon /> {t('newProduction')}
            </Link>
          </Button>
        }
      />

      <StatusCards list={list} totalLabel={t('totalRuns')} />

      <LoadState loading={loading && !data} error={error} onRetry={reload} />

      {data && (
        <DataTable
          grid
          data={data.items}
          columns={columns}
          rowKey={(r) => r.id}
          onRowClick={setPeek}
          selectedKey={peek?.id}
          empty={<ListEmpty list={list} none={t('noProduction')} newTo="/production/new" newLabel={t('newProduction')} />}
          pager={list.paging.pager(data.total)}
          busy={loading}
          toolbar={<ListToolbar list={list} columns={allColumns} searchPlaceholder={t('searchProduction')} />}
          footer={<PageSum cft={data.items.reduce((a, r) => a + r.outputCft, 0)} />}
        />
      )}

      <ProductionQuickView row={peek} onClose={() => setPeek(null)} onChanged={list.refresh} />
    </Page>
  );
}

/**
 * Run fields, in numbered sections, shared by "New Production Run" and the edit panel on the
 * detail page. `source` is the load picker, which only the new-run screen has.
 */
export function ProductionFields({
  form,
  onChange,
  availableCft,
  source,
}: {
  form: ProductionForm;
  onChange: (f: ProductionForm) => void;
  /** Raw CFT left in the chosen load, for the hint and "Use all". */
  availableCft: number | null;
  source?: ReactNode;
}) {
  const { t } = useI18n();
  const set = (k: keyof ProductionForm) => (e: { target: { value: string } }) => onChange({ ...form, [k]: e.target.value });
  return (
    <>
      <FormSection step={1} title={t('secRawInput')}>
        {source}
        <Field id="prod-date" label={t('productionDate')} required>
          <Input id="prod-date" type="date" value={form.productionDate} onChange={set('productionDate')} required />
        </Field>
        <Field
          id="prod-input"
          label={t('inputCft')}
          hint={
            availableCft != null && (
              <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => onChange({ ...form, inputCft: String(availableCft) })}>
                {t('inputCftHint', { cft: num3(availableCft) })} · {t('useAll')}
              </Button>
            )
          }
        >
          <Input id="prod-input" type="number" value={form.inputCft} onChange={set('inputCft')} min={0.001} step="0.001" inputMode="decimal" className="tabular-nums" />
        </Field>
      </FormSection>

      <FormSection step={2} title={t('runDetails')}>
        <Field id="prod-machine" label={t('cuttingMachine')}>
          <Input id="prod-machine" value={form.cuttingMachine} onChange={set('cuttingMachine')} maxLength={100} />
        </Field>
        <Field id="prod-operator" label={t('machineOperator')}>
          <Input id="prod-operator" value={form.machineOperator} onChange={set('machineOperator')} maxLength={100} />
        </Field>
        <Field id="prod-start" label={t('startTime')}>
          <Input id="prod-start" type="datetime-local" value={form.startAt} onChange={set('startAt')} />
        </Field>
        <Field id="prod-end" label={t('endTime')}>
          <Input id="prod-end" type="datetime-local" value={form.endAt} onChange={set('endAt')} min={form.startAt || undefined} />
        </Field>
        <Field id="prod-workers" label={t('workerDetails')} className="sm:col-span-2">
          <Input id="prod-workers" value={form.workerDetails} onChange={set('workerDetails')} maxLength={500} />
        </Field>
        <Field id="prod-waste" label={t('wasteNotes')} className="sm:col-span-2">
          <Input id="prod-waste" value={form.wasteNotes} onChange={set('wasteNotes')} maxLength={1000} />
        </Field>
      </FormSection>
    </>
  );
}

export function NewProductionPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const stock = useLoad(() => api<{ raw: RawStockRow[] }>('/stock'), []);
  const loads = stock.data?.raw.filter((r) => r.cft > 0) ?? [];
  const [loadId, setLoadId] = useState(params.get('load') ?? '');
  const [form, setForm] = useState<ProductionForm>(() => ({
    productionDate: todayLocal(),
    cuttingMachine: '',
    machineOperator: '',
    workerDetails: '',
    startAt: '',
    endAt: '',
    inputCft: '',
    wasteNotes: '',
  }));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen = loads.find((l) => l.importLoadId === loadId) ?? null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api<{ id: string }>('/production', {
        method: 'POST',
        body: JSON.stringify({ importLoadId: loadId, ...productionBody(form) }),
      });
      navigate(`/production/${created.id}`, { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Page className="max-w-5xl">
      <PageHeader title={t('newProduction')} subtitle={t('requiredNote')} back={{ to: '/production', label: t('production') }} />
      <LoadState loading={stock.loading && !stock.data} error={stock.error} onRetry={stock.reload} />
      {stock.data && loads.length === 0 && <Notice>{t('noRawStock')}</Notice>}
      {stock.data && loads.length > 0 && (
        <FormCard onSubmit={submit} className="py-7 [&_form]:gap-7">
          <ProductionFields
            form={form}
            onChange={setForm}
            availableCft={chosen?.cft ?? null}
            source={
              <Field label={t('sourceLoad')} required className="sm:col-span-2">
                <Select value={loadId} onValueChange={setLoadId} required>
                  <SelectTrigger className="w-full" aria-label={t('sourceLoad')}>
                    <SelectValue placeholder={t('pickLoad')} />
                  </SelectTrigger>
                  <SelectContent>
                    {loads.map((l) => (
                      <SelectItem key={l.importLoadId} value={l.importLoadId}>
                        {l.importCode} · {l.woodType} · {num3(l.cft)} CFT
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            }
          />
          {error && <Notice tone="error">{error}</Notice>}
          <div className="border-t border-border/70 pt-5">
            <FormActions>
              <Button asChild variant="ghost">
                <Link to="/production">{t('cancel')}</Link>
              </Button>
              <Button type="submit" disabled={busy || !loadId}>
                {t('create')}
              </Button>
            </FormActions>
          </div>
        </FormCard>
      )}
    </Page>
  );
}

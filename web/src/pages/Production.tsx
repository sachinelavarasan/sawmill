import { PlusIcon } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { api } from '../api';
import { useAuth } from '../auth';
import { num3, useLoad } from '../components/common';
import { StatusBadge } from '../components/status-badge';
import { Field, FormActions, FormCard, FormGrid, LinkRow, LoadState, Notice, numCell, Page, PageHeader, SearchBox, StatusFilter, TableCard, Toolbar, usePaging, wide } from '../components/page';
import { useI18n } from '../i18n';
import { fromLocalInput, toLocalInput } from './Imports';

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
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const paging = usePaging();
  const query = `take=${paging.take}&skip=${paging.skip}${status ? `&status=${status}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
  const { data, loading, error, reload } = useLoad(
    () => api<{ items: ProductionSummary[]; total: number }>(`/production?${query}`),
    [query],
  );

  return (
    <Page>
      <PageHeader
        title={t('production')}
        actions={
          <>
            <Button asChild>
              <Link to="/production/new">
                <PlusIcon /> {t('newProduction')}
              </Link>
            </Button>
          </>
        }
      />


      <Toolbar>
        <SearchBox
          value={q}
          onChange={(v) => {
            setQ(v);
            paging.reset();
          }}
          placeholder={t('searchProduction')}
        />
        <StatusFilter
          value={status}
          onChange={(v) => {
            setStatus(v);
            paging.reset();
          }}
        />
      </Toolbar>

      <LoadState loading={loading && !data} error={error} onRetry={reload} />

      {data && (
        <>
          <TableCard empty={data.items.length === 0} emptyText={q ? t('noMatches', { q }) : t('noProduction')} pager={paging.pager(data.total)} className={cn(loading && 'opacity-60')}>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="pl-4">{t('productionId')}</TableHead>
                  <TableHead className={wide}>{t('date')}</TableHead>
                  <TableHead className={wide}>{t('importId')}</TableHead>
                  <TableHead className={wide}>{t('woodType')}</TableHead>
                  <TableHead className={cn(numCell, wide)}>{t('inputCft')}</TableHead>
                  <TableHead className={numCell}>{t('outputCft')}</TableHead>
                  <TableHead className={cn(numCell, wide)}>{t('wasteCft')}</TableHead>
                  <TableHead className={cn(!isOwner && 'pr-4', isOwner && 'max-md:pr-4')}>{t('status')}</TableHead>
                  {isOwner && <TableHead className={cn(wide, 'pr-4')}>{t('createdBy')}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((r) => (
                  <LinkRow key={r.id} to={`/production/${r.id}`}>
                    <TableCell className="pl-4 font-medium">
                      <Link className="text-primary hover:underline" to={`/production/${r.id}`}>
                        {r.code}
                      </Link>
                      <div className="text-xs font-normal text-muted-foreground md:hidden">
                        {r.importCode} · {r.woodType}
                      </div>
                    </TableCell>
                    <TableCell className={cn(wide, 'text-muted-foreground')}>{dateOnly(r.productionDate)}</TableCell>
                    <TableCell className={wide}>{r.importCode}</TableCell>
                    <TableCell className={wide}>{r.woodType}</TableCell>
                    <TableCell className={cn(numCell, wide)}>{r.inputCft != null ? num3(r.inputCft) : '—'}</TableCell>
                    <TableCell className={cn(numCell, 'font-semibold')}>{num3(r.outputCft)}</TableCell>
                    <TableCell className={cn(numCell, wide, r.wasteCft != null && r.wasteCft < 0 && 'font-semibold text-destructive')}>
                      {r.wasteCft != null ? num3(r.wasteCft) : '—'}
                    </TableCell>
                    <TableCell className={cn(!isOwner && 'pr-4', isOwner && 'max-md:pr-4')}>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    {isOwner && <TableCell className={cn(wide, 'pr-4')}>{r.createdByName}</TableCell>}
                  </LinkRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        </>
      )}
    </Page>
  );
}

/** Run fields shared by "New Production Run" and the edit panel on the detail page. */
export function ProductionFields({
  form,
  onChange,
  availableCft,
}: {
  form: ProductionForm;
  onChange: (f: ProductionForm) => void;
  /** Raw CFT left in the chosen load, for the hint and "Use all". */
  availableCft: number | null;
}) {
  const { t } = useI18n();
  const set = (k: keyof ProductionForm) => (e: { target: { value: string } }) => onChange({ ...form, [k]: e.target.value });
  return (
    <FormGrid>
      <Field id="prod-date" label={`${t('productionDate')} *`}>
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
        <Input id="prod-input" type="number" value={form.inputCft} onChange={set('inputCft')} min={0.001} step="0.001" inputMode="decimal" />
      </Field>
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
      <Field id="prod-workers" label={t('workerDetails')} className="sm:col-span-full">
        <Input id="prod-workers" value={form.workerDetails} onChange={set('workerDetails')} maxLength={500} />
      </Field>
      <Field id="prod-waste" label={t('wasteNotes')} className="sm:col-span-full">
        <Input id="prod-waste" value={form.wasteNotes} onChange={set('wasteNotes')} maxLength={1000} />
      </Field>
    </FormGrid>
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
    <Page>
      <PageHeader title={t('newProduction')} back={{ to: '/production', label: t('production') }} />
      <LoadState loading={stock.loading && !stock.data} error={stock.error} onRetry={stock.reload} />
      {stock.data && loads.length === 0 && <Notice>{t('noRawStock')}</Notice>}
      {stock.data && loads.length > 0 && (
        <FormCard onSubmit={submit}>
          <FormGrid>
            <Field label={`${t('sourceLoad')} *`} className="sm:col-span-full">
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
          </FormGrid>
          <ProductionFields form={form} onChange={setForm} availableCft={chosen?.cft ?? null} />
          {error && <Notice tone="error">{error}</Notice>}
          <FormActions>
            <Button asChild variant="ghost">
              <Link to="/production">{t('cancel')}</Link>
            </Button>
            <Button type="submit" disabled={busy || !loadId}>
              {t('create')}
            </Button>
          </FormActions>
        </FormCard>
      )}
    </Page>
  );
}

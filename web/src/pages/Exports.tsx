import { PlusIcon } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '../api';
import { useAuth } from '../auth';
import { num3, useApi, useLoad } from '../components/common';
import { type Column, DataTable, IdCell } from '../components/data-table';
import { ALL, Field, FormActions, FormCard, FormGrid, LoadState, Notice, Page, PageHeader, SearchBox, StatusFilter, Toolbar, usePaging } from '../components/page';
import { StatusBadge } from '../components/status-badge';
import { useI18n } from '../i18n';
import { fromLocalInput } from './Imports';
import { dateOnly, todayLocal } from './Production';

export interface ExportSummary {
  id: string;
  code: string;
  exportDate: string;
  lorryNumber: string;
  woodType: string;
  totalPieces: number;
  totalCft: number;
  status: string;
  createdByName: string;
}

/** A finished-stock row from GET /stock: one wood type and size from one import load. */
export interface FinishedStockRow {
  woodType: string;
  thicknessIn: number;
  widthIn: number;
  lengthFt: number;
  importLoadId: string;
  importCode: string;
  pieces: number;
  cft: number;
}

export interface ExportForm {
  exportDate: string;
  lorryNumber: string;
  woodType: string;
  importLoadId: string;
  driverName: string;
  driverMobile: string;
  lorryOwnerName: string;
  lorryOwnerMobile: string;
  startAt: string; // datetime-local
  endAt: string;
  notes: string;
}

export const emptyExportForm = (): ExportForm => ({
  exportDate: todayLocal(),
  lorryNumber: '',
  woodType: '',
  importLoadId: '',
  driverName: '',
  driverMobile: '',
  lorryOwnerName: '',
  lorryOwnerMobile: '',
  startAt: '',
  endAt: '',
  notes: '',
});

export const exportBody = (f: ExportForm) =>
  JSON.stringify({
    ...f,
    importLoadId: f.importLoadId || null,
    startAt: fromLocalInput(f.startAt) ?? null,
    endAt: fromLocalInput(f.endAt) ?? null,
  });


export function ExportsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const isOwner = user?.role === 'OWNER';
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const paging = usePaging();
  const query = `take=${paging.take}&skip=${paging.skip}${status ? `&status=${status}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
  const { data, loading, error, reload } = useApi<{ items: ExportSummary[]; total: number }>(`/exports?${query}`);

  const columns = useMemo(() => {
    const cols: Column<ExportSummary>[] = [
      {
        id: 'code',
        header: t('exportId'),
        cell: (e) => (
          <IdCell sub={`${e.lorryNumber} · ${e.woodType}`}>
            <Link className="text-primary hover:underline" to={`/exports/${e.id}`}>
              {e.code}
            </Link>
          </IdCell>
        ),
      },
      { id: 'date', header: t('date'), from: 'md', className: 'text-muted-foreground', cell: (e) => dateOnly(e.exportDate) },
      { id: 'lorry', header: t('lorry'), from: 'md', cell: (e) => e.lorryNumber },
      { id: 'wood', header: t('woodType'), from: 'md', cell: (e) => e.woodType },
      { id: 'pieces', header: t('pieces'), from: 'md', numeric: true, cell: (e) => e.totalPieces },
      { id: 'cft', header: t('totalCft'), numeric: true, className: 'font-semibold', cell: (e) => num3(e.totalCft) },
      { id: 'status', header: t('status'), cell: (e) => <StatusBadge status={e.status} /> },
    ];
    if (isOwner) cols.push({ id: 'by', header: t('createdBy'), from: 'md', cell: (e) => e.createdByName });
    return cols;
  }, [t, isOwner]);

  return (
    <Page>
      <PageHeader
        title={t('exports')}
        actions={
          <>
            <Button asChild>
              <Link to="/exports/new">
                <PlusIcon /> {t('newExport')}
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
          placeholder={t('searchRecords')}
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
        <DataTable
          data={data.items}
          columns={columns}
          rowKey={(e) => e.id}
          rowTo={(e) => `/exports/${e.id}`}
          empty={q ? t('noMatches', { q }) : t('noExports')}
          pager={paging.pager(data.total)}
          busy={loading}
        />
      )}
    </Page>
  );
}

/** Export fields shared by "New Export" and the edit panel. Wood types and loads are suggested from finished stock. */
export function ExportFields({ form, onChange, finished }: { form: ExportForm; onChange: (f: ExportForm) => void; finished: FinishedStockRow[] }) {
  const { t } = useI18n();
  const set = (k: keyof ExportForm) => (e: { target: { value: string } }) => onChange({ ...form, [k]: e.target.value });
  const woods = [...new Set(finished.map((f) => f.woodType))];
  // loads holding finished stock of the chosen wood type (all of them if none chosen yet)
  const loads = new Map<string, string>();
  finished.filter((f) => !form.woodType || f.woodType === form.woodType).forEach((f) => loads.set(f.importLoadId, f.importCode));
  if (form.importLoadId && !loads.has(form.importLoadId)) loads.set(form.importLoadId, '…');

  return (
    <FormGrid>
      <Field id="exp-date" label={`${t('exportDate')} *`}>
        <Input id="exp-date" type="date" value={form.exportDate} onChange={set('exportDate')} required />
      </Field>
      <Field id="exp-lorry" label={`${t('lorryNumber')} *`}>
        <Input
          id="exp-lorry"
          value={form.lorryNumber}
          onChange={set('lorryNumber')}
          required
          minLength={4}
          maxLength={20}
          autoCapitalize="characters"
          placeholder="TN 45 AB 1234"
        />
      </Field>
      <Field id="exp-wood" label={`${t('woodType')} *`} hint={t('exportWoodHint')}>
        <Input id="exp-wood" value={form.woodType} onChange={set('woodType')} required minLength={2} maxLength={60} list="finished-woods" />
        <datalist id="finished-woods">
          {woods.map((w) => (
            <option key={w} value={w} />
          ))}
        </datalist>
      </Field>
      <Field id="exp-load" label={t('defaultLoad')}>
        <Select value={form.importLoadId || ALL} onValueChange={(v) => onChange({ ...form, importLoadId: v === ALL ? '' : v })}>
          <SelectTrigger id="exp-load" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('notSet')}</SelectItem>
            {[...loads].map(([id, code]) => (
              <SelectItem key={id} value={id}>
                {code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field id="exp-driver" label={t('driverName')}>
        <Input id="exp-driver" value={form.driverName} onChange={set('driverName')} maxLength={100} />
      </Field>
      <Field id="exp-driver-mobile" label={t('driverMobile')}>
        <Input id="exp-driver-mobile" value={form.driverMobile} onChange={set('driverMobile')} inputMode="tel" maxLength={15} />
      </Field>
      <Field id="exp-owner" label={t('lorryOwnerName')}>
        <Input id="exp-owner" value={form.lorryOwnerName} onChange={set('lorryOwnerName')} maxLength={100} />
      </Field>
      <Field id="exp-owner-mobile" label={t('lorryOwnerMobile')}>
        <Input id="exp-owner-mobile" value={form.lorryOwnerMobile} onChange={set('lorryOwnerMobile')} inputMode="tel" maxLength={15} />
      </Field>
      <Field id="exp-start" label={t('startTime')}>
        <Input id="exp-start" type="datetime-local" value={form.startAt} onChange={set('startAt')} />
      </Field>
      <Field id="exp-end" label={t('endTime')}>
        <Input id="exp-end" type="datetime-local" value={form.endAt} onChange={set('endAt')} min={form.startAt || undefined} />
      </Field>
      <Field id="exp-notes" label={t('notes')} className="sm:col-span-full">
        <Input id="exp-notes" value={form.notes} onChange={set('notes')} maxLength={1000} />
      </Field>
    </FormGrid>
  );
}

export function NewExportPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const stock = useLoad(() => api<{ finished: FinishedStockRow[] }>('/stock'), []);
  const [form, setForm] = useState(emptyExportForm);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api<{ id: string }>('/exports', { method: 'POST', body: exportBody(form) });
      navigate(`/exports/${created.id}`, { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Page>
      <PageHeader title={t('newExport')} back={{ to: '/exports', label: t('exports') }} />
      <LoadState loading={stock.loading && !stock.data} error={stock.error} onRetry={stock.reload} />
      <FormCard onSubmit={submit}>
        <ExportFields form={form} onChange={setForm} finished={stock.data?.finished ?? []} />
        {error && <Notice tone="error">{error}</Notice>}
        <FormActions>
          <Button asChild variant="ghost">
            <Link to="/exports">{t('cancel')}</Link>
          </Button>
          <Button type="submit" disabled={busy}>
            {t('create')}
          </Button>
        </FormActions>
      </FormCard>
    </Page>
  );
}

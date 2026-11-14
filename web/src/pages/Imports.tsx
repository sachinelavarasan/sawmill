import { PlusIcon, RulerIcon } from 'lucide-react';
import { FormEvent, useId, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '../api';
import { useAuth } from '../auth';
import { dateTime, num3, useApi } from '../components/common';
import { type Column, DataTable, IdCell } from '../components/data-table';
import { StatusBadge } from '../components/status-badge';
import { Field, FormActions, FormCard, FormGrid, LoadState, Notice, Page, PageHeader, SearchBox, StatusFilter, Toolbar, usePaging } from '../components/page';
import { useI18n } from '../i18n';

export interface ImportSummary {
  id: string;
  code: string;
  arrivalAt: string;
  lorryNumber: string;
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


/** `/imports` lists every load; `/measurement` (openOnly) lists the ones still being measured. */
export function ImportsPage({ openOnly = false }: { openOnly?: boolean }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const isOwner = user?.role === 'OWNER';
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const paging = usePaging();
  const query = `take=${paging.take}&skip=${paging.skip}${openOnly ? '&open=1' : status ? `&status=${status}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
  const { data, loading, error, reload } = useApi<{ items: ImportSummary[]; total: number }>(`/imports?${query}`);

  const columns = useMemo(() => {
    const cols: Column<ImportSummary>[] = [
      {
        id: 'code',
        header: t('importId'),
        cell: (l) => (
          <IdCell sub={`${l.lorryNumber} · ${l.woodType}`}>
            <Link className="text-primary hover:underline" to={`/imports/${l.id}`}>
              {l.code}
            </Link>
          </IdCell>
        ),
      },
      { id: 'arrival', header: t('arrival'), from: 'md', className: 'text-muted-foreground', cell: (l) => dateTime(l.arrivalAt) },
      { id: 'lorry', header: t('lorry'), from: 'md', cell: (l) => l.lorryNumber },
      { id: 'wood', header: t('woodType'), from: 'md', cell: (l) => l.woodType },
      { id: 'logs', header: t('logs'), from: 'md', numeric: true, cell: (l) => l.totalLogs },
      { id: 'cft', header: t('totalCft'), numeric: true, className: 'font-semibold', cell: (l) => num3(l.totalCft) },
      { id: 'status', header: t('status'), cell: (l) => <StatusBadge status={l.status} /> },
    ];
    if (isOwner) cols.push({ id: 'by', header: t('createdBy'), from: 'md', cell: (l) => l.createdByName });
    if (openOnly)
      cols.push({
        id: 'measure',
        className: 'text-right',
        cell: (l) => (
          <Button asChild variant="outline" size="sm">
            <Link to={`/imports/${l.id}#logs`} aria-label={t('measure')}>
              <RulerIcon />
              <span className="max-md:sr-only">{t('measure')}</span>
            </Link>
          </Button>
        ),
      });
    return cols;
  }, [t, isOwner, openOnly]);

  return (
    <Page>
      <PageHeader
        title={t(openOnly ? 'measurement' : 'imports')}
        actions={
          <>
            <Button asChild>
              <Link to="/imports/new">
                <PlusIcon /> {t('newImport')}
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
        {!openOnly && (
          <StatusFilter
            value={status}
            onChange={(v) => {
              setStatus(v);
              paging.reset();
            }}
          />
        )}
      </Toolbar>

      <LoadState loading={loading && !data} error={error} onRetry={reload} />

      {data && (
        <DataTable
          data={data.items}
          columns={columns}
          rowKey={(l) => l.id}
          rowTo={(l) => `/imports/${l.id}${openOnly ? '#logs' : ''}`}
          empty={q ? t('noMatches', { q }) : t(openOnly ? 'noOpenLoads' : 'noImports')}
          pager={paging.pager(data.total)}
          busy={loading}
        />
      )}
    </Page>
  );
}

/** The import form fields, shared by "New Import" and the edit panel on the detail page. */
export function ImportFields({ form, onChange }: { form: ImportForm; onChange: (f: ImportForm) => void }) {
  const { t } = useI18n();
  const uid = useId();
  const id = (k: keyof ImportForm) => `${uid}-${k}`;
  const set = (k: keyof ImportForm) => (e: { target: { value: string } }) => onChange({ ...form, [k]: e.target.value });
  return (
    <FormGrid>
      <Field id={id('lorryNumber')} label={`${t('lorryNumber')} *`}>
        <Input id={id('lorryNumber')} value={form.lorryNumber} onChange={set('lorryNumber')} required minLength={4} maxLength={20} autoCapitalize="characters" placeholder="TN 45 AB 1234" />
      </Field>
      <Field id={id('woodType')} label={`${t('woodType')} *`} hint={t('woodTypeHint')}>
        <Input id={id('woodType')} value={form.woodType} onChange={set('woodType')} required minLength={2} maxLength={60} />
      </Field>
      <Field id={id('arrivalAt')} label={t('arrivalDateTime')}>
        <Input id={id('arrivalAt')} type="datetime-local" value={form.arrivalAt} onChange={set('arrivalAt')} required />
      </Field>
      <Field id={id('woodCategory')} label={t('woodCategory')}>
        <Input id={id('woodCategory')} value={form.woodCategory} onChange={set('woodCategory')} maxLength={60} />
      </Field>
      <Field id={id('driverName')} label={t('driverName')}>
        <Input id={id('driverName')} value={form.driverName} onChange={set('driverName')} maxLength={100} />
      </Field>
      <Field id={id('driverMobile')} label={t('driverMobile')}>
        <Input id={id('driverMobile')} value={form.driverMobile} onChange={set('driverMobile')} inputMode="tel" maxLength={15} />
      </Field>
      <Field id={id('lorryOwnerName')} label={t('lorryOwnerName')}>
        <Input id={id('lorryOwnerName')} value={form.lorryOwnerName} onChange={set('lorryOwnerName')} maxLength={100} />
      </Field>
      <Field id={id('lorryOwnerMobile')} label={t('lorryOwnerMobile')}>
        <Input id={id('lorryOwnerMobile')} value={form.lorryOwnerMobile} onChange={set('lorryOwnerMobile')} inputMode="tel" maxLength={15} />
      </Field>
      <Field id={id('originLocation')} label={t('originLocation')}>
        <Input id={id('originLocation')} value={form.originLocation} onChange={set('originLocation')} maxLength={120} />
      </Field>
      <Field id={id('notes')} label={t('notes')} className="sm:col-span-full">
        <Input id={id('notes')} value={form.notes} onChange={set('notes')} maxLength={1000} />
      </Field>
    </FormGrid>
  );
}

export function NewImportPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyImportForm);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api<{ id: string }>('/imports', { method: 'POST', body: importFormBody(form) });
      navigate(`/imports/${created.id}`, { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Page>
      <PageHeader title={t('newImport')} back={{ to: '/imports', label: t('imports') }} />
      <FormCard onSubmit={submit}>
        <ImportFields form={form} onChange={setForm} />
        {error && <Notice tone="error">{error}</Notice>}
        <FormActions>
          <Button asChild variant="ghost">
            <Link to="/imports">{t('cancel')}</Link>
          </Button>
          <Button type="submit" disabled={busy}>
            {t('create')}
          </Button>
        </FormActions>
      </FormCard>
    </Page>
  );
}

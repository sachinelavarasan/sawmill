import { PencilIcon, PlusIcon } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { api } from '../api';
import { useApi } from '../components/common';
import { type Column, DataTable } from '../components/data-table';
import { Field, FormGrid, LoadState, Notice, Page, PageHeader, SearchBox, Toolbar } from '../components/page';
import { TKey, useI18n } from '../i18n';

interface Party {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  gstNumber: string | null;
  notes: string | null;
}

type Form = Record<'name' | 'phone' | 'address' | 'gstNumber' | 'notes', string>;
const blank: Form = { name: '', phone: '', address: '', gstNumber: '', notes: '' };

interface PartyPageProps {
  /** API path: '/suppliers' or '/clients' */
  path: string;
  titleKey: TKey;
  addKey: TKey;
  emptyKey: TKey;
}

/** Owner-only suppliers (picked on an import's purchase details). */
export const SuppliersPage = () => <PartiesPage path="/suppliers" titleKey="suppliers" addKey="addSupplier" emptyKey="noSuppliers" />;
/** Owner-only clients (picked on an export's sale details). */
export const ClientsPage = () => <PartiesPage path="/clients" titleKey="clients" addKey="addClient" emptyKey="noClients" />;

/** The mill's suppliers or clients: same fields, same rules. */
function PartiesPage({ path, titleKey, addKey, emptyKey }: PartyPageProps) {
  const { t } = useI18n();
  const { data, loading, error, reload } = useApi<Party[]>(path);
  // the whole list is loaded, so it is searched and sorted right here
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const needle = q.toLowerCase();
    return needle ? (data ?? []).filter((s) => [s.name, s.phone, s.address, s.gstNumber, s.notes].some((v) => v?.toLowerCase().includes(needle))) : data;
  }, [data, q]);
  // `id: null` = adding a new one
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof Form) => (e: { target: { value: string } }) =>
    setEditing((s) => (s ? { ...s, form: { ...s.form, [k]: e.target.value } } : s));

  const close = () => {
    setEditing(null);
    setFormError(null);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setFormError(null);
    try {
      await api(editing.id ? `${path}/${editing.id}` : path, {
        method: editing.id ? 'PATCH' : 'POST',
        body: JSON.stringify(editing.form),
      });
      setEditing(null);
      reload();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const columns = useMemo(
    (): Column<Party>[] => [
      {
        id: 'name',
        header: t('name'),
        sort: (s) => s.name.toLowerCase(),
        className: 'whitespace-normal',
        cell: (s) => (
          <>
            <div className="font-semibold">{s.name}</div>
            {s.notes && <div className="text-xs text-muted-foreground">{s.notes}</div>}
            <div className="text-xs text-muted-foreground md:hidden">{[s.phone, s.address, s.gstNumber].filter(Boolean).join(' · ')}</div>
          </>
        ),
      },
      { id: 'phone', header: t('mobile'), from: 'md', cell: (s) => s.phone ?? '—' },
      { id: 'address', header: t('address'), from: 'md', sort: (s) => s.address?.toLowerCase(), className: 'max-w-64 whitespace-normal', cell: (s) => s.address ?? '—' },
      { id: 'gst', header: t('gstNumber'), from: 'md', cell: (s) => s.gstNumber ?? '—' },
      {
        id: 'edit',
        className: 'text-right',
        cell: (s) => (
          <Button
            variant="outline"
            size="sm"
            aria-label={t('edit')}
            onClick={() => {
              setFormError(null);
              setEditing({
                id: s.id,
                form: { name: s.name, phone: s.phone ?? '', address: s.address ?? '', gstNumber: s.gstNumber ?? '', notes: s.notes ?? '' },
              });
            }}
          >
            <PencilIcon />
            <span className="max-md:sr-only">{t('edit')}</span>
          </Button>
        ),
      },
    ],
    [t],
  );

  return (
    <Page>
      <PageHeader
        title={t(titleKey)}
        actions={
          <Button onClick={() => setEditing({ id: null, form: blank })}>
            <PlusIcon /> {t(addKey)}
          </Button>
        }
      />

      <LoadState loading={loading && !data} error={error} onRetry={reload} />

      <Dialog open={!!editing} onOpenChange={(open) => !open && close()}>
        {editing && (
          <DialogContent className="sm:max-w-xl">
            <form onSubmit={submit} className="grid gap-4">
              <DialogHeader>
                <DialogTitle>{editing.id ? t('edit') : t(addKey)}</DialogTitle>
              </DialogHeader>
              <FormGrid className="lg:grid-cols-2">
                <Field id="party-name" label={`${t('name')} *`} className="sm:col-span-full">
                  <Input id="party-name" value={editing.form.name} onChange={set('name')} required maxLength={120} autoFocus />
                </Field>
                <Field id="party-phone" label={t('mobile')}>
                  <Input id="party-phone" value={editing.form.phone} onChange={set('phone')} inputMode="tel" maxLength={15} />
                </Field>
                <Field id="party-gst" label={t('gstNumber')}>
                  <Input id="party-gst" value={editing.form.gstNumber} onChange={set('gstNumber')} maxLength={20} />
                </Field>
                <Field id="party-address" label={t('address')} className="sm:col-span-full">
                  <Input id="party-address" value={editing.form.address} onChange={set('address')} maxLength={300} />
                </Field>
                <Field id="party-notes" label={t('notes')} className="sm:col-span-full">
                  <Input id="party-notes" value={editing.form.notes} onChange={set('notes')} maxLength={1000} />
                </Field>
              </FormGrid>
              {formError && <Notice tone="error">{formError}</Notice>}
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={close}>
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={busy}>
                  {t('save')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>

      {data && (
        <>
          {data.length > 0 && (
            <Toolbar>
              <SearchBox value={q} onChange={setQ} placeholder={t('search')} />
            </Toolbar>
          )}
          <DataTable data={shown} columns={columns} rowKey={(s) => s.id} empty={q ? t('noMatches', { q }) : t(emptyKey)} busy={loading} />
        </>
      )}
    </Page>
  );
}

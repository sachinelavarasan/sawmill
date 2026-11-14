import { Permission } from '@sawmill/shared';
import { HandshakeIcon, type LucideIcon, PencilIcon, PhoneIcon, PlusIcon, TruckIcon } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { api } from '../api';
import { useAuth } from '../auth';
import { money2, useApi } from '../components/common';
import { type Column, DataTable } from '../components/data-table';
import { Field, LoadState, Notice, Page, PageHeader, SearchBox } from '../components/page';
import { periodQuery, presets } from '../components/period';
import { TKey, useI18n } from '../i18n';

interface Party {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  gstNumber: string | null;
  notes: string | null;
}
/** One party's line in the accounts summary: what is still owed, over how many approved loads. */
interface Balance {
  id: string | null;
  loads: number;
  balance: number;
}

type Form = Record<'name' | 'phone' | 'address' | 'gstNumber' | 'notes', string>;
const blank: Form = { name: '', phone: '', address: '', gstNumber: '', notes: '' };

interface PartyPageProps {
  /** API path: '/suppliers' or '/clients' */
  path: string;
  titleKey: TKey;
  subKey: TKey;
  addKey: TKey;
  emptyKey: TKey;
  /** the mark each row carries, so the two lists are never mistaken for one another */
  icon: LucideIcon;
  /** which side of the accounts summary holds these parties' balances */
  balances: 'receivables' | 'payables';
}

/** Owner-only suppliers (picked on an import's purchase details). */
export const SuppliersPage = () => <PartiesPage path="/suppliers" titleKey="suppliers" subKey="suppliersSub" addKey="addSupplier" emptyKey="noSuppliers" icon={TruckIcon} balances="payables" />;
/** Owner-only clients (picked on an export's sale details). */
export const ClientsPage = () => <PartiesPage path="/clients" titleKey="clients" subKey="clientsSub" addKey="addClient" emptyKey="noClients" icon={HandshakeIcon} balances="receivables" />;

/** The mill's suppliers or clients: same fields, same rules. */
function PartiesPage({ path, titleKey, subKey, addKey, emptyKey, icon: Icon, balances }: PartyPageProps) {
  const { t } = useI18n();
  const { can } = useAuth();
  const { data, loading, error, reload } = useApi<Party[]>(path);
  // what each party still owes / is owed: the same figures the Accounts page shows, for whoever may see finance.
  // Outstanding balances cover every approved load to date, whatever period is asked for.
  const canFinance = can(Permission.FINANCE_VIEW);
  const summary = useApi<Record<'receivables' | 'payables', Balance[]>>(canFinance ? `/accounts/summary?${periodQuery(presets().thisYear)}` : null);
  const due = useMemo(() => new Map((summary.data?.[balances] ?? []).filter((b) => b.id).map((b) => [b.id as string, b])), [summary.data, balances]);

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

  const add = () => {
    setFormError(null);
    setEditing({ id: null, form: blank });
  };
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

  const columns = useMemo((): Column<Party>[] => {
    const cols: Column<Party>[] = [
      {
        id: 'name',
        header: t('name'),
        sort: (s) => s.name.toLowerCase(),
        className: 'whitespace-normal',
        cell: (s) => (
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary max-sm:hidden" aria-hidden>
              <Icon className="size-[1.125rem]" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <div className="font-semibold">{s.name}</div>
              {s.notes && <div className="max-w-sm text-xs text-muted-foreground">{s.notes}</div>}
              <div className="text-xs text-muted-foreground md:hidden">{[s.phone, s.address, s.gstNumber].filter(Boolean).join(' · ')}</div>
            </div>
          </div>
        ),
      },
      {
        id: 'phone',
        header: t('mobile'),
        from: 'md',
        cell: (s) =>
          s.phone ? (
            <a href={`tel:${s.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 font-medium tabular-nums hover:underline">
              <PhoneIcon className="size-3.5 text-muted-foreground" aria-hidden />
              {s.phone}
            </a>
          ) : (
            '—'
          ),
      },
      { id: 'address', header: t('address'), from: 'md', sort: (s) => s.address?.toLowerCase(), className: 'max-w-64 whitespace-normal', cell: (s) => s.address ?? '—' },
      { id: 'gst', header: t('gstNumber'), from: 'md', className: 'tabular-nums', cell: (s) => s.gstNumber ?? '—' },
    ];
    if (canFinance)
      cols.push({
        id: 'due',
        header: t('balanceDue'),
        numeric: true,
        sort: (s) => due.get(s.id)?.balance ?? 0,
        cell: (s) => {
          const b = due.get(s.id);
          // nothing outstanding (or the figures haven't arrived): a quiet dash, not a zero that reads as a fact
          if (!b || b.balance <= 0) return <span className="text-muted-foreground">—</span>;
          return (
            <>
              <div className={cn('font-semibold', balances === 'receivables' ? 'text-success' : 'text-warning')}>{money2(b.balance)}</div>
              <div className="text-xs text-muted-foreground">{t('loadsCount', { n: b.loads })}</div>
            </>
          );
        },
      });
    cols.push({
      id: 'edit',
      header: <span className="sr-only">{t('actions')}</span>,
      className: 'w-px text-right',
      cell: (s) => (
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          aria-label={`${t('edit')} ${s.name}`}
          title={t('edit')}
          onClick={() => {
            setFormError(null);
            setEditing({
              id: s.id,
              form: { name: s.name, phone: s.phone ?? '', address: s.address ?? '', gstNumber: s.gstNumber ?? '', notes: s.notes ?? '' },
            });
          }}
        >
          <PencilIcon />
        </Button>
      ),
    });
    return cols;
  }, [t, Icon, canFinance, due, balances]);

  return (
    <Page>
      <PageHeader
        title={t(titleKey)}
        subtitle={t(subKey)}
        actions={
          <Button onClick={add}>
            <PlusIcon /> {t(addKey)}
          </Button>
        }
      />

      <LoadState loading={loading && !data} error={error} onRetry={reload} />

      <Dialog open={!!editing} onOpenChange={(open) => !open && !busy && close()}>
        {editing && (
          <DialogContent className="sm:max-w-xl">
            <form onSubmit={submit} className="grid gap-5">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary" aria-hidden>
                    <Icon className="size-4" strokeWidth={1.75} />
                  </span>
                  {editing.id ? `${t('edit')} · ${t(titleKey)}` : t(addKey)}
                </DialogTitle>
                <DialogDescription>{t('requiredNote')}</DialogDescription>
              </DialogHeader>

              <div role="group" aria-labelledby="party-sec-contact" className="grid gap-4 sm:grid-cols-2">
                <h3 id="party-sec-contact" className="text-xs font-semibold tracking-wider text-muted-foreground uppercase sm:col-span-2">
                  {t('secContact')}
                </h3>
                <Field id="party-name" label={t('name')} required className="sm:col-span-2">
                  <Input id="party-name" value={editing.form.name} onChange={set('name')} required maxLength={120} autoFocus />
                </Field>
                <Field id="party-phone" label={t('mobile')}>
                  <Input id="party-phone" type="tel" value={editing.form.phone} onChange={set('phone')} inputMode="tel" maxLength={15} autoComplete="off" className="tabular-nums" />
                </Field>
                <Field id="party-address" label={t('address')} className="sm:col-span-2">
                  <Input id="party-address" value={editing.form.address} onChange={set('address')} maxLength={300} />
                </Field>
              </div>

              <div role="group" aria-labelledby="party-sec-business" className="grid gap-4 border-t border-border/70 pt-5 sm:grid-cols-2">
                <h3 id="party-sec-business" className="text-xs font-semibold tracking-wider text-muted-foreground uppercase sm:col-span-2">
                  {t('secBusiness')}
                </h3>
                <Field id="party-gst" label={t('gstNumber')}>
                  <Input id="party-gst" value={editing.form.gstNumber} onChange={set('gstNumber')} maxLength={20} className="tabular-nums" />
                </Field>
                <Field id="party-notes" label={t('notes')} className="sm:col-span-2">
                  <Textarea id="party-notes" value={editing.form.notes} onChange={set('notes')} maxLength={1000} rows={2} />
                </Field>
              </div>

              {formError && <Notice tone="error">{formError}</Notice>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={close} disabled={busy}>
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
        <DataTable
          data={shown}
          columns={columns}
          rowKey={(s) => s.id}
          busy={loading}
          emptyIcon={<Icon />}
          empty={
            q ? (
              t('noMatches', { q })
            ) : (
              <>
                {t(emptyKey)}
                <span className="mt-4 flex justify-center">
                  <Button size="sm" onClick={add}>
                    <PlusIcon /> {t(addKey)}
                  </Button>
                </span>
              </>
            )
          }
          toolbar={
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <h2 className="flex items-center gap-2 pl-1 text-[0.9375rem] font-semibold">
                {t(titleKey)}
                <span className="min-w-6 rounded-full bg-muted px-2 text-center text-xs leading-6 font-bold text-muted-foreground tabular-nums">{shown?.length ?? 0}</span>
              </h2>
              <SearchBox className="sm:w-72 [&_input]:h-9" value={q} onChange={setQ} placeholder={t('search')} />
            </div>
          }
        />
      )}
    </Page>
  );
}

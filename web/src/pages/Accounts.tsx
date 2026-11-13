import { ArrowDownLeftIcon, ArrowUpRightIcon, PencilIcon, PlusIcon, ReceiptIndianRupeeIcon, Trash2Icon, TrendingUpIcon, WalletIcon } from 'lucide-react';
import { FormEvent, ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { api } from '../api';
import { money, money2, useLoad } from '../components/common';
import { useConfirmDelete } from '../components/confirm';
import { ALL, Field, FormGrid, LoadState, Notice, numCell, OwnerOnly, Page, PageHeader, PagerProps, Section, Stat, StatGrid, TableCard, useClientPaging, usePaging, wide } from '../components/page';
import { PeriodPicker, periodQuery, PeriodValue, presets } from '../components/period';
import { useI18n } from '../i18n';
import { dateOnly } from './Production';

interface Balance {
  id: string | null;
  name: string | null;
  loads: number;
  amount: number;
  balance: number;
  paid?: number;
  received?: number;
}
interface Summary {
  period: PeriodValue;
  pnl: {
    sales: number;
    purchases: number;
    transport: number;
    unloading: number;
    otherExpenses: { category: string; amount: number }[];
    totalOtherExpenses: number;
    totalExpenses: number;
    profit: number;
  };
  payables: Balance[];
  receivables: Balance[];
}
interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  importLoadId: string | null;
  importCode: string | null;
  notes: string | null;
}
interface ExpenseList {
  items: Expense[];
  total: number;
  totalAmount: number;
  categories: string[];
}

const SUGGESTED = ['Labour', 'Electricity', 'Diesel', 'Maintenance', 'Transport', 'Rent', 'Salary'];

/** [OWNER-ONLY] Profit & loss for a period, other expenses, and what is still owed. */
export function AccountsPage() {
  const { t } = useI18n();
  const [period, setPeriod] = useState<PeriodValue>(() => presets().thisMonth);
  const pq = periodQuery(period);
  const summary = useLoad(() => api<Summary>(`/accounts/summary?${pq}`), [pq]);
  const paging = usePaging();
  const expenses = useLoad(() => api<ExpenseList>(`/expenses?${pq}&take=${paging.take}&skip=${paging.skip}`), [pq, paging.take, paging.skip]);
  const reloadAll = () => {
    summary.reload();
    expenses.reload();
  };

  const s = summary.data;
  const toReceive = s?.receivables.reduce((a, r) => a + r.balance, 0) ?? 0;
  const toPay = s?.payables.reduce((a, r) => a + r.balance, 0) ?? 0;

  return (
    <Page>
      <PageHeader title={t('accounts')} badge={<OwnerOnly />} />
      <PeriodPicker
        value={period}
        onChange={(p) => {
          setPeriod(p);
          paging.reset();
        }}
      />

      <LoadState loading={summary.loading && !s} error={summary.error} onRetry={summary.reload} />

      {s && (
        <>
          <StatGrid>
            <Stat
              hero
              icon={<TrendingUpIcon />}
              tone={s.pnl.profit < 0 ? 'bad' : undefined}
              label={t('profitLoss')}
              value={money(s.pnl.profit)}
              hint={`${t('sales')} ${money(s.pnl.sales)} − ${t('totalExpenses')} ${money(s.pnl.totalExpenses)}`}
            />
            <Stat icon={<ReceiptIndianRupeeIcon />} label={t('sales')} value={money(s.pnl.sales)} />
            <Stat icon={<WalletIcon />} label={t('totalExpenses')} value={money(s.pnl.totalExpenses)} />
            <Stat icon={<ArrowDownLeftIcon />} label={t('pendingReceivables')} value={money(toReceive)} tone={toReceive > 0 ? 'warn' : undefined} />
            <Stat icon={<ArrowUpRightIcon />} label={t('pendingPayables')} value={money(toPay)} tone={toPay > 0 ? 'warn' : undefined} />
          </StatGrid>

          <Section title={t('reportPnl')}>
            <Card className="gap-0 py-0">
              <CardContent className="divide-y px-0">
                <PnlLine label={t('sales')} amount={s.pnl.sales} />
                <PnlLine label={t('purchases')} amount={-s.pnl.purchases} />
                <PnlLine label={t('transport')} amount={-s.pnl.transport} />
                <PnlLine label={t('unloadingCharges')} amount={-s.pnl.unloading} />
                {s.pnl.otherExpenses.map((e) => (
                  <PnlLine key={e.category} label={e.category} amount={-e.amount} indent />
                ))}
                <PnlLine label={t('totalExpenses')} amount={-s.pnl.totalExpenses} strong />
                <PnlLine label={t('profitLoss')} amount={s.pnl.profit} strong highlight />
              </CardContent>
            </Card>
          </Section>
        </>
      )}

      <ExpensesSection data={expenses.data} pager={expenses.data ? paging.pager(expenses.data.total) : undefined} loading={expenses.loading} error={expenses.error} onRetry={expenses.reload} onChanged={reloadAll} />

      {s && (
        <Section title={t('balance')}>
          <p className="-mt-2 text-sm text-muted-foreground">{t('outstandingNote')}</p>
          <div className="grid gap-4 lg:grid-cols-2">
            <BalanceTable title={t('pendingReceivables')} rows={s.receivables} partyLabel={t('client')} paidLabel={t('amountReceived')} paidKey="received" noName={t('noClientName')} />
            <BalanceTable title={t('pendingPayables')} rows={s.payables} partyLabel={t('supplier')} paidLabel={t('amountPaid')} paidKey="paid" noName={t('noSupplierName')} />
          </div>
        </Section>
      )}
    </Page>
  );
}

function PnlLine({ label, amount, strong, highlight, indent }: { label: ReactNode; amount: number; strong?: boolean; highlight?: boolean; indent?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-4 px-4 py-2.5 text-sm', strong && 'font-semibold', highlight && 'bg-muted/60 text-base')}>
      <span className={cn(indent && 'pl-4 text-muted-foreground')}>{label}</span>
      <span className={cn('tabular-nums', highlight && (amount < 0 ? 'text-destructive' : 'text-success'))}>{money2(amount)}</span>
    </div>
  );
}

function BalanceTable({
  title,
  rows,
  partyLabel,
  paidLabel,
  paidKey,
  noName,
}: {
  title: string;
  rows: Balance[];
  partyLabel: string;
  paidLabel: string;
  paidKey: 'paid' | 'received';
  noName: string;
}) {
  const { t } = useI18n();
  const total = rows.reduce((a, r) => a + r.balance, 0); // over every row, not just this page
  const paged = useClientPaging(rows, 10);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      <TableCard empty={rows.length === 0} emptyText={t('noOutstanding')} pager={paged.pager}>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="pl-4">{partyLabel}</TableHead>
              <TableHead className={cn(numCell, wide)}>{t('amount')}</TableHead>
              <TableHead className={cn(numCell, wide)}>{paidLabel}</TableHead>
              <TableHead className={cn(numCell, 'pr-4')}>{t('balance')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.rows.map((r) => (
              <TableRow key={r.id ?? 'none'}>
                <TableCell className="pl-4 font-medium whitespace-normal">
                  {r.name ?? <span className="text-muted-foreground">{noName}</span>}
                  <div className="text-xs font-normal text-muted-foreground">{t('loadsCount', { n: r.loads })}</div>
                </TableCell>
                <TableCell className={cn(numCell, wide)}>{money2(r.amount)}</TableCell>
                <TableCell className={cn(numCell, wide)}>{money2(r[paidKey] ?? 0)}</TableCell>
                <TableCell className={cn(numCell, 'pr-4 font-semibold')}>{money2(r.balance)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="pl-4">{t('total')}</TableCell>
              <TableCell className={wide} />
              <TableCell className={wide} />
              <TableCell className={cn(numCell, 'pr-4')}>{money2(total)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </TableCard>
    </div>
  );
}

// ───────── expenses ─────────

interface ExpenseForm {
  id: string | null;
  date: string;
  category: string;
  amount: string;
  importLoadId: string;
  notes: string;
}

function ExpensesSection({
  data,
  pager,
  loading,
  error,
  onRetry,
  onChanged,
}: {
  data: ExpenseList | null;
  pager?: PagerProps;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const confirmDelete = useConfirmDelete();
  const [form, setForm] = useState<ExpenseForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const loads = useLoad(() => (form ? api<{ items: { id: string; code: string; woodType: string }[] }>('/imports?take=200') : Promise.resolve(null)), [!!form]);

  const open = (e?: Expense) => {
    setFormError(null);
    setForm(
      e
        ? { id: e.id, date: e.date, category: e.category, amount: String(e.amount), importLoadId: e.importLoadId ?? '', notes: e.notes ?? '' }
        : { id: null, date: presets().thisMonth.to, category: '', amount: '', importLoadId: '', notes: '' },
    );
  };

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setFormError(null);
    try {
      const body = { date: form.date, category: form.category, amount: Number(form.amount), importLoadId: form.importLoadId || null, notes: form.notes };
      await api(form.id ? `/expenses/${form.id}` : '/expenses', { method: form.id ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      setForm(null);
      onChanged();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const remove = (e: Expense) =>
    confirmDelete().then(async (ok) => {
      if (!ok) return;
      await api(`/expenses/${e.id}`, { method: 'DELETE' });
      onChanged();
    });

  const categories = [...new Set([...(data?.categories ?? []), ...SUGGESTED])];
  const set = (k: keyof ExpenseForm) => (ev: { target: { value: string } }) => setForm((f) => (f ? { ...f, [k]: ev.target.value } : f));

  return (
    <Section
      title={t('otherExpenses')}
      tools={
        <Button size="sm" onClick={() => open()}>
          <PlusIcon /> {t('addExpense')}
        </Button>
      }
    >
      <LoadState loading={loading && !data} error={error} onRetry={onRetry} />
      {data && (
        <TableCard empty={data.items.length === 0} emptyText={t('noExpenses')} pager={pager}>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="pl-4">{t('date')}</TableHead>
                <TableHead>{t('category')}</TableHead>
                <TableHead className={wide}>{t('importId')}</TableHead>
                <TableHead className={wide}>{t('notes')}</TableHead>
                <TableHead className={numCell}>{t('amount')}</TableHead>
                <TableHead className="pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="pl-4 text-muted-foreground">{dateOnly(e.date)}</TableCell>
                  <TableCell className="font-medium">
                    {e.category}
                    {e.notes && <div className="max-w-[12rem] truncate text-xs font-normal text-muted-foreground md:hidden">{e.notes}</div>}
                  </TableCell>
                  <TableCell className={wide}>{e.importCode ?? '—'}</TableCell>
                  <TableCell className={cn(wide, 'max-w-xs truncate text-muted-foreground')} title={e.notes ?? undefined}>
                    {e.notes ?? '—'}
                  </TableCell>
                  <TableCell className={cn(numCell, 'font-semibold')}>{money2(e.amount)}</TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => open(e)} aria-label={t('edit')}>
                        <PencilIcon />
                        <span className="max-md:sr-only">{t('edit')}</span>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(e)} aria-label={t('delete')}>
                        <Trash2Icon />
                        <span className="max-md:sr-only">{t('delete')}</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="pl-4" colSpan={2}>
                  {t('total')}
                </TableCell>
                <TableCell className={wide} />
                <TableCell className={wide} />
                <TableCell className={numCell}>{money2(data.totalAmount)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </TableCard>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && !busy && setForm(null)}>
        <DialogContent className="sm:max-w-lg">
          {form && (
            <form onSubmit={save} className="grid gap-4">
              <DialogHeader>
                <DialogTitle>{form.id ? t('editExpense') : t('addExpense')}</DialogTitle>
              </DialogHeader>
              <FormGrid className="sm:grid-cols-2 lg:grid-cols-2">
                <Field id="exp-date" label={`${t('date')} *`}>
                  <Input id="exp-date" type="date" value={form.date} onChange={set('date')} required />
                </Field>
                <Field id="exp-amount" label={`${t('amount')} *`}>
                  <Input id="exp-amount" type="number" min={0.01} step="0.01" inputMode="decimal" value={form.amount} onChange={set('amount')} required />
                </Field>
                <Field id="exp-category" label={`${t('category')} *`} hint={t('categoryHint')} className="sm:col-span-2">
                  <Input id="exp-category" list="expense-categories" value={form.category} onChange={set('category')} required minLength={2} maxLength={60} />
                  <datalist id="expense-categories">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </Field>
                <Field label={t('importId')} hint={t('expenseLoadHint')} className="sm:col-span-2">
                  <Select value={form.importLoadId || ALL} onValueChange={(v) => setForm({ ...form, importLoadId: v === ALL ? '' : v })}>
                    <SelectTrigger className="w-full" aria-label={t('importId')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>{t('notSet')}</SelectItem>
                      {loads.data?.items.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.code} · {l.woodType}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="exp-notes" label={t('notes')} className="sm:col-span-2">
                  <Input id="exp-notes" value={form.notes} onChange={set('notes')} maxLength={1000} />
                </Field>
              </FormGrid>
              {formError && <Notice tone="error">{formError}</Notice>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setForm(null)} disabled={busy}>
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={busy}>
                  {t('save')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Section>
  );
}

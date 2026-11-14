import { ArrowDownLeftIcon, ArrowUpRightIcon, PencilIcon, PlusIcon, Trash2Icon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react';
import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { api } from '../api';
import { ChartCard, StackedBars } from '../components/charts';
import { money, money2, useLoad } from '../components/common';
import { useConfirmDelete } from '../components/confirm';
import { ALL, Field, FormGrid, LoadState, Notice, numCell, OwnerOnly, Page, PageHeader, PagerProps, Section, Stat, StatGrid, TableCard, useClientPaging, usePaging, wide } from '../components/page';
import { PeriodPicker, periodQuery, PeriodValue, presets } from '../components/period';
import { useToast } from '../components/toast';
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

const shortDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** [OWNER-ONLY] Profit & loss for a period, other expenses, and what is still owed. */
export function AccountsPage() {
  const { t } = useI18n();
  const [period, setPeriod] = useState<PeriodValue>(() => presets().thisMonth);
  const [category, setCategory] = useState('');
  const pq = periodQuery(period);
  const summary = useLoad(() => api<Summary>(`/accounts/summary?${pq}`), [pq]);
  const paging = usePaging();
  const cq = category ? `&category=${encodeURIComponent(category)}` : '';
  const expenses = useLoad(() => api<ExpenseList>(`/expenses?${pq}${cq}&take=${paging.take}&skip=${paging.skip}`), [pq, cq, paging.take, paging.skip]);
  const reloadAll = () => {
    summary.reload();
    expenses.reload();
  };

  const s = summary.data;
  const toReceive = s?.receivables.reduce((a, r) => a + r.balance, 0) ?? 0;
  const toPay = s?.payables.reduce((a, r) => a + r.balance, 0) ?? 0;

  // every cost of the period as one list, largest first, for the breakdown chart
  const costs = s
    ? [
        { label: t('purchases'), amount: s.pnl.purchases },
        { label: t('transport'), amount: s.pnl.transport },
        { label: t('unloadingCharges'), amount: s.pnl.unloading },
        ...s.pnl.otherExpenses.map((e) => ({ label: e.category, amount: e.amount })),
      ]
        .filter((c) => c.amount > 0)
        .sort((x, y) => y.amount - x.amount)
    : [];
  const COST = { key: 'amount', label: t('totalExpenses'), color: 'var(--chart-2)' };

  return (
    <Page>
      <PageHeader title={t('accounts')} badge={<OwnerOnly />} subtitle={t('accountsSub')} />

      {/* the period everything below (except the balances) is worked out for */}
      <Card className="gap-3 py-5">
        <CardContent className="flex flex-col gap-4 px-5 sm:px-6">
          <PeriodPicker
            className="w-full"
            value={period}
            onChange={(p) => {
              setPeriod(p);
              setCategory('');
              paging.reset();
            }}
          />
          <p className="text-sm text-muted-foreground">
            {t('period')}:{' '}
            <span className="font-semibold text-foreground tabular-nums">
              {shortDate(period.from)} – {shortDate(period.to)}
            </span>
          </p>
        </CardContent>
      </Card>

      <LoadState loading={summary.loading && !s} error={summary.error} onRetry={summary.reload} />

      {s && (
        <>
          {/* income − expenses = profit, read left to right */}
          <StatGrid>
            <Stat icon={<ArrowDownLeftIcon />} iconTone="good" label={t('sales')} value={money(s.pnl.sales)} hint={t('income')} />
            <Stat icon={<ArrowUpRightIcon />} iconTone="bad" label={t('totalExpenses')} value={money(s.pnl.totalExpenses)} hint={t('expensesHead')} />
            <Stat
              hero
              icon={s.pnl.profit < 0 ? <TrendingDownIcon /> : <TrendingUpIcon />}
              tone={s.pnl.profit < 0 ? 'bad' : undefined}
              label={t(s.pnl.profit < 0 ? 'netLoss' : 'netProfit')}
              value={money(s.pnl.profit)}
              hint={`${t('sales')} ${money(s.pnl.sales)} − ${t('totalExpenses')} ${money(s.pnl.totalExpenses)}`}
            />
          </StatGrid>

          <div className="grid items-start gap-5 lg:grid-cols-5">
            <Section title={t('reportPnl')} className="lg:col-span-3">
              <Card className="gap-0 overflow-hidden py-0">
                <CardContent className="px-0">
                  <PnlGroup title={t('income')} />
                  <PnlLine label={t('sales')} amount={s.pnl.sales} />
                  <PnlGroup title={t('expensesHead')} />
                  <PnlLine label={t('purchases')} amount={-s.pnl.purchases} />
                  <PnlLine label={t('transport')} amount={-s.pnl.transport} />
                  <PnlLine label={t('unloadingCharges')} amount={-s.pnl.unloading} />
                  <PnlLine label={t('otherExpenses')} amount={-s.pnl.totalOtherExpenses} />
                  {s.pnl.otherExpenses.map((e) => (
                    <PnlLine key={e.category} label={e.category} amount={-e.amount} indent />
                  ))}
                  <PnlLine label={t('totalExpenses')} amount={-s.pnl.totalExpenses} strong />
                  <PnlLine label={t(s.pnl.profit < 0 ? 'netLoss' : 'netProfit')} amount={s.pnl.profit} strong highlight />
                </CardContent>
              </Card>
            </Section>
            <Section title={t('expenseBreakdown')} className="lg:col-span-2">
              <ChartCard
                title={t('totalExpenses')}
                subtitle={t('expenseBreakdownSub')}
                empty={costs.length === 0}
                table={{ columns: [t('category'), t('amount')], rows: costs.map((c) => [c.label, money2(c.amount)]) }}
              >
                <StackedBars rows={costs.map((c) => ({ label: c.label, values: { amount: c.amount } }))} series={[COST]} formatValue={money} ariaLabel={t('expenseBreakdown')} />
              </ChartCard>
            </Section>
          </div>
        </>
      )}

      <ExpensesSection
        data={expenses.data}
        pager={expenses.data ? paging.pager(expenses.data.total) : undefined}
        loading={expenses.loading}
        error={expenses.error}
        onRetry={expenses.reload}
        onChanged={reloadAll}
        category={category}
        onCategory={(c) => {
          setCategory(c);
          paging.reset();
        }}
      />

      {s && (
        <Section title={t('outstandingBalances')}>
          <p className="-mt-2 text-sm text-muted-foreground">{t('outstandingNote')}</p>
          <div className="grid grid-cols-1 items-start gap-5 min-[1400px]:grid-cols-2">
            <BalanceTable
              title={t('pendingReceivables')}
              icon={<ArrowDownLeftIcon />}
              tone="in"
              total={toReceive}
              rows={s.receivables}
              partyLabel={t('client')}
              paidLabel={t('amountReceived')}
              paidKey="received"
              noName={t('noClientName')}
            />
            <BalanceTable
              title={t('pendingPayables')}
              icon={<ArrowUpRightIcon />}
              tone="out"
              total={toPay}
              rows={s.payables}
              partyLabel={t('supplier')}
              paidLabel={t('amountPaid')}
              paidKey="paid"
              noName={t('noSupplierName')}
            />
          </div>
        </Section>
      )}
    </Page>
  );
}

/** A heading row inside the statement: Income, Expenses. */
function PnlGroup({ title }: { title: string }) {
  return <div className="border-b border-border/70 px-5 pt-5 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase not-first:border-t sm:px-6">{title}</div>;
}

function PnlLine({ label, amount, strong, highlight, indent }: { label: ReactNode; amount: number; strong?: boolean; highlight?: boolean; indent?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 px-5 py-3 text-sm not-last:border-b not-last:border-border/70 sm:px-6',
        strong && 'font-semibold',
        indent && 'py-1.5 text-[0.8125rem]',
        highlight && 'bg-muted/50 py-4 text-base',
      )}
    >
      <span className={cn(indent && 'pl-5 text-muted-foreground')}>{label}</span>
      <span className={cn('tabular-nums', indent && 'text-muted-foreground', highlight && 'text-xl font-semibold', highlight && (amount < 0 ? 'text-destructive' : 'text-success'))}>{money2(amount)}</span>
    </div>
  );
}

function BalanceTable({
  title,
  icon,
  tone,
  total,
  rows,
  partyLabel,
  paidLabel,
  paidKey,
  noName,
}: {
  title: string;
  icon: ReactNode;
  /** money owed to the mill (green) or by it (amber) */
  tone: 'in' | 'out';
  /** the sum of every row's balance, not just this page */
  total: number;
  rows: Balance[];
  partyLabel: string;
  paidLabel: string;
  paidKey: 'paid' | 'received';
  noName: string;
}) {
  const { t } = useI18n();
  const paged = useClientPaging(rows, 10);
  return (
    <TableCard
      empty={rows.length === 0}
      emptyText={t('noOutstanding')}
      compactEmpty
      pager={paged.pager}
      toolbar={
        <div className="flex items-center gap-3">
          <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg [&_svg]:size-[1.125rem]', total > 0 ? (tone === 'in' ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning') : 'bg-muted text-muted-foreground')} aria-hidden>
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm leading-snug font-semibold">{title}</h3>
            <div className="text-xs text-muted-foreground">{t('totalDue')}</div>
          </div>
          <div className={cn('text-xl font-semibold tabular-nums', total > 0 && (tone === 'in' ? 'text-success' : 'text-warning'))}>{money2(total)}</div>
        </div>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
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
              <TableCell className={cn(numCell, wide, 'text-muted-foreground')}>{money2(r[paidKey] ?? 0)}</TableCell>
              <TableCell className={cn(numCell, 'pr-4 font-semibold')}>{money2(r.balance)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCard>
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
  category,
  onCategory,
}: {
  data: ExpenseList | null;
  pager?: PagerProps;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onChanged: () => void;
  /** the category the list is filtered to ('' = all) */
  category: string;
  onCategory: (c: string) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const confirmDelete = useConfirmDelete();
  const [deleteError, setDeleteError] = useState<string | null>(null);
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

  // linked from a "Record expense" shortcut: open the form straight away, once, then tidy the address
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (params.get('new') !== 'expense') return;
    open();
    const next = new URLSearchParams(params);
    next.delete('new');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setFormError(null);
    try {
      const body = { date: form.date, category: form.category, amount: Number(form.amount), importLoadId: form.importLoadId || null, notes: form.notes };
      await api(form.id ? `/expenses/${form.id}` : '/expenses', { method: form.id ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      setForm(null);
      toast(t('saved'));
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
      setDeleteError(null);
      try {
        await api(`/expenses/${e.id}`, { method: 'DELETE' });
        toast(t('expenseDeleted'), 'info');
        onChanged();
      } catch (err) {
        setDeleteError((err as Error).message);
      }
    });

  const categories = [...new Set([...(data?.categories ?? []), ...SUGGESTED])];
  const set = (k: keyof ExpenseForm) => (ev: { target: { value: string } }) => setForm((f) => (f ? { ...f, [k]: ev.target.value } : f));

  return (
    <Section
      title={t('otherExpenses')}
      tools={
        <div className="flex flex-wrap items-center gap-2">
          <Select value={category || ALL} onValueChange={(v) => onCategory(v === ALL ? '' : v)}>
            <SelectTrigger className="h-10 w-52 max-sm:w-44" aria-label={t('category')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('allCategories')}</SelectItem>
              {/* the chosen one stays listed even if the answer for it comes back empty */}
              {[...new Set([...(data?.categories ?? []), ...(category ? [category] : [])])].map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="h-10" onClick={() => open()}>
            <PlusIcon /> {t('addExpense')}
          </Button>
        </div>
      }
    >
      <LoadState loading={loading && !data} error={error} onRetry={onRetry} />
      {deleteError && <Notice tone="error">{deleteError}</Notice>}
      {data && (
        <TableCard empty={data.items.length === 0} emptyText={t('noExpenses')} pager={pager} busy={loading}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={cn(wide, 'pl-4')}>{t('date')}</TableHead>
                <TableHead className="max-md:pl-4">{t('category')}</TableHead>
                <TableHead className={wide}>{t('importId')}</TableHead>
                <TableHead className={wide}>{t('notes')}</TableHead>
                <TableHead className={numCell}>{t('amount')}</TableHead>
                <TableHead className="pr-4">
                  <span className="sr-only">{t('actions')}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className={cn(wide, 'pl-4 text-muted-foreground tabular-nums')}>{dateOnly(e.date)}</TableCell>
                  <TableCell className="max-md:pl-4">
                    <span className="inline-block max-w-40 truncate rounded-md bg-muted px-2 py-0.5 align-middle text-[0.8125rem] font-medium">{e.category}</span>
                    {/* on phones the date and the note fold in here */}
                    <div className="mt-1 max-w-[7.5rem] truncate text-xs font-normal text-muted-foreground md:hidden">
                      {dateOnly(e.date)}
                      {e.notes && ` · ${e.notes}`}
                    </div>
                  </TableCell>
                  <TableCell className={wide}>
                    {e.importLoadId && e.importCode ? (
                      <Link className="font-medium text-primary hover:underline" to={`/imports/${e.importLoadId}`}>
                        {e.importCode}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className={cn(wide, 'max-w-xs truncate text-muted-foreground')} title={e.notes ?? undefined}>
                    {e.notes ?? '—'}
                  </TableCell>
                  <TableCell className={cn(numCell, 'font-semibold')}>{money2(e.amount)}</TableCell>
                  <TableCell className="w-px pr-4">
                    <div className="flex justify-end gap-1">
                      <Button size="icon-sm" variant="ghost" className="text-muted-foreground" onClick={() => open(e)} aria-label={`${t('edit')} ${e.category} ${dateOnly(e.date)}`} title={t('edit')}>
                        <PencilIcon />
                      </Button>
                      <Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => remove(e)} aria-label={`${t('delete')} ${e.category} ${dateOnly(e.date)}`} title={t('delete')}>
                        <Trash2Icon />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell className={cn(wide, 'pl-4 font-semibold')}>{t('total')}</TableCell>
                <TableCell className="font-semibold max-md:pl-4">
                  <span className="md:hidden">{t('total')}</span>
                  {category && (
                    <span className="font-normal text-muted-foreground">
                      <span className="md:hidden"> · </span>
                      {category}
                    </span>
                  )}
                </TableCell>
                <TableCell className={wide} />
                <TableCell className={wide} />
                <TableCell className={cn(numCell, 'text-base font-bold')}>{money2(data.totalAmount)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </TableCard>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && !busy && setForm(null)}>
        <DialogContent className="sm:max-w-lg">
          {form && (
            <form onSubmit={save} className="grid gap-5">
              <DialogHeader>
                <DialogTitle>{form.id ? t('editExpense') : t('addExpense')}</DialogTitle>
                <DialogDescription>{t('requiredNote')}</DialogDescription>
              </DialogHeader>
              <FormGrid className="sm:grid-cols-2 lg:grid-cols-2">
                <Field id="exp-date" label={t('date')} required>
                  <Input id="exp-date" type="date" value={form.date} onChange={set('date')} required />
                </Field>
                <Field id="exp-amount" label={t('amount')} required>
                  <Input id="exp-amount" type="number" min={0.01} step="0.01" inputMode="decimal" value={form.amount} onChange={set('amount')} required className="text-right font-semibold tabular-nums" />
                </Field>
                <Field id="exp-category" label={t('category')} required className="sm:col-span-2">
                  <Input id="exp-category" list="expense-categories" value={form.category} onChange={set('category')} required minLength={2} maxLength={60} />
                  <datalist id="expense-categories">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                  {/* one press instead of typing: the categories used before, then the usual ones */}
                  <div role="group" aria-label={t('commonCategories')} className="flex flex-wrap gap-1.5 pt-0.5">
                    {categories.slice(0, 8).map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={form.category === c}
                        onClick={() => setForm({ ...form, category: c })}
                        className={cn(
                          'rounded-md border px-2 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          form.category === c ? 'border-transparent bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground',
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
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
                  <Textarea id="exp-notes" value={form.notes} onChange={set('notes')} maxLength={1000} rows={2} className="bg-card" />
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

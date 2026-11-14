/**
 * App-level building blocks on top of shadcn/ui (src/components/ui).
 * Pages compose these + shadcn components + Tailwind classes; nothing else.
 */
import { ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon, InboxIcon, LockIcon, SearchIcon, XIcon } from 'lucide-react';
import { MouseEvent, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { TKey, useI18n } from '../i18n';

/** Table column shown only from the md breakpoint up. */
export const wide = 'hidden md:table-cell';
/** Right-aligned, tabular figures. */
export const numCell = 'text-right tabular-nums';
/** Radix Select can't hold an empty value, so "no filter" is this sentinel. */
export const ALL = 'all';

// ───────── page frame ─────────

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  // each page fades and rises in as it opens
  return <div className={cn('mx-auto flex w-full min-w-0 max-w-6xl animate-in flex-col gap-5 duration-300 ease-out fade-in-0 slide-in-from-bottom-2', className)}>{children}</div>;
}

export function PageHeader({
  title,
  back,
  subtitle,
  badge,
  actions,
}: {
  title: ReactNode;
  /** small "← Imports" link above the title */
  back?: { to: string; label: string };
  subtitle?: ReactNode;
  /** e.g. a StatusBadge next to the title */
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back && (
          <Link to={back.to} className="mb-2 -ml-2 inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ChevronLeftIcon className="size-4" />
            {back.label}
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[1.7rem] leading-tight font-bold tracking-tight">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A titled block inside a page, with optional tools (buttons) on the right. */
export function Section({ title, tools, children, id, className }: { title: ReactNode; tools?: ReactNode; children: ReactNode; id?: string; className?: string }) {
  return (
    <section id={id} className={cn('flex scroll-mt-20 flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">{title}</h2>
        {tools}
      </div>
      {children}
    </section>
  );
}

/** "Owner only" tag shown next to restricted section titles. */
export function OwnerOnly() {
  const { t } = useI18n();
  return (
    <span className="inline-flex w-fit shrink-0 items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-warning">
      <LockIcon className="size-3" />
      {t('ownerOnly')}
    </span>
  );
}

// ───────── stats ─────────

export type Tone = 'good' | 'warn' | 'bad';
const toneText: Record<Tone, string> = { good: 'text-success', warn: 'text-warning', bad: 'text-destructive' };

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', className)}>{children}</div>;
}

/** A KPI card. `hero` = wide, filled card for the one number that matters most. */
export function Stat({
  label,
  value,
  unit,
  hint,
  icon,
  tone,
  hero,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  hero?: boolean;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        'gap-2 py-5',
        hero && 'col-span-2 border-transparent shadow-lift',
        // in dark mode --primary is a light grey, too bright for a large block: use the soft slate instead
        hero && (tone === 'bad' ? 'bg-destructive-soft text-destructive' : 'bg-primary text-primary-foreground dark:bg-primary-soft dark:text-foreground'),
        className,
      )}
    >
      {/* kept plain: a label and a number. Only the hero card shows its icon; a toned card gets a dot. */}
      <CardHeader className="flex flex-row items-center gap-2 px-5">
        {tone && !hero && <span className={cn('size-2 shrink-0 rounded-full bg-current', toneText[tone])} />}
        <CardDescription className={cn('flex-1 font-medium', hero && 'text-current opacity-85')}>{label}</CardDescription>
        {icon && hero && <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/15 [&_svg]:size-[1.125rem]">{icon}</span>}
      </CardHeader>
      <CardContent className="px-5">
        <div className={cn('leading-tight font-bold tracking-tight tabular-nums', hero ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-[1.7rem]', tone && !hero && toneText[tone])}>
          {value}
          {unit && <span className={cn('ml-1 text-sm font-medium', hero ? 'opacity-80' : 'text-muted-foreground')}>{unit}</span>}
        </div>
        {hint && <div className={cn('mt-0.5 text-sm', hero ? 'opacity-80' : 'text-muted-foreground')}>{hint}</div>}
      </CardContent>
    </Card>
  );
}

/** Several small figures in one card, side by side — for numbers that don't each need a card. */
export function FigureStrip({ items, className }: { items: { label: ReactNode; value: ReactNode; tone?: Tone }[]; className?: string }) {
  return (
    <Card className={cn('grid grid-cols-2 gap-px overflow-hidden bg-border py-0 lg:grid-cols-4', className)}>
      {items.map((it, i) => (
        <div key={i} className="bg-card px-5 py-4">
          <div className="text-sm text-muted-foreground">{it.label}</div>
          <div className={cn('text-xl leading-tight font-bold tabular-nums', it.tone && toneText[it.tone])}>{it.value}</div>
        </div>
      ))}
    </Card>
  );
}

// ───────── feedback ─────────

const noticeTone = {
  info: 'bg-muted text-muted-foreground',
  ok: 'bg-success-soft text-success',
  warn: 'bg-warning-soft text-warning',
  error: 'bg-destructive-soft text-destructive',
} as const;

/** One-line message strip. */
export function Notice({ tone = 'info', children, className }: { tone?: keyof typeof noticeTone; children: ReactNode; className?: string }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex flex-wrap items-center gap-3 rounded-xl border border-current/15 px-4 py-2.5 text-sm', noticeTone[tone], className)}>
      {children}
    </div>
  );
}

/** Loading skeleton / error with retry, for useLoad results. Renders nothing once loaded. */
export function LoadState({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry: () => void }) {
  const { t } = useI18n();
  if (error)
    return (
      <Notice tone="error">
        {t('error')}: {error}
        <Button size="sm" variant="outline" onClick={onRetry}>
          {t('retry')}
        </Button>
      </Notice>
    );
  if (loading)
    return (
      <div className="flex flex-col gap-3" aria-label={t('loading')}>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  return null;
}

// ───────── tables ─────────

/** A card holding a table, or an empty message. */
export function TableCard({
  empty,
  emptyText,
  emptyIcon,
  compactEmpty,
  children,
  className,
  pager,
}: {
  empty?: boolean;
  emptyText?: ReactNode;
  /** defaults to an inbox */
  emptyIcon?: ReactNode;
  /** one quiet line instead of the big empty box — for a section inside a longer page */
  compactEmpty?: boolean;
  children: ReactNode;
  className?: string;
  /** page controls shown as the card's footer (from usePaging / useClientPaging) */
  pager?: PagerProps;
}) {
  return (
    <Card className={cn('gap-0 overflow-hidden py-0', className)}>
      {empty && compactEmpty ? (
        <div className="flex items-center gap-2.5 px-4 py-4 text-sm text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0">
          {emptyIcon ?? <InboxIcon />}
          {emptyText}
        </div>
      ) : empty ? (
        <div className="flex flex-col items-center gap-3 px-4 py-14 text-center text-sm text-muted-foreground">
          <span className="grid size-12 place-items-center rounded-2xl bg-muted [&_svg]:size-6">{emptyIcon ?? <InboxIcon />}</span>
          {emptyText}
        </div>
      ) : (
        <>
          {children}
          {pager && <Pager {...pager} className="border-t bg-muted/30 px-4 py-2" />}
        </>
      )}
    </Card>
  );
}

// ───────── list toolbar ─────────

/** The row above a list: search on the left, filters on the right. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2 print:hidden', className)}>{children}</div>;
}

/**
 * Search box that reports its text 300 ms after typing stops (one API call, not one per key).
 * Esc or the × clears it.
 */
export function SearchBox({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  const { t } = useI18n();
  const [text, setText] = useState(value);
  const latest = useRef(onChange);
  latest.current = onChange;
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (text.trim() === value.trim()) return;
    const id = setTimeout(() => latest.current(text.trim()), 300);
    return () => clearTimeout(id);
  }, [text, value]);
  return (
    <div className={cn('relative w-full sm:w-72', className)}>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setText('')}
        placeholder={placeholder}
        aria-label={t('search')}
        maxLength={60}
        className="bg-card pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button
          type="button"
          onClick={() => setText('')}
          aria-label={t('clear')}
          className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * A table row that opens a record when clicked anywhere. The record ID inside stays a
 * real link (keyboard, screen readers, open in new tab); clicks on buttons, links and
 * inputs in the row, or while selecting text, keep their own behaviour.
 */
export function LinkRow({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  const navigate = useNavigate();
  const open = (e: MouseEvent<HTMLTableRowElement>) => {
    if ((e.target as HTMLElement).closest('a, button, input, select, textarea, label, [role="combobox"]')) return;
    if (window.getSelection()?.toString()) return;
    if (e.metaKey || e.ctrlKey) window.open(to, '_blank', 'noopener');
    else navigate(to);
  };
  return (
    <TableRow onClick={open} className={cn('cursor-pointer', className)}>
      {children}
    </TableRow>
  );
}

// ───────── pagination ─────────

export const PAGE_SIZES = [10, 25, 50, 100] as const;

export interface PagerProps {
  skip: number;
  page: number;
  total: number;
  onSkip: (skip: number) => void;
  /** offer the rows-per-page choice */
  onPageSize?: (size: number) => void;
  className?: string;
}

/** "Rows per page · 26–50 of 120 · |< < Page 2 of 5 > >|". Hidden when everything fits on the smallest page. */
export function Pager({ skip, page, total, onSkip, onPageSize, className }: PagerProps) {
  const { t } = useI18n();
  if (total <= (onPageSize ? PAGE_SIZES[0] : page)) return null;
  const pages = Math.max(1, Math.ceil(total / page));
  const current = Math.floor(skip / page) + 1;
  const go = (n: number) => onSkip((Math.min(Math.max(n, 1), pages) - 1) * page);
  const nav = (label: string, icon: ReactNode, target: number, disabled: boolean, extra?: string) => (
    <Button variant="outline" size="icon-sm" className={cn('bg-card', extra)} disabled={disabled} onClick={() => go(target)} aria-label={label} title={label}>
      {icon}
    </Button>
  );
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm print:hidden', className)}>
      <div className="flex items-center gap-3 text-muted-foreground">
        {onPageSize && (
          <div className="flex items-center gap-2">
            <span className="max-sm:hidden">{t('rowsPerPage')}</span>
            <Select value={String(page)} onValueChange={(v) => onPageSize(Number(v))}>
              <SelectTrigger size="sm" className="w-[4.5rem] bg-card" aria-label={t('rowsPerPage')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <span className="tabular-nums">{t('rangeOf', { from: skip + 1, to: Math.min(skip + page, total), total })}</span>
      </div>
      <div className="flex items-center gap-1">
        {nav(t('firstPage'), <ChevronsLeftIcon />, 1, current <= 1, 'max-sm:hidden')}
        {nav(t('previous'), <ChevronLeftIcon />, current - 1, current <= 1)}
        <span className="px-2 tabular-nums text-muted-foreground" aria-live="polite">
          {t('pageOf', { page: current, pages })}
        </span>
        {nav(t('next'), <ChevronRightIcon />, current + 1, current >= pages)}
        {nav(t('lastPage'), <ChevronsRightIcon />, pages, current >= pages, 'max-sm:hidden')}
      </div>
    </div>
  );
}

/**
 * Page position and size for a list the server pages (?take=&skip=).
 * Call reset() when a filter changes, so the list starts again at page 1.
 */
export function usePaging(initialSize: number = 25) {
  const [skip, setSkip] = useState(0);
  const [take, setTake] = useState(initialSize);
  const reset = useCallback(() => setSkip(0), []);
  const pager = (total: number): PagerProps => ({
    skip,
    page: take,
    total,
    onSkip: setSkip,
    onPageSize: (n) => {
      setTake(n);
      setSkip(0);
    },
  });
  return { skip, take, reset, pager };
}

/** Pages through rows that are already loaded (lists the server returns whole). */
export function useClientPaging<T>(rows: readonly T[], initialSize: number = 25) {
  const p = usePaging(initialSize);
  // stay on a real page when rows disappear (filter, delete)
  const skip = Math.min(p.skip, rows.length ? Math.floor((rows.length - 1) / p.take) * p.take : 0);
  return { rows: rows.slice(skip, skip + p.take), pager: { ...p.pager(rows.length), skip }, reset: p.reset, skip };
}

const STATUSES: [string, TKey][] = [
  ['DRAFT', 'draft'],
  ['SUBMITTED', 'pending'],
  ['APPROVED', 'approved'],
  ['REJECTED', 'rejected'],
];

/** Approval-status filter for list pages. `value` '' = all. */
export function StatusFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  return (
    <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? '' : v)}>
      <SelectTrigger className="w-40 bg-card" aria-label={t('status')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{t('allStatuses')}</SelectItem>
        {STATUSES.map(([v, k]) => (
          <SelectItem key={v} value={v}>
            {t(k)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ───────── forms ─────────

/** Label + control (+ hint), stacked. */
export function Field({ id, label, hint, className, children }: { id?: string; label: ReactNode; hint?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={cn('grid min-w-0 content-start gap-1.5', className)}>
      <Label htmlFor={id} className="text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** Responsive grid of Fields; use `className="sm:col-span-full"` on a Field to make it full width. */
export function FormGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>{children}</div>;
}

/** Bottom row of a form: optional summary on the left, buttons on the right (stacked on phones). */
export function FormActions({ summary, children }: { summary?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
      {summary ? <div className="text-sm text-muted-foreground sm:mr-auto">{summary}</div> : <div className="sm:mr-auto" />}
      {children}
    </div>
  );
}

/** A form inside a card. */
export function FormCard({ title, children, onSubmit, className }: { title?: ReactNode; children: ReactNode; onSubmit: (e: React.FormEvent) => void; className?: string }) {
  return (
    <Card className={cn('py-5', className)}>
      <CardContent className="px-5">
        <form onSubmit={onSubmit} className="grid gap-4">
          {title && <h3 className="text-base font-semibold">{title}</h3>}
          {children}
        </form>
      </CardContent>
    </Card>
  );
}

// ───────── fast numeric entry (log / size / line measurement) ─────────

/**
 * The big-number entry row used on the mill floor: large inputs, a live result,
 * and a save button, all reachable with the keyboard. Children are EntryFields.
 */
export function EntryRow({
  children,
  result,
  resultLabel,
  submitLabel,
  submitDisabled,
  onSubmit,
  className,
}: {
  children: ReactNode;
  result: ReactNode;
  resultLabel: ReactNode;
  submitLabel: ReactNode;
  submitDisabled?: boolean;
  onSubmit: (e: React.FormEvent) => void;
  className?: string;
}) {
  return (
    <Card className={cn('py-4', className)}>
      <CardContent className="px-4">
        <form onSubmit={onSubmit} className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
          {children}
          <div className="flex flex-col gap-1.5 sm:min-w-24">
            <span className="text-xs text-muted-foreground">{resultLabel}</span>
            <strong className="text-2xl leading-[3rem] font-bold text-warning tabular-nums">{result}</strong>
          </div>
          <Button type="submit" size="lg" className="h-12 sm:flex-1 sm:basis-36" disabled={submitDisabled}>
            {submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/** A labelled large numeric input for EntryRow. */
export function EntryField({ label, className, inputRef, ...props }: { label: ReactNode; className?: string; inputRef?: React.Ref<HTMLInputElement> } & React.ComponentProps<typeof Input>) {
  return (
    <label className={cn('flex min-w-0 flex-col gap-1.5 sm:flex-1 sm:basis-28', className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input ref={inputRef} type="number" className="h-12 text-xl font-bold tabular-nums md:text-xl" {...props} />
    </label>
  );
}

/** A big static figure inside EntryRow (e.g. the next log number). */
export function EntryFigure({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <strong className="text-2xl leading-[3rem] font-bold tabular-nums">{children}</strong>
    </div>
  );
}

/**
 * App-level building blocks on top of shadcn/ui (src/components/ui).
 * Pages compose these + shadcn components + Tailwind classes; nothing else.
 */
import { AlertTriangleIcon, ArrowUpRightIcon, Building2Icon, CheckCircle2Icon, ChevronLeftIcon, ChevronRightIcon, InboxIcon, InfoIcon, LockIcon, SearchIcon, XCircleIcon, XIcon } from 'lucide-react';
import { MouseEvent, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { TKey, useI18n } from '../i18n';
import { LogoMark } from './brand';

/** Table column shown only from the md breakpoint up. */
export const wide = 'hidden md:table-cell';
/** Right-aligned, tabular figures that never split across lines (text columns wrap to keep tables in their card). */
export const numCell = 'text-right tabular-nums whitespace-nowrap';
/** Radix Select can't hold an empty value, so "no filter" is this sentinel. */
export const ALL = 'all';

// ───────── page frame ─────────

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  // a short fade as the page opens; nothing moves
  return <div className={cn('mx-auto flex w-full min-w-0 max-w-6xl animate-in flex-col gap-6 duration-300 ease-smooth fade-in-0 slide-in-from-bottom-1.5 lg:gap-8', className)}>{children}</div>;
}

export function PageHeader({
  title,
  eyebrow,
  back,
  subtitle,
  badge,
  actions,
}: {
  title: ReactNode;
  /** small label above the title, e.g. the page name when the title is the mill's name */
  eyebrow?: ReactNode;
  /** small "← Imports" link above the title */
  back?: { to: string; label: string };
  subtitle?: ReactNode;
  /** e.g. a StatusBadge next to the title */
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        {back && (
          <Link
            to={back.to}
            className="mb-1.5 -ml-2 inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeftIcon className="size-4" />
            {back.label}
          </Link>
        )}
        {eyebrow && <div className="mb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{eyebrow}</div>}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-[1.75rem] font-display">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="mt-2 text-sm text-pretty text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// ───────── home hero (as on Android) ─────────

const greetingKey = (): TKey => {
  const h = new Date().getHours();
  return h < 12 ? 'goodMorning' : h < 17 ? 'goodAfternoon' : 'goodEvening';
};

/**
 * The dashboard's navy band, as on the Android home screen: the logo, a greeting with the person's name,
 * the mill on a chip, tools on the right, and (as children) the one figure that matters most.
 * Tools placed here sit on navy: give them the `heroControl` classes.
 */
export function HomeHero({ name, mill, actions, children }: { name: ReactNode; mill?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  const { t } = useI18n();
  return (
    <section className="flex flex-col gap-6 rounded-3xl bg-hero p-5 text-hero-foreground shadow-card sm:p-7">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-4">
        <LogoMark variant="auto" className="size-11 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="text-[0.8125rem] text-hero-muted">{t(greetingKey())},</div>
          <h1 className="truncate text-xl leading-tight font-bold tracking-tight sm:text-2xl font-display">{name}</h1>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>}
      </div>
      {mill && (
        <div className="-mt-2 inline-flex w-fit max-w-full items-center gap-2 rounded-full bg-hero-chip py-1.5 pr-3.5 pl-2.5 text-[0.8125rem] font-medium">
          <Building2Icon className="size-3.5 shrink-0 text-saffron" aria-hidden />
          <span className="truncate">{mill}</span>
        </div>
      )}
      {children}
    </section>
  );
}

/** Classes for a control (select trigger, icon button) placed on the navy hero. */
export const heroControl = 'rounded-full border-transparent bg-hero-chip text-hero-foreground shadow-none hover:bg-hero-border hover:text-hero-foreground [&_svg]:text-hero-muted';

/** The headline figure inside a HomeHero: a label, a big number, a line under it, and an optional chart. */
export function HeroFigure({
  label,
  value,
  unit,
  sub,
  to,
  flush,
  children,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  to?: string;
  /** inside a HeroSplit, which draws the divider itself */
  flush?: boolean;
  children?: ReactNode;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[0.8125rem] font-medium text-hero-muted">{label}</span>
        {to && <ChevronRightIcon className="size-4 text-hero-muted transition-transform duration-200 group-hover/hero:translate-x-0.5" aria-hidden />}
      </div>
      <div className="text-[2.25rem] leading-none font-bold tracking-[-0.03em] tabular-nums sm:text-[2.75rem] font-display">
        <CountUp value={value} />
        {unit && <span className="ml-2 text-base font-semibold tracking-normal text-hero-muted">{unit}</span>}
      </div>
      {sub && <div className="text-[0.8125rem] text-hero-muted">{sub}</div>}
      {children && <div className="mt-2">{children}</div>}
    </>
  );
  const cls = cn('flex min-w-0 flex-col gap-2', !flush && 'border-t border-hero-border pt-5');
  if (!to) return <div className={cls}>{body}</div>;
  return (
    <Link to={to} className={cn(cls, 'group/hero rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-saffron')}>
      {body}
    </Link>
  );
}

/** Small paired columns for the hero panel (orange lead series, striped comparison), with a legend. */
export function HeroBars({ data, legend, labelEvery = 3 }: { data: { label: string; values: number[] }[]; legend?: string[]; labelEvery?: number }) {
  const max = Math.max(1, ...data.flatMap((d) => d.values));
  // the lead series in orange; the comparison series striped, so it reads second
  const fills = ['bg-brand-gradient', 'bg-hatch'];
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <div className="flex h-20 items-end gap-1.5 sm:gap-2">
        {data.map((d, i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end gap-1">
            <div className="flex flex-1 items-end justify-center gap-px">
              {d.values.some((v) => v > 0) ? (
                d.values.map((v, j) =>
                  v > 0 ? (
                    <span key={j} className={cn('w-full max-w-4 rounded-full transition-[height] duration-500 ease-smooth', fills[j % fills.length])} style={{ height: `${Math.max(8, (v / max) * 100)}%` }} />
                  ) : (
                    // the other series had nothing that day: keep its slot so the pair stays aligned
                    <span key={j} className="w-full max-w-4" />
                  ),
                )
              ) : (
                // a quiet day: one faint dot on the baseline, so the days with movement stand out
                <span className="size-1.5 rounded-full bg-hero-muted/30" />
              )}
            </div>
            <span className="h-3 text-center text-[0.625rem] leading-3 text-hero-muted tabular-nums">{i % labelEvery === 0 ? d.label : ''}</span>
          </div>
        ))}
      </div>
      {legend && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-hero-muted">
          {legend.map((l, i) => (
            <span key={l} className="inline-flex items-center gap-1.5">
              <span className={cn('size-2 rounded-full', fills[i % fills.length])} />
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The hero's lower half as a bento: the headline figure (wide) beside a column of small tiles.
 * The side column drops below the figure on narrower screens.
 */
export function HeroSplit({ children, side }: { children: ReactNode; side?: ReactNode }) {
  return (
    <div className="grid gap-5 border-t border-hero-border pt-5 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-7">
      {children}
      {side && <div className="grid content-start gap-3 sm:grid-cols-2 lg:grid-cols-1">{side}</div>}
    </div>
  );
}

/**
 * A small figure tile for a HeroSplit's side column, linking to the page behind it.
 * `accent`: the thing to act on now, in the orange fill (use for one tile at most).
 */
export function HeroTile({
  to,
  icon,
  label,
  value,
  sub,
  accent,
  children,
}: {
  to: string;
  icon: ReactNode;
  label: ReactNode;
  value?: ReactNode;
  sub?: ReactNode;
  accent?: boolean;
  /** custom body in place of the single figure (e.g. two small figures) */
  children?: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cn(
        'group/tile flex min-w-0 flex-col gap-3 rounded-2xl p-4 outline-none transition-[transform,box-shadow] duration-200 ease-smooth hover:-translate-y-0.5 hover:shadow-lift focus-visible:ring-[3px] focus-visible:ring-ring/50',
        accent ? 'bg-brand-gradient text-brand-foreground' : 'bg-hero-chip text-hero-foreground',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn('flex min-w-0 items-center gap-2 text-[0.8125rem] font-medium [&_svg]:size-4 [&_svg]:shrink-0', accent ? 'opacity-90' : 'text-hero-muted')}>
          {icon}
          <span className="min-w-0 leading-snug">{label}</span>
        </span>
        <ArrowUpRightIcon className={cn('size-4 shrink-0 transition-transform duration-200 group-hover/tile:translate-x-0.5 group-hover/tile:-translate-y-0.5', accent ? 'opacity-90' : 'text-hero-muted')} aria-hidden />
      </div>
      {children ?? (
        <div className="text-[1.75rem] leading-none font-bold tracking-[-0.03em] tabular-nums font-display">
          <CountUp value={value} />
        </div>
      )}
      {sub && <div className={cn('line-clamp-2 text-xs', accent ? 'opacity-85' : 'text-hero-muted')}>{sub}</div>}
    </Link>
  );
}

/** A titled block inside a page, with optional tools (buttons) on the right. */
export function Section({ title, tools, children, id, className }: { title: ReactNode; tools?: ReactNode; children: ReactNode; id?: string; className?: string }) {
  return (
    <section id={id} className={cn('flex scroll-mt-20 flex-col gap-4', className)}>
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
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
const toneTile: Record<Tone, string> = { good: 'bg-success-soft text-success', warn: 'bg-warning-soft text-warning', bad: 'bg-destructive-soft text-destructive' };

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('stagger grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4', className)}>{children}</div>;
}

/** A KPI card. `hero` = wide, filled card for the one number that matters most. */
export function Stat({
  label,
  value,
  unit,
  hint,
  icon,
  tone,
  iconTone,
  hero,
  to,
  trend,
  spark,
  info,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  /** tints the icon only, where its colour says something (money in green, money out red); the number keeps its own colour */
  iconTone?: Tone;
  hero?: boolean;
  /** makes the whole card a link to the page behind the number */
  to?: string;
  /** a small comparison under the number: which way it moved, and against what. `good` colours it (up isn't always good) */
  trend?: { dir: 'up' | 'down' | 'flat'; label: ReactNode; good?: boolean };
  /** a small trend line along the foot of the card (its recent shape) */
  spark?: ReactNode;
  /** what the figure means, behind an (i) beside the label */
  info?: string;
  className?: string;
}) {
  const card = (
    <Card
      className={cn(
        'h-full gap-5 px-5 py-5 sm:px-6',
        to && 'transition-[box-shadow,transform] duration-200 ease-smooth group-hover/stat:-translate-y-0.5 group-hover/stat:shadow-lift',
        hero && 'col-span-2',
        // the one figure that matters most: the orange gradient panel
        hero && (tone === 'bad' ? 'bg-destructive-soft text-destructive' : 'bg-brand-gradient text-brand-foreground'),
        className,
      )}
    >
      {/* the title leads; the corner holds a ↗ to the page behind the number (or the card's icon) */}
      <div className="flex items-start gap-3">
        <div className={cn('flex min-w-0 flex-1 items-center gap-1.5 pt-1 text-[0.9375rem] leading-snug font-semibold', hero ? 'text-current' : 'text-foreground')}>
          <span className="min-w-0">{label}</span>
          {info && <InfoTip text={info} className={cn(hero && 'text-current/70')} />}
        </div>
        {to ? (
          <span
            className={cn(
              'grid size-8 shrink-0 place-items-center rounded-full transition-colors duration-200 [&_svg]:size-4',
              hero ? 'bg-current/15' : 'bg-secondary text-foreground/80 group-hover/stat:bg-brand group-hover/stat:text-brand-foreground',
            )}
            aria-hidden
          >
            <ArrowUpRightIcon />
          </span>
        ) : (
          icon && <span className={cn('grid size-8 shrink-0 place-items-center rounded-full [&_svg]:size-4', hero ? 'bg-current/15' : iconTone ? toneTile[iconTone] : 'bg-secondary text-muted-foreground')}>{icon}</span>
        )}
      </div>
      {/* the figure with its recent shape beside it; the comparison runs full width underneath */}
      <div className="mt-auto">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className={cn('leading-none font-bold whitespace-nowrap tracking-[-0.03em] tabular-nums font-display', hero ? 'text-[2.25rem] sm:text-[2.75rem]' : 'text-[1.75rem] sm:text-[2rem]', tone && !hero && toneText[tone])}>
            <CountUp value={value} />
            {unit && <span className={cn('ml-1 text-xs font-semibold tracking-normal', hero ? 'opacity-80' : 'text-foreground/70')}>{unit}</span>}
          </div>
          {spark && <div className="w-28 shrink-0">{spark}</div>}
        </div>
        {(trend || hint) && (
          <div className={cn('mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs', hero ? 'opacity-85' : 'text-muted-foreground')}>
            {trend && <Trend {...trend} onFill={hero} />}
            {hint}
          </div>
        )}
      </div>
    </Card>
  );
  if (!to) return card;
  return (
    <Link to={to} className={cn('group/stat min-w-0 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50', hero && 'col-span-2')}>
      {card}
    </Link>
  );
}

/**
 * A small (i) that explains a figure or a measurement on hover, focus or tap. It is a real button,
 * so the explanation is reachable by keyboard and on touch screens.
 */
export function InfoTip({ text, className }: { text: string; className?: string }) {
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={text}
            onClick={(e) => e.preventDefault()}
            className={cn('grid size-4 shrink-0 place-items-center rounded-full text-muted-foreground/70 transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring', className)}
          >
            <InfoIcon className="size-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-64 text-pretty">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** The comparison under a KPI: a small triangle for the direction and the change, green or red when the direction has a meaning. */
function Trend({ dir, label, good, onFill }: { dir: 'up' | 'down' | 'flat'; label: ReactNode; good?: boolean; /** on a filled (hero) card: keep the card's colour */ onFill?: boolean }) {
  const colour = onFill || good == null || dir === 'flat' ? 'text-current' : good ? 'text-success' : 'text-destructive';
  return (
    <span className={cn('inline-flex items-center gap-1 font-semibold whitespace-nowrap tabular-nums', colour)}>
      {dir === 'flat' ? (
        <span className="h-0.5 w-2.5 rounded-full bg-current" aria-hidden />
      ) : (
        <svg viewBox="0 0 10 8" className={cn('size-2.5 fill-current', dir === 'down' && 'rotate-180')} aria-hidden>
          <path d="M5 0 10 8H0Z" />
        </svg>
      )}
      {label}
    </span>
  );
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** "₹1,74,39,425" → prefix "₹", 17439425, 0 decimals, suffix "": the parts of a formatted figure. */
const FIGURE = /^([^\d-]*)(-?[\d,]+(?:\.(\d+))?)(.*)$/;

/**
 * A formatted figure that counts up from zero when it first appears (about 0.7s, easing out), keeping its
 * own format: rupee sign, Indian digit grouping, decimals. Anything that isn't a plain figure is shown as is.
 * People who ask for less motion get the number straight away.
 */
export function CountUp({ value }: { value: ReactNode }) {
  const text = typeof value === 'string' || typeof value === 'number' ? String(value) : null;
  const m = text ? FIGURE.exec(text) : null;
  const target = m ? Number(m[2].replace(/,/g, '')) : NaN;
  const decimals = m?.[3]?.length ?? 0;
  const [shown, setShown] = useState<number | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (!Number.isFinite(target) || done.current || reducedMotion()) return;
    done.current = true; // count once, on first appearance; later changes just show the new number
    const start = performance.now();
    const DUR = 700;
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / DUR);
      setShown(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
      else setShown(null);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  if (!m || shown == null) return <>{value}</>;
  const body = shown.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <>
      {m[1]}
      {body}
      {m[4]}
    </>
  );
}

/** Several small figures in one card, side by side — for numbers that don't each need a card. */
export function FigureStrip({ items, className }: { items: { label: ReactNode; value: ReactNode; tone?: Tone }[]; className?: string }) {
  return (
    <Card className={cn('grid grid-cols-2 gap-px overflow-hidden bg-border py-0 lg:grid-cols-4', className)}>
      {items.map((it, i) => (
        <div key={i} className="bg-card px-5 py-4 sm:px-6 sm:py-5">
          <div className="text-[0.8125rem] font-medium text-muted-foreground">{it.label}</div>
          <div className={cn('mt-1 text-2xl leading-tight font-semibold tracking-tight tabular-nums font-display', it.tone && toneText[it.tone])}>{it.value}</div>
        </div>
      ))}
    </Card>
  );
}

// ───────── feedback ─────────

const noticeTone = {
  // neutral: a plain remark (e.g. "this record is locked"); info: something worth knowing
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-info-soft text-info',
  ok: 'bg-success-soft text-success',
  warn: 'bg-warning-soft text-warning',
  error: 'bg-destructive-soft text-destructive',
} as const;

const noticeIcon = { neutral: InfoIcon, info: InfoIcon, ok: CheckCircle2Icon, warn: AlertTriangleIcon, error: XCircleIcon } as const;

/** One-line message strip, with an icon for its tone. */
export function Notice({ tone = 'neutral', children, className }: { tone?: keyof typeof noticeTone; children: ReactNode; className?: string }) {
  const Icon = noticeIcon[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-current/15 py-3 pr-4 pl-4 text-sm', noticeTone[tone], className)}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {children}
    </div>
  );
}

/** A placeholder table: a toolbar line, a header band, and rows of varying length. */
function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-card">
      <Skeleton className="h-10 rounded-none" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-13 items-center gap-4 border-t border-border/70 px-4">
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-4 flex-1 rounded-md" style={{ maxWidth: `${14 - (i % 5) * 1.5}rem` }} />
          <Skeleton className="ml-auto h-4 w-16 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/** A placeholder card of labelled fields, in two columns from sm up. */
function FieldsSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="grid gap-x-5 gap-y-6 rounded-xl bg-card p-card shadow-card sm:grid-cols-2">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="grid gap-2">
          <Skeleton className="h-3 w-24 rounded-md" />
          <Skeleton className="h-11 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/**
 * Loading skeleton / error with retry, for useLoad results. Renders nothing once loaded.
 * `shape` mirrors what is about to appear, so the page doesn't jump when it does:
 *   overview  figures above a table (dashboards, statements, reports; the default)
 *   list      a table on its own (record lists)
 *   detail    a record: its summary strip, then its fields beside a side card
 *   form      a card of fields
 */
export function LoadState({ loading, error, onRetry, shape = 'overview' }: { loading: boolean; error: string | null; onRetry: () => void; shape?: 'overview' | 'list' | 'detail' | 'form' }) {
  const { t } = useI18n();
  if (loading && !error && shape !== 'overview')
    return (
      <div className="flex flex-col gap-4" role="status" aria-label={t('loading')}>
        {shape === 'list' && <TableSkeleton rows={8} />}
        {shape === 'form' && <FieldsSkeleton />}
        {shape === 'detail' && (
          <>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-card shadow-card lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="grid gap-2 px-5 py-4">
                  <Skeleton className="h-3 w-20 rounded-md" />
                  <Skeleton className="h-7 w-28 rounded-md" />
                </div>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <TableSkeleton rows={6} />
              <Skeleton className="h-56 rounded-xl" />
            </div>
          </>
        )}
      </div>
    );
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
      <div className="flex flex-col gap-4" role="status" aria-label={t('loading')}>
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <TableSkeleton />
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
  busy,
  toolbar,
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
  /** a refresh is in flight: a progress line runs along the top and the rows dim */
  busy?: boolean;
  /** heading, search and filters shown inside the card, above the table (and above the empty message) */
  toolbar?: ReactNode;
}) {
  return (
    <Card className={cn('relative gap-0 overflow-hidden py-0 shadow-table', className)} aria-busy={busy || undefined}>
      {busy && (
        <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden print:hidden" aria-hidden>
          <div className="h-full w-full origin-left animate-progress bg-primary" />
        </div>
      )}
      {toolbar && <div className="border-b border-border/70 px-4 py-3.5 sm:px-5 print:hidden">{toolbar}</div>}
      {empty && compactEmpty ? (
        <div className="flex items-center gap-2.5 px-4 py-4 text-sm text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0">
          {emptyIcon ?? <InboxIcon />}
          {emptyText}
        </div>
      ) : empty ? (
        <div className="flex flex-col items-center gap-4 px-4 py-16 text-center text-sm text-muted-foreground">
          <span className="grid size-12 place-items-center rounded-xl bg-card text-muted-foreground shadow-widget [&_svg]:size-5">{emptyIcon ?? <InboxIcon />}</span>
          <span className="max-w-xs text-balance">{emptyText}</span>
        </div>
      ) : (
        <>
          <div className={cn('transition-opacity duration-200', busy && 'opacity-55')}>{children}</div>
          {pager && <Pager {...pager} className="border-t border-border px-4 py-3.5 sm:px-5" />}
        </>
      )}
    </Card>
  );
}

// ───────── list toolbar ─────────

/** The row above a list: search on the left, filters on the right. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 print:hidden', className)}>{children}</div>;
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
    <div className={cn('group/search relative w-full sm:w-72', className)}>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setText('')}
        placeholder={placeholder}
        aria-label={t('search')}
        maxLength={60}
        className="rounded-full pr-9 pl-10 [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button
          type="button"
          onClick={() => setText('')}
          aria-label={t('clear')}
          className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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

/** Page numbers to show: always the first and last, the current one with a neighbour each side, gaps as null. */
function pageList(current: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const keep = new Set([1, pages, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((n) => keep.add(n));
  if (current >= pages - 2) [pages - 3, pages - 2, pages - 1].forEach((n) => keep.add(n));
  const out: (number | null)[] = [];
  let last = 0;
  for (const n of [...keep].filter((n) => n >= 1 && n <= pages).sort((x, y) => x - y)) {
    if (n - last > 1) out.push(null);
    out.push(n);
    last = n;
  }
  return out;
}

/** A round pager control: the arrows, and each page number (the open page filled). */
const pagerBtn = 'size-9 rounded-full text-[0.8125rem] font-semibold tabular-nums';

/**
 * "Rows per page [25] · 26–50 of 120"  on the left, "‹ 1 2 [3] 4 … 9 ›" on the right.
 * Hidden when everything fits on the smallest page.
 */
export function Pager({ skip, page, total, onSkip, onPageSize, className }: PagerProps) {
  const { t } = useI18n();
  if (total <= (onPageSize ? PAGE_SIZES[0] : page)) return null;
  const pages = Math.max(1, Math.ceil(total / page));
  const current = Math.floor(skip / page) + 1;
  const go = (n: number) => onSkip((Math.min(Math.max(n, 1), pages) - 1) * page);
  return (
    <nav aria-label={t('pageOf', { page: current, pages })} className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-3 text-sm print:hidden', className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground">
        {onPageSize && (
          <label className="flex items-center gap-2">
            <span className="max-sm:hidden">{t('rowsPerPage')}</span>
            <Select value={String(page)} onValueChange={(v) => onPageSize(Number(v))}>
              <SelectTrigger size="sm" className="w-[4.75rem] rounded-full px-3.5" aria-label={t('rowsPerPage')}>
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
          </label>
        )}
        <span className="tabular-nums">
          {t('rangeOf', { from: skip + 1, to: Math.min(skip + page, total), total })}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className={pagerBtn} disabled={current <= 1} onClick={() => go(current - 1)} aria-label={t('previous')} title={t('previous')}>
          <ChevronLeftIcon />
        </Button>
        {/* phones: "3 / 9"; wider: the page numbers */}
        <span className="px-2 text-[0.8125rem] font-semibold tabular-nums sm:hidden" aria-live="polite">
          {current} / {pages}
        </span>
        <div className="flex items-center gap-1 max-sm:hidden">
          {pageList(current, pages).map((n, i) =>
            n == null ? (
              <span key={`gap${i}`} className="grid size-9 place-items-center text-muted-foreground" aria-hidden>
                …
              </span>
            ) : (
              <Button
                key={n}
                variant={n === current ? 'default' : 'ghost'}
                size="icon"
                className={cn(pagerBtn, n !== current && 'text-foreground/75 hover:bg-secondary')}
                aria-current={n === current ? 'page' : undefined}
                aria-label={t('pageOf', { page: n, pages })}
                onClick={() => go(n)}
              >
                {n}
              </Button>
            ),
          )}
        </div>
        <Button variant="outline" size="icon" className={pagerBtn} disabled={current >= pages} onClick={() => go(current + 1)} aria-label={t('next')} title={t('next')}>
          <ChevronRightIcon />
        </Button>
      </div>
    </nav>
  );
}

/** Where the main record lists keep the rows-per-page last picked on this device. */
const PAGE_SIZE_KEY = 'timbertrail.pageSize';

/** The remembered rows-per-page, or `fallback` if none (or storage is blocked). */
function savedPageSize(fallback: number): number {
  try {
    const n = Number(localStorage.getItem(PAGE_SIZE_KEY));
    if ((PAGE_SIZES as readonly number[]).includes(n)) return n;
  } catch {
    /* storage blocked: use the fallback */
  }
  return fallback;
}

/**
 * Page position and size for a list the server pages (?take=&skip=).
 * Call reset() when a filter changes, so the list starts again at page 1.
 * `remember`: the main record lists share the last rows-per-page picked on this device;
 * small tables inside a record don't, so picking 100 there leaves the lists alone.
 */
export function usePaging(initialSize: number = 25, { remember = false }: { remember?: boolean } = {}) {
  const [skip, setSkip] = useState(0);
  const [take, setTake] = useState(() => (remember ? savedPageSize(initialSize) : initialSize));
  const reset = useCallback(() => setSkip(0), []);
  const pager = (total: number): PagerProps => ({
    skip,
    page: take,
    total,
    onSkip: setSkip,
    onPageSize: (n) => {
      setTake(n);
      setSkip(0);
      if (remember) {
        try {
          localStorage.setItem(PAGE_SIZE_KEY, String(n));
        } catch {
          /* storage blocked: the choice lasts for this page only */
        }
      }
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

const STATUS_DOT: Record<string, string> = { DRAFT: 'bg-muted-foreground', SUBMITTED: 'bg-warning', APPROVED: 'bg-success', REJECTED: 'bg-destructive' };

/** A row of filter chips: one is always chosen. Scrolls sideways on a narrow screen. */
export function FilterChips<V extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: V;
  onChange: (v: V) => void;
  /** `quiet`: the count is plain information, not something waiting (no amber) */
  options: { value: V; label: ReactNode; dot?: string; count?: number; quiet?: boolean }[];
  /** what the chips filter by, for screen readers */
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn('scroll-quiet -mx-1 flex max-w-full items-center gap-1.5 overflow-x-auto px-1 py-1', className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[0.8125rem] font-medium whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              on ? 'border-transparent bg-primary text-primary-foreground shadow-button' : 'border-transparent bg-control text-muted-foreground hover:bg-control-hover hover:text-foreground',
            )}
          >
            {o.dot && <span className={cn('size-2 rounded-full', o.dot, on && 'ring-2 ring-primary-foreground/40')} />}
            {o.label}
            {o.count != null && (
              <span className={cn('-mr-1 min-w-5 rounded-full px-1.5 text-center text-xs leading-5 font-semibold tabular-nums', on ? 'bg-primary-foreground/20' : o.count && !o.quiet ? 'bg-warning-soft text-warning' : 'bg-muted')}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Approval-status filter for list pages, as chips. `value` '' = all. */
export function StatusFilter({ value, onChange, counts }: { value: string; onChange: (v: string) => void; /** records per status ('' = all), shown in the chips */ counts?: Record<string, number | undefined> }) {
  const { t } = useI18n();
  return (
    <FilterChips
      label={t('status')}
      value={value}
      onChange={onChange}
      options={[{ value: '', label: t('all'), count: counts?.[''], quiet: true }, ...STATUSES.map(([v, k]) => ({ value: v, label: t(k), dot: STATUS_DOT[v], count: counts?.[v], quiet: true }))]}
    />
  );
}

// ───────── forms ─────────

/** Label + control (+ hint), stacked. */
export function Field({ id, label, hint, required, className, children }: { id?: string; label: ReactNode; hint?: ReactNode; /** marks the label with a red asterisk */ required?: boolean; className?: string; children: ReactNode }) {
  return (
    <div className={cn('grid min-w-0 content-start gap-2', className)}>
      <Label htmlFor={id} className="gap-1 text-[0.8125rem] text-muted-foreground">
        {label}
        {required && (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

/**
 * One numbered part of a longer form: its heading and a line of help on the left (above, on
 * narrow screens), its Fields in two balanced columns on the right. Use `sm:col-span-2` on a
 * Field that needs the full width.
 */
export function FormSection({ step, title, description, children }: { step?: number; title: ReactNode; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-x-12 gap-y-5 border-t border-border/70 pt-8 first:border-0 first:pt-0 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <div>
        <h3 className="flex items-center gap-2.5 text-[0.9375rem] font-semibold">
          {step != null && <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary tabular-nums">{step}</span>}
          {title}
        </h3>
        {description && <p className="mt-1.5 text-sm text-pretty text-muted-foreground">{description}</p>}
      </div>
      <div className="grid content-start gap-x-5 gap-y-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/** Responsive grid of Fields; use `className="sm:col-span-full"` on a Field to make it full width. */
export function FormGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-x-5 gap-y-5 sm:grid-cols-2 lg:grid-cols-3', className)}>{children}</div>;
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
    <Card className={cn('py-7', className)}>
      <CardContent className="px-5 sm:px-7">
        <form onSubmit={onSubmit} className="grid gap-6">
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
            <strong className="text-2xl leading-[3rem] font-bold text-warning tabular-nums font-display">{result}</strong>
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
      <strong className="text-2xl leading-[3rem] font-bold tabular-nums font-display">{children}</strong>
    </div>
  );
}

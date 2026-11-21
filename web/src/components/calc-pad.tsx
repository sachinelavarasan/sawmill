/**
 * The calculator view for measuring: a display that shows the numbers being typed and the working,
 * a big keypad, "=" to save, and a paper-roll "tape" of the last entries with the running total —
 * the way the mill already works with a hand calculator. Used for logs (girth × length), load-out
 * lines and sawn sizes (thickness × width × length × pieces).
 *
 * The keypad means no phone keyboard pops up on a tablet; a real keyboard works as well.
 */
import { CalculatorIcon, ChevronRightIcon, DeleteIcon, KeyboardIcon, ListIcon, PencilIcon, Trash2Icon, XIcon } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { num3 } from './common';

export interface CalcField {
  key: string;
  label: string;
  /** shown after the value, e.g. "in", "ft" */
  unit?: string;
  value: string;
  /** whole numbers only (pieces): no decimal point */
  integer?: boolean;
}

/** One saved entry in the list beside the calculator. */
export interface CalcEntry {
  key: string;
  /** its number, e.g. 12 for "Log 12" */
  no: number;
  /** the measurements, e.g. "48 × 12" or "1 × 8 in × 8 ft  ×78" */
  label: ReactNode;
  /** a second, smaller line (e.g. the source load) */
  sub?: ReactNode;
  cft: number;
  /** a warning shown on the row (e.g. more than in stock) */
  warn?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

const MAX_DIGITS = 6;

/** Calculator or form, per device; the calculator is the default in the simple view. */
export function useCalcMode(): [boolean, (calc: boolean) => void] {
  const { simple } = useAuth();
  const read = () => {
    try {
      const v = localStorage.getItem('timbertrail.entryMode');
      return v === 'calc' ? true : v === 'form' ? false : null;
    } catch {
      return null;
    }
  };
  const [chosen, setChosen] = useState<boolean | null>(read);
  const set = (calc: boolean) => {
    setChosen(calc);
    try {
      localStorage.setItem('timbertrail.entryMode', calc ? 'calc' : 'form');
    } catch {
      /* private window: just for this visit */
    }
  };
  return [chosen ?? simple, set];
}

/** The Calculator / Form switch, for a section's header. */
export function CalcModeSwitch({ calc, onChange }: { calc: boolean; onChange: (calc: boolean) => void }) {
  const { t } = useI18n();
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={calc ? 'calc' : 'form'}
      onValueChange={(v) => v && onChange(v === 'calc')}
      aria-label={t('entryView')}
      className="h-10 bg-card"
    >
      <ToggleGroupItem value="calc" className="h-10 gap-2 px-3.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
        <CalculatorIcon className="size-4" aria-hidden /> {t('calculatorView')}
      </ToggleGroupItem>
      <ToggleGroupItem value="form" className="h-10 gap-2 px-3.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
        <ListIcon className="size-4" aria-hidden /> {t('formView')}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

/** ⌫, C, Clear all, Next: a soft orange, so they never read as numbers (in light and dark). */
const FN_KEY = 'border-saffron/30 bg-saffron-soft text-saffron-strong hover:bg-saffron/15 active:bg-saffron/20';

/** A key cap, for the keyboard keys line. */
function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md border border-b-2 bg-card px-2 font-sans text-[0.6875rem] font-semibold whitespace-nowrap text-foreground">
      {children}
    </kbd>
  );
}

/** What a key press does to a typed value; null = the press is not allowed. */
function typeKey(value: string, key: string, integer: boolean): string | null {
  if (key === 'back') return value.slice(0, -1);
  if (key === 'clear') return '';
  if (key === '.') {
    if (integer || value.includes('.')) return null;
    return `${value || '0'}.`;
  }
  // a digit
  const [whole, dec] = value.split('.');
  if (dec !== undefined && dec.length >= 2) return null; // two decimals, as everywhere else
  if (whole.length + (dec?.length ?? 0) >= MAX_DIGITS) return null;
  if (value === '0') return key;
  return value + key;
}

export function CalcPad({
  title,
  fields,
  onChange,
  active,
  setActive,
  result,
  formula,
  total,
  totalLabel,
  problem,
  canSave,
  busy,
  onSave,
  saveLabel,
  afterSave = 0,
  entries,
  entriesTitle,
  entriesTotal,
  editing,
  extra,
}: {
  /** what is being entered, e.g. "Log 12" */
  title: ReactNode;
  fields: CalcField[];
  onChange: (key: string, value: string) => void;
  /** which field the keys type into */
  active: number;
  setActive: (i: number) => void;
  /** this entry's CFT, null while incomplete */
  result: number | null;
  /** the working with the numbers typed, e.g. "48 × 48 × 12 ÷ 2304" */
  formula: string;
  /** the load's total, with this entry */
  total: number;
  totalLabel: string;
  /** why the entry can't be saved yet, if it can't */
  problem?: string | null;
  canSave: boolean;
  busy?: boolean;
  onSave: () => Promise<unknown> | void;
  saveLabel: string;
  /** the field to type into after a save (the one that usually changes next) */
  afterSave?: number;
  /** everything saved so far, newest first */
  entries: CalcEntry[];
  entriesTitle: string;
  entriesTotal: number;
  /** set while a saved entry is loaded into the calculator to be corrected */
  editing?: { key: string; label: ReactNode; onCancel: () => void } | null;
  /** shown in the display under the numbers, e.g. which load the pieces come from */
  extra?: ReactNode;
}) {
  const { t } = useI18n();
  const field = fields[active] ?? fields[0];
  const ready = canSave && !busy;

  const press = (key: string) => {
    const next = typeKey(field.value, key, !!field.integer);
    if (next != null) onChange(field.key, next);
  };
  const clearAll = () => {
    fields.forEach((f) => onChange(f.key, ''));
    setActive(0);
  };
  /** set at once (props update later): a second "=" or Enter while saving is ignored, not saved twice */
  const saving = useRef(false);
  const save = async () => {
    if (!ready || saving.current) return;
    saving.current = true;
    try {
      await onSave();
      setActive(afterSave);
    } finally {
      saving.current = false;
    }
  };
  /** Next, or "=" on the last field: move on while something is missing, save once it is all there */
  const enter = () => {
    if (active < fields.length - 1 && !(ready && fields.every((f) => f.value))) return setActive(active + 1);
    if (ready) return void save();
    const empty = fields.findIndex((f) => !f.value);
    setActive(empty >= 0 ? empty : active);
  };

  // a real keyboard drives the pad too — unless the person is typing in some other box
  const handler = useRef<(e: KeyboardEvent) => void>(() => undefined);
  const padRef = useRef<HTMLDivElement>(null);
  handler.current = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target as HTMLElement | null;
    if (el && (el.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="listbox"], [role="menu"]'))) return;
    const k = e.key;
    // Enter / Space on a focused button or link is that button's own press
    if ((k === 'Enter' || k === ' ') && el?.closest('button, a')) return;
    // arrows move between the fields only while the pad itself has focus; elsewhere they scroll
    const inPad = !!el && !!padRef.current?.contains(el);
    let used = true;
    if (/^\d$/.test(k)) press(k);
    else if (k === '.' || k === ',') press('.');
    else if (k === 'Backspace') press('back');
    else if (k === 'Delete' || k === 'Escape') press('clear');
    else if (k === 'Enter' || k === '=' || k === '+') enter();
    else if (inPad && k === 'ArrowRight') setActive((active + 1) % fields.length);
    else if (inPad && k === 'ArrowLeft') setActive((active + fields.length - 1) % fields.length);
    else used = false;
    if (used) e.preventDefault();
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => handler.current(e);
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  /** a mouse or finger press doesn't move focus onto the pad's buttons, so the keyboard keeps typing into the calculator */
  const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault();
  const key = (label: ReactNode, onClick: () => void, opts: { className?: string; aria?: string; disabled?: boolean } = {}) => (
    <button
      type="button"
      onMouseDown={keepFocus}
      onClick={onClick}
      disabled={opts.disabled}
      aria-label={opts.aria}
      className={cn(
        'grid h-16 place-items-center rounded-xl border border-border bg-card text-2xl font-semibold text-foreground tabular-nums shadow-card transition-[transform,background-color] duration-75 outline-none select-none hover:bg-muted active:scale-[0.97] active:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-35 disabled:shadow-none sm:h-[4.5rem]',
        opts.className,
      )}
    >
      {label}
    </button>
  );
  const last = active === fields.length - 1 || (ready && fields.every((f) => f.value));

  return (
    // side by side from a tablet up, so what was just added is always in view beside the keys
    <div ref={padRef} className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(15rem,0.85fr)] lg:gap-5">
      <div className="flex min-w-0 flex-col gap-3 rounded-2xl bg-muted p-3 sm:p-4">
        {/* the keyboard keys, where they are seen (where there is a keyboard) */}
        <div className="hidden flex-wrap items-center gap-x-3 gap-y-1.5 px-1 text-xs text-muted-foreground md:flex">
          <span className="flex items-center gap-1.5 font-semibold text-foreground">
            <KeyboardIcon className="size-4" aria-hidden /> {t('kbdTitle')}
          </span>
          <span className="flex items-center gap-1 whitespace-nowrap">
            <Kbd>0–9</Kbd>
            <Kbd>.</Kbd> {t('kbdNumbers')}
          </span>
          <span className="flex items-center gap-1 whitespace-nowrap">
            <Kbd>Enter</Kbd> {t('kbdNext')}
          </span>
          <span className="flex items-center gap-1 whitespace-nowrap">
            <Kbd>⌫</Kbd> {t('kbdDelete')}
          </span>
          <span className="flex items-center gap-1 whitespace-nowrap">
            <Kbd>Esc</Kbd> {t('kbdClear')}
          </span>
        </div>
        {/* the display */}
        <div className="flex flex-col gap-3 rounded-xl bg-hero p-4 text-hero-foreground sm:p-5" aria-live="polite">
          {editing && (
            <div className="-mx-1 flex items-center justify-between gap-2 rounded-lg bg-saffron/15 px-3 py-2 text-sm font-semibold text-hero-foreground">
              <span className="flex min-w-0 items-center gap-2">
                <PencilIcon className="size-4 shrink-0 text-saffron" aria-hidden />
                <span className="truncate">{editing.label}</span>
              </span>
              <button type="button" onClick={editing.onCancel} className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 hover:bg-hero-border">
                <XIcon className="size-4" aria-hidden /> {t('cancel')}
              </button>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 text-sm text-hero-muted">
            <span className="font-semibold text-hero-foreground">{editing ? '' : title}</span>
            <span className="tabular-nums">
              {totalLabel}: <span className="font-semibold text-hero-foreground">{num3(total)}</span> CFT
            </span>
          </div>
          {/* the numbers being typed: tap one to type into it */}
          <div className={cn('grid gap-2', fields.length > 2 ? 'grid-cols-2 xl:grid-cols-4' : 'grid-cols-2')}>
            {fields.map((f, i) => (
              <button
                key={f.key}
                type="button"
                onMouseDown={keepFocus}
                onClick={() => setActive(i)}
                aria-pressed={i === active}
                className={cn(
                  'flex min-w-0 flex-col items-start rounded-lg px-3 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-saffron',
                  i === active ? 'bg-hero-foreground/15 ring-2 ring-saffron' : 'bg-hero-chip hover:bg-hero-border',
                )}
              >
                <span className="truncate text-xs text-hero-muted">{f.label}</span>
                <span className="flex items-baseline gap-1 text-[1.75rem] leading-tight font-bold tabular-nums font-display">
                  {f.value || <span className="text-hero-muted/60">0</span>}
                  {i === active && <span className="inline-block h-6 w-0.5 animate-pulse self-center bg-saffron" aria-hidden />}
                  {/* the unit, unless the label already says it ("Girth (in)") */}
                  {f.unit && !f.label.includes(`(${f.unit})`) && <span className="text-sm font-medium text-hero-muted">{f.unit}</span>}
                </span>
              </button>
            ))}
          </div>
          {extra}
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-t border-hero-border pt-3">
            <span className="text-sm text-hero-muted tabular-nums">{formula}</span>
            <span className="text-4xl leading-none font-bold tabular-nums font-display sm:text-5xl">
              {result != null ? num3(result) : '0.000'}
              <span className="ml-1.5 text-base font-medium text-hero-muted">CFT</span>
            </span>
          </div>
          {problem && <div className="text-sm font-medium text-saffron" role="alert">{problem}</div>}
        </div>

        {/* the keypad */}
        <div className="grid grid-cols-4 gap-2">
          {key('7', () => press('7'))}
          {key('8', () => press('8'))}
          {key('9', () => press('9'))}
          {key(<DeleteIcon className="size-7" />, () => press('back'), { aria: 'Backspace', className: FN_KEY })}
          {key('4', () => press('4'))}
          {key('5', () => press('5'))}
          {key('6', () => press('6'))}
          {key('C', () => press('clear'), { aria: t('clear'), className: cn(FN_KEY, 'text-xl') })}
          {key('1', () => press('1'))}
          {key('2', () => press('2'))}
          {key('3', () => press('3'))}
          {key(
            last ? (
              <span className="flex flex-col items-center leading-none">
                <span className="text-3xl">=</span>
                <span className="mt-1 text-xs font-semibold">{t('calcEquals')}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-lg">
                {t('next')} <ChevronRightIcon className="size-5" />
              </span>
            ),
            enter,
            {
              aria: last ? saveLabel : t('next'),
              className: cn(
                'row-span-2 h-auto! sm:h-auto!',
                !last
                  ? FN_KEY
                  : ready
                    ? 'border-transparent bg-brand-gradient text-brand-foreground shadow-button hover:opacity-90 active:opacity-90'
                    : 'border-2 border-dashed border-saffron/50 bg-card text-saffron-strong/70 shadow-none disabled:opacity-100',
              ),
              disabled: last && !ready,
            },
          )}
          {key('0', () => press('0'))}
          {key('.', () => press('.'), { disabled: !!field.integer, aria: 'decimal point' })}
          {key(<span className="text-base">{t('calcClearAll')}</span>, clearAll, { className: FN_KEY })}
        </div>
      </div>

      {/* everything added so far, newest on top — beside the keys, so each entry can be checked as it goes in */}
      <div className="flex flex-col overflow-hidden rounded-2xl bg-card shadow-card md:sticky md:top-24 md:max-h-[calc(100svh-7.5rem)]">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <span className="text-sm font-semibold">{entriesTitle}</span>
          <span className="min-w-7 rounded-full bg-muted px-2 text-center text-xs leading-6 font-bold tabular-nums">{entries.length}</span>
        </div>
        {entries.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t('calcTapeEmpty')}</p>
        ) : (
          <ol className="scroll-quiet flex min-h-0 flex-1 flex-col overflow-y-auto">
            {entries.map((e, i) => (
              <li
                key={e.key}
                className={cn(
                  'flex items-center gap-2 border-b py-2 pr-1.5 pl-3 last:border-0',
                  editing?.key === e.key && 'bg-saffron/10',
                  i === 0 && !editing && 'animate-in duration-500 fade-in-0 slide-in-from-top-1',
                )}
              >
                <span className="w-8 shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">#{e.no}</span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-[0.9375rem] font-medium tabular-nums', e.warn && 'text-destructive')}>{e.label}</span>
                  {e.sub && <span className="block truncate text-xs text-muted-foreground">{e.sub}</span>}
                </span>
                <span className="shrink-0 text-right text-[0.9375rem] font-bold tabular-nums">{num3(e.cft)}</span>
                {e.onEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      e.onEdit?.();
                      (document.activeElement as HTMLElement | null)?.blur(); // the keys and Enter go to the calculator next
                    }}
                    aria-label={`${t('edit')} #${e.no}`}
                    title={t('edit')}
                    className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <PencilIcon className="size-4" />
                  </button>
                )}
                {e.onDelete && (
                  <button
                    type="button"
                    onClick={e.onDelete}
                    aria-label={`${t('delete')} #${e.no}`}
                    title={t('delete')}
                    className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                  >
                    <Trash2Icon className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
        <div className="flex items-baseline justify-between gap-3 border-t-2 border-double bg-muted/40 px-4 py-3">
          <span className="text-sm font-semibold">{t('total')}</span>
          <span className="text-xl font-bold tabular-nums font-display">
            {num3(entriesTotal)} <span className="text-xs font-medium text-muted-foreground">CFT</span>
          </span>
        </div>
      </div>
    </div>
  );
}

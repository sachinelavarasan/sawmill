/**
 * Date and date-and-time pickers built from shadcn/ui (Popover + Calendar), used everywhere the app
 * asks for a date. They keep the string values the native inputs had — 'YYYY-MM-DD' and
 * 'YYYY-MM-DDTHH:mm' (local time) — so forms and their API bodies are unchanged.
 */
import { format, isValid, parse } from 'date-fns';
import { enIN, ta } from 'date-fns/locale';
import { CalendarIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useI18n } from '../i18n';

const DAY = 'yyyy-MM-dd';
const toDate = (v: string | undefined) => {
  if (!v) return undefined;
  const d = parse(v.slice(0, 10), DAY, new Date());
  return isValid(d) ? d : undefined;
};

interface DateProps {
  id?: string;
  /** 'YYYY-MM-DD', or '' for none */
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
  /** offer a clear (×) button — for optional dates such as report filters */
  clearable?: boolean;
}

export function DatePicker({ id, value, onChange, min, max, required, disabled, placeholder, className, clearable, ...rest }: DateProps) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const selected = toDate(value);
  const from = toDate(min);
  const to = toDate(max);
  const locale = lang === 'ta' ? ta : enIN;
  const pick = (d: Date | undefined) => {
    onChange(d ? format(d, DAY) : '');
    setOpen(false);
  };
  const today = new Date();
  const todayAllowed = (!from || today >= from) && (!to || format(today, DAY) <= format(to, DAY));

  return (
    <div className={cn('relative', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={rest['aria-label']}
            className={cn(
              'h-11 w-full justify-start rounded-md px-3 text-left font-normal tabular-nums',
              !selected && 'text-muted-foreground',
              clearable && selected && 'pr-9',
            )}
          >
            <CalendarIcon className="text-muted-foreground" aria-hidden />
            <span className="truncate">{selected ? format(selected, 'dd MMM yyyy', { locale }) : (placeholder ?? t('pickDate'))}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? to ?? undefined}
            onSelect={(d) => d && pick(d)}
            disabled={[...(from ? [{ before: from }] : []), ...(to ? [{ after: to }] : [])]}
            captionLayout="dropdown"
            locale={locale}
            className="[--cell-size:--spacing(10)]"
            autoFocus
          />
          <div className="flex justify-between gap-2 border-t p-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => pick(today)} disabled={!todayAllowed}>
              {t('today')}
            </Button>
            {!required && selected && (
              <Button type="button" variant="ghost" size="sm" onClick={() => pick(undefined)}>
                {t('clear')}
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {clearable && selected && !disabled && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={t('clear')}
          className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
      {/* keeps the browser's "please fill in" check that the native date input had */}
      {required && <input tabIndex={-1} aria-hidden required value={value} onChange={() => undefined} className="sr-only bottom-0 left-4" />}
    </div>
  );
}

interface DateTimeProps {
  id?: string;
  /** 'YYYY-MM-DDTHH:mm' in local time, or '' for none */
  value: string;
  onChange: (value: string) => void;
  /** earliest allowed, same format */
  min?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

/** A date (calendar) beside a time — the shadcn date-and-time pattern. */
export function DateTimePicker({ id, value, onChange, min, required, disabled, className }: DateTimeProps) {
  const { t } = useI18n();
  const day = value.slice(0, 10);
  const time = value.slice(11, 16);
  const minDay = min?.slice(0, 10);
  const set = (d: string, tm: string) => onChange(d ? `${d}T${tm || '00:00'}` : '');
  return (
    <div className={cn('grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2', className)}>
      <DatePicker id={id} value={day} onChange={(d) => set(d, time || format(new Date(), 'HH:mm'))} min={minDay} required={required} disabled={disabled} />
      <Input
        type="time"
        aria-label={t('time')}
        value={time}
        onChange={(e) => set(day || format(new Date(), DAY), e.target.value)}
        min={minDay && minDay === day ? min?.slice(11, 16) : undefined}
        required={required}
        disabled={disabled}
        className="h-11 tabular-nums appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
      />
    </div>
  );
}

/** Adapts a form's `set('field')` change handler (which reads `e.target.value`) to the pickers' plain-string onChange. */
export const asEvent =
  (handler: (e: { target: { value: string } }) => void) =>
  (value: string) =>
    handler({ target: { value } });

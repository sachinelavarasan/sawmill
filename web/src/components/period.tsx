import { CalendarRangeIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useI18n } from '../i18n';

export interface PeriodValue {
  from: string;
  to: string;
}

const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

/** Quick ranges, in the browser's local calendar. */
export function presets(now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  return {
    thisMonth: { from: iso(new Date(y, m, 1)), to: iso(now) },
    lastMonth: { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) },
    thisYear: { from: iso(new Date(y, 0, 1)), to: iso(now) },
  };
}

export const periodQuery = (p: PeriodValue) => `from=${p.from}&to=${p.to}`;

/** From–to date range with This month / Last month / This year shortcuts. */
export function PeriodPicker({ value, onChange, className }: { value: PeriodValue; onChange: (p: PeriodValue) => void; className?: string }) {
  const { t } = useI18n();
  const p = presets();
  const same = (a: PeriodValue) => a.from === value.from && a.to === value.to;
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div className="flex items-center gap-1.5 rounded-md border bg-card px-2 shadow-xs">
        <CalendarRangeIcon className="size-4 text-muted-foreground" />
        <Input
          type="date"
          aria-label={t('from')}
          value={value.from}
          max={value.to}
          onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })}
          className="h-8 w-[8.5rem] border-0 px-1 shadow-none focus-visible:ring-0"
        />
        <span className="text-muted-foreground">–</span>
        <Input
          type="date"
          aria-label={t('to')}
          value={value.to}
          min={value.from}
          onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })}
          className="h-8 w-[8.5rem] border-0 px-1 shadow-none focus-visible:ring-0"
        />
      </div>
      {(['thisMonth', 'lastMonth', 'thisYear'] as const).map((k) => (
        <Button key={k} type="button" size="sm" variant={same(p[k]) ? 'secondary' : 'ghost'} onClick={() => onChange(p[k])}>
          {t(k)}
        </Button>
      ))}
    </div>
  );
}

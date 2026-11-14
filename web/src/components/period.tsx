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
    thisQuarter: { from: iso(new Date(y, Math.floor(m / 3) * 3, 1)), to: iso(now) },
    thisYear: { from: iso(new Date(y, 0, 1)), to: iso(now) },
    lastYear: { from: iso(new Date(y - 1, 0, 1)), to: iso(new Date(y - 1, 11, 31)) },
  };
}

export const periodQuery = (p: PeriodValue) => `from=${p.from}&to=${p.to}`;

/** Quick ranges (this month, last month, this quarter, this year, last year) and a from–to date range for anything else. */
export function PeriodPicker({ value, onChange, className }: { value: PeriodValue; onChange: (p: PeriodValue) => void; className?: string }) {
  const { t } = useI18n();
  const p = presets();
  const same = (a: PeriodValue) => a.from === value.from && a.to === value.to;
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div role="group" aria-label={t('period')} className="flex flex-wrap items-center gap-1.5">
        {(['thisMonth', 'lastMonth', 'thisQuarter', 'thisYear', 'lastYear'] as const).map((k) => (
          <Button key={k} type="button" size="sm" variant={same(p[k]) ? 'default' : 'outline'} className="h-9" aria-pressed={same(p[k])} onClick={() => onChange(p[k])}>
            {t(k)}
          </Button>
        ))}
      </div>
      <div className="flex h-9 items-center gap-1.5 rounded-lg border bg-card pr-2 pl-3 shadow-xs sm:ml-auto transition-colors hover:border-foreground/25 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
        <CalendarRangeIcon className="size-4 text-muted-foreground" />
        <Input
          type="date"
          aria-label={t('from')}
          value={value.from}
          max={value.to}
          onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })}
          className="h-8 w-[8.5rem] border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
        />
        <span className="text-muted-foreground">–</span>
        <Input
          type="date"
          aria-label={t('to')}
          value={value.to}
          min={value.from}
          onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })}
          className="h-8 w-[8.5rem] border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
        />
      </div>
    </div>
  );
}

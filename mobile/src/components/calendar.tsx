/**
 * The app's calendar and time picker — used by every date field (imports, production, exports,
 * payments, expenses, report periods) through DateField / DateTimeField in sheet.tsx.
 *
 * CalendarPicker (react-native-calendars draws the month grid; everything around it is ours)
 *   header   ‹  November 2026 ▾  ›   — arrows step a month; tapping the title opens the selector
 *   selector expands in place (no second sheet): a page of 12 years → the 12 months of that year →
 *            straight back to the calendar at that month. Years and months outside min/max are off.
 *   days     rounded squares: selected = solid saffron, today = saffron outline, the neighbouring
 *            months' days muted (tap one to jump there), days outside min/max faded and untappable
 *   motion   the month slides in from the side it came from
 *
 * State: the visible month is this component's own (controlled; the library follows it through
 * `initialDate`, which it re-reads on change). The selected day is the caller's `value` — moving
 * between months or opening the selector never changes it.
 *
 * TimePicker: a large read-out, AM / PM, then hours 1–12 and minutes in fives, in the same
 * rounded-square cells, so date and time read as one control.
 */
import { useCallback, useState } from 'react';
import { LayoutChangeEvent, Pressable, View } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';
import { FadeIn, FadeInLeft, FadeInRight } from 'react-native-reanimated';
import { todayIso } from '../lib/format';
import { useLang, useT } from '../lib/i18n';
import { useThemeToggle } from '../lib/theme';
import { AnimatedView, tick } from './motion';
import { Text } from './text';
import { cn, Icon, Segmented } from './ui';

// ───────── names (both languages, so nothing depends on the phone's locale data) ─────────

const MONTHS = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ta: ['ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்'],
};
const MONTHS_SHORT = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ta: ['ஜன', 'பிப்', 'மார்', 'ஏப்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆக', 'செப்', 'அக்', 'நவ', 'டிச'],
};
/** Monday first, matching firstDay={1} */
const WEEKDAYS = {
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  ta: ['தி', 'செ', 'பு', 'வி', 'வெ', 'ச', 'ஞா'],
};

// ───────── month arithmetic on 'YYYY-MM' ─────────

const pad = (n: number) => String(n).padStart(2, '0');
const ym = (y: number, m: number) => `${y}-${pad(m)}`; // m: 1–12
const yearOf = (s: string) => Number(s.slice(0, 4));
const monthOf = (s: string) => Number(s.slice(5, 7));
function addMonths(s: string, n: number) {
  const total = yearOf(s) * 12 + (monthOf(s) - 1) + n;
  return ym(Math.floor(total / 12), (total % 12) + 1);
}
const clampMonth = (s: string, min?: string, max?: string) => (min && s < min.slice(0, 7) ? min.slice(0, 7) : max && s > max.slice(0, 7) ? max.slice(0, 7) : s);

/** without bounds, the year selector still stops somewhere sensible */
const FIRST_YEAR = 1990;
const LAST_YEAR = 2099;
const YEARS_PER_PAGE = 12;

type Mode = 'days' | 'years' | 'months';

/** One rounded-square choice (a year, a month, an hour, a minute): solid saffron when chosen. */
function Cell({ label, on, disabled, onPress, a11y }: { label: string; on: boolean; disabled?: boolean; onPress: () => void; a11y?: string }) {
  const { dark } = useThemeToggle();
  return (
    <Pressable
      onPress={() => {
        if (!on) tick();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ selected: on, disabled: !!disabled }}
      className={cn(
        'min-h-12 flex-1 items-center justify-center rounded-xl px-1',
        on ? 'bg-saffron' : cn(dark ? 'bg-primary-soft' : 'bg-secondary', 'active:opacity-70'),
        disabled && 'opacity-30',
      )}
    >
      <Text className={cn('text-center text-[15px] tabular-nums', on ? 'font-bold text-saffron-foreground' : 'font-semibold text-foreground')} numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Text>
    </Pressable>
  );
}

/** `items` laid out `columns` across in equal cells. */
function Grid<T>({ items, columns, render }: { items: T[]; columns: number; render: (item: T) => React.ReactNode }) {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
  return (
    <View className="gap-2">
      {rows.map((r, i) => (
        <View key={i} className="flex-row gap-2">
          {r.map(render)}
          {Array.from({ length: columns - r.length }, (_, k) => (
            <View key={`f${k}`} className="flex-1" />
          ))}
        </View>
      ))}
    </View>
  );
}

/** Round arrow button for the header (44dp). */
function Arrow({ dir, disabled, label, onPress }: { dir: 'left' | 'right'; disabled: boolean; label: string; onPress: () => void }) {
  const { dark } = useThemeToggle();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      className={cn('h-11 w-11 items-center justify-center rounded-full active:opacity-70', dark ? 'bg-primary-soft' : 'bg-secondary', disabled && 'opacity-30')}
    >
      <Icon name={dir === 'left' ? 'chevron-left' : 'chevron-right'} size={20} colorClassName="accent-foreground" />
    </Pressable>
  );
}

/** react-native-calendars draws no header of its own: ours sits above it. */
const NoHeader = () => null;

export function CalendarPicker({ value, onChange, min, max }: { value: string | null; onChange: (day: string) => void; min?: string; max?: string }) {
  const t = useT();
  const { lang } = useLang();
  const today = todayIso();
  const [month, setMonth] = useState(() => clampMonth((value ?? today).slice(0, 7), min, max));
  /** +1 forward, -1 back: which side the next month slides in from */
  const [dir, setDir] = useState(0);
  const [mode, setMode] = useState<Mode>('days');
  /** the year being chosen in the months grid, and the first year on the years page */
  const [pickYear, setPickYear] = useState(yearOf(month));
  const [pageStart, setPageStart] = useState(Math.floor(yearOf(month) / YEARS_PER_PAGE) * YEARS_PER_PAGE);
  /** the days view's height, so the selector takes exactly its place and the sheet doesn't jump */
  const [daysHeight, setDaysHeight] = useState(0);

  const minYM = min?.slice(0, 7);
  const maxYM = max?.slice(0, 7);
  const minYear = min ? yearOf(min) : FIRST_YEAR;
  const maxYear = max ? yearOf(max) : LAST_YEAR;

  const go = useCallback(
    (next: string) => {
      const target = clampMonth(next, min, max);
      if (target === month) return;
      setDir(target > month ? 1 : -1);
      setMonth(target);
    },
    [month, min, max],
  );

  // ── header ──
  const names = MONTHS[lang] ?? MONTHS.en;
  const shortNames = MONTHS_SHORT[lang] ?? MONTHS_SHORT.en;
  const title = mode === 'days' ? `${names[monthOf(month) - 1]} ${yearOf(month)}` : mode === 'months' ? String(pickYear) : `${pageStart} – ${pageStart + YEARS_PER_PAGE - 1}`;
  const prevOff = mode === 'days' ? !!minYM && month <= minYM : mode === 'months' ? pickYear <= minYear : pageStart <= minYear;
  const nextOff = mode === 'days' ? !!maxYM && month >= maxYM : mode === 'months' ? pickYear >= maxYear : pageStart + YEARS_PER_PAGE - 1 >= maxYear;
  const step = (n: 1 | -1) => {
    tick();
    if (mode === 'days') go(addMonths(month, n));
    else if (mode === 'months') setPickYear((y) => y + n);
    else setPageStart((p) => p + n * YEARS_PER_PAGE);
  };
  const toggleSelector = () => {
    tick();
    if (mode === 'days') {
      setPageStart(Math.floor(yearOf(month) / YEARS_PER_PAGE) * YEARS_PER_PAGE);
      setMode('years');
    } else setMode('days');
  };

  // ── days ──
  const pick = useCallback(
    (day: string) => {
      if (day.slice(0, 7) !== month) go(day.slice(0, 7));
      onChange(day);
    },
    [month, go, onChange],
  );
  const Day = useCallback(
    ({ date }: { date?: DateData }) => {
      if (!date) return <View className="h-11 w-11" />;
      const ds = date.dateString;
      const inMonth = ds.slice(0, 7) === month;
      const out = (!!min && ds < min) || (!!max && ds > max);
      const selected = ds === value;
      const isToday = ds === today;
      return (
        <Pressable
          onPress={() => pick(ds)}
          disabled={out}
          accessibilityRole="button"
          accessibilityLabel={`${date.day} ${names[date.month - 1]} ${date.year}${isToday ? `, ${t('today')}` : ''}`}
          accessibilityState={{ selected, disabled: out }}
          className={cn(
            'h-11 w-11 items-center justify-center rounded-xl',
            selected ? 'bg-saffron' : isToday ? 'border-[1.5px] border-saffron' : 'active:bg-secondary',
            out && 'opacity-30',
          )}
        >
          <Text
            className={cn(
              'text-[15px] tabular-nums',
              selected ? 'font-bold text-saffron-foreground' : isToday ? 'font-bold text-saffron-strong' : inMonth ? 'font-medium text-foreground' : 'font-normal text-muted-foreground',
            )}
          >
            {date.day}
          </Text>
        </Pressable>
      );
    },
    [month, min, max, value, today, pick, names, t],
  );

  return (
    <View className="gap-2 px-3">
      <View className="flex-row items-center gap-2 pb-1">
        <Arrow dir="left" disabled={prevOff} label={t('previous')} onPress={() => step(-1)} />
        <Pressable
          onPress={toggleSelector}
          accessibilityRole="button"
          accessibilityState={{ expanded: mode !== 'days' }}
          accessibilityLabel={title}
          className="min-h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-full active:opacity-70"
        >
          <Text className="text-[17px] font-bold tracking-tight text-foreground font-display" numberOfLines={1}>
            {title}
          </Text>
          <Icon name={mode === 'days' ? 'chevron-down' : 'chevron-up'} size={16} colorClassName="accent-saffron" />
        </Pressable>
        <Arrow dir="right" disabled={nextOff} label={t('next')} onPress={() => step(1)} />
      </View>

      {mode === 'days' ? (
        <View onLayout={(e: LayoutChangeEvent) => setDaysHeight(Math.round(e.nativeEvent.layout.height))}>
          <View className="flex-row">
            {(WEEKDAYS[lang] ?? WEEKDAYS.en).map((d) => (
              <Text key={d} className="flex-1 pb-1 text-center text-xs font-semibold text-muted-foreground" numberOfLines={1}>
                {d}
              </Text>
            ))}
          </View>
          <AnimatedView key={month} entering={(dir > 0 ? FadeInRight : dir < 0 ? FadeInLeft : FadeIn).duration(200)}>
            <Calendar
              // the visible month is ours; the library re-reads initialDate when it changes
              initialDate={`${month}-01`}
              customHeader={NoHeader}
              hideExtraDays={false}
              showSixWeeks
              firstDay={1}
              minDate={min}
              maxDate={max}
              dayComponent={Day}
              theme={{ calendarBackground: 'transparent', weekVerticalMargin: 2 }}
              style={{ paddingLeft: 0, paddingRight: 0 }}
            />
          </AnimatedView>
        </View>
      ) : (
        <AnimatedView entering={FadeIn.duration(160)} style={{ minHeight: daysHeight }} className="justify-center">
          {mode === 'years' ? (
            <Grid
              columns={3}
              items={Array.from({ length: YEARS_PER_PAGE }, (_, i) => pageStart + i)}
              render={(y) => (
                <Cell
                  key={y}
                  label={String(y)}
                  on={y === yearOf(month)}
                  disabled={y < minYear || y > maxYear}
                  onPress={() => {
                    setPickYear(y);
                    setMode('months');
                  }}
                />
              )}
            />
          ) : (
            <Grid
              columns={3}
              items={Array.from({ length: 12 }, (_, i) => i + 1)}
              render={(m) => {
                const key = ym(pickYear, m);
                return (
                  <Cell
                    key={m}
                    label={shortNames[m - 1]}
                    a11y={`${names[m - 1]} ${pickYear}`}
                    on={key === month}
                    disabled={(!!minYM && key < minYM) || (!!maxYM && key > maxYM)}
                    onPress={() => {
                      go(key);
                      setMode('days');
                    }}
                  />
                );
              }}
            />
          )}
        </AnimatedView>
      )}
    </View>
  );
}

// ───────── time ─────────

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

/** 12-hour time: read-out, AM / PM, hour and minute grids. `hour` is 0–23, `minute` a multiple of 5. */
export function TimePicker({ hour, minute, onHour, onMinute }: { hour: number; minute: number; onHour: (h: number) => void; onMinute: (m: number) => void }) {
  const t = useT();
  const { dark } = useThemeToggle();
  const pm = hour >= 12;
  const h12 = hour % 12 || 12;
  return (
    <View className="gap-3 px-5">
      <View className={cn('flex-row items-center justify-between rounded-2xl px-4 py-3', dark ? 'bg-primary-soft' : 'bg-background')}>
        <Text className="text-[13px] font-semibold text-muted-foreground">{t('time')}</Text>
        <Text className="text-[26px] font-bold tabular-nums text-foreground font-display" accessibilityLiveRegion="polite">
          {h12}:{pad(minute)}
          <Text className="text-base font-bold text-saffron-strong"> {pm ? 'PM' : 'AM'}</Text>
        </Text>
      </View>
      <Segmented<'am' | 'pm'>
        value={pm ? 'pm' : 'am'}
        onChange={(v) => onHour((hour % 12) + (v === 'pm' ? 12 : 0))}
        options={[
          { value: 'am', label: 'AM' },
          { value: 'pm', label: 'PM' },
        ]}
      />
      <Grid columns={6} items={HOURS_12} render={(h) => <Cell key={h} label={String(h)} a11y={`${h} ${pm ? 'PM' : 'AM'}`} on={h === h12} onPress={() => onHour((h % 12) + (pm ? 12 : 0))} />} />
      <Grid columns={6} items={MINUTES} render={(m) => <Cell key={m} label={`:${pad(m)}`} on={m === minute} onPress={() => onMinute(m)} />} />
    </View>
  );
}

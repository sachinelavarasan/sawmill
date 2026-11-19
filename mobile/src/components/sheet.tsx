/**
 * Pickers built on AppBottomSheet (components/bottom-sheet.tsx): SelectField (with search and
 * add-new), DateField, DateTimeField and PeriodPicker. The sheet itself — look, height, gestures,
 * back button, safe areas — lives in AppBottomSheet; nothing here styles a sheet.
 */
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { dateOnly, isoDay, type Period, PERIOD_KEYS, presets, todayIso } from '../lib/format';
import { useT } from '../lib/i18n';
import { CalendarPicker, TimePicker } from './calendar';
import { AppBottomSheet, SheetActions, type SheetHandle, SheetInput, useSheet, useSheetColors } from './bottom-sheet';
import { useThemeToggle } from '../lib/theme';
import { fontStyleFor, Text } from './text';
import { toast } from './toast';
import { Chip, cn, Icon, Muted } from './ui';

// the sheet plumbing lives in bottom-sheet.tsx; re-exported for the many screens that import it from here
export { AppBottomSheet, SheetActions, SheetInput, useSheet };
export type { SheetHandle };

// ───────── form-field trigger ─────────

/** Looks like an input; tapping opens a picker. */
export function PickerTrigger({
  label,
  required,
  value,
  placeholder,
  icon,
  error,
  hint,
  onPress,
  disabled,
}: {
  label: string;
  required?: boolean;
  value?: string | null;
  placeholder?: string;
  icon: 'chevron-down' | 'calendar' | 'clock';
  error?: string | null;
  hint?: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const t = useT();
  return (
    <View className="gap-1.5">
      <Text className="text-[13px] font-semibold text-foreground">
        {label}
        {required && <Text className="text-destructive"> *</Text>}
      </Text>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder || t('choose')}`}
        className={cn(
          'min-h-[52px] flex-row items-center gap-2 rounded-xl border bg-card px-4 active:bg-secondary',
          error ? 'border-destructive' : 'border-input',
          disabled && 'opacity-60',
        )}
      >
        <Text className={cn('flex-1 text-base', value ? 'text-foreground' : 'text-muted-foreground')} numberOfLines={1}>
          {value || placeholder || t('choose')}
        </Text>
        <Icon name={icon} size={18} colorClassName="accent-muted-foreground" />
      </Pressable>
      {error ? <Text className="text-[13px] text-destructive">{error}</Text> : hint ? <Muted>{hint}</Muted> : null}
    </View>
  );
}

// ───────── select ─────────

export interface Option<V extends string = string> {
  value: V;
  label: string;
  hint?: string;
}

/** Dropdown with an optional search box — suppliers, clients, source loads, stock sizes. */
export function SelectField<V extends string>({
  label,
  required,
  value,
  options,
  onChange,
  placeholder,
  searchable,
  error,
  hint,
  disabled,
  allowClear,
  emptyText,
  onCreate,
}: {
  label: string;
  required?: boolean;
  value: V | '' | null;
  options: Option<V>[];
  onChange: (v: V | '') => void;
  placeholder?: string;
  searchable?: boolean;
  error?: string | null;
  hint?: string;
  disabled?: boolean;
  allowClear?: boolean;
  emptyText?: string;
  /** Lets the person add what they typed when it isn't in the list: creates it and resolves to its value. */
  onCreate?: (name: string) => Promise<V>;
}) {
  const sheet = useSheet();
  // the one just added, named here until the refreshed list arrives with it
  const [made, setMade] = useState<Option<V> | null>(null);
  const selected = options.find((o) => o.value === value) ?? (made && made.value === value ? made : undefined);
  return (
    <>
      <PickerTrigger
        label={label}
        required={required}
        value={selected?.label}
        placeholder={placeholder}
        icon="chevron-down"
        error={error}
        hint={selected?.hint ?? hint}
        onPress={sheet.open}
        disabled={disabled}
      />
      <SelectSheet
        ref={sheet.ref}
        title={label}
        options={options}
        value={value}
        searchable={!!onCreate || (searchable ?? options.length > 8)}
        allowClear={allowClear}
        emptyText={emptyText}
        onCreate={
          onCreate &&
          (async (name) => {
            const v = await onCreate(name);
            setMade({ value: v, label: name });
            onChange(v);
            sheet.close();
          })
        }
        onPick={(v) => {
          onChange(v);
          sheet.close();
        }}
      />
    </>
  );
}

export const SelectSheet = forwardRef<
  SheetHandle,
  {
    title: string;
    options: Option[];
    value: string | null;
    searchable?: boolean;
    allowClear?: boolean;
    emptyText?: string;
    onPick: (v: any) => void;
    /** adds the typed name (see SelectField) */
    onCreate?: (name: string) => Promise<void>;
  }
>(function SelectSheet({ title, options, value, searchable, allowClear, emptyText, onPick, onCreate }, ref) {
  const t = useT();
  const sheet = useRef<SheetHandle>(null);
  const { surface } = useSheetColors();
  const { dark } = useThemeToggle();
  const [q, setQ] = useState('');
  useImperativeHandle(ref, () => ({ open: () => sheet.current?.open(), close: () => sheet.current?.close() }), []);
  const [adding, setAdding] = useState(false);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/\s+/g, '');
    if (!needle) return options;
    return options.filter((o) => `${o.label} ${o.hint ?? ''}`.toLowerCase().replace(/\s+/g, '').includes(needle));
  }, [q, options]);
  const typed = q.trim().replace(/\s+/g, ' ');
  const squash = (s: string) => s.toLowerCase().replace(/\s+/g, '');
  // offered unless that exact name (ignoring case and spaces) is already in the list
  const canAdd = !!onCreate && typed.length >= 2 && !options.some((o) => squash(o.label) === squash(typed));
  const add = async () => {
    if (!onCreate || adding) return;
    setAdding(true);
    try {
      await onCreate(typed);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setAdding(false);
    }
  };

  return (
    // a long or searchable list gets the tall fixed sheet (it doesn't jump while you type); a short one fits its options
    <AppBottomSheet ref={sheet} variant={searchable ? 'expanded' : 'medium'} content="list" title={title} onDismiss={() => setQ('')}>
      {({ header, bottomPadding }) => (
      <BottomSheetFlatList
        data={shown}
        keyExtractor={(o: Option) => o.value}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        // title and search stay put while the options scroll
        stickyHeaderIndices={[0]}
        ListHeaderComponent={
          <View style={{ backgroundColor: surface }}>
            {header}
            <View className="gap-3 px-5 pb-2">
            {searchable && (
              <View className={cn('min-h-12 flex-row items-center gap-2.5 rounded-xl border border-border px-3.5', dark ? 'bg-primary-soft' : 'bg-secondary')}>
                <Icon name="search" size={18} colorClassName="accent-muted-foreground" />
                <SheetInput
                  value={q}
                  onChangeText={setQ}
                  placeholder={onCreate ? t('searchOrAddName') : t('search')}
                  maxLength={onCreate ? 120 : undefined}
                  returnKeyType={canAdd ? 'done' : undefined}
                  onSubmitEditing={canAdd && !shown.length ? () => void add() : undefined}
                  placeholderTextColorClassName="accent-muted-foreground"
                  autoCorrect={false}
                  accessibilityLabel={t('search')}
                  className="flex-1 py-2 text-[15px] text-foreground"
                  style={fontStyleFor()}
                />
              </View>
            )}
            {canAdd && (
              <Pressable
                onPress={() => void add()}
                disabled={adding}
                accessibilityRole="button"
                accessibilityLabel={t('addNamed', { name: typed })}
                accessibilityState={{ busy: adding }}
                className={cn('min-h-16 flex-row items-center gap-3 rounded-2xl border border-saffron/35 bg-saffron-soft px-3.5 py-3 active:opacity-75', adding && 'opacity-75')}
              >
                <View className="size-10 items-center justify-center rounded-full bg-saffron">
                  {adding ? <ActivityIndicator size="small" colorClassName="accent-saffron-foreground" /> : <Icon name="plus" size={20} colorClassName="accent-saffron-foreground" />}
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-[15px] font-bold text-foreground" numberOfLines={1}>
                    {t('addNamed', { name: typed })}
                  </Text>
                  <Text className="text-[13px] text-saffron-strong" numberOfLines={1}>
                    {t('notInListTapToAdd')}
                  </Text>
                </View>
                <Icon name="chevron-right" size={18} colorClassName="accent-saffron-strong" />
              </Pressable>
            )}
            {allowClear && value && (
              <Pressable onPress={() => onPick('')} accessibilityRole="button" className="min-h-11 justify-center">
                <Text className="text-[15px] font-semibold text-destructive">{t('clear')}</Text>
              </Pressable>
            )}
            </View>
          </View>
        }
        ListEmptyComponent={canAdd ? null : <Muted className="px-5 py-6">{options.length ? t('noResults') : (emptyText ?? t('noData'))}</Muted>}
        renderItem={({ item }: { item: Option }) => {
          const on = item.value === value;
          return (
            <Pressable
              onPress={() => onPick(item.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              className={cn('min-h-14 flex-row items-center gap-3 border-b border-border px-5 py-3 active:bg-secondary', on && 'bg-saffron-soft')}
            >
              <View className="flex-1">
                <Text className={cn('text-[15px] text-foreground', on ? 'font-bold' : 'font-medium')}>{item.label}</Text>
                {!!item.hint && <Muted>{item.hint}</Muted>}
              </View>
              {on && <Icon name="check" size={18} colorClassName="accent-saffron-strong" />}
            </Pressable>
          );
        }}
      />
      )}
    </AppBottomSheet>
  );
});

// ───────── dates ─────────

/** CalendarPicker in a sheet; `value` / result are YYYY-MM-DD days. Picking a day closes it. */
const CalendarSheet = forwardRef<SheetHandle, { title: string; value: string | null; min?: string; max?: string; onPick: (day: string) => void }>(
  function CalendarSheet({ title, value, min, max, onPick }, ref) {
    const t = useT();
    const today = todayIso();
    const todayAllowed = (!min || today >= min) && (!max || today <= max);
    return (
      <AppBottomSheet ref={ref} variant="medium" title={title} padded={false}>
        <CalendarPicker value={value} min={min} max={max} onChange={onPick} />
        {todayAllowed && (
          <View className="flex-row gap-2.5 px-5 pt-3">
            <Chip text={t('today')} on={value === today} onPress={() => onPick(today)} />
          </View>
        )}
      </AppBottomSheet>
    );
  },
);

export function DateField({
  label,
  required,
  value,
  onChange,
  min,
  max,
  error,
  hint,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (day: string) => void;
  min?: string;
  max?: string;
  error?: string | null;
  hint?: string;
}) {
  const sheet = useSheet();
  return (
    <>
      <PickerTrigger label={label} required={required} value={value ? dateOnly(value) : ''} icon="calendar" error={error} hint={hint} onPress={sheet.open} />
      <CalendarSheet
        ref={sheet.ref}
        title={label}
        value={value || null}
        min={min}
        max={max}
        onPick={(d) => {
          onChange(d);
          sheet.close();
        }}
      />
    </>
  );
}

/**
 * Date and time (an ISO timestamp, or '' for none): day from a calendar, hour and
 * minute from chips — no typing. "Now" fills both at once.
 */
export function DateTimeField({ label, value, onChange, hint }: { label: string; value: string; onChange: (iso: string) => void; hint?: string }) {
  const t = useT();
  const sheet = useSheet();
  const d = value ? new Date(value) : null;
  const [day, setDay] = useState(d ? isoDay(d) : todayIso());
  const [hour, setHour] = useState(d ? d.getHours() : new Date().getHours());
  const [minute, setMinute] = useState(d ? Math.floor(d.getMinutes() / 5) * 5 : 0);
  const shown = d ? d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
  const commit = () => {
    const [y, m, dd] = day.split('-').map(Number);
    onChange(new Date(y, m - 1, dd, hour, minute).toISOString());
    sheet.close();
  };
  return (
    <>
      <PickerTrigger label={label} value={shown} placeholder={t('notSet')} icon="clock" hint={hint} onPress={sheet.open} />
      <AppBottomSheet
        ref={sheet.ref}
        variant="expanded"
        title={label}
        padded={false}
        footer={
          <SheetActions
            primary={{ title: t('apply'), onPress: commit }}
            secondary={[
              ...(value
                ? [
                    {
                      title: t('clear'),
                      onPress: () => {
                        onChange('');
                        sheet.close();
                      },
                    },
                  ]
                : []),
              {
                title: t('now'),
                onPress: () => {
                  onChange(new Date().toISOString());
                  sheet.close();
                },
              },
            ]}
          />
        }
      >
        <View className="gap-5">
          <CalendarPicker value={day} onChange={setDay} />
          <View className="h-px bg-border" />
          <TimePicker hour={hour} minute={minute} onHour={setHour} onMinute={setMinute} />
        </View>
      </AppBottomSheet>
    </>
  );
}

/** Quick ranges as chips, plus a from–to pair for anything else. */
/** `value` null = no period chosen (a filter left open): no chip is lit. */
export function PeriodPicker({ value, onChange }: { value: Period | null; onChange: (p: Period) => void }) {
  const t = useT();
  const p = presets();
  const custom = !!value && !PERIOD_KEYS.some((k) => p[k].from === value.from && p[k].to === value.to);
  const sheet = useSheet();
  const [draft, setDraft] = useState(value ?? p.thisMonth);
  return (
    <>
      <View className="flex-row flex-wrap gap-1.5">
        {PERIOD_KEYS.map((k) => (
          <Chip key={k} text={t(k)} on={!!value && p[k].from === value.from && p[k].to === value.to} onPress={() => onChange(p[k])} />
        ))}
        <Chip
          text={custom && value ? `${dateOnly(value.from)} – ${dateOnly(value.to)}` : t('customRange')}
          on={custom}
          onPress={() => {
            setDraft(value ?? p.thisMonth);
            sheet.open();
          }}
        />
      </View>
      <AppBottomSheet
        ref={sheet.ref}
        variant="medium"
        title={t('customRange')}
        footer={
          <SheetActions
            primary={{
              title: t('apply'),
              disabled: draft.from > draft.to,
              onPress: () => {
                onChange(draft);
                sheet.close();
              },
            }}
          />
        }
      >
        <View className="gap-3">
          <DateField label={t('from')} value={draft.from} max={draft.to} onChange={(from) => setDraft((d) => ({ ...d, from }))} />
          <DateField label={t('to')} value={draft.to} min={draft.from} onChange={(to) => setDraft((d) => ({ ...d, to }))} />
        </View>
      </AppBottomSheet>
    </>
  );
}

/**
 * Bottom sheets (@gorhom/bottom-sheet): pickers, filters and the Quick Add menu.
 * `Sheet` is the themed shell; SelectField / DateField / PeriodPicker are built on it.
 */
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { forwardRef, ReactNode, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable, withUniwind } from 'uniwind';
import { dateOnly, isoDay, type Period, PERIOD_KEYS, presets, todayIso } from '../lib/format';
import { useT } from '../lib/i18n';
import { InSheet } from './sheet-context';
import { Button, Chip, cn, Icon, Muted } from './ui';

export const SheetInput = withUniwind(BottomSheetTextInput);

export interface SheetHandle {
  open: () => void;
  close: () => void;
}

export function useSheet() {
  const ref = useRef<SheetHandle>(null);
  return { ref, open: () => ref.current?.open(), close: () => ref.current?.close() };
}

function useSheetColors() {
  const [card, border] = useCSSVariable(['--color-card', '--color-input']);
  return { card: String(card ?? '#ffffff'), handle: String(border ?? '#cbd5e1') };
}

/** Themed bottom sheet. Children scroll; `footer` stays pinned at the bottom (Apply / Save). */
export const Sheet = forwardRef<SheetHandle, { title?: string; children: ReactNode; footer?: ReactNode; onDismiss?: () => void; scroll?: boolean }>(
  function Sheet({ title, children, footer, onDismiss, scroll = true }, ref) {
    const modal = useRef<BottomSheetModal>(null);
    const insets = useSafeAreaInsets();
    const colors = useSheetColors();
    useImperativeHandle(ref, () => ({ open: () => modal.current?.present(), close: () => modal.current?.dismiss() }), []);
    const backdrop = useCallback(
      (p: BottomSheetBackdropProps) => <BottomSheetBackdrop {...p} pressBehavior="close" appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.45} />,
      [],
    );
    const head = title ? (
      <Text className="px-5 pb-3 text-lg font-bold text-foreground" accessibilityRole="header">
        {title}
      </Text>
    ) : null;
    return (
      <BottomSheetModal
        ref={modal}
        enableDynamicSizing
        backdropComponent={backdrop}
        onDismiss={onDismiss}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backgroundStyle={{ backgroundColor: colors.card, borderRadius: 24 }}
        handleIndicatorStyle={{ backgroundColor: colors.handle, width: 40 }}
      >
        <InSheet.Provider value>
        {scroll ? (
          <BottomSheetScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: footer ? 12 : 20 + insets.bottom }}>
            {head}
            {children}
            {footer && <View style={{ paddingBottom: insets.bottom }} className="gap-2.5 px-5 pt-3">{footer}</View>}
          </BottomSheetScrollView>
        ) : (
          <View style={{ paddingBottom: 12 + insets.bottom }}>
            {head}
            {children}
            {footer && <View className="gap-2.5 px-5 pt-3">{footer}</View>}
          </View>
        )}
        </InSheet.Provider>
      </BottomSheetModal>
    );
  },
);

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
      <Text className="text-sm font-semibold text-foreground">
        {label}
        {required && <Text className="text-destructive"> *</Text>}
      </Text>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder || t('choose')}`}
        className={cn(
          'min-h-[52px] flex-row items-center gap-2 rounded-xl border-[1.5px] bg-card px-4 active:bg-secondary',
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
}) {
  const sheet = useSheet();
  const selected = options.find((o) => o.value === value);
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
        searchable={searchable ?? options.length > 8}
        allowClear={allowClear}
        emptyText={emptyText}
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
  { title: string; options: Option[]; value: string | null; searchable?: boolean; allowClear?: boolean; emptyText?: string; onPick: (v: any) => void }
>(function SelectSheet({ title, options, value, searchable, allowClear, emptyText, onPick }, ref) {
  const t = useT();
  const modal = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const colors = useSheetColors();
  const [q, setQ] = useState('');
  useImperativeHandle(ref, () => ({ open: () => modal.current?.present(), close: () => modal.current?.dismiss() }), []);
  const backdrop = useCallback(
    (p: BottomSheetBackdropProps) => <BottomSheetBackdrop {...p} pressBehavior="close" appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.45} />,
    [],
  );
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/\s+/g, '');
    if (!needle) return options;
    return options.filter((o) => `${o.label} ${o.hint ?? ''}`.toLowerCase().replace(/\s+/g, '').includes(needle));
  }, [q, options]);

  return (
    <BottomSheetModal
      ref={modal}
      snapPoints={searchable ? ['85%'] : undefined}
      enableDynamicSizing={!searchable}
      backdropComponent={backdrop}
      onDismiss={() => setQ('')}
      keyboardBehavior="interactive"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={{ backgroundColor: colors.card, borderRadius: 24 }}
      handleIndicatorStyle={{ backgroundColor: colors.handle, width: 40 }}
    >
      <BottomSheetFlatList
        data={shown}
        keyExtractor={(o: Option) => o.value}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 20 + insets.bottom }}
        ListHeaderComponent={
          <View className="gap-3 px-5 pb-2">
            <Text className="text-lg font-bold text-foreground" accessibilityRole="header">
              {title}
            </Text>
            {searchable && (
              <View className="min-h-12 flex-row items-center gap-2 rounded-xl border border-border bg-secondary px-3.5">
                <Icon name="search" size={18} colorClassName="accent-muted-foreground" />
                <SheetInput
                  value={q}
                  onChangeText={setQ}
                  placeholder={t('search')}
                  placeholderTextColorClassName="accent-muted-foreground"
                  autoCorrect={false}
                  accessibilityLabel={t('search')}
                  className="flex-1 py-2 text-[15px] text-foreground"
                />
              </View>
            )}
            {allowClear && value && (
              <Pressable onPress={() => onPick('')} accessibilityRole="button" className="min-h-11 justify-center">
                <Text className="text-[15px] font-semibold text-destructive">{t('clear')}</Text>
              </Pressable>
            )}
          </View>
        }
        ListEmptyComponent={<Muted className="px-5 py-6">{options.length ? t('noResults') : (emptyText ?? t('noData'))}</Muted>}
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
              {on && <Icon name="check" size={18} colorClassName="accent-warning" />}
            </Pressable>
          );
        }}
      />
    </BottomSheetModal>
  );
});

// ───────── dates ─────────

function useCalendarTheme() {
  const [card, fg, muted, saffron, saffronFg, primary] = useCSSVariable([
    '--color-card',
    '--color-foreground',
    '--color-muted-foreground',
    '--color-saffron',
    '--color-saffron-foreground',
    '--color-primary',
  ]).map(String);
  return {
    backgroundColor: card,
    calendarBackground: card,
    textSectionTitleColor: muted,
    dayTextColor: fg,
    textDisabledColor: muted,
    todayTextColor: saffron,
    selectedDayBackgroundColor: saffron,
    selectedDayTextColor: saffronFg,
    monthTextColor: fg,
    arrowColor: primary,
    textDayFontSize: 15,
    textMonthFontSize: 16,
    textMonthFontWeight: '700' as const,
    textDayHeaderFontSize: 12,
  };
}

/** Calendar in a sheet; `value` / result are YYYY-MM-DD days. */
const CalendarSheet = forwardRef<SheetHandle, { title: string; value: string | null; min?: string; max?: string; onPick: (day: string) => void }>(
  function CalendarSheet({ title, value, min, max, onPick }, ref) {
    const theme = useCalendarTheme();
    const t = useT();
    const today = todayIso();
    return (
      <Sheet ref={ref} title={title} scroll={false}>
        <Calendar
          key={`${value}-${theme.calendarBackground}`}
          current={value ?? today}
          minDate={min}
          maxDate={max}
          firstDay={1}
          enableSwipeMonths
          onDayPress={(d: DateData) => onPick(d.dateString)}
          markedDates={value ? { [value]: { selected: true } } : {}}
          theme={theme}
        />
        <View className="flex-row gap-2.5 px-5 pt-2">
          <Chip text={t('today')} on={value === today} onPress={() => onPick(today)} />
        </View>
      </Sheet>
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
  const theme = useCalendarTheme();
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
      <Sheet
        ref={sheet.ref}
        title={label}
        footer={
          <View className="flex-row gap-2.5">
            {!!value && (
              <Button
                className="flex-1"
                kind="secondary"
                title={t('clear')}
                onPress={() => {
                  onChange('');
                  sheet.close();
                }}
              />
            )}
            <Button
              className="flex-1"
              kind="secondary"
              title={t('now')}
              onPress={() => {
                onChange(new Date().toISOString());
                sheet.close();
              }}
            />
            <Button className="flex-1" title={t('apply')} onPress={commit} />
          </View>
        }
      >
        <Calendar key={theme.calendarBackground} current={day} firstDay={1} onDayPress={(x: DateData) => setDay(x.dateString)} markedDates={{ [day]: { selected: true } }} theme={theme} />
        <View className="gap-2 px-5 pt-2">
          <Muted>{t('time')}</Muted>
          <View className="flex-row flex-wrap gap-1.5">
            {Array.from({ length: 24 }, (_, h) => (
              <Chip key={h} text={`${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`} on={hour === h} onPress={() => setHour(h)} />
            ))}
          </View>
          <View className="flex-row flex-wrap gap-1.5">
            {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
              <Chip key={m} text={`:${String(m).padStart(2, '0')}`} on={minute === m} onPress={() => setMinute(m)} />
            ))}
          </View>
        </View>
      </Sheet>
    </>
  );
}

/** Quick ranges as chips, plus a from–to pair for anything else. */
export function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const t = useT();
  const p = presets();
  const custom = !PERIOD_KEYS.some((k) => p[k].from === value.from && p[k].to === value.to);
  const sheet = useSheet();
  const [draft, setDraft] = useState(value);
  return (
    <>
      <View className="flex-row flex-wrap gap-1.5">
        {PERIOD_KEYS.map((k) => (
          <Chip key={k} text={t(k)} on={p[k].from === value.from && p[k].to === value.to} onPress={() => onChange(p[k])} />
        ))}
        <Chip
          text={custom ? `${dateOnly(value.from)} – ${dateOnly(value.to)}` : t('customRange')}
          on={custom}
          onPress={() => {
            setDraft(value);
            sheet.open();
          }}
        />
      </View>
      <Sheet
        ref={sheet.ref}
        title={t('customRange')}
        footer={
          <Button
            title={t('apply')}
            disabled={draft.from > draft.to}
            onPress={() => {
              onChange(draft);
              sheet.close();
            }}
          />
        }
      >
        <View className="gap-3 px-5">
          <DateField label={t('from')} value={draft.from} max={draft.to} onChange={(from) => setDraft((d) => ({ ...d, from }))} />
          <DateField label={t('to')} value={draft.to} min={draft.from} onChange={(to) => setDraft((d) => ({ ...d, to }))} />
        </View>
      </Sheet>
    </>
  );
}

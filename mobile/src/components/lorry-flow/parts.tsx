/**
 * The pieces of the Lorry In / Lorry Out step-by-step screens ("Sawmill Pro – Lorry In & Out" mockup):
 * one question per screen, big words, big buttons, nothing else on the page.
 *
 *   StepScreen   round back button · step dots · big question · one line under it · the page ·
 *                one big button pinned at the bottom (taupe while it can't go on)
 *   PlateField   the lorry number on a yellow plate (dashed cream while empty), and a button that
 *                lists the lorries seen before
 *   TimeChip     "Arrived today, 8:40 AM · Change" — a date & time sheet
 *   ChoiceGrid   wood type / category as big buttons, "+ New" dashed
 *   BoxField     a white box with its label inside ("Name" over "Murugan"), two per row
 *   CheckCard    the "All correct?" card: plate, then label / value rows
 *   NoteCard     a soft note with an icon (what happens next, or what is missing)
 */
import { useRouter } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, TextInput as RNTextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isoDay, timeOnly, todayIso } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { AppBottomSheet, SheetActions, useSheet } from '../bottom-sheet';
import { CalendarPicker, TimePicker } from '../calendar';
import { KeyboardView } from '../keyboard';
import { useStatusBar } from '../header';
import { Tap } from '../motion';
import { fontStyleFor, Text, TextInput } from '../text';
import { cn, Icon, type IconName, ModTile, type Mod, Plate } from '../ui';

// ───────── the frame ─────────

/** Step dots: the current one is a long pill, done ones dark, later ones pale. */
function StepDots({ step, total }: { step: number; total: number }) {
  const t = useT();
  return (
    <View className="flex-row items-center gap-1.5" accessible accessibilityLabel={t('stepOfThree', { n: step })}>
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <View key={n} className={cn('h-2 rounded-full', n === step ? 'w-6 bg-primary' : n < step ? 'w-2 bg-primary' : 'w-2 bg-input')} />
      ))}
    </View>
  );
}

/**
 * One step: back (to the step before, or out of the flow on the first), the dots, the question and
 * the page, with the big button pinned at the bottom. Android's back button goes a step back too.
 */
export function StepScreen({
  step,
  total = 3,
  title,
  sub,
  onBack,
  footer,
  children,
  scroll = true,
  footerPanel,
  dots = true,
}: {
  step: number;
  total?: number;
  title: string;
  sub?: string;
  /** a step back; on the first step, leave the flow */
  onBack: () => void;
  footer: ReactNode;
  children: ReactNode;
  /** false: the page lays itself out (an empty state centred in the space) */
  scroll?: boolean;
  /** the footer on a white panel with rounded top corners (a running total beside the button) */
  footerPanel?: boolean;
  /** false: a page that isn't one of a flow's steps (a record), no dots */
  dots?: boolean;
}) {
  const t = useT();
  const insets = useSafeAreaInsets();
  useStatusBar(false); // dark icons on the cream page
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const head = (
    <View className="gap-1 pb-4">
      <Text className="text-[24px] font-bold leading-[30px] tracking-tight text-foreground font-display" accessibilityRole="header">
        {title}
      </Text>
      {!!sub && <Text className="text-[14px] leading-5 text-muted-foreground">{sub}</Text>}
    </View>
  );

  return (
    // the app's keyboard handling (iOS pads, Android shrinks to the space left), so the fields being
    // typed in and the big button stay above the keyboard
    <KeyboardView className="bg-background">
      <View className="flex-row items-center px-4 pb-2" style={{ paddingTop: insets.top + 8 }}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          hitSlop={6}
          className="h-11 w-11 items-center justify-center rounded-full bg-card shadow-sm shadow-black/10 active:opacity-80"
        >
          <Icon name="chevron-left" size={22} colorClassName="accent-foreground" />
        </Pressable>
        <View className="flex-1 items-center">
          {dots && <StepDots step={step} total={total} />}
        </View>
        <View className="w-11" />
      </View>
      {scroll ? (
        <ScrollView className="flex-1" contentContainerClassName="px-4 pt-2 pb-6" keyboardShouldPersistTaps="handled">
          {head}
          {children}
        </ScrollView>
      ) : (
        <View className="flex-1 px-4 pt-2">
          {head}
          {children}
        </View>
      )}
      {footer ? (
        <View className={cn('px-4', footerPanel ? 'rounded-t-[26px] bg-card pt-3 shadow-lg shadow-black/10' : 'pt-2.5')} style={{ paddingBottom: insets.bottom + 12 }}>
          {footer}
        </View>
      ) : (
        <View style={{ height: insets.bottom }} />
      )}
    </KeyboardView>
  );
}

/** The one big button at the bottom: walnut when it can go on, taupe while it can't. */
export function BigButton({ title, onPress, disabled, busy, icon = 'arrow-right' }: { title: string; onPress: () => void; disabled?: boolean; busy?: boolean; icon?: IconName | null }) {
  const off = !!disabled && !busy;
  return (
    <Tap
      scale={0.97}
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      className={cn('min-h-[54px] flex-row items-center justify-center gap-2 rounded-[18px] px-5', off ? 'bg-input' : 'bg-primary active:opacity-90', busy && 'opacity-85')}
    >
      {busy ? (
        <ActivityIndicator colorClassName="accent-primary-foreground" />
      ) : (
        <>
          <Text className="shrink text-center text-[16px] font-semibold text-primary-foreground" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{title}</Text>
          {!!icon && !off && <Icon name={icon} size={19} colorClassName="accent-primary-foreground" />}
        </>
      )}
    </Tap>
  );
}

/** The quiet second option under the big button ("Save as draft"). */
export function QuietButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" className={cn('min-h-11 items-center justify-center active:opacity-70', disabled && 'opacity-50')}>
      <Text className="text-[15px] font-semibold text-saffron-strong">{title}</Text>
    </Pressable>
  );
}

/** A small heading over a group ("WOOD TYPE", "DRIVER"). */
export function GroupLabel({ children }: { children: string }) {
  return <Text className="pb-2 pt-4 text-[12px] font-bold uppercase tracking-[0.6px] text-muted-foreground">{children}</Text>;
}

// ───────── lorry number ─────────

/** "tn45ab1234" / "TN 45  ab 1234" → upper-cased, single spaces. */
export const cleanPlate = (s: string) => s.toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trimStart();

/**
 * The lorry number on a yellow plate, typed in place (dashed cream while empty), and beside it a
 * dark button that lists the lorries seen before (the camera in the mockup comes later).
 */
export function PlateField({ value, onChange, onPick }: { value: string; onChange: (v: string) => void; onPick: () => void }) {
  const t = useT();
  const empty = !value.trim();
  return (
    <View className="flex-row gap-3">
      <View className={cn('h-[64px] flex-1 justify-center rounded-[18px] px-2', empty ? 'border-2 border-dashed border-input bg-saffron-soft' : 'border-[2.5px] border-plate-foreground bg-plate')}>
        <TextInput
          value={value}
          onChangeText={(v) => onChange(cleanPlate(v))}
          placeholder={t('platePlaceholder')}
          placeholderTextColorClassName="accent-muted-foreground"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={20}
          accessibilityLabel={t('lorryNumber')}
          className="text-center text-[22px] font-bold tracking-[1.5px] text-plate-foreground"
          style={fontStyleFor('font-bold')}
        />
      </View>
      <Pressable
        onPress={onPick}
        accessibilityRole="button"
        accessibilityLabel={t('pickOrAddLorry')}
        className="h-[64px] w-[64px] items-center justify-center rounded-[18px] bg-primary active:opacity-85"
      >
        <Icon name="list" size={24} colorClassName="accent-primary-foreground" />
      </Pressable>
    </View>
  );
}

// ───────── time ─────────

/** "today, 8:40 AM", or the date and time for another day. */
export function whenText(iso: string, t: ReturnType<typeof useT>) {
  const d = new Date(iso);
  return isoDay(d) === todayIso() ? t('todayAt', { time: timeOnly(iso) }) : `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${timeOnly(iso)}`;
}

/** "🕐 Arrived today, 8:40 AM · Change": tap to pick another date and time. `value` null = now. */
export function TimeChip({ label, value, onChange, title }: { label: string; value: string | null; onChange: (iso: string | null) => void; title: string }) {
  const t = useT();
  const sheet = useSheet();
  const start = value ? new Date(value) : new Date();
  const [day, setDay] = useState(isoDay(start));
  const [hour, setHour] = useState(start.getHours());
  const [minute, setMinute] = useState(Math.floor(start.getMinutes() / 5) * 5);
  const open = () => {
    const d = value ? new Date(value) : new Date();
    setDay(isoDay(d));
    setHour(d.getHours());
    setMinute(Math.floor(d.getMinutes() / 5) * 5);
    sheet.open();
  };
  const commit = () => {
    const [y, m, dd] = day.split('-').map(Number);
    const picked = new Date(y, m - 1, dd, hour, minute);
    // never in the future: a lorry can't have arrived later than now
    onChange(picked.getTime() > Date.now() ? null : picked.toISOString());
    sheet.close();
  };
  return (
    <>
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`${label}. ${t('change')}`} className="mt-3 max-w-full flex-row flex-wrap items-center gap-x-2 gap-y-0.5 self-start rounded-full bg-secondary px-3.5 py-2.5 active:opacity-80">
        <Icon name="clock" size={16} colorClassName="accent-saffron-strong" />
        <Text className="text-[14px] font-medium text-foreground">{label}</Text>
        <Text className="text-[14px] font-semibold text-saffron-strong">· {t('change')}</Text>
      </Pressable>
      <AppBottomSheet
        ref={sheet.ref}
        variant="expanded"
        title={title}
        padded={false}
        footer={<SheetActions primary={{ title: t('apply'), onPress: commit }} secondary={{ title: t('now'), onPress: () => (onChange(null), sheet.close()) }} />}
      >
        <View className="gap-5">
          <CalendarPicker value={day} onChange={setDay} max={todayIso()} />
          <View className="h-px bg-border" />
          <TimePicker hour={hour} minute={minute} onHour={setHour} onMinute={setMinute} />
        </View>
      </AppBottomSheet>
    </>
  );
}

// ───────── choices ─────────

/**
 * Big choice buttons, three to a row, the chosen one walnut with a tick; "+ New" dashed at the end.
 * With nothing to choose yet, one wide dashed "+ Add …" button and a line saying they stay.
 */
export function ChoiceGrid({
  options,
  value,
  onChange,
  onNew,
  addLabel,
  emptyHint,
  wide,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  /** asks for a new name; absent = no "+ New" */
  onNew?: () => void;
  /** "Add wood type" — the wide button when there is nothing yet */
  addLabel: string;
  emptyHint?: string;
  /** two to a row (long names, e.g. categories) */
  wide?: boolean;
}) {
  const t = useT();
  if (!options.length)
    return onNew ? (
      <View className="gap-2.5">
        <Pressable onPress={onNew} accessibilityRole="button" className="min-h-[50px] flex-row items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-input active:bg-secondary">
          <Icon name="plus" size={18} colorClassName="accent-saffron-strong" />
          <Text className="text-[15px] font-semibold text-saffron-strong">{addLabel}</Text>
        </Pressable>
        {!!emptyHint && <Text className="text-[13px] text-muted-foreground">{emptyHint}</Text>}
      </View>
    ) : null;
  const basis = wide ? 'basis-[46%]' : 'basis-[29%]';
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => {
        const on = o === value;
        return (
          <Tap
            key={o}
            scale={0.96}
            haptic={!on}
            onPress={() => onChange(o)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            className={cn('min-h-[50px] grow flex-row items-center justify-center gap-1 rounded-2xl border-2 px-2', basis, on ? 'border-primary bg-primary' : 'border-control-border bg-card')}
          >
            {on && <Icon name="check" size={15} strokeWidth={2.75} colorClassName="accent-primary-foreground" />}
            <Text className={cn('shrink text-center text-[15px] font-semibold', on ? 'text-primary-foreground' : 'text-foreground')} numberOfLines={2}>
              {o}
            </Text>
          </Tap>
        );
      })}
      {onNew && (
        <Pressable
          onPress={onNew}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          className={cn('min-h-[50px] grow flex-row items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-input px-2 active:bg-secondary', basis)}
        >
          <Text className="text-[15px] font-semibold text-saffron-strong">+ {t('newChoice')}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ───────── fields ─────────

/** A white box with its label inside, over the value ("Name" / "Murugan"). Tap anywhere to type. */
export function BoxField({
  label,
  value,
  onChange,
  placeholder,
  phone,
  error,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  phone?: boolean;
  error?: string | null;
  required?: boolean;
}) {
  const [input, setInput] = useState<RNTextInput | null>(null);
  const [focused, setFocused] = useState(false);
  return (
    <View className="flex-1 gap-1">
      <Pressable
        onPress={() => input?.focus()}
        className={cn('min-h-[62px] justify-center rounded-2xl border-2 bg-card px-3.5 py-2', error ? 'border-destructive' : focused ? 'border-saffron' : 'border-control-border')}
      >
        <Text className="text-[12px] font-medium text-muted-foreground" numberOfLines={1}>
          {label}
          {required && <Text className="text-destructive"> *</Text>}
        </Text>
        <TextInput
          ref={setInput}
          value={value}
          onChangeText={(v) => onChange(phone ? v.replace(/[^0-9+ ]/g, '') : v)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColorClassName="accent-muted-foreground"
          keyboardType={phone ? 'phone-pad' : 'default'}
          autoCapitalize={phone ? 'none' : 'words'}
          maxLength={phone ? 15 : 100}
          accessibilityLabel={label}
          className="p-0 text-[16px] font-semibold text-foreground"
          style={fontStyleFor('font-semibold')}
        />
      </Pressable>
      {!!error && <Text className="px-1 text-[12px] text-destructive">{error}</Text>}
    </View>
  );
}

/** Two boxes side by side. */
export function BoxRow({ children }: { children: ReactNode }) {
  return <View className="flex-row gap-2.5">{children}</View>;
}

// ───────── check ─────────

export type CheckRow = { label: string; value: string | null; /** missing and needed: copper "Not added" */ needed?: boolean };

/** "All correct?": the plate (or a dashed "No number") with Edit, then one row per fact. */
export function CheckCard({ plate, onEdit, rows }: { plate: string; onEdit: () => void; rows: CheckRow[] }) {
  const t = useT();
  return (
    <View className="rounded-3xl bg-card px-4 pb-1 pt-4 shadow-sm shadow-black/5">
      <View className="flex-row items-center justify-between gap-3 border-b border-border pb-3">
        {plate ? (
          <Plate number={plate} size="md" />
        ) : (
          <View className="rounded-xl border-2 border-dashed border-input bg-saffron-soft px-3 py-1.5">
            <Text className="text-[15px] font-bold tracking-[1px] text-muted-foreground">{t('noNumber')}</Text>
          </View>
        )}
        <Pressable onPress={onEdit} accessibilityRole="button" hitSlop={8} className="active:opacity-70">
          <Text className="text-[15px] font-semibold text-saffron-strong">{t('edit')}</Text>
        </Pressable>
      </View>
      {rows.map((r, i) => (
        <View key={r.label} className={cn('min-h-[48px] flex-row items-center justify-between gap-3 py-2.5', i < rows.length - 1 && 'border-b border-border')}>
          <Text className="text-[15px] text-muted-foreground">{r.label}</Text>
          <Text className={cn('shrink text-right text-[15px] font-bold', r.value ? 'text-foreground' : r.needed ? 'text-saffron-strong' : 'text-foreground')} numberOfLines={2}>
            {r.value || (r.needed ? t('notAdded') : '—')}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** A soft note: what happens next (`mod` tile), or what is missing (`warn`). */
export function NoteCard({ text, mod, icon, warn }: { text: string; mod?: Mod; icon?: IconName; warn?: boolean }) {
  return (
    <View className={cn('mt-3 flex-row items-center gap-3 rounded-2xl p-3.5', warn ? 'bg-warning-soft' : 'bg-secondary')} accessibilityRole={warn ? 'alert' : undefined}>
      {warn ? <Icon name="alert-circle" size={19} colorClassName="accent-saffron-strong" /> : <ModTile mod={mod ?? 'unload'} icon={icon ?? 'truck'} size="sm" />}
      <Text className={cn('flex-1 text-[14px] leading-5', warn ? 'font-semibold text-saffron-strong' : 'text-foreground')}>{text}</Text>
    </View>
  );
}

/** Leaves a flow for Home, wherever it was opened from. */
export function useLeaveFlow() {
  const router = useRouter();
  return () => (router.canGoBack() ? router.back() : router.replace('/'));
}

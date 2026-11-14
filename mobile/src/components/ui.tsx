/**
 * TimberTrail building blocks for Android, styled with Tailwind classes (Uniwind).
 * Colours come from the theme names in src/global.css — never hex values here.
 * Saffron marks the one primary action on a screen; everything else is slate on white.
 */
import { Feather } from '@expo/vector-icons';
import type { TKey } from '@sawmill/shared';
import { ReactNode, useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import { useLang, useT } from '../lib/i18n';
import { useThemeToggle } from '../lib/theme';
import type { Status } from '../lib/types';

/** Join class names, skipping false / null / undefined. */
export const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

/** Feather icon; colour it with `colorClassName="accent-…"`. */
export const Icon = withUniwind(Feather);
export type IconName = keyof typeof Feather.glyphMap;

export const SafeAreaView = withUniwind(RNSafeAreaView);

// ───────── text ─────────

export function H1({ children }: { children: ReactNode }) {
  return <Text className="text-2xl font-bold tracking-tight text-foreground">{children}</Text>;
}

/** Small heading over a group, with an optional action on the right ("View all"). */
export function SectionTitle({ children, right, action }: { children: ReactNode; right?: ReactNode; action?: { label: string; onPress: () => void } }) {
  return (
    <View className="mt-3 min-h-8 flex-row items-center gap-2">
      <Text className="shrink text-xs font-bold uppercase tracking-wider text-muted-foreground">{children}</Text>
      {right}
      <View className="flex-1" />
      {action && (
        <Pressable onPress={action.onPress} accessibilityRole="button" hitSlop={8} className="min-h-8 justify-center px-1">
          <Text className="text-[13px] font-semibold text-primary">{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function Muted({ children, className, lines }: { children: ReactNode; className?: string; lines?: number }) {
  return (
    <Text className={cn('text-[13px] text-muted-foreground', className)} numberOfLines={lines}>
      {children}
    </Text>
  );
}

// ───────── surfaces ─────────

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <View className={cn('gap-2.5 rounded-xl border border-border bg-card p-4 shadow-sm', className)}>{children}</View>;
}

export function PressableCard({ children, onPress, label, className }: { children: ReactNode; onPress: () => void; label?: string; className?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={cn('gap-2 rounded-xl border border-border bg-card p-4 shadow-sm active:bg-secondary', className)}
    >
      {children}
    </Pressable>
  );
}

export function Grid({ children }: { children: ReactNode }) {
  return <View className="flex-row flex-wrap gap-2.5">{children}</View>;
}

export type Tone = 'warn' | 'good' | 'bad' | 'info';

export const TONE_TEXT: Record<Tone, string> = { warn: 'text-warning', good: 'text-success', bad: 'text-destructive', info: 'text-info' };
export const TONE_BG: Record<Tone, string> = { warn: 'bg-warning-soft', good: 'bg-success-soft', bad: 'bg-destructive-soft', info: 'bg-info-soft' };
export const TONE_ACCENT: Record<Tone, string> = { warn: 'accent-warning', good: 'accent-success', bad: 'accent-destructive', info: 'accent-info' };

/** A figure on the dashboard. Tapping opens the screen behind it. */
export function Kpi({
  label,
  value,
  unit,
  tone,
  icon,
  onPress,
}: {
  label: string;
  value: string | number;
  unit?: string;
  tone?: Tone;
  icon?: IconName;
  onPress?: () => void;
}) {
  const body = (
    <>
      <View className="flex-row items-center gap-1.5">
        {icon && <Icon name={icon} size={14} colorClassName="accent-muted-foreground" />}
        <Text className="flex-1 text-xs font-medium text-muted-foreground" numberOfLines={2}>
          {label}
        </Text>
        {onPress && <Icon name="chevron-right" size={14} colorClassName="accent-muted-foreground" />}
      </View>
      <Text className={cn('text-xl font-bold tabular-nums', tone ? TONE_TEXT[tone] : 'text-foreground')} numberOfLines={1} adjustsFontSizeToFit>
        {value}
        {unit ? <Text className="text-xs font-semibold text-muted-foreground"> {unit}</Text> : null}
      </Text>
    </>
  );
  const box = 'grow basis-[46%] gap-1.5 rounded-xl border border-border bg-card px-3.5 py-3 shadow-sm';
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" className={cn(box, 'active:bg-secondary')}>
      {body}
    </Pressable>
  ) : (
    <View className={box}>{body}</View>
  );
}

/** Two big numbers side by side; the second is highlighted. */
export function StatPair({ a, b }: { a: { label: string; value: string | number }; b: { label: string; value: string | number } }) {
  return (
    <View className="flex-row gap-2.5">
      <View className="flex-1 gap-0.5 rounded-xl border border-border bg-card p-3.5">
        <Text className="text-xs font-semibold text-muted-foreground">{a.label}</Text>
        <Text className="text-2xl font-bold tabular-nums text-foreground">{a.value}</Text>
      </View>
      <View className="flex-1 gap-0.5 rounded-xl bg-primary p-3.5">
        <Text className="text-xs font-semibold text-primary-foreground opacity-85">{b.label}</Text>
        <Text className="text-2xl font-bold tabular-nums text-primary-foreground">{b.value}</Text>
      </View>
    </View>
  );
}

export function Pill({ tone, text, icon }: { tone?: Tone; text: string; icon?: IconName }) {
  return (
    <View className={cn('flex-row items-center gap-1 self-start rounded-full px-2.5 py-[3px]', tone ? TONE_BG[tone] : 'bg-secondary')}>
      {icon && <Icon name={icon} size={11} colorClassName={tone ? TONE_ACCENT[tone] : 'accent-muted-foreground'} />}
      <Text className={cn('text-xs font-semibold', tone ? TONE_TEXT[tone] : 'text-muted-foreground')}>{text}</Text>
    </View>
  );
}

const STATUS: Record<Status, { key: TKey; tone?: Tone }> = {
  DRAFT: { key: 'draft' },
  SUBMITTED: { key: 'pending', tone: 'warn' },
  APPROVED: { key: 'approved', tone: 'good' },
  REJECTED: { key: 'rejected', tone: 'bad' },
};

export function StatusPill({ status }: { status: string }) {
  const t = useT();
  const m = STATUS[status as Status];
  return <Pill tone={m?.tone} text={m ? t(m.key) : status} />;
}

/** "label ........ value" row inside a card. */
export function KV({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="flex-row justify-between gap-3">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className={cn('shrink text-right text-sm text-foreground', strong ? 'font-bold' : 'font-semibold')}>{value}</Text>
    </View>
  );
}

export function Divider() {
  return <View className="h-px bg-border" />;
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const box = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-14 w-14' }[size];
  const text = { sm: 'text-[13px]', md: 'text-base', lg: 'text-xl' }[size];
  return (
    <View className={cn('items-center justify-center rounded-full bg-saffron-soft', box)}>
      <Text className={cn('font-bold text-warning', text)}>{name.trim().charAt(0).toUpperCase() || '?'}</Text>
    </View>
  );
}

/** Red count bubble (pending approvals on the bell / tab). */
export function CountBadge({ n, className }: { n: number; className?: string }) {
  if (!n) return null;
  return (
    <View className={cn('h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1', className)}>
      <Text className="text-[11px] font-bold text-card">{n > 99 ? '99+' : n}</Text>
    </View>
  );
}

// ───────── rows (menus, lists) ─────────

/** A tappable row with an icon tile — menus on the Transactions and More tabs, settings. */
export function MenuRow({
  icon,
  title,
  subtitle,
  value,
  badge,
  onPress,
  tone,
  last,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  value?: string;
  badge?: number;
  onPress?: () => void;
  tone?: 'bad';
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      className={cn('min-h-14 flex-row items-center gap-3 px-4 py-3 active:bg-secondary', !last && 'border-b border-border')}
    >
      {icon && (
        <View className={cn('h-10 w-10 items-center justify-center rounded-lg', tone === 'bad' ? 'bg-destructive-soft' : 'bg-secondary')}>
          <Icon name={icon} size={19} colorClassName={tone === 'bad' ? 'accent-destructive' : 'accent-primary'} />
        </View>
      )}
      <View className="flex-1 gap-0.5">
        <Text className={cn('text-[15px] font-semibold', tone === 'bad' ? 'text-destructive' : 'text-foreground')}>{title}</Text>
        {!!subtitle && <Muted lines={2}>{subtitle}</Muted>}
      </View>
      {!!value && <Text className="text-sm font-semibold text-muted-foreground">{value}</Text>}
      {!!badge && <CountBadge n={badge} />}
      {onPress && <Icon name="chevron-right" size={18} colorClassName="accent-muted-foreground" />}
    </Pressable>
  );
}

/** White rounded group holding MenuRows. */
export function MenuGroup({ children }: { children: ReactNode }) {
  return <View className="overflow-hidden rounded-xl border border-border bg-card">{children}</View>;
}

// ───────── buttons ─────────

type ButtonKind = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  busy,
  className,
  size = 'lg',
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  icon?: IconName;
  disabled?: boolean;
  busy?: boolean;
  className?: string;
  size?: 'md' | 'lg';
}) {
  const box: Record<ButtonKind, string> = {
    primary: 'bg-saffron active:opacity-85',
    secondary: 'border-[1.5px] border-input bg-card active:bg-secondary',
    danger: 'border-[1.5px] border-destructive bg-card active:bg-destructive-soft',
    success: 'bg-success active:opacity-85',
    ghost: 'active:bg-secondary',
  };
  const text: Record<ButtonKind, string> = {
    primary: 'text-saffron-foreground',
    secondary: 'text-foreground',
    danger: 'text-destructive',
    success: 'text-card',
    ghost: 'text-primary',
  };
  const accent: Record<ButtonKind, string> = {
    primary: 'accent-saffron-foreground',
    secondary: 'accent-foreground',
    danger: 'accent-destructive',
    success: 'accent-card',
    ghost: 'accent-primary',
  };
  const off = !!disabled && !busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      className={cn(
        'flex-row items-center justify-center gap-2 rounded-xl px-4',
        size === 'lg' ? 'min-h-[52px]' : 'min-h-11',
        off ? 'border border-border bg-secondary' : box[kind],
        busy && 'opacity-80',
        className,
      )}
    >
      {busy ? (
        <ActivityIndicator colorClassName={accent[kind]} />
      ) : (
        <>
          {icon && <Icon name={icon} size={18} colorClassName={off ? 'accent-muted-foreground' : accent[kind]} />}
          <Text className={cn('shrink text-center font-bold', size === 'lg' ? 'text-base' : 'text-sm', off ? 'text-muted-foreground' : text[kind])} numberOfLines={2}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** Square icon button on a card or page. */
export function IconButton({ icon, label, onPress, tone }: { icon: IconName; label: string; onPress: () => void; tone?: 'bad' }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-11 w-11 items-center justify-center rounded-lg border border-border bg-card active:bg-secondary"
    >
      <Icon name={icon} size={18} colorClassName={tone === 'bad' ? 'accent-destructive' : 'accent-foreground'} />
    </Pressable>
  );
}

/** Filter / choice chip. Selected = saffron. */
export function Chip({ text, on, onPress, count }: { text: string; on?: boolean; onPress: () => void; count?: number }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      className={cn('min-h-9 flex-row items-center gap-1.5 rounded-full border px-3.5', on ? 'border-saffron bg-saffron-soft' : 'border-border bg-card active:bg-secondary')}
    >
      <Text className={cn('text-[13px] font-semibold', on ? 'text-foreground' : 'text-muted-foreground')}>{text}</Text>
      {count != null && count > 0 && <Text className="text-xs font-bold text-warning">{count}</Text>}
    </Pressable>
  );
}

/** Two to four mutually exclusive choices in one bar. */
export function Segmented<V extends string>({ value, options, onChange }: { value: V; options: { value: V; label: string }[]; onChange: (v: V) => void }) {
  return (
    <View className="flex-row rounded-xl bg-secondary p-1" accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            className={cn('min-h-10 flex-1 items-center justify-center rounded-lg px-2', on && 'bg-card shadow-sm')}
          >
            <Text className={cn('text-center text-[13px] font-semibold', on ? 'text-foreground' : 'text-muted-foreground')} numberOfLines={2}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const t = useT();
  return (
    <View className="min-h-12 flex-row items-center gap-2 rounded-xl border border-border bg-card px-3.5">
      <Icon name="search" size={18} colorClassName="accent-muted-foreground" />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColorClassName="accent-muted-foreground"
        cursorColorClassName="accent-primary"
        returnKeyType="search"
        autoCorrect={false}
        accessibilityLabel={placeholder}
        className="flex-1 py-2 text-[15px] text-foreground"
      />
      {!!value && (
        <Pressable onPress={() => onChange('')} accessibilityRole="button" accessibilityLabel={t('clear')} hitSlop={10}>
          <Icon name="x-circle" size={18} colorClassName="accent-muted-foreground" />
        </Pressable>
      )}
    </View>
  );
}

// ───────── toggles ─────────

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <Segmented
      value={lang}
      onChange={setLang}
      options={[
        { value: 'en', label: 'English' },
        { value: 'ta', label: 'தமிழ்' },
      ]}
    />
  );
}

export function ThemeToggle() {
  const { dark, toggle } = useThemeToggle();
  const t = useT();
  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={dark ? t('lightTheme') : t('darkTheme')}
      className="h-11 w-11 items-center justify-center rounded-lg border border-border bg-card active:bg-secondary"
    >
      <Icon name={dark ? 'sun' : 'moon'} size={20} colorClassName="accent-foreground" />
    </Pressable>
  );
}

// ───────── states ─────────

export function Loading() {
  return <ActivityIndicator colorClassName="accent-primary" className="mt-8" />;
}

/** Grey placeholder block that gently pulses while data loads. */
export function Skeleton({ className }: { className?: string }) {
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View style={{ opacity: pulse }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View className={cn('rounded-lg bg-secondary', className)} />
    </Animated.View>
  );
}

/** Placeholder cards shaped like a list of records. */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <View className="gap-2.5" accessibilityLabel="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} className="gap-2.5 rounded-xl border border-border bg-card p-4">
          <View className="flex-row justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-16 rounded-full" />
          </View>
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-3 w-32" />
        </View>
      ))}
    </View>
  );
}

/** Placeholder KPI tiles. */
export function SkeletonGrid({ tiles = 4 }: { tiles?: number }) {
  return (
    <Grid>
      {Array.from({ length: tiles }, (_, i) => (
        <View key={i} className="grow basis-[46%] gap-2 rounded-xl border border-border bg-card px-3.5 py-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-24" />
        </View>
      ))}
    </Grid>
  );
}

export function EmptyState({ icon = 'inbox', title, body, action }: { icon?: IconName; title: string; body?: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View className="items-center gap-2 px-6 py-10">
      <View className="mb-1 h-14 w-14 items-center justify-center rounded-full bg-secondary">
        <Icon name={icon} size={24} colorClassName="accent-muted-foreground" />
      </View>
      <Text className="text-center text-base font-semibold text-foreground">{title}</Text>
      {!!body && <Text className="text-center text-[13px] text-muted-foreground">{body}</Text>}
      {action && <Button className="mt-2" size="md" kind="secondary" title={action.label} onPress={action.onPress} />}
    </View>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useT();
  return (
    <View className="flex-row items-center gap-2.5 rounded-xl bg-destructive-soft p-3" accessibilityRole="alert">
      <Icon name="alert-circle" size={18} colorClassName="accent-destructive" />
      <Text className="flex-1 text-sm text-destructive">{message}</Text>
      {onRetry && (
        <Pressable onPress={onRetry} accessibilityRole="button" className="min-h-9 justify-center rounded-lg bg-card px-3">
          <Text className="font-bold text-destructive">{t('retry')}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Amber note, e.g. "this record is locked". */
export function Notice({ children, tone = 'warn', icon = 'info' }: { children: ReactNode; tone?: Tone; icon?: IconName }) {
  return (
    <View className={cn('flex-row items-start gap-2.5 rounded-xl px-3.5 py-3', TONE_BG[tone])}>
      <Icon name={icon} size={16} colorClassName={TONE_ACCENT[tone]} className="mt-0.5" />
      <Text className={cn('flex-1 text-sm font-medium', TONE_TEXT[tone])}>{children}</Text>
    </View>
  );
}

/** Why the owner rejected a record. */
export function Reason({ children }: { children: ReactNode }) {
  return (
    <View className="flex-row items-start gap-2 rounded-lg bg-destructive-soft px-3 py-2">
      <Icon name="corner-down-right" size={14} colorClassName="accent-destructive" className="mt-0.5" />
      <Text className="flex-1 text-[13px] text-destructive">{children}</Text>
    </View>
  );
}

/**
 * Pull-to-refresh in the app's colours: `refreshControl={refresher(refreshing, load)}`.
 * A function, not a component — ScrollView clones this element and hands it the list as children.
 */
export function refresher(refreshing: boolean, onRefresh: () => void) {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColorClassName="accent-primary"
      colorsClassName="accent-saffron"
      progressBackgroundColorClassName="accent-card"
    />
  );
}

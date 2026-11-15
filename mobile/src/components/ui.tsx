/**
 * TimberTrail building blocks for Android, styled with Tailwind classes (Uniwind).
 *
 * Rules every component here follows:
 *  - colours come from the tokens in src/global.css — never hex values;
 *  - surfaces are separated by hairline borders, not shadows;
 *  - corners: controls 12px (rounded-xl), cards 16px (rounded-2xl);
 *  - saffron marks the one primary action on a screen; navy carries structure;
 *  - every touch target is at least 44×44.
 */
import type { TKey } from '@timbertrail/shared';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import Reanimated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useCSSVariable, withUniwind } from 'uniwind';
import { useLang, useT } from '../lib/i18n';
import { useThemeToggle } from '../lib/theme';
import type { Status } from '../lib/types';
import { Icon, type IconName } from './icon';
import { Appear, AnimatedView, SPRING_SLIDE, Tap, tick, useGrowIn } from './motion';
import { Text, TextInput } from './text';

export { Icon, type IconName };

/** Join class names, skipping false / null / undefined. */
export const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

export const SafeAreaView = withUniwind(RNSafeAreaView);

// ───────── text ─────────

export function H1({ children }: { children: ReactNode }) {
  return <Text className="text-2xl font-bold tracking-tight text-foreground font-display">{children}</Text>;
}

/** Heading over a group, with an optional action on the right ("View all"). */
export function SectionTitle({ children, right, action }: { children: ReactNode; right?: ReactNode; action?: { label: string; onPress: () => void } }) {
  return (
    <View className="mt-4 min-h-8 flex-row items-center gap-2">
      <Text className="shrink text-base font-bold tracking-tight text-foreground font-display" accessibilityRole="header">
        {children}
      </Text>
      {right}
      <View className="flex-1" />
      {action && (
        <Pressable onPress={action.onPress} accessibilityRole="button" hitSlop={8} className="min-h-9 flex-row items-center gap-0.5 px-1">
          <Text className="text-[13px] font-semibold text-saffron-strong">{action.label}</Text>
          <Icon name="chevron-right" size={14} colorClassName="accent-saffron-strong" />
        </Pressable>
      )}
    </View>
  );
}

/** Small uppercase label for groups inside menus and forms. */
export function Overline({ children, className }: { children: ReactNode; className?: string }) {
  return <Text className={cn('text-[11px] font-semibold uppercase tracking-[1px] text-muted-foreground', className)}>{children}</Text>;
}

export function Muted({ children, className, lines }: { children: ReactNode; className?: string; lines?: number }) {
  return (
    <Text className={cn('text-[13px] leading-[18px] text-muted-foreground', className)} numberOfLines={lines}>
      {children}
    </Text>
  );
}

// ───────── surfaces ─────────

/** A soft tinted panel on the sheet — grouped figures, details. No border, no shadow. */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <View className={cn('gap-2.5 rounded-2xl bg-background p-4', className)}>{children}</View>;
}

export function PressableCard({ children, onPress, label, className }: { children: ReactNode; onPress: () => void; label?: string; className?: string }) {
  return (
    <Tap
      scale={0.985}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={cn('-mx-4 gap-2.5 border-b border-border px-4 py-4 active:bg-secondary', className)}
    >
      {children}
    </Tap>
  );
}

export function Grid({ children }: { children: ReactNode }) {
  return <View className="flex-row flex-wrap gap-3">{children}</View>;
}

export type Tone = 'warn' | 'good' | 'bad' | 'info';

export const TONE_TEXT: Record<Tone, string> = { warn: 'text-warning', good: 'text-success', bad: 'text-destructive', info: 'text-info' };
export const TONE_BG: Record<Tone, string> = { warn: 'bg-warning-soft', good: 'bg-success-soft', bad: 'bg-destructive-soft', info: 'bg-info-soft' };
export const TONE_ACCENT: Record<Tone, string> = { warn: 'accent-warning', good: 'accent-success', bad: 'accent-destructive', info: 'accent-info' };

/** Rounded square holding an icon — list rows, KPI tiles, quick actions. */
export function IconTile({ icon, tone = 'saffron', size = 'md' }: { icon: IconName; tone?: 'saffron' | 'navy' | 'neutral' | Tone; size?: 'sm' | 'md' | 'lg' }) {
  const box = { sm: 'h-8 w-8 rounded-lg', md: 'h-10 w-10 rounded-xl', lg: 'h-12 w-12 rounded-2xl' }[size];
  const px = { sm: 16, md: 19, lg: 22 }[size];
  const bg =
    tone === 'saffron' ? 'bg-saffron-soft' : tone === 'navy' ? 'bg-primary-soft' : tone === 'neutral' ? 'bg-secondary' : TONE_BG[tone];
  const fg =
    tone === 'saffron' ? 'accent-saffron-strong' : tone === 'navy' ? 'accent-primary' : tone === 'neutral' ? 'accent-muted-foreground' : TONE_ACCENT[tone];
  return (
    <View className={cn('items-center justify-center', box, bg)}>
      <Icon name={icon} size={px} colorClassName={fg} />
    </View>
  );
}

/** A figure on a dashboard: icon, label, big value. Tapping opens the screen behind it. */
export function Kpi({
  label,
  value,
  unit,
  tone,
  icon,
  hint,
  onPress,
}: {
  label: string;
  value: string | number;
  unit?: string;
  tone?: Tone;
  icon?: IconName;
  /** a short line under the value */
  hint?: string;
  onPress?: () => void;
}) {
  const body = (
    <>
      <View className="flex-row items-start justify-between">
        {icon ? <IconTile icon={icon} tone={tone ?? 'saffron'} size="sm" /> : <View />}
        {onPress && <Icon name="arrow-up-right" size={15} colorClassName="accent-muted-foreground" />}
      </View>
      <View className="gap-0.5">
        <Text className="text-xs font-medium text-muted-foreground" numberOfLines={2}>
          {label}
        </Text>
        <Text className={cn('text-[22px] font-bold tracking-tight tabular-nums font-display', tone ? TONE_TEXT[tone] : 'text-foreground')} numberOfLines={1} adjustsFontSizeToFit>
          {value}
          {unit ? <Text className="text-xs font-semibold text-muted-foreground"> {unit}</Text> : null}
        </Text>
        {!!hint && (
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {hint}
          </Text>
        )}
      </View>
    </>
  );
  const box = 'grow basis-[46%] gap-3 rounded-2xl bg-background p-3.5';
  return onPress ? (
    <Tap scale={0.96} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}`} className={cn(box, 'active:bg-secondary')}>
      {body}
    </Tap>
  ) : (
    <View className={box}>{body}</View>
  );
}

/** Two big numbers side by side; the second sits on navy. */
export function StatPair({ a, b }: { a: { label: string; value: string | number }; b: { label: string; value: string | number } }) {
  return (
    <View className="flex-row gap-3">
      <View className="flex-1 gap-1 rounded-2xl bg-background p-4">
        <Text className="text-xs font-medium text-muted-foreground">{a.label}</Text>
        <Text className="text-2xl font-bold tracking-tight tabular-nums text-foreground font-display">{a.value}</Text>
      </View>
      <View className="flex-1 gap-1 rounded-2xl bg-hero p-4">
        <Text className="text-xs font-medium text-hero-muted">{b.label}</Text>
        <Text className="text-2xl font-bold tracking-tight tabular-nums text-hero-foreground font-display">{b.value}</Text>
      </View>
    </View>
  );
}

/**
 * Navy summary card — the headline figure of a screen (stock on hand, today's output,
 * profit). Optional icon top-right and children below for a chart or breakdown.
 */
export function HeroCard({
  label,
  value,
  unit,
  sub,
  icon,
  onPress,
  children,
  bare,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: ReactNode;
  icon?: IconName;
  onPress?: () => void;
  children?: ReactNode;
  /** drawn straight on the navy above the sheet (no panel of its own) */
  bare?: boolean;
}) {
  const body = (
    <>
      <View className="flex-row items-start gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-[13px] font-medium text-hero-muted">{label}</Text>
          <Text className={cn('font-bold tracking-tight tabular-nums text-hero-foreground font-display', bare ? 'text-[36px]' : 'text-[30px]')} numberOfLines={1} adjustsFontSizeToFit>
            {value}
            {unit ? <Text className="text-base font-semibold text-hero-muted"> {unit}</Text> : null}
          </Text>
          {typeof sub === 'string' ? <Text className="text-[13px] text-hero-muted">{sub}</Text> : sub}
        </View>
        {icon && (
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-saffron">
            <Icon name={icon} size={22} colorClassName="accent-saffron-foreground" />
          </View>
        )}
      </View>
      {children}
    </>
  );
  const box = bare ? 'gap-5' : 'gap-4 overflow-hidden rounded-2xl bg-hero p-5';
  return onPress ? (
    <Tap scale={0.985} onPress={onPress} accessibilityRole="button" className={cn(box, 'active:opacity-90')}>
      {body}
    </Tap>
  ) : (
    <View className={box}>{body}</View>
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

/** Status with a coloured dot — Draft, Pending, Approved, Rejected. */
export function StatusPill({ status }: { status: string }) {
  const t = useT();
  const m = STATUS[status as Status];
  const tone = m?.tone;
  return (
    <View className={cn('flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-[3px]', tone ? TONE_BG[tone] : 'bg-secondary')}>
      <View className={cn('h-1.5 w-1.5 rounded-full', tone === 'good' ? 'bg-success' : tone === 'warn' ? 'bg-warning' : tone === 'bad' ? 'bg-destructive' : 'bg-muted-foreground')} />
      <Text className={cn('text-xs font-semibold', tone ? TONE_TEXT[tone] : 'text-muted-foreground')}>{m ? t(m.key) : status}</Text>
    </View>
  );
}

/** "label ........ value" row inside a card. */
export function KV({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="min-h-6 flex-row items-center justify-between gap-3">
      <Text className="shrink text-sm text-muted-foreground">{label}</Text>
      <Text className={cn('shrink text-right tabular-nums text-foreground', strong ? 'text-[15px] font-bold' : 'text-sm font-semibold')}>{value}</Text>
    </View>
  );
}

export function Divider() {
  return <View className="h-px bg-border" />;
}

/** Initials (up to two letters) on a soft navy circle. */
export function Avatar({ name, size = 'md', tone = 'navy' }: { name: string; size?: 'sm' | 'md' | 'lg'; tone?: 'navy' | 'saffron' }) {
  const box = { sm: 'h-8 w-8', md: 'h-11 w-11', lg: 'h-14 w-14' }[size];
  const text = { sm: 'text-xs', md: 'text-sm', lg: 'text-lg' }[size];
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '')).toUpperCase();
  return (
    <View className={cn('items-center justify-center rounded-full', box, tone === 'saffron' ? 'bg-saffron' : 'bg-primary-soft')} accessible={false}>
      <Text className={cn('font-bold', text, tone === 'saffron' ? 'text-saffron-foreground' : 'text-primary')}>{initials}</Text>
    </View>
  );
}

/** Red count bubble (pending approvals on the bell / tab). */
export function CountBadge({ n, className, onDark }: { n: number; className?: string; /** sits on the navy app bar */ onDark?: boolean }) {
  if (!n) return null;
  return (
    <View className={cn('h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 bg-destructive px-1', onDark ? 'border-hero' : 'border-card', className)}>
      <Text className="text-[10px] font-bold text-white">{n > 99 ? '99+' : n}</Text>
    </View>
  );
}

/** Thin bar showing a share (0–100). */
export function ProgressBar({ pct, tone = 'saffron' }: { pct: number; tone?: 'saffron' | 'navy' | 'good' }) {
  const fill = tone === 'navy' ? 'bg-primary' : tone === 'good' ? 'bg-success' : 'bg-saffron';
  const target = Math.max(0, Math.min(100, pct));
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(target, { duration: 700 });
  }, [target, w]);
  const bar = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return (
    <View className="h-1.5 overflow-hidden rounded-full bg-secondary" accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}>
      <AnimatedView className={cn('h-full rounded-full', fill)} style={bar} />
    </View>
  );
}

// ───────── charts ─────────

/** Small legend dot + label. */
export function LegendDot({ className, label, value, onDark }: { className: string; label: string; value?: string; onDark?: boolean }) {
  return (
    <View className={cn('flex-row items-center gap-2', onDark && 'shrink')}>
      <View className={cn('h-2.5 w-2.5 rounded-full', className)} />
      <Text className={cn('text-[13px]', onDark ? 'text-hero-muted' : 'flex-1 text-muted-foreground')} numberOfLines={1}>
        {label}
      </Text>
      {value != null && <Text className={cn('text-[13px] font-semibold tabular-nums', onDark ? 'text-hero-foreground' : 'text-foreground')}>{value}</Text>}
    </View>
  );
}

/**
 * Grouped bar chart drawn with plain views — one or two series per bucket.
 * `series[0]` is saffron, `series[1]` navy (pale slate in dark theme).
 */
export function BarChart({
  data,
  height = 120,
  labelEvery = 1,
  onDark,
  accessibilityLabel,
}: {
  data: { label: string; values: number[] }[];
  height?: number;
  /** show every n-th label (dense daily charts) */
  labelEvery?: number;
  /** drawn on a navy hero card */
  onDark?: boolean;
  accessibilityLabel?: string;
}) {
  const max = Math.max(1, ...data.flatMap((d) => d.values));
  const colors = onDark ? ['bg-saffron', 'bg-hero-muted'] : ['bg-saffron', 'bg-chart-2'];
  const dense = data.length > 12;
  // bars grow up from the baseline once, when the chart first appears
  const grow = useGrowIn();
  const growStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: 0.02 + grow.value * 0.98 }] }));
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <AnimatedView className="flex-row items-end" style={[{ height, gap: dense ? 2 : 6, transformOrigin: 'bottom' }, growStyle]}>
        {data.map((d, i) => (
          <View key={i} className="flex-1 flex-row items-end justify-center" style={{ gap: 2, height }}>
            {d.values.map((v, s) => (
              <View
                key={s}
                className={cn(dense ? 'rounded-t-sm' : 'rounded-t-md', colors[s] ?? 'bg-chart-3', onDark && s === 1 && 'opacity-50')}
                style={{ height: Math.max(v > 0 ? 3 : 1, (v / max) * height), flex: 1, maxWidth: dense ? 10 : 18, opacity: v > 0 ? undefined : 0.25 }}
              />
            ))}
          </View>
        ))}
      </AnimatedView>
      <View className="mt-2 flex-row" style={{ gap: dense ? 2 : 6 }}>
        {data.map((d, i) => (
          <Text key={i} className={cn('flex-1 text-center text-[10px]', onDark ? 'text-hero-muted' : 'text-muted-foreground')} numberOfLines={1}>
            {i % labelEvery === 0 ? d.label : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Ring chart for shares of a whole. Segment colours are theme tokens. */
export function Donut({
  segments,
  size = 128,
  thickness = 14,
  center,
}: {
  segments: { value: number; color: 'saffron' | 'primary' | 'success' | 'warning' | 'muted' | 'destructive' }[];
  size?: number;
  thickness?: number;
  center?: ReactNode;
}) {
  const vars = useCSSVariable(['--color-saffron', '--color-primary', '--color-success', '--color-warning', '--color-muted-foreground', '--color-destructive', '--color-secondary']).map(String);
  const color = { saffron: vars[0], primary: vars[1], success: vars[2], warning: vars[3], muted: vars[4], destructive: vars[5] };
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0);
  let offset = 0;
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center" accessible={false}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={vars[6]} strokeWidth={thickness} fill="none" />
        {total > 0 &&
          segments.map((s, i) => {
            const len = (s.value / total) * c;
            const el = (
              <Circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={color[s.color]}
                strokeWidth={thickness}
                fill="none"
                strokeDasharray={`${Math.max(0, len - (segments.length > 1 ? 2 : 0))} ${c}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
      </Svg>
      {center}
    </View>
  );
}

// ───────── rows (menus, lists) ─────────

/** A tappable row with an icon tile — menus, settings. */
export function MenuRow({
  icon,
  title,
  subtitle,
  value,
  badge,
  onPress,
  tone,
  last,
  right,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  value?: string;
  badge?: number;
  onPress?: () => void;
  tone?: 'bad';
  last?: boolean;
  /** replaces the chevron (a switch, a pill) */
  right?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      className={cn('min-h-[60px] flex-row items-center gap-3.5 px-4 py-3 active:bg-secondary', !last && 'border-b border-border')}
    >
      {icon && <IconTile icon={icon} tone={tone === 'bad' ? 'bad' : 'navy'} size="sm" />}
      <View className="flex-1 gap-0.5">
        <Text className={cn('text-[15px] font-semibold', tone === 'bad' ? 'text-destructive' : 'text-foreground')}>{title}</Text>
        {!!subtitle && <Muted lines={2}>{subtitle}</Muted>}
      </View>
      {!!value && <Text className="text-sm font-medium text-muted-foreground">{value}</Text>}
      {!!badge && <CountBadge n={badge} />}
      {right ?? (onPress && <Icon name="chevron-right" size={18} colorClassName="accent-muted-foreground" />)}
    </Pressable>
  );
}

// ───────── tiles (launcher grids) ─────────

export type TileTone = 'saffron' | 'navy' | 'neutral' | Tone;

/**
 * A square-ish tappable tile on the sheet.
 *  - `compact`: icon over a centred label (module launcher, 3 across)
 *  - `stack`:   icon, title and a two-line description, left aligned (2 across)
 */
export function Tile({
  icon,
  tone = 'saffron',
  title,
  subtitle,
  badge,
  onPress,
  variant = 'compact',
}: {
  icon: IconName;
  tone?: TileTone;
  title: string;
  subtitle?: string;
  badge?: number;
  onPress: () => void;
  variant?: 'compact' | 'stack';
}) {
  const compact = variant === 'compact';
  return (
    <Tap
      scale={0.95}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${title}, ${badge}` : title}
      className={cn(
        'flex-1 rounded-2xl bg-background active:bg-secondary',
        compact ? 'min-h-[104px] items-center justify-center gap-2.5 px-2 py-4' : 'min-h-[148px] justify-between gap-4 p-4',
      )}
    >
      <View className={cn('flex-row', !compact && 'w-full items-start justify-between')}>
        <IconTile icon={icon} tone={tone} size={compact ? 'lg' : 'md'} />
        {!!badge && <CountBadge n={badge} className={compact ? 'absolute -right-2 -top-1.5' : ''} />}
        {!compact && !badge && <Icon name="arrow-up-right" size={16} colorClassName="accent-muted-foreground" />}
      </View>
      <View className={cn('gap-1', compact && 'items-center')}>
        <Text className={cn('font-semibold text-foreground', compact ? 'text-center text-[13px] leading-[17px]' : 'text-[15px] leading-5')} numberOfLines={2}>
          {title}
        </Text>
        {!!subtitle && !compact && (
          <Text className="text-xs leading-[17px] text-muted-foreground" numberOfLines={3}>
            {subtitle}
          </Text>
        )}
      </View>
    </Tap>
  );
}

/** Lays tiles out `columns` across in equal widths; a short last row keeps the same widths. */
export function TileGrid({ columns = 3, children }: { columns?: 2 | 3; children: ReactNode[] }) {
  const items = children.filter(Boolean);
  const rows: ReactNode[][] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
  return (
    <View className="gap-3">
      {rows.map((r, i) => (
        <View key={i} className="flex-row gap-3">
          {r}
          {Array.from({ length: columns - r.length }, (_, k) => (
            <View key={`f${k}`} className="flex-1" />
          ))}
        </View>
      ))}
    </View>
  );
}

/** Rounded group holding MenuRows. */
/** Rows on the sheet, edge to edge, divided by hairlines. */
export function MenuGroup({ children }: { children: ReactNode }) {
  return <View className="-mx-4">{children}</View>;
}

// ───────── buttons ─────────

type ButtonKind = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'navy';

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
  size?: 'sm' | 'md' | 'lg';
}) {
  const box: Record<ButtonKind, string> = {
    primary: 'bg-saffron active:opacity-85',
    navy: 'bg-hero active:opacity-90',
    secondary: 'border border-input bg-card active:bg-secondary',
    danger: 'border border-destructive bg-card active:bg-destructive-soft',
    success: 'bg-success active:opacity-85',
    ghost: 'active:bg-secondary',
  };
  const text: Record<ButtonKind, string> = {
    primary: 'text-saffron-foreground',
    navy: 'text-hero-foreground',
    secondary: 'text-foreground',
    danger: 'text-destructive',
    success: 'text-white',
    ghost: 'text-saffron-strong',
  };
  const accent: Record<ButtonKind, string> = {
    primary: 'accent-saffron-foreground',
    navy: 'accent-hero-foreground',
    secondary: 'accent-foreground',
    danger: 'accent-destructive',
    success: 'accent-white',
    ghost: 'accent-saffron-strong',
  };
  const off = !!disabled && !busy;
  return (
    <Tap
      scale={0.96}
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      className={cn(
        'flex-row items-center justify-center gap-2 rounded-xl',
        size === 'lg' ? 'min-h-[52px] px-5' : size === 'md' ? 'min-h-11 px-4' : 'min-h-9 px-3',
        off ? 'bg-secondary' : box[kind],
        busy && 'opacity-80',
        className,
      )}
    >
      {busy ? (
        <ActivityIndicator colorClassName={accent[kind]} />
      ) : (
        <>
          {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} colorClassName={off ? 'accent-muted-foreground' : accent[kind]} />}
          <Text
            className={cn('shrink text-center font-semibold', size === 'lg' ? 'text-[15px]' : 'text-sm', off ? 'text-muted-foreground' : text[kind])}
            numberOfLines={2}
          >
            {title}
          </Text>
        </>
      )}
    </Tap>
  );
}

/** Square icon button on a card or page. */
export function IconButton({ icon, label, onPress, tone }: { icon: IconName; label: string; onPress: () => void; tone?: 'bad' }) {
  return (
    <Tap
      scale={0.9}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-11 w-11 items-center justify-center rounded-xl border border-border bg-card active:bg-secondary"
    >
      <Icon name={icon} size={18} colorClassName={tone === 'bad' ? 'accent-destructive' : 'accent-foreground'} />
    </Tap>
  );
}

/** Filter / choice chip. Selected = solid saffron. */
export function Chip({ text, on, onPress, count }: { text: string; on?: boolean; onPress: () => void; count?: number }) {
  return (
    <Tap
      scale={0.94}
      haptic={!on}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      className={cn('min-h-9 flex-row items-center gap-1.5 rounded-full border px-4', on ? 'border-saffron bg-saffron' : 'border-transparent bg-background active:bg-secondary')}
    >
      <Text className={cn('text-[13px] font-semibold', on ? 'text-saffron-foreground' : 'text-muted-foreground')}>{text}</Text>
      {count != null && count > 0 && (
        <View className={cn('min-w-5 items-center rounded-full px-1.5', on ? 'bg-saffron-foreground/15' : 'bg-secondary')}>
          <Text className={cn('text-[11px] font-bold', on ? 'text-saffron-foreground' : 'text-foreground')}>{count}</Text>
        </View>
      )}
    </Tap>
  );
}

/**
 * Two to four mutually exclusive choices in one bar; the selected background slides
 * between them. `onDark` for use inside the navy app bar.
 */
export function Segmented<V extends string>({
  value,
  options,
  onChange,
  onDark,
}: {
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
  onDark?: boolean;
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  useEffect(() => {
    if (w) x.value = withSpring(index * w, SPRING_SLIDE);
  }, [index, w, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View
      className={cn('flex-row rounded-xl p-1', onDark ? 'bg-hero-chip' : 'bg-secondary')}
      accessibilityRole="tablist"
      onLayout={(e) => {
        const each = (e.nativeEvent.layout.width - 8) / options.length;
        if (!w) x.value = index * each;
        setW(each);
      }}
    >
      {w > 0 && (
        <AnimatedView
          pointerEvents="none"
          className={cn('absolute bottom-1 left-1 top-1 rounded-lg', onDark ? 'bg-saffron' : 'border border-border bg-card')}
          style={[{ width: w }, thumb]}
        />
      )}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              if (!on) tick();
              onChange(o.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            className="min-h-10 flex-1 items-center justify-center rounded-lg px-2"
          >
            <Text
              className={cn(
                'text-center text-[13px]',
                on ? (onDark ? 'font-semibold text-saffron-foreground' : 'font-semibold text-foreground') : onDark ? 'font-medium text-hero-muted' : 'font-medium text-muted-foreground',
              )}
              numberOfLines={2}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Text tabs for the navy app bar: icon + label, the active one bright with a saffron bar
 * underneath that springs to the next tab. Tabs size to their labels and the strip scrolls
 * sideways when they don't fit (long Tamil labels).
 */
export function TabStrip<V extends string>({
  value,
  options,
  onChange,
}: {
  value: V;
  options: { value: V; label: string; icon?: IconName }[];
  onChange: (v: V) => void;
}) {
  const [boxes, setBoxes] = useState<Partial<Record<V, { x: number; w: number }>>>({});
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const placed = useRef(false);
  const active = boxes[value];
  useEffect(() => {
    if (!active) return;
    if (!placed.current) {
      // first measurement: put the bar in place without sliding in from the left
      x.value = active.x;
      w.value = active.w;
      placed.current = true;
    } else {
      x.value = withSpring(active.x, SPRING_SLIDE);
      w.value = withSpring(active.w, SPRING_SLIDE);
    }
  }, [active, x, w]);
  const bar = useAnimatedStyle(() => ({ width: w.value, transform: [{ translateX: x.value }] }));

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 border-b border-hero-border" contentContainerClassName="px-4" accessibilityRole="tablist">
      <View className="flex-row gap-6">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              onLayout={(e) => {
                const { x: ox, width } = e.nativeEvent.layout;
                setBoxes((b) => (b[o.value]?.x === ox && b[o.value]?.w === width ? b : { ...b, [o.value]: { x: ox, w: width } }));
              }}
              onPress={() => {
                if (!on) tick();
                onChange(o.value);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              className="min-h-12 flex-row items-center gap-1.5 pb-1"
            >
              {o.icon && <Icon name={o.icon} size={16} colorClassName={on ? 'accent-saffron' : 'accent-hero-muted'} />}
              <Text className={cn('text-[15px]', on ? 'font-semibold text-hero-foreground' : 'font-medium text-hero-muted')} numberOfLines={1}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
        {active && <AnimatedView pointerEvents="none" className="absolute bottom-0 left-0 h-[3px] rounded-full bg-saffron" style={bar} />}
      </View>
    </ScrollView>
  );
}

export function SearchBar({ value, onChange, placeholder, right }: { value: string; onChange: (v: string) => void; placeholder: string; right?: ReactNode }) {
  const t = useT();
  return (
    <View className="min-h-12 flex-row items-center gap-2.5 rounded-2xl bg-background pl-4 pr-1.5">
      <Icon name="search" size={18} colorClassName="accent-muted-foreground" />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColorClassName="accent-muted-foreground"
        cursorColorClassName="accent-saffron"
        returnKeyType="search"
        autoCorrect={false}
        accessibilityLabel={placeholder}
        className="flex-1 py-2 text-[15px] text-foreground"
      />
      {!!value && (
        <Pressable onPress={() => onChange('')} accessibilityRole="button" accessibilityLabel={t('clear')} className="h-10 w-10 items-center justify-center">
          <Icon name="x-circle" size={18} colorClassName="accent-muted-foreground" />
        </Pressable>
      )}
      {right}
    </View>
  );
}

/** On / off switch with a 44px touch area; the thumb springs across and the track fades to saffron. */
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const [on, off] = useCSSVariable(['--color-saffron', '--color-input']).map(String);
  const p = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    p.value = withSpring(value ? 1 : 0, SPRING_SLIDE);
  }, [value, p]);
  const track = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.value, [0, 1], [off, on]) }));
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: p.value * 20 }, { scale: 1 + Math.sin(p.value * Math.PI) * 0.08 }] }));
  return (
    <Pressable
      onPress={() => {
        tick();
        onChange(!value);
      }}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      hitSlop={8}
      className="h-11 justify-center"
    >
      <Reanimated.View style={[{ height: 28, width: 48, borderRadius: 14, padding: 2, justifyContent: 'center' }, track]}>
        <AnimatedView className="h-6 w-6 rounded-full bg-white shadow-sm" style={thumb} />
      </Reanimated.View>
    </Pressable>
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

/** English · தமிழ் as two small pills — fits on the right of a settings row. */
export function LangPills({ onDark }: { onDark?: boolean }) {
  const { lang, setLang } = useLang();
  return (
    <View className={cn('flex-row rounded-full p-0.5', onDark ? 'bg-hero-chip' : 'bg-background')} accessibilityRole="tablist">
      {(['en', 'ta'] as const).map((l) => {
        const on = lang === l;
        return (
          <Pressable
            key={l}
            onPress={() => {
              if (!on) tick();
              setLang(l);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            className={cn('min-h-9 justify-center rounded-full px-3.5', on && 'bg-saffron')}
          >
            <Text className={cn('text-[13px]', on ? 'font-semibold text-saffron-foreground' : onDark ? 'font-medium text-hero-muted' : 'font-medium text-muted-foreground')}>
              {l === 'en' ? 'English' : 'தமிழ்'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ThemeToggle({ onDark }: { onDark?: boolean }) {
  const { dark, toggle } = useThemeToggle();
  const t = useT();
  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={dark ? t('lightTheme') : t('darkTheme')}
      className={cn('h-11 w-11 items-center justify-center rounded-xl', onDark ? 'bg-hero-chip active:opacity-80' : 'border border-border bg-card active:bg-secondary')}
    >
      <Icon name={dark ? 'sun' : 'moon'} size={19} colorClassName={onDark ? 'accent-hero-foreground' : 'accent-foreground'} />
    </Pressable>
  );
}

// ───────── states ─────────

export function Loading() {
  return <ActivityIndicator colorClassName="accent-saffron" className="mt-8" />;
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

/** Placeholder rows shaped like a list of records. */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <View accessibilityLabel="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} className="flex-row items-center gap-3 border-b border-border py-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <View className="flex-1 gap-2">
            <View className="flex-row justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-16 rounded-full" />
            </View>
            <Skeleton className="h-3 w-44" />
          </View>
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
        <View key={i} className="grow basis-[46%] gap-3 rounded-2xl bg-background p-3.5">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-24" />
        </View>
      ))}
    </Grid>
  );
}

export function EmptyState({ icon = 'inbox', title, body, action }: { icon?: IconName; title: string; body?: string; action?: { label: string; onPress: () => void } }) {
  return (
    <Appear className="items-center gap-2 px-6 py-12">
      <View className="mb-2 h-16 w-16 items-center justify-center rounded-full bg-background">
        <Icon name={icon} size={24} colorClassName="accent-muted-foreground" />
      </View>
      <Text className="text-center text-base font-bold text-foreground font-display">{title}</Text>
      {!!body && <Text className="text-center text-[13px] leading-[18px] text-muted-foreground">{body}</Text>}
      {action && <Button className="mt-2" size="md" kind="secondary" icon="plus" title={action.label} onPress={action.onPress} />}
    </Appear>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useT();
  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-destructive/25 bg-destructive-soft p-3.5" accessibilityRole="alert">
      <Icon name="alert-circle" size={18} colorClassName="accent-destructive" />
      <Text className="flex-1 text-sm text-destructive">{message}</Text>
      {onRetry && (
        <Pressable onPress={onRetry} accessibilityRole="button" className="min-h-10 justify-center rounded-lg bg-card px-3.5">
          <Text className="text-sm font-semibold text-destructive">{t('retry')}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Tinted note, e.g. "this record is locked". */
export function Notice({ children, tone = 'warn', icon = 'info' }: { children: ReactNode; tone?: Tone; icon?: IconName }) {
  return (
    <View className={cn('flex-row items-start gap-2.5 rounded-2xl px-4 py-3', TONE_BG[tone])}>
      <Icon name={icon} size={16} colorClassName={TONE_ACCENT[tone]} className="mt-0.5" />
      <Text className={cn('flex-1 text-sm font-medium leading-5', TONE_TEXT[tone])}>{children}</Text>
    </View>
  );
}

/** Why the owner rejected a record. */
export function Reason({ children }: { children: ReactNode }) {
  return (
    <View className="flex-row items-start gap-2 rounded-xl bg-destructive-soft px-3 py-2">
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
      tintColorClassName="accent-saffron"
      colorsClassName="accent-saffron"
      progressBackgroundColorClassName="accent-card"
    />
  );
}

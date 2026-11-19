/**
 * TimberTrail building blocks for Android, styled with Tailwind classes (Uniwind).
 *
 * Rules every component here follows:
 *  - colours come from the tokens in src/global.css — never hex values;
 *  - surfaces are separated by hairline borders and soft grey panels, not shadows;
 *  - corners: controls 12px (rounded-xl), panels 16–18px (rounded-2xl), headline cards 24px;
 *  - near-black (primary) carries the main action and the selected choice; orange (saffron) is
 *    kept for the open tab, highlights and the one thing that needs attention;
 *  - headline figures sit on the dark hero surface in both themes;
 *  - every touch target is at least 44×44.
 */
import type { TKey } from '@timbertrail/shared';
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import Reanimated, { Easing, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useCSSVariable, withUniwind } from 'uniwind';
import { useLang, useT } from '../lib/i18n';
import { useThemeToggle } from '../lib/theme';
import { useListDensity } from '../services/preferences';
import type { Status } from '../lib/types';
import { Icon, type IconName } from './icon';
import { Appear, AnimatedView, SLIDE, Tap, tick, useGrowIn } from './motion';
import { Glow } from './glow';
import { useInSheet } from './sheet-context';
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
  const compact = useListDensity() === 'compact';
  return (
    <Tap
      scale={0.985}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={cn('-mx-4 border-b border-border px-4 active:bg-secondary', compact ? 'gap-2 py-3' : 'gap-2.5 py-4', className)}
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

/**
 * Rounded square holding an icon — list rows, KPI tiles, quick actions.
 * `raised` puts the neutral tones on white, for tiles that sit inside a grey panel.
 */
export function IconTile({ icon, tone = 'saffron', size = 'md', raised }: { icon: IconName; tone?: 'saffron' | 'navy' | 'neutral' | Tone; size?: 'sm' | 'md' | 'lg'; raised?: boolean }) {
  const box = { sm: 'h-8 w-8 rounded-lg', md: 'h-10 w-10 rounded-xl', lg: 'h-12 w-12 rounded-2xl' }[size];
  const px = { sm: 16, md: 19, lg: 22 }[size];
  const bg =
    tone === 'saffron'
      ? 'bg-saffron-soft'
      : tone === 'navy' || tone === 'neutral'
        ? raised
          ? 'bg-card'
          : tone === 'navy'
            ? 'bg-primary-soft'
            : 'bg-secondary'
        : TONE_BG[tone];
  const fg =
    tone === 'saffron' ? 'accent-saffron-strong' : tone === 'navy' ? 'accent-primary' : tone === 'neutral' ? 'accent-muted-foreground' : TONE_ACCENT[tone];
  return (
    <View className={cn('items-center justify-center', box, bg)}>
      <Icon name={icon} size={px} colorClassName={fg} />
    </View>
  );
}

/**
 * Change against an earlier window, e.g. "▲ 12% vs previous 7 days". Only shown when the data
 * has both windows; a rise is green and a fall red (pass `invert` where less is better).
 */
export function TrendTag({ pct, label, invert }: { pct: number; label: string; invert?: boolean }) {
  const flat = pct === 0;
  const good = invert ? pct < 0 : pct > 0;
  const tone = flat ? 'text-muted-foreground' : good ? 'text-success' : 'text-destructive';
  const accent = flat ? 'accent-muted-foreground' : good ? 'accent-success' : 'accent-destructive';
  return (
    <View className="flex-row items-center gap-1" accessible accessibilityLabel={`${pct > 0 ? '+' : ''}${pct}% ${label}`}>
      <Icon name={pct >= 0 ? 'trending-up' : 'trending-down'} size={13} colorClassName={accent} />
      <Text className={cn('text-xs font-semibold tabular-nums', tone)}>
        {pct > 0 ? '+' : ''}
        {pct}%
      </Text>
      <Text className="shrink text-[11px] text-muted-foreground" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * A figure on a dashboard: small icon and label, then the number large. Under it either a real
 * trend or a short hint. Tapping opens the screen behind it. No border, no shadow: a soft panel.
 */
export function Kpi({
  label,
  value,
  unit,
  tone,
  icon,
  hint,
  trend,
  onPress,
}: {
  label: string;
  value: string | number;
  unit?: string;
  tone?: Tone;
  icon?: IconName;
  /** a short line under the value */
  hint?: string;
  /** change against an earlier window — pass only when both windows come from the API */
  trend?: { pct: number; label: string; invert?: boolean } | null;
  onPress?: () => void;
}) {
  const body = (
    <>
      <View className="flex-row items-center gap-2">
        {icon && (
          <View className={cn('h-7 w-7 items-center justify-center rounded-lg', tone ? TONE_BG[tone] : 'bg-card')}>
            <Icon name={icon} size={14} colorClassName={tone ? TONE_ACCENT[tone] : 'accent-foreground'} />
          </View>
        )}
        <Text className="flex-1 text-xs font-medium leading-4 text-muted-foreground" numberOfLines={2}>
          {label}
        </Text>
      </View>
      <Text className={cn('text-[24px] font-bold tracking-tight tabular-nums font-display', tone ? TONE_TEXT[tone] : 'text-foreground')} numberOfLines={1} adjustsFontSizeToFit>
        {value}
        {unit ? <Text className="text-xs font-semibold text-muted-foreground"> {unit}</Text> : null}
      </Text>
      {trend ? (
        <TrendTag {...trend} />
      ) : hint ? (
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </>
  );
  const box = 'grow basis-[46%] gap-2 rounded-2xl bg-background p-3.5';
  const a11y = `${label}: ${value}${unit ? ` ${unit}` : ''}${trend ? `, ${trend.pct > 0 ? '+' : ''}${trend.pct}% ${trend.label}` : hint ? `, ${hint}` : ''}`;
  return onPress ? (
    <Tap scale={0.97} onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} className={cn(box, 'min-h-[112px] active:bg-secondary')}>
      {body}
    </Tap>
  ) : (
    <View className={cn(box, 'min-h-[112px]')} accessible accessibilityLabel={a11y}>
      {body}
    </View>
  );
}

/**
 * The row of secondary figures under a headline number on the dark surface (a hero, a HeroCard):
 * small muted label over a white figure, split by a hairline. `accent` sets one figure in bold
 * (never orange: the gradient behind it is orange in places);
 * `wrap` lets many figures flow onto more lines instead of sharing one.
 */
export function HeroStats({ items, wrap }: { items: { label: string; value: string; accent?: boolean }[]; wrap?: boolean }) {
  return (
    <View className={cn('flex-row border-t border-hero-border pt-4', wrap ? 'flex-wrap gap-x-6 gap-y-3' : 'gap-3')}>
      {items.map((x) => (
        <View key={x.label} className={cn('gap-0.5', !wrap && 'flex-1')}>
          <Text className="text-[11px] text-hero-muted" numberOfLines={1}>
            {x.label}
          </Text>
          {/* emphasis is weight, not colour: the band and the cards' lit edge are orange, so orange text vanishes on them */}
          <Text className={cn('text-[15px] tabular-nums text-hero-foreground', x.accent ? 'font-bold' : 'font-semibold')} numberOfLines={1} adjustsFontSizeToFit={!wrap}>
            {x.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Two big numbers side by side; the second sits on the dark gradient card. */
export function StatPair({ a, b }: { a: { label: string; value: string | number }; b: { label: string; value: string | number } }) {
  return (
    <View className="flex-row gap-3">
      <View className="flex-1 gap-1 rounded-3xl bg-background p-4">
        <Text className="text-xs font-medium text-muted-foreground">{a.label}</Text>
        <Text className="text-2xl font-bold tracking-tight tabular-nums text-foreground font-display">{a.value}</Text>
      </View>
      <View className="flex-1 gap-1 overflow-hidden rounded-3xl bg-hero p-4">
        <Glow variant="card" />
        <Text className="text-xs font-medium text-hero-muted">{b.label}</Text>
        <Text className="text-2xl font-bold tracking-tight tabular-nums text-hero-foreground font-display">{b.value}</Text>
      </View>
    </View>
  );
}

/**
 * Dark gradient summary card (orange rising out of warm black) — the headline figure of a screen (stock on hand, today's output,
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
      {!bare && <Glow variant="card" />}
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
          <View className="h-11 w-11 items-center justify-center rounded-full bg-hero-chip">
            <Icon name={icon} size={20} colorClassName="accent-hero-foreground" />
          </View>
        )}
      </View>
      {children}
    </>
  );
  const box = bare ? 'gap-5' : 'gap-4 overflow-hidden rounded-3xl bg-hero p-5';
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

const STATUS: Record<Status, { key: TKey; tone?: Tone; icon: IconName }> = {
  DRAFT: { key: 'draft', icon: 'edit-3' },
  SUBMITTED: { key: 'pending', tone: 'warn', icon: 'clock' },
  APPROVED: { key: 'approved', tone: 'good', icon: 'check-circle' },
  REJECTED: { key: 'rejected', tone: 'bad', icon: 'x-circle' },
};

/**
 * Approval status — Draft, Pending, Approved, Rejected — the same badge everywhere: an icon and the
 * word (never colour alone) on a soft fill of its colour with a faint outline.
 */
export function RecordStatusBadge({ status }: { status: string }) {
  const t = useT();
  const m = STATUS[status as Status];
  const tone = m?.tone;
  return (
    <View
      className={cn(
        'flex-row items-center gap-1 self-start rounded-full border py-[3px] pl-2 pr-2.5',
        tone ? TONE_BG[tone] : 'bg-secondary',
        tone === 'good' ? 'border-success/30' : tone === 'warn' ? 'border-warning/30' : tone === 'bad' ? 'border-destructive/30' : 'border-input',
      )}
      accessible
      accessibilityLabel={m ? t(m.key) : status}
    >
      {m && <Icon name={m.icon} size={12} colorClassName={tone ? TONE_ACCENT[tone] : 'accent-muted-foreground'} />}
      <Text className={cn('text-xs font-semibold', tone ? TONE_TEXT[tone] : 'text-muted-foreground')} numberOfLines={1}>
        {m ? t(m.key) : status}
      </Text>
    </View>
  );
}

/** The status badge under its older name (detail screens, adjustments). */
export const StatusPill = RecordStatusBadge;

/** The figure being worked out as you type (this log's CFT, this line's CFT): soft orange strip. */
export function LiveFigure({ label, value, unit = 'CFT' }: { label: string; value: string; unit?: string }) {
  return (
    <View className="flex-row items-center justify-between rounded-2xl bg-saffron-soft px-4 py-3" accessibilityLiveRegion="polite">
      <Text className="text-sm font-semibold text-saffron-strong">{label}</Text>
      <Text className="text-xl font-bold tabular-nums text-saffron-strong font-display">
        {value}
        {unit ? <Text className="text-sm font-semibold"> {unit}</Text> : null}
      </Text>
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

/** Orange count bubble (pending approvals on the bell / tab / menu row). */
export function CountBadge({ n, className, onDark, inline }: { n: number; className?: string; /** sits on the navy app bar */ onDark?: boolean; /** inline inside a list row */ inline?: boolean }) {
  if (!n) return null;
  return (
    <View
      className={cn(
        'items-center justify-center rounded-full bg-saffron',
        inline ? 'h-[22px] min-w-[22px] px-1.5' : cn('h-5 min-w-5 border-2 px-1', onDark ? 'border-hero-foreground' : 'border-card'),
        className,
      )}
    >
      <Text className={cn('font-bold tabular-nums text-white', inline ? 'text-[11px] leading-[13px]' : 'text-[10px] leading-[12px]')} style={{ includeFontPadding: false }}>
        {n > 99 ? '99+' : n}
      </Text>
    </View>
  );
}

/** Thin bar showing a share (0–100). `onDark` for the hero surface. */
export function ProgressBar({ pct, tone = 'saffron', onDark }: { pct: number; tone?: 'saffron' | 'navy' | 'good'; onDark?: boolean }) {
  const fill = tone === 'navy' ? 'bg-primary' : tone === 'good' ? 'bg-success' : 'bg-saffron';
  const target = Math.max(0, Math.min(100, pct));
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(target, { duration: 700 });
  }, [target, w]);
  const bar = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return (
    <View className={cn('h-1.5 overflow-hidden rounded-full', onDark ? 'bg-hero-chip' : 'bg-secondary')} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}>
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
  const inset = useContext(InsetGroup);
  const compact = useListDensity() === 'compact';
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      className={cn(
        'flex-row items-center gap-3.5 px-4', compact ? 'min-h-[52px] py-2' : 'min-h-[60px] py-3',
        inset ? 'active:bg-input/40' : 'active:bg-secondary',
        !last && (inset ? 'border-b border-card' : 'border-b border-border'),
      )}
    >
      {icon && <IconTile icon={icon} tone={tone === 'bad' ? 'bad' : 'navy'} size="sm" raised={inset} />}
      <View className="flex-1 gap-0.5">
        <Text className={cn('text-[15px] font-semibold', tone === 'bad' ? 'text-destructive' : 'text-foreground')}>{title}</Text>
        {!!subtitle && <Muted lines={2}>{subtitle}</Muted>}
      </View>
      {!!value && <Text className="text-sm font-medium text-muted-foreground">{value}</Text>}
      {!!badge && <CountBadge n={badge} inline />}
      {right ?? (onPress && <Icon name="chevron-right" size={18} colorClassName="accent-muted-foreground" />)}
    </Pressable>
  );
}

// ───────── tiles (launcher grids) ─────────

export type TileTone = 'saffron' | 'navy' | 'neutral' | Tone;

/**
 * A tappable tile on the sheet.
 *  - `compact`: icon over a centred label (3 across)
 *  - `stack`:   icon, title and a two-line description, left aligned (2 across)
 *  - `row`:     icon beside a title that wraps to two lines, chevron or count (module launcher, 2 across)
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
  variant?: 'compact' | 'stack' | 'row';
}) {
  if (variant === 'row')
    return (
      <Tap
        scale={0.97}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={badge ? `${title}, ${badge}` : title}
        className="min-h-[64px] flex-1 flex-row items-center gap-3 rounded-2xl bg-background py-3 pl-3 pr-2.5 active:bg-secondary"
      >
        <IconTile icon={icon} tone={tone} raised />
        {/* two lines, so long Tamil names wrap instead of being cut */}
        <Text className="flex-1 text-sm font-semibold leading-[18px] text-foreground" numberOfLines={2}>
          {title}
        </Text>
        {badge ? <CountBadge n={badge} /> : <Icon name="chevron-right" size={16} colorClassName="accent-muted-foreground" />}
      </Tap>
    );
  const compact = variant === 'compact';
  return (
    <Tap
      scale={0.95}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${title}, ${badge}` : title}
      className={cn(
        // a raised card with a visible edge and soft shadow, so each tile reads as its own button
        'flex-1 rounded-[22px] border border-foreground/10 bg-card shadow-sm shadow-black/10 active:bg-secondary',
        compact ? 'min-h-[112px] items-center justify-center gap-3 px-2 py-4' : 'min-h-[148px] justify-between gap-4 p-4',
      )}
    >
      <View className={cn('flex-row', !compact && 'w-full items-start justify-between')}>
        <IconTile icon={icon} tone={tone} size={compact ? 'lg' : 'md'} />
        {!!badge && <CountBadge n={badge} className={compact ? 'absolute -right-2 -top-1.5' : ''} />}
        {!compact && !badge && <Icon name="arrow-up-right" size={16} colorClassName="accent-muted-foreground" />}
      </View>
      <View className={cn('gap-1', compact && 'items-center')}>
        <Text className={cn('font-semibold tracking-tight text-foreground', compact ? 'text-center text-[13px] leading-[17px]' : 'text-[15px] leading-5')} numberOfLines={2}>
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

/** set inside an inset MenuGroup: rows draw their dividers and icon tiles for a grey panel */
const InsetGroup = createContext(false);

/**
 * Rows holding MenuRows (or any rows).
 *  - default: on the sheet, edge to edge, divided by hairlines (lists, history);
 *  - `inset`: one soft grey rounded panel per group (settings, preferences, menus).
 */
export function MenuGroup({ children, inset }: { children: ReactNode; inset?: boolean }) {
  const raised = useRaisedPanel();
  if (!inset) return <View className="-mx-4">{children}</View>;
  return (
    <InsetGroup.Provider value>
      <View className={cn('overflow-hidden rounded-2xl', raised)}>{children}</View>
    </InsetGroup.Provider>
  );
}

/**
 * A grey panel's fill. On a page it is --color-background; inside a dark bottom sheet (whose own
 * surface is that same raised charcoal) it steps up to --color-primary-soft so it still shows.
 */
function useRaisedPanel(base = 'bg-background') {
  const inSheet = useInSheet();
  const { dark } = useThemeToggle();
  return inSheet && dark ? 'bg-primary-soft' : base;
}

/**
 * The small call to action on the right of a list card ("Measure", "Review"): near-black pill,
 * or orange when it is the one thing waiting on this person.
 */
export function ActionPill({ label, accent, icon = 'chevron-right' }: { label: string; accent?: boolean; icon?: IconName }) {
  return (
    <View className={cn('min-h-9 flex-row items-center gap-1 rounded-full px-3.5', accent ? 'bg-saffron' : 'bg-primary')}>
      <Text className={cn('text-[13px] font-semibold', accent ? 'text-saffron-foreground' : 'text-primary-foreground')}>{label}</Text>
      <Icon name={icon} size={14} colorClassName={accent ? 'accent-saffron-foreground' : 'accent-primary-foreground'} />
    </View>
  );
}

// ───────── buttons ─────────

/** `danger` is outlined red (a secondary destructive action); `destructive` is solid red (the confirming one). */
type ButtonKind = 'primary' | 'secondary' | 'danger' | 'destructive' | 'success' | 'ghost' | 'navy';

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
    primary: 'bg-primary active:opacity-85',
    navy: 'bg-primary active:opacity-85',
    secondary: 'border border-input bg-card active:bg-secondary',
    danger: 'border border-destructive bg-card active:bg-destructive-soft',
    destructive: 'bg-destructive active:opacity-85',
    success: 'bg-success active:opacity-85',
    ghost: 'active:bg-secondary',
  };
  const text: Record<ButtonKind, string> = {
    primary: 'text-primary-foreground',
    navy: 'text-primary-foreground',
    secondary: 'text-foreground',
    danger: 'text-destructive',
    destructive: 'text-white',
    success: 'text-white',
    ghost: 'text-saffron-strong',
  };
  const accent: Record<ButtonKind, string> = {
    primary: 'accent-primary-foreground',
    navy: 'accent-primary-foreground',
    secondary: 'accent-foreground',
    danger: 'accent-destructive',
    destructive: 'accent-white',
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
        'flex-row items-center justify-center gap-2 rounded-full',
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

/** Round icon button on a card or page. */
export function IconButton({ icon, label, onPress, tone }: { icon: IconName; label: string; onPress: () => void; tone?: 'bad' }) {
  return (
    <Tap
      scale={0.9}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-11 w-11 items-center justify-center rounded-full bg-secondary active:bg-background"
    >
      <Icon name={icon} size={18} colorClassName={tone === 'bad' ? 'accent-destructive' : 'accent-foreground'} />
    </Tap>
  );
}

/** Filter / choice chip. Selected = solid black (white in dark). */
export function Chip({ text, on, onPress, count }: { text: string; on?: boolean; onPress: () => void; count?: number }) {
  // inside a grey panel, an unselected chip sits on white so it stays visible
  const inset = useContext(InsetGroup);
  return (
    <Tap
      scale={0.94}
      haptic={!on}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      className={cn('min-h-9 flex-row items-center gap-1.5 rounded-full border px-4', on ? 'border-primary bg-primary' : cn('border-transparent active:bg-secondary', inset ? 'bg-card' : 'bg-background'))}
    >
      <Text className={cn('text-[13px] font-semibold', on ? 'text-primary-foreground' : 'text-muted-foreground')}>{text}</Text>
      {count != null && count > 0 && (
        <View className={cn('min-w-5 items-center rounded-full px-1.5', on ? 'bg-saffron' : 'bg-secondary')}>
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
  const track = useRaisedPanel('bg-secondary');
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  useEffect(() => {
    if (w) x.value = withTiming(index * w, SLIDE);
  }, [index, w, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View
      className={cn('flex-row rounded-2xl p-1', onDark ? 'bg-hero-chip' : track)}
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
          className={cn('absolute bottom-1 left-1 top-1 rounded-xl', onDark ? 'bg-saffron' : 'bg-primary')}
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
            className="min-h-10 flex-1 items-center justify-center rounded-xl px-2"
          >
            <Text
              className={cn(
                'text-center text-[13px]',
                on ? (onDark ? 'font-semibold text-saffron-foreground' : 'font-semibold text-primary-foreground') : onDark ? 'font-medium text-hero-muted' : 'font-medium text-muted-foreground',
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
      x.value = withTiming(active.x, SLIDE);
      w.value = withTiming(active.w, SLIDE);
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
    <View className="min-h-12 flex-row items-center gap-2.5 rounded-full bg-background pl-4 pr-1.5">
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

/**
 * The squared switch geometry (dp). Both shapes are rounded rectangles, never pills or circles:
 * a 60 × 34 track (radius 7) holding a 24 × 24 thumb (radius 4), inset 5 on every side, so the
 * thumb travels 26 and can never leave the track.
 */
const SWITCH = { w: 60, h: 34, r: 7, thumb: 24, thumbR: 4 } as const;
const SWITCH_INSET = (SWITCH.h - SWITCH.thumb) / 2;
const SWITCH_TRAVEL = SWITCH.w - SWITCH.thumb - SWITCH_INSET * 2;
const SWITCH_TIMING = { duration: 200, easing: Easing.bezier(0.2, 0, 0, 1) };

/**
 * On / off switch, TimberTrail's square-on-square design: off is the neutral input grey with the
 * thumb on the left; on is saffron with the thumb on the right. The thumb slides across in 200 ms
 * and dips slightly while pressed. Colours are theme tokens (--color-input, --color-saffron), so
 * it follows light and dark; the thumb is white in both.
 *
 * Touch area is 48dp tall (and 60dp wide); screen readers hear a switch with its label and state.
 */
export function CustomSwitch({ value, onChange, label, disabled }: { value: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  const [on, off] = useCSSVariable(['--color-saffron', '--color-input']).map(String);
  const p = useSharedValue(value ? 1 : 0);
  const pressed = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(value ? 1 : 0, SWITCH_TIMING);
  }, [value, p]);
  const track = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.value, [0, 1], [off, on]) }));
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: p.value * SWITCH_TRAVEL }, { scale: 1 - pressed.value * 0.08 }] }));
  return (
    <Pressable
      onPress={() => {
        tick();
        onChange(!value);
      }}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: 90 });
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, { duration: 160 });
      }}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      hitSlop={{ top: 0, bottom: 0, left: 6, right: 6 }}
      className={cn('h-12 justify-center', disabled && 'opacity-40')}
    >
      <Reanimated.View style={[{ width: SWITCH.w, height: SWITCH.h, borderRadius: SWITCH.r, padding: SWITCH_INSET, justifyContent: 'center' }, track]}>
        <AnimatedView
          className="bg-white shadow-sm shadow-black/20"
          style={[{ width: SWITCH.thumb, height: SWITCH.thumb, borderRadius: SWITCH.thumbR, elevation: 2 }, thumb]}
        />
      </Reanimated.View>
    </Pressable>
  );
}

/** The app's switch everywhere (same props as before): see CustomSwitch. */
export const Toggle = CustomSwitch;

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
        <View key={i} className="min-h-[112px] grow basis-[46%] gap-3 rounded-2xl bg-background p-3.5">
          <View className="flex-row items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <Skeleton className="h-3 w-20" />
          </View>
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-3 w-28" />
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

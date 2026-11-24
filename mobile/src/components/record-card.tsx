/**
 * OperationalRecordCard — one card shape for the three operational lists (Load in, Production,
 * Load out), configured per operation in cards.tsx. Everything about a record sits on ONE surface
 * that is ONE tap target (no nested panels, no inner buttons):
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ [icon]  IMP-0042                 (✓ Approved)│  header: operation, ID, date, status
 *   │         19 Nov 2026, 3:05 pm                 │
 *   │ 🚚 TN 45 AB 1234 · 🌲 Teak · 📍 Kerala      │  metadata: only what the record has
 *   │ ──────────────────────────────────────────── │
 *   │ LOGS            RECEIVED                     │  metrics: two (or three) columns
 *   │ 42              118.250 CFT                  │
 *   │ ──────────────────────────────────────────── │
 *   │ Created by Ravi              View details  → │  footer
 *   └──────────────────────────────────────────────┘
 *
 * Surface: white with a hairline in light; the raised charcoal with a hairline in dark. Nothing is
 * shown for a value the record doesn't have — no placeholder zeros.
 */
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useT } from '../lib/i18n';
import { STATUSES, type Status } from '../lib/types';
import { useThemeToggle } from '../lib/theme';
import { useListDensity } from '../services/preferences';
import { Tap } from './motion';
import { Text } from './text';
import { Chip, cn, Icon, type IconName, IconTile, Muted, Reason, RecordStatusBadge, Skeleton } from './ui';

export interface RecordMeta {
  icon: IconName;
  /** what it is, for screen readers: "Lorry number" */
  label: string;
  value: string | null | undefined;
}

export interface RecordMetric {
  label: string;
  /** null when the record has no such figure yet: the column shows a dash, never a zero */
  value: string | null;
  unit?: string;
}

export interface OperationalRecordCardProps {
  icon: IconName;
  code: string;
  /** already formatted (date, or date and time) — omitted when unknown */
  date?: string;
  status: string;
  meta: RecordMeta[];
  metrics: RecordMetric[];
  /** muted text on the left of the footer ("Created by Ravi") */
  footerNote?: string;
  /** the footer's call to action; defaults to "View details" */
  action?: { label: string; accent?: boolean };
  rejectionReason?: string | null;
  onPress: () => void;
  /** spoken summary of the whole card */
  accessibilityLabel: string;
  viewDetailsLabel: string;
}

export function RecordCardHeader({ icon, code, date, status }: { icon: IconName; code: string; date?: string; status: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <IconTile icon={icon} tone="navy" size="sm" />
      <View className="flex-1 gap-0.5">
        <Text className="text-[15px] font-bold tracking-tight text-foreground font-display" numberOfLines={1}>
          {code}
        </Text>
        {!!date && (
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {date}
          </Text>
        )}
      </View>
      <RecordStatusBadge status={status} />
    </View>
  );
}

/** Small icon + value pairs that wrap; a pair with no value is left out. */
export function RecordMetadata({ items }: { items: RecordMeta[] }) {
  const shown = items.filter((m) => !!m.value?.trim());
  if (!shown.length) return null;
  return (
    <View className="flex-row flex-wrap items-center gap-x-3.5 gap-y-1.5">
      {shown.map((m) => (
        <View key={m.label} className="max-w-full shrink flex-row items-center gap-1.5" accessible accessibilityLabel={`${m.label}: ${m.value}`}>
          <Icon name={m.icon} size={13} colorClassName="accent-muted-foreground" />
          <Text className="shrink text-[13px] font-medium text-foreground" numberOfLines={1}>
            {m.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Equal columns of label over figure, on the card itself (no inner panel). */
export function RecordMetrics({ items }: { items: RecordMetric[] }) {
  return (
    <View className="flex-row gap-3">
      {items.map((m) => (
        <View key={m.label} className="flex-1 gap-0.5" accessible accessibilityLabel={`${m.label}: ${m.value ?? '—'}${m.value && m.unit ? ` ${m.unit}` : ''}`}>
          <Text className="text-[11px] font-semibold uppercase tracking-[0.6px] text-muted-foreground" numberOfLines={1}>
            {m.label}
          </Text>
          <Text className="text-lg font-bold tabular-nums text-foreground font-display" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {m.value ?? '—'}
            {m.value && m.unit ? <Text className="text-xs font-semibold text-muted-foreground"> {m.unit}</Text> : null}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Context on the left, the call to action on the right (part of the card's one tap target). */
export function RecordCardFooter({ note, action }: { note?: string; action: { label: string; accent?: boolean } }) {
  return (
    <View className="flex-row items-center gap-3">
      <Muted lines={1} className="flex-1">
        {note ?? ''}
      </Muted>
      {action.accent ? (
        <View className="min-h-8 flex-row items-center gap-1 rounded-full bg-saffron px-3">
          <Text className="text-[13px] font-semibold text-saffron-foreground">{action.label}</Text>
          <Icon name="arrow-right" size={14} colorClassName="accent-saffron-foreground" />
        </View>
      ) : (
        <View className="flex-row items-center gap-1">
          <Text className="text-[13px] font-semibold text-saffron-strong">{action.label}</Text>
          <Icon name="arrow-right" size={14} colorClassName="accent-saffron-strong" />
        </View>
      )}
    </View>
  );
}

/** The card's one surface. */
function Surface({ children, onPress, label }: { children: ReactNode; onPress: () => void; label: string }) {
  const { dark } = useThemeToggle();
  const compact = useListDensity() === 'compact';
  return (
    <Tap
      scale={0.985}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={cn(
        'mb-3 rounded-3xl bg-card shadow-sm shadow-black/5 active:bg-secondary',
        compact ? 'gap-2.5 p-3' : 'gap-3 p-4',
      )}
    >
      {children}
    </Tap>
  );
}

const Rule = () => <View className="h-px bg-border" />;

export function OperationalRecordCard(p: OperationalRecordCardProps) {
  return (
    <Surface onPress={p.onPress} label={p.accessibilityLabel}>
      <RecordCardHeader icon={p.icon} code={p.code} date={p.date} status={p.status} />
      <RecordMetadata items={p.meta} />
      {!!p.rejectionReason && <Reason>{p.rejectionReason}</Reason>}
      <Rule />
      <RecordMetrics items={p.metrics} />
      <Rule />
      <RecordCardFooter note={p.footerNote} action={p.action ?? { label: p.viewDetailsLabel }} />
    </Surface>
  );
}

/** Loading placeholders shaped like record cards. */
export function SkeletonRecordCards({ count = 3 }: { count?: number }) {
  return (
    <View accessibilityLabel="Loading">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} className="mb-3 gap-3 rounded-3xl bg-card p-4">
          <View className="flex-row items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <View className="flex-1 gap-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-36" />
            </View>
            <Skeleton className="h-5 w-20 rounded-full" />
          </View>
          <Skeleton className="h-3 w-48" />
          <View className="flex-row gap-3 pt-1">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-28" />
          </View>
        </View>
      ))}
    </View>
  );
}

/** The status filter above an operational list: All · Draft · Pending · Approved · Rejected ('' = all). */
export function OperationFilterChips({ value, onChange }: { value: Status | ''; onChange: (s: Status | '') => void }) {
  const t = useT();
  const label: Record<Status, 'draft' | 'pending' | 'approved' | 'rejected'> = { DRAFT: 'draft', SUBMITTED: 'pending', APPROVED: 'approved', REJECTED: 'rejected' };
  // the same status colours as the web's filter chips
  const dot: Record<Status, string> = { DRAFT: 'bg-muted-foreground', SUBMITTED: 'bg-warning', APPROVED: 'bg-success', REJECTED: 'bg-destructive' };
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5" accessibilityRole="tablist">
      <Chip text={t('allStatuses')} on={!value} onPress={() => onChange('')} />
      {STATUSES.map((s) => (
        <Chip key={s} text={t(label[s])} dot={dot[s]} on={value === s} onPress={() => onChange(s)} />
      ))}
    </ScrollView>
  );
}

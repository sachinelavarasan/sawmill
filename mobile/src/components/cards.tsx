/** One card per record type, shared by the lists, the dashboards and the approvals queue. */
import { sizeLabel, type TKey } from '@timbertrail/shared';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { dateOnly, dateTime, int, isoDay, num3, signed3, signedInt, timeOnly, todayIso } from '../lib/format';
import { useT } from '../lib/i18n';
import { useListDensity } from '../services/preferences';
import { OperationalRecordCard } from './record-card';
import type { ImportSummary } from '../lib/imports-api';
import type { ApprovalItem, ApprovalKind, ExportSummary, Movement, MovementSource, ProductionSummary } from '../lib/types';
import { Text } from './text';
import { ActionPill, cn, Icon, IconTile, type IconName, Muted, StatusPill } from './ui';

/** Row padding for the list density preference (both keep a 48px+ touch target). */
const rowPad = (compact: boolean) => (compact ? 'min-h-14 py-2' : 'min-h-[68px] py-3');

// ───────── operational records: one card, three configurations ─────────

/** A load coming in: lorry, wood, where from; logs and CFT received. `measure` makes it open the keypad. */
export function ImportCard({ item, measure }: { item: ImportSummary; measure?: boolean }) {
  const t = useT();
  const router = useRouter();
  const when = item.arrivalAt ? dateTime(item.arrivalAt) : undefined;
  return (
    <OperationalRecordCard
      icon="download"
      code={item.code}
      date={when}
      status={item.status}
      meta={[
        { icon: 'truck', label: t('lorryNumber'), value: item.lorryNumber },
        { icon: 'tree-pine', label: t('woodType'), value: item.woodType },
        { icon: 'map-pin', label: t('originLocation'), value: item.originLocation },
      ]}
      metrics={[
        { label: t('logs'), value: int(item.totalLogs) },
        { label: t('receivedCft'), value: num3(item.totalCft), unit: 'CFT' },
      ]}
      footerNote={item.createdByName ? `${t('createdBy')} ${item.createdByName}` : undefined}
      action={measure ? { label: t('measure'), accent: true } : undefined}
      rejectionReason={item.rejectionReason}
      viewDetailsLabel={t('viewDetails')}
      accessibilityLabel={`${t('imports')} ${item.code}, ${item.lorryNumber}, ${item.woodType}, ${int(item.totalLogs)} ${t('logs')}, ${num3(item.totalCft)} CFT`}
      onPress={() => router.push(measure ? `/imports/${item.id}/measure` : `/imports/${item.id}`)}
    />
  );
}

/** A production run: which load it sawed, wood; raw CFT in, finished CFT out, and waste once known. */
export function ProductionCard({ item }: { item: ProductionSummary }) {
  const t = useT();
  const router = useRouter();
  return (
    <OperationalRecordCard
      icon="factory"
      code={item.code}
      date={dateOnly(item.productionDate)}
      status={item.status}
      meta={[
        { icon: 'download', label: t('sourceLoad'), value: item.importCode },
        { icon: 'tree-pine', label: t('woodType'), value: item.woodType },
      ]}
      metrics={[
        { label: t('inputCft'), value: item.inputCft != null ? num3(item.inputCft) : null, unit: 'CFT' },
        { label: t('outputCft'), value: num3(item.outputCft), unit: 'CFT' },
        // only when the run has a waste figure: no "0" for something not yet worked out
        ...(item.wasteCft != null ? [{ label: t('wasteCft'), value: num3(item.wasteCft), unit: 'CFT' }] : []),
      ]}
      footerNote={item.createdByName ? `${t('createdBy')} ${item.createdByName}` : undefined}
      rejectionReason={item.rejectionReason}
      viewDetailsLabel={t('viewDetails')}
      accessibilityLabel={`${t('production')} ${item.code}, ${item.importCode}, ${item.woodType}, ${item.inputCft != null ? num3(item.inputCft) : '—'} → ${num3(item.outputCft)} CFT`}
      onPress={() => router.push(`/production/${item.id}`)}
    />
  );
}

/** A load going out: lorry, wood; pieces and CFT shipped. */
export function ExportCard({ item }: { item: ExportSummary }) {
  const t = useT();
  const router = useRouter();
  return (
    <OperationalRecordCard
      icon="upload"
      code={item.code}
      date={dateOnly(item.exportDate)}
      status={item.status}
      meta={[
        { icon: 'truck', label: t('lorryNumber'), value: item.lorryNumber },
        { icon: 'tree-pine', label: t('woodType'), value: item.woodType },
      ]}
      metrics={[
        { label: t('pieces'), value: int(item.totalPieces) },
        { label: t('shippedCft'), value: num3(item.totalCft), unit: 'CFT' },
      ]}
      footerNote={item.createdByName ? `${t('createdBy')} ${item.createdByName}` : undefined}
      rejectionReason={item.rejectionReason}
      viewDetailsLabel={t('viewDetails')}
      accessibilityLabel={`${t('exports')} ${item.code}, ${item.lorryNumber}, ${item.woodType}, ${int(item.totalPieces)} ${t('pieces')}, ${num3(item.totalCft)} CFT`}
      onPress={() => router.push(`/exports/${item.id}`)}
    />
  );
}

export const SOURCE_KEY: Record<MovementSource, TKey> = {
  IMPORT: 'srcImport',
  PRODUCTION_INPUT: 'srcProductionIn',
  PRODUCTION_OUTPUT: 'srcProductionOut',
  EXPORT: 'srcExport',
  ADJUSTMENT: 'srcAdjustment',
};

const SOURCE_ICON: Record<MovementSource, IconName> = {
  IMPORT: 'download',
  PRODUCTION_INPUT: 'axe',
  PRODUCTION_OUTPUT: 'package',
  EXPORT: 'upload',
  ADJUSTMENT: 'sliders',
};

const sourceHref = (m: Movement) =>
  m.source === 'IMPORT'
    ? `/imports/${m.sourceId}`
    : m.source === 'EXPORT'
      ? `/exports/${m.sourceId}`
      : m.source === 'ADJUSTMENT'
        ? `/stock/adjustments/${m.sourceId}`
        : `/production/${m.sourceId}`;

/**
 * One stock movement, statement style: where it came from (icon + source + record code),
 * what wood, and the signed change on the right with the time under it. Tapping opens the
 * record that caused it. `timeOnly` when the list is already grouped by day.
 */
export function MovementRow({ m, last, timeOnly: onlyTime }: { m: Movement; last?: boolean; timeOnly?: boolean }) {
  const compact = useListDensity() === 'compact';
  const t = useT();
  const router = useRouter();
  const up = m.cftDelta > 0;
  const size = m.thicknessIn != null && m.widthIn != null && m.lengthFt != null ? sizeLabel(m.thicknessIn, m.widthIn, m.lengthFt) : null;
  return (
    <Pressable
      onPress={() => router.push(sourceHref(m) as never)}
      accessibilityRole="button"
      accessibilityLabel={`${t(up ? 'stockIn' : 'stockOut')}: ${t(SOURCE_KEY[m.source])} ${m.sourceCode}, ${signed3(m.cftDelta)} CFT${m.piecesDelta ? `, ${signedInt(m.piecesDelta)} ${t('pieces')}` : ''}`}
      className={cn('flex-row items-center gap-3.5 px-4 active:bg-secondary', rowPad(compact), !last && 'border-b border-border')}
    >
      <View>
        <IconTile icon={SOURCE_ICON[m.source]} tone={up ? 'good' : 'bad'} />
      </View>
      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-2">
          <Text className="shrink text-[15px] font-semibold text-foreground" numberOfLines={1}>
            {t(SOURCE_KEY[m.source])}
          </Text>
          <Text className="text-xs font-medium text-muted-foreground">{m.sourceCode}</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className={cn('rounded-md px-1.5 py-px', m.kind === 'RAW' ? 'bg-saffron-soft' : 'bg-primary-soft')}>
            <Text className={cn('text-[11px] font-semibold', m.kind === 'RAW' ? 'text-saffron-strong' : 'text-primary')}>{t(m.kind === 'RAW' ? 'raw' : 'finished')}</Text>
          </View>
          <Text className="shrink text-[13px] text-muted-foreground" numberOfLines={1}>
            {m.woodType}
            {size ? ` · ${size}` : ''}
          </Text>
        </View>
      </View>
      {/* direction in words and an arrow as well as colour; pieces when the movement moved pieces */}
      <View className="items-end gap-0.5">
        <View className="flex-row items-center gap-1">
          <Icon name={up ? 'arrow-down-left' : 'arrow-up-right'} size={12} colorClassName={up ? 'accent-success' : 'accent-destructive'} />
          <Text className={cn('text-[11px] font-bold uppercase tracking-[0.5px]', up ? 'text-success' : 'text-destructive')}>{t(up ? 'stockIn' : 'stockOut')}</Text>
        </View>
        <Text className={cn('text-[15px] font-bold tabular-nums', up ? 'text-success' : 'text-destructive')}>
          {signed3(m.cftDelta)}
          <Text className="text-[11px] font-semibold"> CFT</Text>
        </Text>
        <Text className="text-xs tabular-nums text-muted-foreground" numberOfLines={1}>
          {m.piecesDelta ? `${signedInt(m.piecesDelta)} ${t('pieces')} · ` : ''}
          {onlyTime ? timeOnly(m.createdAt) : dateTime(m.createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}

/** "Today", "Yesterday" or the date, for a date-only ('YYYY-MM-DD') or a full timestamp. */
export function useDayLabel() {
  const t = useT();
  return (s: string) => {
    const day = s.length > 10 ? isoDay(new Date(s)) : s.slice(0, 10);
    if (day === todayIso()) return t('today');
    if (day === isoDay(new Date(Date.now() - 86_400_000))) return t('yesterday');
    return dateOnly(day);
  };
}

// ───────── approvals ─────────

export const APPROVAL_KIND: Record<ApprovalKind, { labelKey: TKey; icon: IconName; href: (id: string) => string }> = {
  IMPORT: { labelKey: 'imports', icon: 'download', href: (id) => `/imports/${id}` },
  PRODUCTION: { labelKey: 'production', icon: 'settings', href: (id) => `/production/${id}` },
  EXPORT: { labelKey: 'exports', icon: 'upload', href: (id) => `/exports/${id}` },
  ADJUSTMENT: { labelKey: 'adjustments', icon: 'sliders', href: (id) => `/stock/adjustments/${id}` },
};

/** The figures that matter for a decision, on one line. */
export function approvalSummary(i: ApprovalItem, t: ReturnType<typeof useT>): string {
  switch (i.type) {
    case 'IMPORT':
      return `${i.lorryNumber} · ${int(i.totalLogs)} ${t('logs')} · ${num3(i.totalCft)} CFT`;
    case 'PRODUCTION':
      return `${i.importCode} · ${i.inputCft != null ? num3(i.inputCft) : '—'} → ${num3(i.outputCft)} CFT`;
    case 'EXPORT':
      return `${i.lorryNumber} · ${int(i.totalPieces)} ${t('pieces')} · ${num3(i.totalCft)} CFT`;
    case 'ADJUSTMENT':
      return `${i.importCode} · ${t(i.kind === 'RAW' ? 'raw' : 'finished')} ${signed3(i.cftDelta)} CFT${i.piecesDelta ? ` · ${signedInt(i.piecesDelta)} ${t('pieces')}` : ''}`;
  }
}

/** A record waiting for the owner, as a compact row with a Review button (Home's queue preview). */
export function ApprovalRow({ item, last }: { item: ApprovalItem; last?: boolean }) {
  const compact = useListDensity() === 'compact';
  const t = useT();
  const router = useRouter();
  const dayLabel = useDayLabel();
  const k = APPROVAL_KIND[item.type];
  return (
    <Pressable
      onPress={() => router.push(k.href(item.id) as never)}
      accessibilityRole="button"
      accessibilityLabel={`${t('review')} ${item.code}, ${t(k.labelKey)}`}
      className={cn('flex-row items-center gap-3 px-4 active:bg-secondary', rowPad(compact), !last && 'border-b border-border')}
    >
      <IconTile icon={k.icon} tone="warn" />
      <View className="flex-1 gap-0.5">
        <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
          {item.code} <Text className="text-[13px] font-medium text-muted-foreground">· {t(k.labelKey)}</Text>
        </Text>
        <Text className="text-[13px] tabular-nums text-foreground" numberOfLines={1}>
          {approvalSummary(item, t)}
        </Text>
        <Muted lines={1}>
          {item.createdByName} · {dayLabel(item.submittedAt)}
        </Muted>
      </View>
      <ActionPill label={t('review')} />
    </Pressable>
  );
}

// ───────── activity ─────────

export type ActivityKind = 'IMPORT' | 'PRODUCTION' | 'EXPORT';
export interface Activity {
  kind: ActivityKind;
  id: string;
  code: string;
  status: string;
  /** the record's own date (arrival, production or export date) */
  date: string;
  wood: string;
  /** the figure that describes it: "42 logs · 118.250 CFT" */
  context: string;
}

const ACTIVITY: Record<ActivityKind, { labelKey: TKey; icon: IconName; href: (id: string) => string }> = {
  IMPORT: APPROVAL_KIND.IMPORT,
  PRODUCTION: APPROVAL_KIND.PRODUCTION,
  EXPORT: APPROVAL_KIND.EXPORT,
};

/** Recent imports, production runs and exports as one timeline, newest first. */
export function toActivities(
  t: ReturnType<typeof useT>,
  imports: ImportSummary[] = [],
  production: ProductionSummary[] = [],
  exports: ExportSummary[] = [],
  limit = 6,
): Activity[] {
  const all: Activity[] = [
    ...imports.map((i) => ({ kind: 'IMPORT' as const, id: i.id, code: i.code, status: i.status, date: i.arrivalAt, wood: i.woodType, context: `${int(i.totalLogs)} ${t('logs')} · ${num3(i.totalCft)} CFT` })),
    ...production.map((p) => ({
      kind: 'PRODUCTION' as const,
      id: p.id,
      code: p.code,
      status: p.status,
      date: p.productionDate,
      wood: p.woodType,
      context: `${p.inputCft != null ? num3(p.inputCft) : '—'} → ${num3(p.outputCft)} CFT`,
    })),
    ...exports.map((e) => ({ kind: 'EXPORT' as const, id: e.id, code: e.code, status: e.status, date: e.exportDate, wood: e.woodType, context: `${int(e.totalPieces)} ${t('pieces')} · ${num3(e.totalCft)} CFT` })),
  ];
  const at = (s: string) => Date.parse(s.length > 10 ? s : `${s}T00:00:00`) || 0;
  return all.sort((a, b) => at(b.date) - at(a.date)).slice(0, limit);
}

/**
 * One operation in a timeline: icon of its kind, record code and status on top; kind, wood and its
 * figures under it, with the day on the right. Tapping opens the record.
 */
export function ActivityRow({ a, last }: { a: Activity; last?: boolean }) {
  const compact = useListDensity() === 'compact';
  const t = useT();
  const router = useRouter();
  const dayLabel = useDayLabel();
  const k = ACTIVITY[a.kind];
  return (
    <Pressable
      onPress={() => router.push(k.href(a.id) as never)}
      accessibilityRole="button"
      accessibilityLabel={`${a.code}, ${t(k.labelKey)}, ${dayLabel(a.date)}`}
      className={cn('flex-row items-center gap-3 px-4 active:bg-secondary', rowPad(compact), !last && 'border-b border-border')}
    >
      <IconTile icon={k.icon} tone="navy" />
      <View className="flex-1 gap-1">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="shrink text-[15px] font-semibold text-foreground" numberOfLines={1}>
            {a.code}
          </Text>
          <StatusPill status={a.status} />
        </View>
        <View className="flex-row items-center justify-between gap-2">
          <Text className="shrink text-[13px] text-muted-foreground" numberOfLines={1}>
            {t(k.labelKey)} · {a.wood} · {a.context}
          </Text>
          <Text className="text-xs font-medium text-muted-foreground">{dayLabel(a.date)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

/** Day heading in a movement list: "Today", "Yesterday" or the date, with that day's net change. */
export function DayHeader({ day, net }: { day: string; net: number }) {
  const t = useT();
  const today = todayIso();
  const yesterday = isoDay(new Date(Date.now() - 86_400_000));
  const label = day === today ? t('today') : day === yesterday ? t('yesterday') : dateOnly(day);
  return (
    <View className="-mx-4 flex-row items-center justify-between bg-background px-4 py-2">
      <Text className="text-xs font-semibold uppercase tracking-[1px] text-muted-foreground">{label}</Text>
      <Text className={cn('text-xs font-semibold tabular-nums', net > 0 ? 'text-success' : net < 0 ? 'text-destructive' : 'text-muted-foreground')}>
        {signed3(net)} CFT
      </Text>
    </View>
  );
}

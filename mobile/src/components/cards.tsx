/** One card per record type, shared by the lists, the dashboards and the approvals queue. */
import { sizeLabel, type TKey } from '@timbertrail/shared';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { dateOnly, dateTime, int, isoDay, num3, signed3, timeOnly, todayIso } from '../lib/format';
import { useT } from '../lib/i18n';
import type { ImportSummary } from '../lib/imports-api';
import type { ExportSummary, Movement, MovementSource, ProductionSummary } from '../lib/types';
import { Text } from './text';
import { cn, Icon, IconTile, type IconName, Muted, PressableCard, Reason, StatusPill } from './ui';

/** Icon tile, code and status on one line; the subtitle under the code. */
function Head({ code, status, icon, sub }: { code: string; status: string; icon: IconName; sub: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <IconTile icon={icon} tone="navy" />
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="shrink text-[15px] font-semibold text-foreground" numberOfLines={1}>
            {code}
          </Text>
          <StatusPill status={status} />
        </View>
        <Muted lines={1}>{sub}</Muted>
      </View>
    </View>
  );
}

/** Key figures in a soft strip under the head. */
function Figures({ items, right }: { items: { value: string; label: string }[]; right?: React.ReactNode }) {
  return (
    <View className="flex-row items-center gap-4 rounded-xl bg-secondary px-3.5 py-2.5">
      {items.map((f) => (
        <View key={f.label} className="gap-0.5">
          <Text className="text-[11px] font-medium text-muted-foreground">{f.label}</Text>
          <Text className="text-[15px] font-bold tabular-nums text-foreground">{f.value}</Text>
        </View>
      ))}
      <View className="flex-1" />
      {right ?? <Icon name="chevron-right" size={18} colorClassName="accent-muted-foreground" />}
    </View>
  );
}

export function ImportCard({ item, measure }: { item: ImportSummary; measure?: boolean }) {
  const t = useT();
  const router = useRouter();
  return (
    <PressableCard label={`${item.code}, ${item.woodType}`} onPress={() => router.push(measure ? `/imports/${item.id}/measure` : `/imports/${item.id}`)}>
      <Head
        code={item.code}
        status={item.status}
        icon="download"
        sub={`${item.lorryNumber} · ${item.woodType}${item.arrivalAt ? ` · ${dateTime(item.arrivalAt)}` : ''}`}
      />
      <Figures
        items={[
          { value: int(item.totalLogs), label: t('logs') },
          { value: num3(item.totalCft), label: 'CFT' },
        ]}
        right={
          measure ? (
            <View className="min-h-9 flex-row items-center gap-1 rounded-full bg-saffron px-3.5">
              <Text className="text-[13px] font-semibold text-saffron-foreground">{t('measure')}</Text>
              <Icon name="chevron-right" size={14} colorClassName="accent-saffron-foreground" />
            </View>
          ) : undefined
        }
      />
      {!!item.rejectionReason && <Reason>{item.rejectionReason}</Reason>}
    </PressableCard>
  );
}

export function ProductionCard({ item }: { item: ProductionSummary }) {
  const t = useT();
  const router = useRouter();
  return (
    <PressableCard label={`${item.code}, ${item.woodType}`} onPress={() => router.push(`/production/${item.id}`)}>
      <Head code={item.code} status={item.status} icon="settings" sub={`${item.importCode} · ${item.woodType} · ${dateOnly(item.productionDate)}`} />
      <Figures
        items={[
          { value: item.inputCft != null ? num3(item.inputCft) : '—', label: t('inputCft') },
          { value: num3(item.outputCft), label: t('outputCft') },
        ]}
      />
      {!!item.rejectionReason && <Reason>{item.rejectionReason}</Reason>}
    </PressableCard>
  );
}

export function ExportCard({ item }: { item: ExportSummary }) {
  const t = useT();
  const router = useRouter();
  return (
    <PressableCard label={`${item.code}, ${item.woodType}`} onPress={() => router.push(`/exports/${item.id}`)}>
      <Head code={item.code} status={item.status} icon="upload" sub={`${item.lorryNumber} · ${item.woodType} · ${dateOnly(item.exportDate)}`} />
      <Figures
        items={[
          { value: int(item.totalPieces), label: t('pieces') },
          { value: num3(item.totalCft), label: 'CFT' },
        ]}
      />
      {!!item.rejectionReason && <Reason>{item.rejectionReason}</Reason>}
    </PressableCard>
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
  const t = useT();
  const router = useRouter();
  const up = m.cftDelta > 0;
  const size = m.thicknessIn != null && m.widthIn != null && m.lengthFt != null ? sizeLabel(m.thicknessIn, m.widthIn, m.lengthFt) : null;
  return (
    <Pressable
      onPress={() => router.push(sourceHref(m) as never)}
      accessibilityRole="button"
      accessibilityLabel={`${t(SOURCE_KEY[m.source])} ${m.sourceCode}, ${signed3(m.cftDelta)} CFT`}
      className={cn('min-h-[68px] flex-row items-center gap-3.5 px-4 py-3 active:bg-secondary', !last && 'border-b border-border')}
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
      <View className="items-end gap-1">
        <Text className={cn('text-[15px] font-bold tabular-nums', up ? 'text-success' : 'text-destructive')}>
          {signed3(m.cftDelta)}
          <Text className="text-[11px] font-semibold"> CFT</Text>
        </Text>
        <Text className="text-xs text-muted-foreground">{onlyTime ? timeOnly(m.createdAt) : dateTime(m.createdAt)}</Text>
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

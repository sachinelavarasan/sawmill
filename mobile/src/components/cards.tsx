/** One card per record type, shared by the lists, the dashboards and the approvals queue. */
import { sizeLabel, type TKey } from '@sawmill/shared';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { dateOnly, dateTime, int, num3, signed3 } from '../lib/format';
import { useT } from '../lib/i18n';
import type { ImportSummary } from '../lib/imports-api';
import type { ExportSummary, Movement, MovementSource, ProductionSummary } from '../lib/types';
import { cn, Icon, Muted, PressableCard, Reason, StatusPill } from './ui';

function Head({ code, status }: { code: string; status: string }) {
  return (
    <View className="flex-row items-center justify-between gap-2.5">
      <Text className="text-[15px] font-bold text-foreground">{code}</Text>
      <StatusPill status={status} />
    </View>
  );
}

function Figures({ items }: { items: { value: string; label: string }[] }) {
  return (
    <View className="flex-row flex-wrap gap-x-4 gap-y-1">
      {items.map((f) => (
        <Text key={f.label} className="text-sm tabular-nums text-foreground">
          <Text className="font-bold">{f.value}</Text> <Text className="text-muted-foreground">{f.label}</Text>
        </Text>
      ))}
    </View>
  );
}

export function ImportCard({ item, measure }: { item: ImportSummary; measure?: boolean }) {
  const t = useT();
  const router = useRouter();
  return (
    <PressableCard onPress={() => router.push(measure ? `/imports/${item.id}/measure` : `/imports/${item.id}`)}>
      <Head code={item.code} status={item.status} />
      <Muted lines={1}>
        {item.lorryNumber} · {item.woodType}
        {item.arrivalAt ? ` · ${dateTime(item.arrivalAt)}` : ''}
      </Muted>
      <View className="flex-row items-center justify-between">
        <Figures
          items={[
            { value: int(item.totalLogs), label: t('logs') },
            { value: num3(item.totalCft), label: 'CFT' },
          ]}
        />
        {measure ? (
          <View className="flex-row items-center gap-1 rounded-full bg-saffron-soft px-3 py-1">
            <Text className="text-[13px] font-bold text-warning">{t('measure')}</Text>
            <Icon name="chevron-right" size={14} colorClassName="accent-warning" />
          </View>
        ) : (
          <Icon name="chevron-right" size={18} colorClassName="accent-muted-foreground" />
        )}
      </View>
      {!!item.rejectionReason && <Reason>{item.rejectionReason}</Reason>}
    </PressableCard>
  );
}

export function ProductionCard({ item }: { item: ProductionSummary }) {
  const t = useT();
  const router = useRouter();
  return (
    <PressableCard onPress={() => router.push(`/production/${item.id}`)}>
      <Head code={item.code} status={item.status} />
      <Muted lines={1}>
        {item.importCode} · {item.woodType} · {dateOnly(item.productionDate)}
      </Muted>
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
    <PressableCard onPress={() => router.push(`/exports/${item.id}`)}>
      <Head code={item.code} status={item.status} />
      <Muted lines={1}>
        {item.lorryNumber} · {item.woodType} · {dateOnly(item.exportDate)}
      </Muted>
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

/** One stock movement: what changed, by how much, and which record caused it. */
export function MovementRow({ m, last }: { m: Movement; last?: boolean }) {
  const t = useT();
  const up = m.cftDelta > 0;
  return (
    <View className={cn('flex-row items-center gap-3 px-4 py-3', !last && 'border-b border-border')}>
      <View className={cn('h-9 w-9 items-center justify-center rounded-full', up ? 'bg-success-soft' : 'bg-destructive-soft')}>
        <Icon name={up ? 'arrow-down-left' : 'arrow-up-right'} size={16} colorClassName={up ? 'accent-success' : 'accent-destructive'} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
          {t(SOURCE_KEY[m.source])} · {m.sourceCode}
        </Text>
        <Muted lines={1}>
          {t(m.kind === 'RAW' ? 'raw' : 'finished')} · {m.woodType}
          {m.thicknessIn != null && m.widthIn != null && m.lengthFt != null ? ` · ${sizeLabel(m.thicknessIn, m.widthIn, m.lengthFt)}` : ''} · {dateTime(m.createdAt)}
        </Muted>
      </View>
      <Text className={cn('text-sm font-bold tabular-nums', up ? 'text-success' : 'text-destructive')}>{signed3(m.cftDelta)}</Text>
    </View>
  );
}

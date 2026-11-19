import { Pressable, View } from 'react-native';
import { dateTime, int, num3, signed3, signedInt } from '../../lib/format';
import { useT } from '../../lib/i18n';
import type { ApprovalItem } from '../../lib/types';
import { APPROVAL_KIND } from '../cards';
import { Text } from '../text';
import { ActionPill, cn, Icon, IconTile } from '../ui';
import { ApprovalStatusBadge, formatWaitAge } from './ApprovalStatusBadge';

/**
 * Focused approval queue card:
 * - Header: operation icon, record ID, operation type, wood type, status/aging badge
 * - Primary info: vehicle / source load + key measurements (no duplicated fields)
 * - Footer: submitted by, submission timestamp, waiting duration, Review CTA
 */
export function ApprovalQueueCard({ item, onPress }: { item: ApprovalItem; onPress: () => void }) {
  const t = useT();
  const k = APPROVAL_KIND[item.type];
  const wait = formatWaitAge(item.submittedAt);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${t('review')} ${item.code}, ${t(k.labelKey)}, ${item.woodType}`}
      className="mb-3 gap-3 rounded-2xl border border-border bg-card p-4 active:bg-secondary"
    >
      {/* Header */}
      <View className="flex-row items-center gap-3">
        <IconTile icon={k.icon} tone={wait?.isAged ? 'warn' : 'saffron'} />
        <View className="flex-1 gap-0.5">
          <Text className="text-[15px] font-bold tracking-tight text-foreground font-display" numberOfLines={1}>
            {item.code}
          </Text>
          <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
            {t(k.labelKey)} · {item.woodType}
          </Text>
        </View>
        <ApprovalStatusBadge status="SUBMITTED" submittedAt={item.submittedAt} />
      </View>

      {/* Primary operational metrics */}
      <View className="gap-2 rounded-xl bg-background px-3.5 py-3">
        {item.type === 'IMPORT' && (
          <View className="flex-row items-center justify-between gap-3">
            <MetricCell label={t('vehicleLabel')} value={item.lorryNumber} />
            <MetricCell label={t('logs')} value={int(item.totalLogs)} align="center" />
            <MetricCell label={t('totalCft')} value={`${num3(item.totalCft)} CFT`} align="right" strong />
          </View>
        )}

        {item.type === 'PRODUCTION' && (
          <View className="flex-row items-center justify-between gap-3">
            <MetricCell label={t('sourceLoadShort')} value={item.importCode} />
            <MetricCell label={t('rawCftLabel')} value={item.inputCft != null ? `${num3(item.inputCft)} CFT` : '—'} align="center" />
            <MetricCell label={t('finishedCftLabel')} value={`${num3(item.outputCft)} CFT`} align="right" strong />
          </View>
        )}

        {item.type === 'EXPORT' && (
          <View className="flex-row items-center justify-between gap-3">
            <MetricCell label={t('vehicleLabel')} value={item.lorryNumber} />
            <MetricCell label={t('pieces')} value={int(item.totalPieces)} align="center" />
            <MetricCell label={t('totalCft')} value={`${num3(item.totalCft)} CFT`} align="right" strong />
          </View>
        )}

        {item.type === 'ADJUSTMENT' && (
          <View className="gap-1.5">
            <View className="flex-row items-center justify-between gap-3">
              <MetricCell label={t('sourceLoadShort')} value={`${item.importCode} · ${t(item.kind === 'RAW' ? 'raw' : 'finished')}`} />
              <MetricCell
                label={t('change')}
                value={`${signed3(item.cftDelta)} CFT${item.piecesDelta ? ` (${signedInt(item.piecesDelta)})` : ''}`}
                align="right"
                strong
              />
            </View>
            {!!item.reason && (
              <Text className="text-[12px] text-muted-foreground" numberOfLines={2}>
                {item.reason}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Footer */}
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 gap-0.5">
          <Text className="text-[13px] font-medium text-foreground" numberOfLines={1}>
            {t('submittedBy')} {item.createdByName}
          </Text>
          <View className="flex-row items-center gap-1.5">
            <Icon name="clock" size={12} colorClassName={wait?.isAged ? 'accent-warning' : 'accent-muted-foreground'} />
            <Text className={cn('text-[12px] tabular-nums', wait?.isAged ? 'font-semibold text-warning' : 'text-muted-foreground')} numberOfLines={1}>
              {dateTime(item.submittedAt)}
              {wait ? ` · ${t('waitingDuration', { age: wait.label })}` : ''}
            </Text>
          </View>
        </View>
        <ActionPill label={t('review')} accent={wait?.isAged} />
      </View>
    </Pressable>
  );
}

function MetricCell({
  label,
  value,
  align = 'left',
  strong,
}: {
  label: string;
  value: string;
  align?: 'left' | 'center' | 'right';
  strong?: boolean;
}) {
  return (
    <View className={cn('flex-1 gap-0.5', align === 'center' && 'items-center', align === 'right' && 'items-end')}>
      <Text className="text-[11px] font-medium text-muted-foreground" numberOfLines={1}>
        {label}
      </Text>
      <Text
        className={cn('tabular-nums text-foreground', strong ? 'text-[14px] font-bold' : 'text-[13px] font-semibold')}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

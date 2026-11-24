import type { TKey } from '@timbertrail/shared';
import { Pressable, View } from 'react-native';
import { int, isoDay, num3, signed3, timeOnly, todayIso } from '../../lib/format';
import { useT } from '../../lib/i18n';
import type { ApprovalItem, ApprovalKind } from '../../lib/types';
import { APPROVAL_KIND, useDayLabel } from '../cards';
import { Text } from '../text';
import { cn, Icon, ModTile } from '../ui';
import { formatWaitAge } from './ApprovalStatusBadge';

/** The plain name of what is waiting, as the people in the yard say it. */
const NAME: Record<ApprovalKind, TKey> = { IMPORT: 'simpleLoadIn', PRODUCTION: 'simpleCut', EXPORT: 'simpleLoadOut', ADJUSTMENT: 'adjustments' };

/** The one line of figures the owner needs to decide. */
function figures(i: ApprovalItem, t: ReturnType<typeof useT>): string {
  switch (i.type) {
    case 'IMPORT':
      return `${i.code} · ${int(i.totalLogs)} ${t('logs').toLowerCase()} · ${num3(i.totalCft)} CFT`;
    case 'PRODUCTION':
      return `${i.code} · ${num3(i.outputCft)} CFT`;
    case 'EXPORT':
      return `${i.code} · ${int(i.totalPieces)} ${t('pieces').toLowerCase()} · ${num3(i.totalCft)} CFT`;
    case 'ADJUSTMENT':
      return `${i.importCode} · ${signed3(i.cftDelta)} CFT`;
  }
}

/**
 * One entry waiting for the owner, as a plain row (Sawmill Pro): the area's tile, what it is and
 * its figures, who sent it and when, and a chevron. Rows sit together in one white card: pass
 * `first` / `last` to round its corners. Entries waiting a long time show their time in amber.
 */
export function ApprovalQueueCard({ item, onPress, first, last }: { item: ApprovalItem; onPress: () => void; first?: boolean; last?: boolean }) {
  const t = useT();
  const dayLabel = useDayLabel();
  const k = APPROVAL_KIND[item.type];
  const wait = formatWaitAge(item.submittedAt);
  const today = !!item.submittedAt && isoDay(new Date(item.submittedAt)) === todayIso();
  const when = item.submittedAt ? (today ? timeOnly(item.submittedAt) : dayLabel(item.submittedAt)) : '';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${t(NAME[item.type])}, ${figures(item, t)}, ${item.createdByName ?? ''} ${when}`}
      className={cn(
        'min-h-[76px] flex-row items-center gap-3.5 bg-card px-4 py-3 active:bg-secondary',
        first && 'rounded-t-3xl',
        last ? 'mb-3 rounded-b-3xl' : 'border-b border-border',
      )}
    >
      <ModTile mod={k.mod} icon={k.icon} />
      <View className="flex-1 gap-0.5">
        <Text className="text-[17px] font-bold tracking-tight text-foreground font-display" numberOfLines={1}>
          {t(NAME[item.type])}
        </Text>
        <Text className="text-[14px] tabular-nums text-muted-foreground" numberOfLines={1}>
          {figures(item, t)}
        </Text>
      </View>
      <View className="items-end gap-0.5">
        <Text className="max-w-[96px] text-[13px] text-muted-foreground" numberOfLines={1}>
          {item.createdByName}
        </Text>
        <Text className={cn('text-[13px] tabular-nums', wait?.isAged ? 'font-semibold text-warning' : 'text-muted-foreground')} numberOfLines={1}>
          {when}
        </Text>
      </View>
      <Icon name="chevron-right" size={18} colorClassName="accent-muted-foreground" />
    </Pressable>
  );
}

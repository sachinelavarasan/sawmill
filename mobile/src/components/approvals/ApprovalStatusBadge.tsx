import { View } from 'react-native';
import { useT } from '../../lib/i18n';
import { Text } from '../text';
import { cn, Icon, RecordStatusBadge } from '../ui';

/** Formats a submission timestamp into a compact waiting duration (e.g. "3h", "2d 4h"). */
export function formatWaitAge(submittedAt: string | null | undefined, nowMs = Date.now()): { label: string; isAged: boolean } | null {
  if (!submittedAt) return null;
  const ts = Date.parse(submittedAt);
  if (!Number.isFinite(ts)) return null;
  const diffMs = Math.max(0, nowMs - ts);
  const mins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  const isAged = hours >= 24;
  if (days >= 1) {
    const remH = hours % 24;
    return { label: remH > 0 ? `${days}d ${remH}h` : `${days}d`, isAged };
  }
  if (hours >= 1) return { label: `${hours}h`, isAged };
  return { label: `${Math.max(1, mins)}m`, isAged: false };
}

/** Status badge for approval queue cards, pairing pending status with subtle aging when >= 24h. */
export function ApprovalStatusBadge({ status = 'SUBMITTED', submittedAt }: { status?: string; submittedAt?: string | null }) {
  const t = useT();
  const wait = formatWaitAge(submittedAt);

  if (wait?.isAged && status === 'SUBMITTED') {
    return (
      <View
        className="flex-row items-center gap-1 self-start rounded-full border border-warning/35 bg-warning-soft py-[3px] pl-2 pr-2.5"
        accessible
        accessibilityLabel={t('waitingDuration', { age: wait.label })}
      >
        <Icon name="clock" size={12} colorClassName="accent-warning" />
        <Text className={cn('text-xs font-semibold tabular-nums text-warning')} numberOfLines={1}>
          {wait.label}
        </Text>
      </View>
    );
  }

  return <RecordStatusBadge status={status} />;
}

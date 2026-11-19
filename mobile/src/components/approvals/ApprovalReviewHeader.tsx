import { View } from 'react-native';
import { dateTime } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { Text } from '../text';
import { ApprovalStatusBadge, formatWaitAge } from './ApprovalStatusBadge';

/** Reusable header summary for dedicated approval review views. */
export function ApprovalReviewHeader({
  code,
  operationLabel,
  woodType,
  submittedBy,
  submittedAt,
  status = 'SUBMITTED',
}: {
  code: string;
  operationLabel: string;
  woodType: string;
  submittedBy?: string | null;
  submittedAt?: string | null;
  status?: string;
}) {
  const t = useT();
  const wait = formatWaitAge(submittedAt);
  return (
    <View className="gap-2 rounded-2xl border border-border bg-card p-4">
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1 gap-0.5">
          <Text className="text-lg font-bold tracking-tight text-foreground font-display" numberOfLines={1}>
            {code}
          </Text>
          <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
            {operationLabel} · {woodType}
          </Text>
        </View>
        <ApprovalStatusBadge status={status} submittedAt={submittedAt} />
      </View>
      {(submittedBy || submittedAt) && (
        <Text className="text-xs text-muted-foreground">
          {submittedBy ? `${t('submittedBy')} ${submittedBy}` : ''}
          {submittedBy && submittedAt ? ' · ' : ''}
          {submittedAt ? dateTime(submittedAt) : ''}
          {wait ? ` · ${t('waitingDuration', { age: wait.label })}` : ''}
        </Text>
      )}
    </View>
  );
}

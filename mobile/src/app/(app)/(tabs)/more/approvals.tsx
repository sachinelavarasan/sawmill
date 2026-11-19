/**
 * Owner's approval queue: everything submitted, oldest first. Tap a card to open the full
 * record, where Approve / Reject live (with the stock effect spelled out before approving).
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { APPROVAL_KIND, approvalSummary } from '../../../../components/cards';
import { Text } from '../../../../components/text';
import { ScreenHeader, SheetList } from '../../../../components/header';
import { ActionPill, Chip, EmptyState, ErrorBox, Icon, IconTile, Muted, PressableCard, refresher, SkeletonList } from '../../../../components/ui';
import { dateTime, int } from '../../../../lib/format';
import { useT } from '../../../../lib/i18n';
import { useApi } from '../../../../lib/query';
import type { ApprovalItem, ApprovalKind, ApprovalQueue } from '../../../../lib/types';

const KIND = APPROVAL_KIND;

export default function ApprovalsScreen() {
  const t = useT();
  const router = useRouter();
  const [kind, setKind] = useState<ApprovalKind | ''>('');
  const q = useApi<ApprovalQueue>('/approvals');
  const items = (q.data?.items ?? []).filter((i) => !kind || i.type === kind);
  const summary = (i: ApprovalItem) => approvalSummary(i, t);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader compact title={t('approvals')} subtitle={q.data ? `${int(q.data.counts.total)} · ${t('pending')}` : undefined} back />
      <SheetList compact
        data={items}
        keyExtractor={(i) => `${i.type.toLowerCase()}:${i.id}`}
        refreshControl={refresher(q.isRefetching, () => void q.refetch())}
        ListHeaderComponent={
          <View className="gap-3 pb-1">
            <Muted>{t('approvalsSubtitle')}</Muted>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
              <Chip text={t('allPending')} on={!kind} count={q.data?.counts.total} onPress={() => setKind('')} />
              {(Object.keys(KIND) as ApprovalKind[]).map((k) => (
                <Chip key={k} text={t(KIND[k].labelKey)} on={kind === k} count={q.data?.counts[k]} onPress={() => setKind(k)} />
              ))}
            </ScrollView>
            {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
            {q.isPending && <SkeletonList />}
          </View>
        }
        ListEmptyComponent={q.isPending || q.error ? null : <EmptyState icon="check-circle" title={t('noPendingApprovals')} body={t('nothingToApprove')} />}
        renderItem={({ item }) => (
          <PressableCard label={`${t('review')} ${item.code}`} onPress={() => router.push(KIND[item.type].href(item.id) as never)}>
            <View className="flex-row items-center gap-3">
              <IconTile icon={KIND[item.type].icon} />
              <View className="flex-1 gap-0.5">
                <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
                  {item.code}
                </Text>
                <Muted lines={1}>
                  {t(KIND[item.type].labelKey)} · {item.woodType}
                </Muted>
              </View>
              <ActionPill label={t('review')} />
            </View>
            <View className="rounded-2xl bg-background px-3.5 py-3">
              <Text className="text-sm font-semibold tabular-nums text-foreground">{summary(item)}</Text>
              {item.type === 'ADJUSTMENT' && <Muted lines={2}>{item.reason}</Muted>}
            </View>
            <View className="flex-row items-center gap-1.5">
              <Icon name="clock" size={13} colorClassName="accent-muted-foreground" />
              <Muted lines={1} className="flex-1">
                {t('submittedBy')} {item.createdByName} · {dateTime(item.submittedAt)}
              </Muted>
            </View>
          </PressableCard>
        )}
      />
    </View>
  );
}

/**
 * Owner's approval workspace: compact summary, operation filters, oldest-first queue by default,
 * and dedicated review navigation (no accidental approval on list tap).
 */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { ApprovalFilterBar, type ApprovalSort } from '../../../../components/approvals/ApprovalFilterBar';
import { ApprovalQueueCard } from '../../../../components/approvals/ApprovalQueueCard';
import { ApprovalSummary } from '../../../../components/approvals/ApprovalSummary';
import { APPROVAL_KIND } from '../../../../components/cards';
import { HeaderButton, ScreenHeader, SheetList } from '../../../../components/header';
import { EmptyState, ErrorBox, Muted, refresher, SkeletonList } from '../../../../components/ui';
import { int, isoDay, type Period } from '../../../../lib/format';
import { useT } from '../../../../lib/i18n';
import { useApi } from '../../../../lib/query';
import type { ApprovalKind, ApprovalQueue } from '../../../../lib/types';

export default function ApprovalsScreen() {
  const t = useT();
  const router = useRouter();
  const [kind, setKind] = useState<ApprovalKind | ''>('');
  const [sort, setSort] = useState<ApprovalSort>('oldest');
  const [period, setPeriod] = useState<Period | null>(null);
  const q = useApi<ApprovalQueue>('/approvals');

  const items = useMemo(() => {
    const base = (q.data?.items ?? []).filter((i) => {
      if (kind && i.type !== kind) return false;
      if (period && i.submittedAt) {
        const day = isoDay(new Date(i.submittedAt));
        if (day < period.from || day > period.to) return false;
      }
      return true;
    });
    if (sort === 'newest') {
      return [...base].sort((a, b) => Date.parse(b.submittedAt || '0') - Date.parse(a.submittedAt || '0'));
    }
    return base;
  }, [q.data?.items, kind, period, sort]);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        compact
        back
        title={t('approvals')}
        subtitle={q.data ? `${int(q.data.counts.total)} · ${t('pending')}` : undefined}
        right={
          <HeaderButton
            icon={q.isRefetching ? 'loader' : 'refresh-cw'}
            label={t('refresh')}
            onPress={() => void q.refetch()}
          />
        }
      />
      <SheetList
        compact
        data={items}
        keyExtractor={(i) => `${i.type.toLowerCase()}:${i.id}`}
        refreshControl={refresher(q.isRefetching, () => void q.refetch())}
        ListHeaderComponent={
          <View className="gap-3 pb-2">
            <ApprovalSummary counts={q.data?.counts} loading={q.isPending} />
            <ApprovalFilterBar
              kind={kind}
              onKind={setKind}
              counts={q.data?.counts}
              sort={sort}
              onSort={setSort}
              period={period}
              onPeriod={setPeriod}
            />
            <Muted>{t('approvalsSubtitle')}</Muted>
            {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
            {q.isPending && <SkeletonList />}
          </View>
        }
        ListEmptyComponent={
          q.isPending || q.error ? null : (
            <EmptyState
              icon="check-circle"
              title={t('noPendingApprovals')}
              body={kind || period ? t('noneWithStatus') : t('nothingToApprove')}
            />
          )
        }
        renderItem={({ item }) => (
          <ApprovalQueueCard
            item={item}
            onPress={() => router.push(APPROVAL_KIND[item.type].href(item.id) as never)}
          />
        )}
      />
    </View>
  );
}

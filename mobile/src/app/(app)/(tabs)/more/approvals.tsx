/**
 * Owner's approval queue: everything submitted, oldest first. Tap a card to open the full
 * record, where Approve / Reject live (with the stock effect spelled out before approving).
 */
import { type TKey } from '@timbertrail/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from '../../../../components/text';
import { ScreenHeader, SheetList } from '../../../../components/header';
import { Chip, EmptyState, ErrorBox, Icon, type IconName, IconTile, Muted, PressableCard, refresher, SkeletonList } from '../../../../components/ui';
import { dateTime, int, num3, signed3, signedInt } from '../../../../lib/format';
import { useT } from '../../../../lib/i18n';
import { useApi } from '../../../../lib/query';
import type { ApprovalItem, ApprovalKind, ApprovalQueue } from '../../../../lib/types';

const KIND: Record<ApprovalKind, { labelKey: TKey; icon: IconName; href: (id: string) => string }> = {
  IMPORT: { labelKey: 'imports', icon: 'download', href: (id) => `/imports/${id}` },
  PRODUCTION: { labelKey: 'production', icon: 'settings', href: (id) => `/production/${id}` },
  EXPORT: { labelKey: 'exports', icon: 'upload', href: (id) => `/exports/${id}` },
  ADJUSTMENT: { labelKey: 'adjustments', icon: 'sliders', href: (id) => `/stock/adjustments/${id}` },
};

export default function ApprovalsScreen() {
  const t = useT();
  const router = useRouter();
  const [kind, setKind] = useState<ApprovalKind | ''>('');
  const q = useApi<ApprovalQueue>('/approvals');
  const items = (q.data?.items ?? []).filter((i) => !kind || i.type === kind);

  const summary = (i: ApprovalItem) => {
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
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={t('approvals')} back />
      <SheetList
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
          <PressableCard onPress={() => router.push(KIND[item.type].href(item.id) as never)}>
            <View className="flex-row items-center gap-2.5">
              <IconTile icon={KIND[item.type].icon} />
              <View className="flex-1">
                <Text className="text-[15px] font-semibold text-foreground">{item.code}</Text>
                <Muted>
                  {t(KIND[item.type].labelKey)} · {item.woodType}
                </Muted>
              </View>
              <Icon name="chevron-right" size={18} colorClassName="accent-muted-foreground" />
            </View>
            <View className="rounded-xl bg-secondary px-3.5 py-2.5">
              <Text className="text-sm font-medium tabular-nums text-foreground">{summary(item)}</Text>
            </View>
            {item.type === 'ADJUSTMENT' && <Muted lines={2}>{item.reason}</Muted>}
            <Muted>
              {t('submittedBy')} {item.createdByName} · {dateTime(item.submittedAt)}
            </Muted>
          </PressableCard>
        )}
      />
    </View>
  );
}

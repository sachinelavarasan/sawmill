/** [OWNER-ONLY] Who did what, and when. Read-only; filter by record type. */
import type { TKey } from '@sawmill/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, Text, View } from 'react-native';
import { ScreenHeader } from '../../../../components/header';
import { Chip, EmptyState, ErrorBox, Icon, Muted, Pill, PressableCard, refresher, SkeletonList, type Tone } from '../../../../components/ui';
import { api } from '../../../../lib/api';
import { dateTime } from '../../../../lib/format';
import { useT } from '../../../../lib/i18n';
import { useRefetchOnFocus } from '../../../../lib/query';
import type { AuditRow, Paged } from '../../../../lib/types';

const ACTIONS: Record<string, { label: TKey; tone?: Tone }> = {
  CREATE: { label: 'auditActCreate', tone: 'info' },
  UPDATE: { label: 'auditActUpdate' },
  OWNER_EDIT: { label: 'auditActOwnerEdit' },
  DELETE: { label: 'auditActDelete', tone: 'bad' },
  SUBMIT: { label: 'auditActSubmit', tone: 'warn' },
  APPROVE: { label: 'auditActApprove', tone: 'good' },
  REJECT: { label: 'auditActReject', tone: 'bad' },
  LOGIN: { label: 'auditActLogin' },
  LOGOUT: { label: 'auditActLogout' },
  LOGIN_LOCKED: { label: 'auditActLoginLocked', tone: 'warn' },
  REFRESH_TOKEN_REUSE: { label: 'auditActTokenReuse', tone: 'warn' },
  RESET_PASSWORD: { label: 'auditActResetPassword', tone: 'warn' },
  DOWNLOAD_REPORT: { label: 'auditActDownloadReport' },
};

/** Record kinds; `page` is where such a record opens on the phone. */
const ENTITIES: Record<string, { label: TKey; page?: (id: string) => string }> = {
  ImportLoad: { label: 'auditEntImportLoad', page: (id) => `/imports/${id}` },
  LogMeasurement: { label: 'auditEntLogMeasurement' },
  UnloadingEntry: { label: 'auditEntUnloadingEntry' },
  ImportFinancials: { label: 'auditEntImportFinancials' },
  ProductionRun: { label: 'auditEntProductionRun', page: (id) => `/production/${id}` },
  ProductionOutput: { label: 'auditEntProductionOutput' },
  ExportLoad: { label: 'auditEntExportLoad', page: (id) => `/exports/${id}` },
  ExportMeasurement: { label: 'auditEntExportMeasurement' },
  ExportFinancials: { label: 'auditEntExportFinancials' },
  StockAdjustment: { label: 'auditEntStockAdjustment', page: (id) => `/stock/adjustments/${id}` },
  Expense: { label: 'auditEntExpense' },
  Client: { label: 'auditEntClient' },
  Supplier: { label: 'auditEntSupplier' },
  User: { label: 'auditEntUser' },
  Mill: { label: 'auditEntMill' },
  Report: { label: 'auditEntReport' },
};
const FILTERS = ['ImportLoad', 'ProductionRun', 'ExportLoad', 'StockAdjustment', 'Expense', 'User', 'Mill'];

export default function AuditScreen() {
  const t = useT();
  const router = useRouter();
  const [entity, setEntity] = useState('');
  const query = `take=50${entity ? `&entityType=${entity}` : ''}`;
  const q = useInfiniteQuery({
    queryKey: ['api', `/audit-logs?${query}`, 'pages'],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api<Paged<AuditRow>>(`/audit-logs?${query}&skip=${pageParam}`),
    getNextPageParam: (last, all) => {
      const n = all.reduce((s, p) => s + p.items.length, 0);
      return n < last.total ? n : undefined;
    },
  });
  useRefetchOnFocus(q.refetch);
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={t('auditLog')} back />
      <FlatList
        data={items}
        keyExtractor={(r) => r.id}
        contentContainerClassName="gap-2.5 p-4 pb-6"
        refreshControl={refresher(q.isRefetching && !q.isFetchingNextPage, () => void q.refetch())}
        onEndReachedThreshold={0.4}
        onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
        ListHeaderComponent={
          <View className="gap-3 pb-1">
            <Muted>{t('auditSub')}</Muted>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
              <Chip text={t('allRecordTypes')} on={!entity} onPress={() => setEntity('')} />
              {FILTERS.map((e) => (
                <Chip key={e} text={t(ENTITIES[e].label)} on={entity === e} onPress={() => setEntity(e)} />
              ))}
            </ScrollView>
            {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
            {q.isPending && <SkeletonList />}
          </View>
        }
        ListEmptyComponent={q.isPending ? null : <EmptyState icon="file-text" title={t('auditNoMatch')} />}
        ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator className="py-4" colorClassName="accent-primary" /> : null}
        renderItem={({ item: r }) => {
          const a = ACTIONS[r.action];
          const e = ENTITIES[r.entityType];
          const page = e?.page && r.entityId && r.action !== 'DELETE' ? e.page(r.entityId) : null;
          const body = (
            <>
              <View className="flex-row items-center gap-2">
                <Pill tone={a?.tone} text={a ? t(a.label) : r.action} />
                <Text className="flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>
                  {e ? t(e.label) : r.entityType}
                </Text>
                {page && <Icon name="chevron-right" size={16} colorClassName="accent-muted-foreground" />}
              </View>
              <Muted>
                {r.user ? `${r.user.name} (@${r.user.username})` : t('systemUser')} · {dateTime(r.createdAt)}
              </Muted>
            </>
          );
          return page ? (
            <PressableCard onPress={() => router.push(page as never)}>{body}</PressableCard>
          ) : (
            <View className="gap-2 rounded-xl border border-border bg-card p-4">{body}</View>
          );
        }}
      />
    </View>
  );
}

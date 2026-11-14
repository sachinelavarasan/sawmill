/** [OWNER-ONLY] Other expenses (labour, diesel, electricity …) for a period, by category. */
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, Text, View } from 'react-native';
import { ScreenHeader } from '../../../../components/header';
import { PeriodPicker } from '../../../../components/sheet';
import { Button, Chip, EmptyState, ErrorBox, Muted, PressableCard, refresher, SkeletonList } from '../../../../components/ui';
import { api } from '../../../../lib/api';
import { dateOnly, inr, int, periodQuery, presets } from '../../../../lib/format';
import { useT } from '../../../../lib/i18n';
import { useRefetchOnFocus } from '../../../../lib/query';
import type { ExpenseList } from '../../../../lib/types';

export default function ExpensesScreen() {
  const t = useT();
  const router = useRouter();
  const [period, setPeriod] = useState(presets().thisMonth);
  const [category, setCategory] = useState('');
  const query = `${periodQuery(period)}${category ? `&category=${encodeURIComponent(category)}` : ''}&take=50`;
  const q = useInfiniteQuery({
    queryKey: ['api', `/expenses?${query}`, 'pages'],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api<ExpenseList>(`/expenses?${query}&skip=${pageParam}`),
    getNextPageParam: (last, all) => {
      const n = all.reduce((s, p) => s + p.items.length, 0);
      return n < last.total ? n : undefined;
    },
  });
  useRefetchOnFocus(q.refetch);
  const first = q.data?.pages[0];
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const add = () => router.push('/expenses/form');

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={t('otherExpenses')} back right={<Button size="md" icon="plus" title={t('addExpense')} onPress={add} className="mr-2" />} />
      <FlatList
        data={items}
        keyExtractor={(e) => e.id}
        contentContainerClassName="gap-2.5 p-4 pb-6"
        refreshControl={refresher(q.isRefetching && !q.isFetchingNextPage, () => void q.refetch())}
        onEndReachedThreshold={0.4}
        onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
        ListHeaderComponent={
          <View className="gap-3 pb-1">
            <PeriodPicker value={period} onChange={setPeriod} />
            {!!first?.categories.length && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
                <Chip text={t('allCategories')} on={!category} onPress={() => setCategory('')} />
                {first.categories.map((c) => (
                  <Chip key={c} text={c} on={category === c} onPress={() => setCategory(c)} />
                ))}
              </ScrollView>
            )}
            {first && (
              <View className="flex-row items-center justify-between rounded-xl bg-primary p-4">
                <View>
                  <Text className="text-[13px] text-primary-foreground opacity-85">{t('total')}</Text>
                  <Text className="text-xs text-primary-foreground opacity-85">{t('entries')}: {int(first.total)}</Text>
                </View>
                <Text className="text-2xl font-bold tabular-nums text-primary-foreground">{inr(first.totalAmount)}</Text>
              </View>
            )}
            {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
            {q.isPending && <SkeletonList rows={3} />}
          </View>
        }
        ListEmptyComponent={q.isPending ? null : <EmptyState icon="credit-card" title={t('noExpenses')} action={{ label: t('addExpense'), onPress: add }} />}
        ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator className="py-4" colorClassName="accent-primary" /> : null}
        renderItem={({ item: e }) => (
          <PressableCard onPress={() => router.push({ pathname: '/expenses/form', params: { id: e.id } })}>
            <View className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 text-[15px] font-bold text-foreground">{e.category}</Text>
              <Text className="text-base font-bold tabular-nums text-foreground">{inr(e.amount)}</Text>
            </View>
            <Muted lines={2}>
              {dateOnly(e.date)}
              {e.importCode ? ` · ${e.importCode}` : ''}
              {e.notes ? ` · ${e.notes}` : ''}
            </Muted>
          </PressableCard>
        )}
      />
    </View>
  );
}

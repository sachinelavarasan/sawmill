/** [OWNER-ONLY] Other expenses (labour, diesel, electricity …) for a period, by category. */
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { HeaderButton, ScreenHeader, SheetList, StickyFooter } from '../../../../components/header';
import { PeriodPicker } from '../../../../components/sheet';
import { Text } from '../../../../components/text';
import { Button, Chip, EmptyState, ErrorBox, HeroCard, IconTile, Muted, PressableCard, refresher, SectionTitle, Skeleton, SkeletonList } from '../../../../components/ui';
import { api } from '../../../../lib/api';
import { dateOnly, inr, int, periodQuery, presets } from '../../../../lib/format';
import { useT } from '../../../../lib/i18n';
import { mergePages, rowKey, useRefetchOnFocus } from '../../../../lib/query';
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
    queryFn: ({ pageParam, signal }) => api<ExpenseList>(`/expenses?${query}&skip=${pageParam}`, { signal }),
    getNextPageParam: (last, all) => {
      const n = all.reduce((s, p) => s + p.items.length, 0);
      return n < last.total ? n : undefined;
    },
  });
  useRefetchOnFocus(q.refetch);
  const first = q.data?.pages[0];
  const items = mergePages(q.data?.pages, (e) => e.id);
  const add = () => router.push('/expenses/form');

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader compact title={t('otherExpenses')} back right={<HeaderButton icon="plus" label={t('addExpense')} onPress={add} />} />
      <SheetList compact
        data={items}
        keyExtractor={rowKey('expense')}
        refreshControl={refresher(q.isRefetching && !q.isFetchingNextPage, () => void q.refetch())}
        onEndReachedThreshold={0.4}
        onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
        hero={
          first ? (
            <HeroCard bare label={t('total')} value={inr(first.totalAmount)} sub={`${t('entries')}: ${int(first.total)}`} icon="receipt" />
          ) : (
            <Skeleton className="h-24 rounded-2xl opacity-20" />
          )
        }
        ListHeaderComponent={
          <View className="gap-3 pb-1">
            <PeriodPicker value={period} onChange={setPeriod} />
            {!!first?.categories.length && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
                <Chip text={t('allCategories')} on={!category} onPress={() => setCategory('')} />
                {first.categories.map((c) => (
                  <Chip key={c} text={c} on={category === c} onPress={() => setCategory(c)} />
                ))}
              </ScrollView>
            )}
            {!!items.length && <SectionTitle>{t('recentActivity')}</SectionTitle>}
            {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
            {q.isPending && <SkeletonList rows={3} />}
          </View>
        }
        ListEmptyComponent={q.isPending ? null : <EmptyState icon="credit-card" title={t('noExpenses')} action={{ label: t('addExpense'), onPress: add }} />}
        ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator className="py-4" colorClassName="accent-primary" /> : null}
        renderItem={({ item: e }) => (
          <PressableCard label={`${e.category}, ${inr(e.amount)}`} onPress={() => router.push({ pathname: '/expenses/form', params: { id: e.id } })}>
            <View className="flex-row items-center gap-3">
              <IconTile icon="receipt" />
              <View className="flex-1 gap-0.5">
                <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
                  {e.category}
                </Text>
                <Muted lines={1}>
                  {dateOnly(e.date)}
                  {e.importCode ? ` · ${e.importCode}` : ''}
                  {e.notes ? ` · ${e.notes}` : ''}
                </Muted>
              </View>
              <Text className="text-base font-bold tabular-nums text-foreground">{inr(e.amount)}</Text>
            </View>
          </PressableCard>
        )}
      />
      <StickyFooter tabBar>
        <Button icon="plus" title={t('addExpense')} onPress={add} />
      </StickyFooter>
    </View>
  );
}

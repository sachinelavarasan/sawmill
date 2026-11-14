/**
 * A searchable, filterable list of records that loads 30 at a time as you scroll
 * (the API pages with ?take=&skip=). Pull down to refresh.
 */
import { useInfiniteQuery } from '@tanstack/react-query';
import { ReactElement, ReactNode, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, Text, View } from 'react-native';
import { api } from '../lib/api';
import { useDebounced } from '../lib/hooks';
import { useT } from '../lib/i18n';
import { useRefetchOnFocus } from '../lib/query';
import { type Paged, STATUSES } from '../lib/types';
import { Chip, EmptyState, ErrorBox, type IconName, refresher, SearchBar, SkeletonList } from './ui';

const PAGE = 30;

export function RecordList<T extends { id: string }>({
  path,
  params,
  search,
  statusFilter,
  renderItem,
  empty,
  header,
  bottomPad = 24,
}: {
  /** e.g. '/imports' */
  path: string;
  /** extra query, e.g. { open: '1' } */
  params?: Record<string, string>;
  /** placeholder for the search box; omit for no search */
  search?: string;
  statusFilter?: boolean;
  renderItem: (item: T) => ReactElement;
  empty: { icon?: IconName; title: string; body?: string; action?: { label: string; onPress: () => void } };
  header?: ReactNode;
  /** room below the last card (for a floating button) */
  bottomPad?: number;
}) {
  const t = useT();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('');
  const dq = useDebounced(q.trim());

  const query = useMemo(() => {
    const p = new URLSearchParams({ ...(params ?? {}), take: String(PAGE) });
    if (dq) p.set('q', dq);
    if (status) p.set('status', status);
    return p.toString();
  }, [params, dq, status]);

  const list = useInfiniteQuery({
    queryKey: ['api', `${path}?${query}`, 'pages'],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api<Paged<T>>(`${path}?${query}&skip=${pageParam}`),
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
  });
  useRefetchOnFocus(list.refetch);

  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const filtered = !!dq || !!status;

  return (
    <FlatList
      className="flex-1 bg-background"
      data={items}
      keyExtractor={(i) => i.id}
      contentContainerClassName="gap-2.5 p-4"
      contentContainerStyle={{ paddingBottom: bottomPad }}
      keyboardShouldPersistTaps="handled"
      refreshControl={refresher(list.isRefetching && !list.isFetchingNextPage, () => void list.refetch())}
      onEndReachedThreshold={0.4}
      onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && void list.fetchNextPage()}
      ListHeaderComponent={
        <View className="gap-3 pb-1">
          {header}
          {search && <SearchBar value={q} onChange={setQ} placeholder={search} />}
          {statusFilter && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
              <Chip text={t('allStatuses')} on={!status} onPress={() => setStatus('')} />
              {STATUSES.map((s) => (
                <Chip key={s} text={t(s === 'SUBMITTED' ? 'pending' : (s.toLowerCase() as 'draft'))} on={status === s} onPress={() => setStatus(s)} />
              ))}
            </ScrollView>
          )}
          {list.error && <ErrorBox message={(list.error as Error).message} onRetry={() => void list.refetch()} />}
          {list.isPending && <SkeletonList />}
        </View>
      }
      ListEmptyComponent={
        list.isPending || list.error ? null : filtered ? (
          <EmptyState icon="search" title={t('noResults')} body={dq ? t('noMatches', { q: dq }) : undefined} />
        ) : (
          <EmptyState {...empty} />
        )
      }
      ListFooterComponent={
        list.isFetchingNextPage ? (
          <ActivityIndicator className="py-4" colorClassName="accent-primary" />
        ) : items.length > PAGE && !list.hasNextPage ? (
          <Text className="py-3 text-center text-xs text-muted-foreground">{t('endOfList')}</Text>
        ) : null
      }
      renderItem={({ item }) => renderItem(item)}
    />
  );
}

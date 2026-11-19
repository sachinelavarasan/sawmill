/**
 * A searchable, filterable list of records that loads 30 at a time as you scroll
 * (the API pages with ?take=&skip=). Pull down to refresh.
 */
import { useInfiniteQuery } from '@tanstack/react-query';
import { ReactElement, ReactNode, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Text } from './text';
import { api } from '../lib/api';
import { useDebounced } from '../lib/hooks';
import { useT } from '../lib/i18n';
import { mergePages, useRefetchOnFocus } from '../lib/query';
import type { Paged, Status } from '../lib/types';
import { SheetList } from './header';
import { Appear } from './motion';
import { OperationFilterChips, SkeletonRecordCards } from './record-card';
import { EmptyState, ErrorBox, type IconName, refresher, SearchBar } from './ui';

const PAGE = 30;

export function RecordList<T extends { id: string }>({
  path,
  params,
  search,
  statusFilter,
  renderItem,
  empty,
  header,
  hero,
  bottomPad = 24,
  compact,
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
  /** navy content above the sheet (a headline figure) */
  hero?: ReactNode;
  /** room below the last card (for a floating button) */
  bottomPad?: number;
  /** under a compact header (see SheetList) */
  compact?: boolean;
}) {
  const t = useT();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<Status | ''>('');
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
    queryFn: ({ pageParam, signal }) => api<Paged<T>>(`${path}?${query}&skip=${pageParam}`, { signal }),
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
  });
  useRefetchOnFocus(list.refetch);

  const items = mergePages(list.data?.pages, (i) => i.id);
  const filtered = !!dq || !!status;

  return (
    <SheetList
      hero={hero}
      compact={compact}
      bottomPad={bottomPad}
      data={items}
      keyExtractor={(i) => `${path}:${i.id}`}
      refreshControl={refresher(list.isRefetching && !list.isFetchingNextPage, () => void list.refetch())}
      onEndReachedThreshold={0.4}
      onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && void list.fetchNextPage()}
      ListHeaderComponent={
        <View className="gap-3 pb-3">
          {header}
          {search && <SearchBar value={q} onChange={setQ} placeholder={search} />}
          {statusFilter && <OperationFilterChips value={status} onChange={setStatus} />}
          {list.error && <ErrorBox message={(list.error as Error).message} onRetry={() => void list.refetch()} />}
          {list.isPending && <SkeletonRecordCards />}
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
          <ActivityIndicator className="py-4" colorClassName="accent-saffron" />
        ) : items.length > PAGE && !list.hasNextPage ? (
          <Text className="py-3 text-center text-xs text-muted-foreground">{t('endOfList')}</Text>
        ) : null
      }
      renderItem={({ item, index }) => <Appear index={index % 30}>{renderItem(item)}</Appear>}
    />
  );
}

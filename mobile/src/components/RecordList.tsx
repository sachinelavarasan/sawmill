/**
 * A searchable, filterable list of records that loads 30 at a time as you scroll
 * (the API pages with ?take=&skip=). Pull down to refresh.
 *
 * `groupByDay`: a heading before the first record of each day — "Today", "Yesterday", then the
 * date — with `daySummary` beside it (e.g. "3 lorries · 45.000 CFT"). The API returns records
 * newest first, so each day's records sit together under one heading.
 */
import { useInfiniteQuery } from '@tanstack/react-query';
import { ReactElement, ReactNode, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Text } from './text';
import { api } from '../lib/api';
import { useDebounced } from '../lib/hooks';
import { useT } from '../lib/i18n';
import { dateOnly, isoDay, todayIso } from '../lib/format';
import { mergePages, useRefetchOnFocus } from '../lib/query';
import type { Paged, Status } from '../lib/types';
import { SheetList } from './header';
import { Appear } from './motion';
import { OperationFilterChips, SkeletonRecordCards } from './record-card';
import { EmptyState, ErrorBox, type IconName, type Mod, refresher, SearchBar } from './ui';

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
  groupByDay,
  daySummary,
}: {
  /** e.g. '/imports' */
  path: string;
  /** extra query, e.g. { open: '1' } */
  params?: Record<string, string>;
  /** placeholder for the search box; omit for no search */
  search?: string;
  statusFilter?: boolean;
  renderItem: (item: T) => ReactElement;
  empty: { icon?: IconName; title: string; body?: string; action?: { label: string; onPress: () => void }; mod?: Mod };
  header?: ReactNode;
  /** navy content above the sheet (a headline figure) */
  hero?: ReactNode;
  /** room below the last card (for a floating button) */
  bottomPad?: number;
  /** under a compact header (see SheetList) */
  compact?: boolean;
  /** the record's day (YYYY-MM-DD or an ISO date-time): headings by day */
  groupByDay?: (item: T) => string;
  /** a line beside each day's heading, from that day's records (as loaded so far) */
  daySummary?: (items: T[]) => string;
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

  // the day of each record, and each day's records (for the heading's summary)
  const dayOf = (i: T) => (groupByDay ? toDay(groupByDay(i)) : '');
  const byDay = useMemo(() => {
    const m = new Map<string, T[]>();
    if (groupByDay) for (const i of items) m.set(toDay(groupByDay(i)), [...(m.get(toDay(groupByDay(i))) ?? []), i]);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, groupByDay]);

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
          <EmptyState mod="neutral" icon="search" title={t('noResults')} body={dq ? t('noMatches', { q: dq }) : undefined} />
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
      renderItem={({ item, index }) => {
        const day = groupByDay ? dayOf(item) : null;
        const first = day != null && (index === 0 || dayOf(items[index - 1]) !== day);
        return (
          <Appear index={index % 30}>
            {first && <DayHeading day={day} summary={daySummary?.(byDay.get(day) ?? [])} />}
            {renderItem(item)}
          </Appear>
        );
      }}
    />
  );
}

/** "2026-11-27" or "2026-11-27T08:40:00Z" → the local day */
export const toDay = (s: string) => (s.length > 10 ? isoDay(new Date(s)) : s.slice(0, 10));

/**
 * For a list that isn't a RecordList: whether `index` starts a new day (so a DayHeading goes above
 * it), given each item's date. The list must already be in date order (newest or oldest first).
 */
export function startsDay<T>(items: T[], index: number, dateOf: (item: T) => string): boolean {
  return index === 0 || toDay(dateOf(items[index - 1])) !== toDay(dateOf(items[index]));
}

/** "TODAY · 3 lorries · 45.000 CFT" over a day's records: Today, Yesterday, then the date. */
export function DayHeading({ day, summary }: { day: string; summary?: string }) {
  const t = useT();
  const yesterday = isoDay(new Date(Date.now() - 86_400_000));
  const label = day === todayIso() ? t('today') : day === yesterday ? t('yesterday') : dateOnly(day);
  return (
    <View className="flex-row items-baseline justify-between gap-3 pb-2 pt-3" accessibilityRole="header">
      <Text className="text-[13px] font-bold uppercase tracking-[0.8px] text-foreground">{label}</Text>
      {!!summary && (
        <Text className="shrink text-right text-[12px] font-medium tabular-nums text-muted-foreground" numberOfLines={1}>
          {summary}
        </Text>
      )}
    </View>
  );
}

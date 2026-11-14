/**
 * Stock on hand: raw wood by import load, finished wood by size, every movement, and
 * corrections (adjustments). Quantities only — no prices here, so it is the same for
 * owner and accountant.
 */
import { sizeLabel } from '@sawmill/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, Text, View } from 'react-native';
import { MovementRow } from '../../../../components/cards';
import { ScreenHeader } from '../../../../components/header';
import { RecordList } from '../../../../components/RecordList';
import {
  Button,
  Chip,
  EmptyState,
  ErrorBox,
  Grid,
  Kpi,
  Muted,
  PressableCard,
  refresher,
  SearchBar,
  Segmented,
  SkeletonGrid,
  SkeletonList,
  StatusPill,
} from '../../../../components/ui';
import { api } from '../../../../lib/api';
import { dateOnly, dateTime, int, num3, signed3, signedInt } from '../../../../lib/format';
import { useT } from '../../../../lib/i18n';
import { useApi, useRefetchOnFocus } from '../../../../lib/query';
import type { Adjustment, Balances, Movement, Paged } from '../../../../lib/types';

type Tab = 'raw' | 'finished' | 'movements' | 'adjustments';

export default function StockScreen() {
  const t = useT();
  const [tab, setTab] = useState<Tab>('raw');
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={t('stock')} back />
      <View className="border-b border-border bg-card px-4 pb-3 pt-1">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'raw', label: t('raw') },
            { value: 'finished', label: t('finished') },
            { value: 'movements', label: t('movements') },
            { value: 'adjustments', label: t('adjustments') },
          ]}
        />
      </View>
      {tab === 'raw' || tab === 'finished' ? <Balance tab={tab} /> : tab === 'movements' ? <Movements /> : <Adjustments />}
    </View>
  );
}

function Balance({ tab }: { tab: 'raw' | 'finished' }) {
  const t = useT();
  const router = useRouter();
  const q = useApi<Balances>('/stock');
  const [search, setSearch] = useState('');
  const needle = search.trim().toLowerCase().replace(/\s+/g, '');
  const match = (s: string) => !needle || s.toLowerCase().replace(/\s+/g, '').includes(needle);
  const totals = q.data?.totals;

  // finished stock grouped by size, each size listing the loads it came from
  const sizes = useMemo(() => {
    const m = new Map<string, { label: string; wood: string; pieces: number; cft: number; loads: { code: string; pieces: number }[] }>();
    for (const r of q.data?.finished ?? []) {
      const key = `${r.woodType}|${r.thicknessIn}|${r.widthIn}|${r.lengthFt}`;
      const s = m.get(key) ?? { label: sizeLabel(r.thicknessIn, r.widthIn, r.lengthFt), wood: r.woodType, pieces: 0, cft: 0, loads: [] };
      s.pieces += r.pieces;
      s.cft += r.cft;
      s.loads.push({ code: r.importCode, pieces: r.pieces });
      m.set(key, s);
    }
    return [...m.values()].filter((s) => s.pieces > 0 && match(`${s.wood} ${s.label} ${s.loads.map((l) => l.code).join(' ')}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, needle]);
  const raw = (q.data?.raw ?? []).filter((r) => r.cft > 0 && match(`${r.importCode} ${r.woodType}`));

  const header = (
    <View className="gap-3 pb-1">
      {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
      {!totals ? (
        <SkeletonGrid tiles={2} />
      ) : tab === 'raw' ? (
        <Grid>
          <Kpi icon="layers" label={t('rawStock')} value={num3(totals.rawCft)} unit="CFT" />
          <Kpi icon="truck" label={t('loadsWithRaw')} value={int(totals.rawLoads)} />
        </Grid>
      ) : (
        <Grid>
          <Kpi icon="package" label={t('finishedStock')} value={num3(totals.finishedCft)} unit="CFT" />
          <Kpi icon="grid" label={t('finishedPieces')} value={int(totals.finishedPieces)} />
        </Grid>
      )}
      <SearchBar value={search} onChange={setSearch} placeholder={tab === 'raw' ? t('searchLoads') : t('searchSizes')} />
      {q.isPending && <SkeletonList />}
    </View>
  );

  const empty = q.isPending ? null : <EmptyState icon="layers" title={needle ? t('noResults') : t('noStock')} />;

  return tab === 'raw' ? (
    <FlatList
      data={raw}
      keyExtractor={(r) => r.importLoadId}
      contentContainerClassName="gap-2.5 p-4 pb-6"
      refreshControl={refresher(q.isRefetching, () => void q.refetch())}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      renderItem={({ item: r }) => {
        const pct = r.receivedCft > 0 ? Math.min(100, (r.cft / r.receivedCft) * 100) : 0;
        return (
          <PressableCard onPress={() => router.push(`/imports/${r.importLoadId}`)}>
            <View className="flex-row items-center justify-between">
              <Text className="text-[15px] font-bold text-foreground">{r.importCode}</Text>
              <Text className="text-base font-bold tabular-nums text-foreground">
                {num3(r.cft)} <Text className="text-xs text-muted-foreground">CFT</Text>
              </Text>
            </View>
            <Muted>
              {r.woodType} · {dateOnly(r.arrivalAt)} · {int(r.logs)} {t('logs')}
            </Muted>
            <View className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <View className="h-full rounded-full bg-saffron" style={{ width: `${pct}%` }} />
            </View>
            <Muted>
              {t('inStockOfReceived')}: {num3(r.cft)} / {num3(r.receivedCft)} CFT
            </Muted>
          </PressableCard>
        );
      }}
    />
  ) : (
    <FlatList
      data={sizes}
      keyExtractor={(s) => `${s.wood}|${s.label}`}
      contentContainerClassName="gap-2.5 p-4 pb-6"
      refreshControl={refresher(q.isRefetching, () => void q.refetch())}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      renderItem={({ item: s }) => (
        <View className="gap-1.5 rounded-xl border border-border bg-card p-4">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 text-[15px] font-bold text-foreground">{s.label}</Text>
            <Text className="text-base font-bold tabular-nums text-foreground">{int(s.pieces)}</Text>
          </View>
          <View className="flex-row justify-between">
            <Muted>{s.wood}</Muted>
            <Muted>{num3(s.cft)} CFT</Muted>
          </View>
          <Muted lines={2}>{s.loads.map((l) => `${l.code} (${int(l.pieces)})`).join(' · ')}</Muted>
        </View>
      )}
    />
  );
}

function Movements() {
  const t = useT();
  const [kind, setKind] = useState<'' | 'RAW' | 'FINISHED'>('');
  const [direction, setDirection] = useState<'' | 'in' | 'out'>('');
  const query = `take=40${kind ? `&kind=${kind}` : ''}${direction ? `&direction=${direction}` : ''}`;
  const q = useInfiniteQuery({
    queryKey: ['api', `/stock/movements?${query}`, 'pages'],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api<Paged<Movement>>(`/stock/movements?${query}&skip=${pageParam}`),
    getNextPageParam: (last, all) => {
      const n = all.reduce((s, p) => s + p.items.length, 0);
      return n < last.total ? n : undefined;
    },
  });
  useRefetchOnFocus(q.refetch);
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <FlatList
      data={items}
      keyExtractor={(m) => m.id}
      contentContainerClassName="p-4 pb-6"
      refreshControl={refresher(q.isRefetching && !q.isFetchingNextPage, () => void q.refetch())}
      onEndReachedThreshold={0.4}
      onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
      ListHeaderComponent={
        <View className="gap-2 pb-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
            <Chip text={t('all')} on={!kind} onPress={() => setKind('')} />
            <Chip text={t('raw')} on={kind === 'RAW'} onPress={() => setKind('RAW')} />
            <Chip text={t('finished')} on={kind === 'FINISHED'} onPress={() => setKind('FINISHED')} />
            <View className="w-3" />
            <Chip text={t('allDirections')} on={!direction} onPress={() => setDirection('')} />
            <Chip text={t('stockIn')} on={direction === 'in'} onPress={() => setDirection('in')} />
            <Chip text={t('stockOut')} on={direction === 'out'} onPress={() => setDirection('out')} />
          </ScrollView>
          {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
          {q.isPending && <SkeletonList />}
        </View>
      }
      ListEmptyComponent={q.isPending ? null : <EmptyState icon="activity" title={t('noMovements')} />}
      renderItem={({ item, index }) => (
        <View className={index === 0 ? 'overflow-hidden rounded-t-xl border-x border-t border-border bg-card' : index === items.length - 1 ? 'overflow-hidden rounded-b-xl border-x border-b border-border bg-card' : 'border-x border-border bg-card'}>
          <MovementRow m={item} last={index === items.length - 1} />
        </View>
      )}
      ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator className="py-4" colorClassName="accent-primary" /> : null}
    />
  );
}

function Adjustments() {
  const t = useT();
  const router = useRouter();
  return (
    <RecordList<Adjustment>
      path="/stock-adjustments"
      statusFilter
      header={<Button kind="secondary" icon="plus" title={t('newAdjustment')} onPress={() => router.push('/stock/adjustments/new')} />}
      empty={{ icon: 'sliders', title: t('noAdjustments'), body: t('adjustHint') }}
      renderItem={(a) => (
        <PressableCard onPress={() => router.push(`/stock/adjustments/${a.id}`)}>
          <View className="flex-row items-center justify-between">
            <Text className="text-[15px] font-bold text-foreground">{a.code}</Text>
            <StatusPill status={a.status} />
          </View>
          <Muted lines={1}>
            {a.importCode} · {t(a.kind === 'RAW' ? 'raw' : 'finished')} · {a.woodType}
            {a.thicknessIn != null && a.widthIn != null && a.lengthFt != null ? ` · ${sizeLabel(a.thicknessIn, a.widthIn, a.lengthFt)}` : ''}
          </Muted>
          <Text className="text-sm font-bold tabular-nums text-foreground">
            {signed3(a.cftDelta)} CFT{a.piecesDelta ? ` · ${signedInt(a.piecesDelta)} ${t('pieces')}` : ''}
          </Text>
          <Muted lines={2}>
            {a.reason} · {dateTime(a.createdAt)}
          </Muted>
        </PressableCard>
      )}
    />
  );
}

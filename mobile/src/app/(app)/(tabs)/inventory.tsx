/**
 * Inventory: wood on hand — raw by import load, finished by size — every movement, and
 * corrections (adjustments). Quantities only — no prices here, so it is the same for
 * owner and accountant.
 */
import { sizeLabel } from '@timbertrail/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { DayHeader, MovementRow } from '../../../components/cards';
import { HeaderButton, ScreenHeader, SheetList, StickyFooter } from '../../../components/header';
import { RecordList } from '../../../components/RecordList';
import { Text } from '../../../components/text';
import {
  Button,
  Chip,
  EmptyState,
  ErrorBox,
  HeroCard,
  IconTile,
  Muted,
  PressableCard,
  ProgressBar,
  refresher,
  SearchBar,
  TabStrip,
  Skeleton,
  SkeletonList,
  StatusPill,
} from '../../../components/ui';
import { api } from '../../../lib/api';
import { dateOnly, dateTime, int, isoDay, num3, signed3, signedInt } from '../../../lib/format';
import { useT } from '../../../lib/i18n';
import { mergePages, useApi, useRefetchOnFocus } from '../../../lib/query';
import type { Adjustment, Balances, Movement, Paged } from '../../../lib/types';

type Tab = 'raw' | 'finished' | 'movements' | 'adjustments';

export default function InventoryScreen() {
  const t = useT();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('raw');
  const adding = tab === 'adjustments';
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={t('inventory')} large right={<HeaderButton icon="sliders" label={t('newAdjustment')} onPress={() => router.push('/stock/adjustments/new')} />}>
        <TabStrip
          value={tab}
          onChange={setTab}
          options={[
            { value: 'raw', label: t('raw'), icon: 'layers' },
            { value: 'finished', label: t('finished'), icon: 'package' },
            { value: 'movements', label: t('movements'), icon: 'activity' },
            { value: 'adjustments', label: t('adjustments'), icon: 'sliders' },
          ]}
        />
      </ScreenHeader>
      {tab === 'raw' || tab === 'finished' ? <Balance tab={tab} /> : tab === 'movements' ? <Movements /> : <Adjustments />}
      {tab !== 'movements' && (
        <StickyFooter tabBar>
          <Button
            icon="plus"
            title={adding ? t('newAdjustment') : t('newImport')}
            onPress={() => router.push(adding ? '/stock/adjustments/new' : '/imports/new')}
          />
        </StickyFooter>
      )}
    </View>
  );
}

/** "All woods · Teak · Pine …" from what is actually in stock. */
function WoodChips({ woods, value, onChange }: { woods: string[]; value: string; onChange: (w: string) => void }) {
  const t = useT();
  if (woods.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
      <Chip text={t('all')} on={!value} onPress={() => onChange('')} />
      {woods.map((w) => (
        <Chip key={w} text={w} on={value === w} onPress={() => onChange(w)} />
      ))}
    </ScrollView>
  );
}

function Balance({ tab }: { tab: 'raw' | 'finished' }) {
  const t = useT();
  const router = useRouter();
  const q = useApi<Balances>('/stock');
  const [search, setSearch] = useState('');
  const [wood, setWood] = useState('');
  const needle = search.trim().toLowerCase().replace(/\s+/g, '');
  const match = (s: string) => !needle || s.toLowerCase().replace(/\s+/g, '').includes(needle);
  const totals = q.data?.totals;

  const woods = useMemo(() => {
    const src = tab === 'raw' ? (q.data?.raw ?? []).filter((r) => r.cft > 0) : (q.data?.finished ?? []).filter((r) => r.pieces > 0);
    return [...new Set(src.map((r) => r.woodType))].sort();
  }, [q.data, tab]);

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
    return [...m.values()].filter((s) => s.pieces > 0 && (!wood || s.wood === wood) && match(`${s.wood} ${s.label} ${s.loads.map((l) => l.code).join(' ')}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, needle, wood]);
  const raw = (q.data?.raw ?? []).filter((r) => r.cft > 0 && (!wood || r.woodType === wood) && match(`${r.importCode} ${r.woodType}`));

  const hero = (
    <>
      {!totals ? (
        <Skeleton className="h-28 rounded-2xl opacity-20" />
      ) : (
        <HeroCard
          bare
          label={tab === 'raw' ? t('rawStock') : t('finishedStock')}
          value={num3(tab === 'raw' ? totals.rawCft : totals.finishedCft)}
          unit="CFT"
          icon={tab === 'raw' ? 'layers' : 'package'}
        >
          <View className="flex-row gap-3 border-t border-hero-border pt-4">
            {(tab === 'raw'
              ? [
                  { label: t('loadsWithRaw'), value: int(totals.rawLoads) },
                  { label: t('finishedStock'), value: `${num3(totals.finishedCft)} CFT` },
                ]
              : [
                  { label: t('finishedPieces'), value: int(totals.finishedPieces) },
                  { label: t('rawStock'), value: `${num3(totals.rawCft)} CFT` },
                ]
            ).map((x) => (
              <View key={x.label} className="flex-1 gap-0.5">
                <Text className="text-[11px] text-hero-muted" numberOfLines={1}>
                  {x.label}
                </Text>
                <Text className="text-[15px] font-semibold tabular-nums text-hero-foreground">{x.value}</Text>
              </View>
            ))}
          </View>
        </HeroCard>
      )}
    </>
  );

  const header = (
    <View className="gap-3 pb-1">
      {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
      <SearchBar value={search} onChange={setSearch} placeholder={tab === 'raw' ? t('searchLoads') : t('searchSizes')} />
      <WoodChips woods={woods} value={wood} onChange={setWood} />
      {q.isPending && <SkeletonList />}
    </View>
  );

  const empty = q.isPending ? null : <EmptyState icon="layers" title={needle || wood ? t('noResults') : t('noStock')} />;

  return tab === 'raw' ? (
    <SheetList
      hero={hero}
      data={raw}
      keyExtractor={(r) => `raw:${r.importLoadId}`}
      refreshControl={refresher(q.isRefetching, () => void q.refetch())}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      renderItem={({ item: r }) => {
        const pct = r.receivedCft > 0 ? Math.min(100, (r.cft / r.receivedCft) * 100) : 0;
        return (
          <PressableCard label={`${r.importCode}, ${r.woodType}, ${num3(r.cft)} CFT`} onPress={() => router.push(`/imports/${r.importLoadId}`)} className="gap-3">
            <View className="flex-row items-center gap-3">
              <IconTile icon="layers" size="lg" />
              <View className="flex-1 gap-0.5">
                <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
                  {r.woodType}
                </Text>
                <Muted lines={1}>
                  {r.importCode} · {dateOnly(r.arrivalAt)} · {int(r.logs)} {t('logs')}
                </Muted>
              </View>
              <View className="items-end">
                <Text className="text-base font-bold tabular-nums text-foreground">{num3(r.cft)}</Text>
                <Text className="text-[11px] font-medium text-muted-foreground">CFT</Text>
              </View>
            </View>
            <View className="gap-1.5">
              <ProgressBar pct={pct} />
              <Muted>
                {t('inStockOfReceived')}: {num3(r.cft)} / {num3(r.receivedCft)} CFT
              </Muted>
            </View>
          </PressableCard>
        );
      }}
    />
  ) : (
    <SheetList
      hero={hero}
      data={sizes}
      keyExtractor={(s) => `size:${s.wood}|${s.label}`}
      refreshControl={refresher(q.isRefetching, () => void q.refetch())}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      renderItem={({ item: s }) => (
        <View className="-mx-4 gap-2.5 border-b border-border px-4 py-4" accessible accessibilityLabel={`${s.label}, ${s.wood}, ${int(s.pieces)} ${t('pieces')}`}>
          <View className="flex-row items-center gap-3">
            <IconTile icon="package" size="lg" tone="navy" />
            <View className="flex-1 gap-0.5">
              <Text className="text-[15px] font-semibold text-foreground">{s.label}</Text>
              <Muted>
                {s.wood} · {num3(s.cft)} CFT
              </Muted>
            </View>
            <View className="items-end">
              <Text className="text-base font-bold tabular-nums text-foreground">{int(s.pieces)}</Text>
              <Text className="text-[11px] font-medium text-muted-foreground">{t('pieces')}</Text>
            </View>
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
    queryFn: ({ pageParam, signal }) => api<Paged<Movement>>(`/stock/movements?${query}&skip=${pageParam}`, { signal }),
    getNextPageParam: (last, all) => {
      const n = all.reduce((s, p) => s + p.items.length, 0);
      return n < last.total ? n : undefined;
    },
  });
  useRefetchOnFocus(q.refetch);
  const items = useMemo(() => mergePages(q.data?.pages, (m) => m.id), [q.data]);
  // statement layout: a heading per local day (with that day's net change), then its movements
  const rows = useMemo(() => {
    const out: ({ type: 'day'; day: string; net: number } | { type: 'mv'; m: Movement; last: boolean })[] = [];
    let head: { type: 'day'; day: string; net: number } | null = null;
    items.forEach((m, i) => {
      const day = isoDay(new Date(m.createdAt));
      if (!head || head.day !== day) {
        head = { type: 'day', day, net: 0 };
        out.push(head);
      }
      head.net += m.cftDelta;
      const next = items[i + 1];
      out.push({ type: 'mv', m, last: !next || isoDay(new Date(next.createdAt)) !== day });
    });
    return out;
  }, [items]);

  return (
    <SheetList
      data={rows}
      keyExtractor={(r) => (r.type === 'day' ? `day:${r.day}` : `movement:${r.m.id}`)}
      refreshControl={refresher(q.isRefetching && !q.isFetchingNextPage, () => void q.refetch())}
      onEndReachedThreshold={0.4}
      onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
      ListHeaderComponent={
        <View className="gap-2 pb-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            <Chip text={t('all')} on={!kind} onPress={() => setKind('')} />
            <Chip text={t('raw')} on={kind === 'RAW'} onPress={() => setKind('RAW')} />
            <Chip text={t('finished')} on={kind === 'FINISHED'} onPress={() => setKind('FINISHED')} />
            <View className="mx-1 w-px self-stretch bg-border" />
            <Chip text={t('allDirections')} on={!direction} onPress={() => setDirection('')} />
            <Chip text={t('stockIn')} on={direction === 'in'} onPress={() => setDirection('in')} />
            <Chip text={t('stockOut')} on={direction === 'out'} onPress={() => setDirection('out')} />
          </ScrollView>
          {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
          {q.isPending && <SkeletonList />}
        </View>
      }
      ListEmptyComponent={q.isPending ? null : <EmptyState icon="activity" title={t('noMovements')} />}
      renderItem={({ item }) =>
        item.type === 'day' ? (
          <DayHeader day={item.day} net={item.net} />
        ) : (
          <View className="-mx-4">
            <MovementRow m={item.m} last={item.last} timeOnly />
          </View>
        )
      }
      ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator className="py-4" colorClassName="accent-saffron" /> : null}
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
      empty={{ icon: 'sliders', title: t('noAdjustments'), body: t('adjustHint') }}
      renderItem={(a) => (
        <PressableCard label={a.code} onPress={() => router.push(`/stock/adjustments/${a.id}`)}>
          <View className="flex-row items-center gap-3">
            <IconTile icon="sliders" tone="navy" />
            <View className="flex-1 gap-0.5">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="text-[15px] font-semibold text-foreground">{a.code}</Text>
                <StatusPill status={a.status} />
              </View>
              <Muted lines={1}>
                {a.importCode} · {t(a.kind === 'RAW' ? 'raw' : 'finished')} · {a.woodType}
                {a.thicknessIn != null && a.widthIn != null && a.lengthFt != null ? ` · ${sizeLabel(a.thicknessIn, a.widthIn, a.lengthFt)}` : ''}
              </Muted>
            </View>
          </View>
          <View className="rounded-xl bg-secondary px-3.5 py-2.5">
            <Text className={a.cftDelta < 0 ? 'text-[15px] font-bold tabular-nums text-destructive' : 'text-[15px] font-bold tabular-nums text-success'}>
              {signed3(a.cftDelta)} CFT{a.piecesDelta ? ` · ${signedInt(a.piecesDelta)} ${t('pieces')}` : ''}
            </Text>
          </View>
          <Muted lines={2}>
            {a.reason} · {dateTime(a.createdAt)}
          </Muted>
        </PressableCard>
      )}
    />
  );
}

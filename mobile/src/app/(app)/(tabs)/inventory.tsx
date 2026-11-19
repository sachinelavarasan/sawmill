/**
 * Inventory: watching stock, not entering records — so it is laid out as analysis, not as the
 * operational lists (Load in / Production / Load out).
 *
 *   Finished     a compact summary on the band; how finished stock splits by wood type (one bar,
 *                its legend doubles as the wood filter); then a catalogue of sizes grouped by wood,
 *                each with pieces and CFT, and the import loads they came from (expand when several)
 *   Raw          raw wood left in each import load, with how much of what was received remains
 *   Movements    the ledger as a day-by-day timeline: what moved, in or out (word, arrow and colour),
 *                the CFT and pieces, and the record that caused it; filter by type, wood and date
 *   Corrections  stock adjustments with their approval status; new ones for those allowed to make them
 *
 * Quantities only (no prices), so it is the same for owner and accountant. Every figure comes from
 * the API; shares of the total are worked out from those figures, nothing is estimated.
 */
import { Permission, sizeLabel, type TKey } from '@timbertrail/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { DayHeader, MovementRow } from '../../../components/cards';
import { HeaderButton, ScreenHeader, SheetList, StickyFooter } from '../../../components/header';
import { RecordList } from '../../../components/RecordList';
import { PeriodPicker } from '../../../components/sheet';
import { Text } from '../../../components/text';
import {
  Button,
  Card,
  Chip,
  cn,
  EmptyState,
  ErrorBox,
  HeroCard,
  HeroStats,
  Icon,
  type IconName,
  Muted,
  ProgressBar,
  refresher,
  SearchBar,
  Segmented,
  Skeleton,
  SkeletonList,
  StatusPill,
  TabStrip,
} from '../../../components/ui';
import { Tap } from '../../../components/motion';
import { api } from '../../../lib/api';
import { dateOnly, dateTime, int, isoDay, num3, type Period, periodQuery, signed3, signedInt } from '../../../lib/format';
import { useT } from '../../../lib/i18n';
import { mergePages, useApi, useRefetchOnFocus } from '../../../lib/query';
import { useSession } from '../../../lib/session';
import type { Adjustment, Balances, Movement, MovementSource, Paged } from '../../../lib/types';

type Tab = 'raw' | 'finished' | 'movements' | 'adjustments';

export default function InventoryScreen() {
  const t = useT();
  const router = useRouter();
  const { can } = useSession();
  const [tab, setTab] = useState<Tab>('finished');
  const mayAdjust = can(Permission.OPERATIONS_CREATE);
  const newAdjustment = () => router.push('/stock/adjustments/new');
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={t('inventory')} large right={mayAdjust ? <HeaderButton icon="sliders" label={t('newAdjustment')} onPress={newAdjustment} /> : undefined}>
        <TabStrip
          value={tab}
          onChange={setTab}
          options={[
            { value: 'finished', label: t('finished'), icon: 'package' },
            { value: 'raw', label: t('raw'), icon: 'layers' },
            { value: 'movements', label: t('movements'), icon: 'activity' },
            { value: 'adjustments', label: t('adjustments'), icon: 'sliders' },
          ]}
        />
      </ScreenHeader>
      {tab === 'finished' ? <FinishedStock /> : tab === 'raw' ? <RawStock /> : tab === 'movements' ? <Movements /> : <Corrections />}
      {tab === 'adjustments' && mayAdjust && (
        <StickyFooter tabBar>
          <Button icon="plus" title={t('newAdjustment')} onPress={newAdjustment} />
        </StickyFooter>
      )}
    </View>
  );
}

const match = (needle: string, s: string) => !needle || s.toLowerCase().replace(/\s+/g, '').includes(needle);
const squash = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '');

// ───────── finished: analysis + catalogue ─────────

/** Colours for the wood-type split, in order of size — theme tokens only; the rest share the neutral. */
const SPLIT = ['bg-saffron', 'bg-chart-2', 'bg-saffron-strong', 'bg-chart-3'];
const splitColor = (i: number) => SPLIT[i] ?? 'bg-input';

type SizeRow = { key: string; wood: string; label: string; t: number; w: number; l: number; pieces: number; cft: number; loads: { id: string; code: string; pieces: number }[] };
type CatalogueRow = { type: 'wood'; wood: string; pieces: number; cft: number; sizes: number } | { type: 'size'; s: SizeRow; last: boolean };
type Sort = 'cft' | 'pieces' | 'size';

function FinishedStock() {
  const t = useT();
  const q = useApi<Balances>('/stock');
  const [search, setSearch] = useState('');
  const [wood, setWood] = useState('');
  const [sort, setSort] = useState<Sort>('cft');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const needle = squash(search);
  const totals = q.data?.totals;

  // one row per size (wood + T × W × L), with the loads it came from
  const sizes = useMemo(() => {
    const m = new Map<string, SizeRow>();
    for (const r of q.data?.finished ?? []) {
      if (r.pieces <= 0) continue;
      const key = `${r.woodType}|${r.thicknessIn}|${r.widthIn}|${r.lengthFt}`;
      const s = m.get(key) ?? { key, wood: r.woodType, label: sizeLabel(r.thicknessIn, r.widthIn, r.lengthFt), t: r.thicknessIn, w: r.widthIn, l: r.lengthFt, pieces: 0, cft: 0, loads: [] };
      s.pieces += r.pieces;
      s.cft += r.cft;
      s.loads.push({ id: r.importLoadId, code: r.importCode, pieces: r.pieces });
      m.set(key, s);
    }
    return [...m.values()];
  }, [q.data]);

  // the split by wood type, largest first (worked out from the sizes above)
  const woods = useMemo(() => {
    const m = new Map<string, { wood: string; cft: number; pieces: number; sizes: number }>();
    for (const s of sizes) {
      const x = m.get(s.wood) ?? { wood: s.wood, cft: 0, pieces: 0, sizes: 0 };
      x.cft += s.cft;
      x.pieces += s.pieces;
      x.sizes += 1;
      m.set(s.wood, x);
    }
    return [...m.values()].sort((a, b) => b.cft - a.cft);
  }, [sizes]);
  const totalCft = woods.reduce((n, w) => n + w.cft, 0);

  // the catalogue: filtered, grouped by wood (in the split's order), sorted within each wood
  const rows = useMemo(() => {
    const out: CatalogueRow[] = [];
    const order = (a: SizeRow, b: SizeRow) => (sort === 'cft' ? b.cft - a.cft : sort === 'pieces' ? b.pieces - a.pieces : a.t - b.t || a.w - b.w || a.l - b.l);
    for (const w of woods) {
      if (wood && w.wood !== wood) continue;
      const list = sizes.filter((s) => s.wood === w.wood && match(needle, `${s.wood} ${s.label} ${s.t}x${s.w}x${s.l} ${s.loads.map((l) => l.code).join(' ')}`)).sort(order);
      if (!list.length) continue;
      out.push({ type: 'wood', wood: w.wood, pieces: list.reduce((n, s) => n + s.pieces, 0), cft: list.reduce((n, s) => n + s.cft, 0), sizes: list.length });
      list.forEach((s, i) => out.push({ type: 'size', s, last: i === list.length - 1 }));
    }
    return out;
  }, [woods, sizes, wood, needle, sort]);

  const toggle = (key: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const hero = !totals ? (
    <Skeleton className="h-24 rounded-2xl opacity-20" />
  ) : (
    <HeroCard bare label={t('finishedStock')} value={num3(totals.finishedCft)} unit="CFT" icon="package">
      <HeroStats
        items={[
          { label: t('finishedPieces'), value: int(totals.finishedPieces), accent: true },
          { label: t('woodTypes'), value: int(woods.length) },
          { label: t('rawStock'), value: `${num3(totals.rawCft)} CFT` },
        ]}
      />
    </HeroCard>
  );

  const header = (
    <View className="gap-3 pb-1">
      {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
      {q.isPending ? (
        <Skeleton className="h-36 rounded-2xl" />
      ) : (
        woods.length > 0 && <WoodSplit woods={woods} total={totalCft} selected={wood} onSelect={(w) => setWood((cur) => (cur === w ? '' : w))} />
      )}
      <SearchBar value={search} onChange={setSearch} placeholder={t('searchSizes')} />
      <View className="flex-row items-center gap-3">
        <Text className="text-[13px] font-semibold text-muted-foreground">{t('sortBy')}</Text>
        <View className="flex-1">
          <Segmented<Sort>
            value={sort}
            onChange={setSort}
            options={[
              { value: 'cft', label: t('sortMostCft') },
              { value: 'pieces', label: t('sortMostPieces') },
              { value: 'size', label: t('size') },
            ]}
          />
        </View>
      </View>
      {q.isPending && <SkeletonList rows={4} />}
    </View>
  );

  return (
    <SheetList
      hero={hero}
      data={rows}
      keyExtractor={(r) => (r.type === 'wood' ? `wood:${r.wood}` : `size:${r.s.key}`)}
      refreshControl={refresher(q.isRefetching, () => void q.refetch())}
      ListHeaderComponent={header}
      ListEmptyComponent={q.isPending ? null : <EmptyState icon="package" title={needle || wood ? t('noResults') : t('noStock')} />}
      renderItem={({ item }) => (item.type === 'wood' ? <WoodHeading {...item} /> : <SizeItem s={item.s} last={item.last} open={open.has(item.s.key)} onToggle={() => toggle(item.s.key)} />)}
    />
  );
}

/**
 * Finished stock split by wood type: one segmented bar, then a legend of every wood with its CFT
 * and share. Tapping a wood filters the catalogue to it (again: show all).
 */
function WoodSplit({ woods, total, selected, onSelect }: { woods: { wood: string; cft: number; pieces: number }[]; total: number; selected: string; onSelect: (w: string) => void }) {
  const t = useT();
  const share = (cft: number) => (total > 0 ? (cft / total) * 100 : 0);
  return (
    <Card className="gap-3">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-[15px] font-semibold text-foreground">{t('byWoodType')}</Text>
        <Muted>{num3(total)} CFT</Muted>
      </View>
      <View className="h-3 flex-row overflow-hidden rounded-full bg-secondary" accessible accessibilityLabel={woods.map((w) => `${w.wood} ${Math.round(share(w.cft))}%`).join(', ')}>
        {woods.map((w, i) => (
          <View key={w.wood} className={cn(splitColor(i), selected && selected !== w.wood && 'opacity-30')} style={{ width: `${share(w.cft)}%`, marginRight: i < woods.length - 1 ? 2 : 0 }} />
        ))}
      </View>
      <View className="-mx-1.5">
        {woods.map((w, i) => {
          const on = selected === w.wood;
          return (
            <Pressable
              key={w.wood}
              onPress={() => onSelect(w.wood)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${w.wood}: ${num3(w.cft)} CFT, ${int(w.pieces)} ${t('pieces')}, ${share(w.cft).toFixed(1)}%`}
              className={cn('min-h-11 flex-row items-center gap-2.5 rounded-xl px-1.5', on ? 'bg-card' : 'active:bg-secondary')}
            >
              <View className={cn('h-2.5 w-2.5 rounded-sm', splitColor(i))} />
              <Text className={cn('flex-1 text-sm', on ? 'font-bold text-foreground' : 'font-medium text-foreground')} numberOfLines={1}>
                {w.wood}
              </Text>
              <Text className="text-[13px] tabular-nums text-muted-foreground">{int(w.pieces)}</Text>
              <Text className="w-24 text-right text-[13px] font-semibold tabular-nums text-foreground">{num3(w.cft)}</Text>
              <Text className="w-12 text-right text-xs tabular-nums text-muted-foreground">{share(w.cft).toFixed(share(w.cft) < 10 ? 1 : 0)}%</Text>
              {on && <Icon name="x" size={14} colorClassName="accent-muted-foreground" />}
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

/** A wood type's heading in the catalogue, with what is shown under it. */
function WoodHeading({ wood, pieces, cft, sizes }: { wood: string; pieces: number; cft: number; sizes: number }) {
  const t = useT();
  return (
    <View className="flex-row items-end justify-between gap-3 pb-1.5 pt-5" accessibilityRole="header">
      <View className="shrink gap-0.5">
        <Text className="text-base font-bold tracking-tight text-foreground font-display" numberOfLines={1}>
          {wood}
        </Text>
        <Muted>{t('sizesCount', { n: sizes })}</Muted>
      </View>
      <Text className="text-[13px] font-semibold tabular-nums text-muted-foreground">
        {int(pieces)} {t('pieces')} · <Text className="text-foreground">{num3(cft)} CFT</Text>
      </Text>
    </View>
  );
}

/**
 * One size in the catalogue: the dimensions large, pieces and CFT on the right; its source load
 * underneath — or "From n loads", which expands to each load's pieces.
 */
function SizeItem({ s, last, open, onToggle }: { s: SizeRow; last: boolean; open: boolean; onToggle: () => void }) {
  const t = useT();
  const router = useRouter();
  const many = s.loads.length > 1;
  const body = (
    <>
      <View className="flex-row items-center gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-[15px] font-semibold tabular-nums text-foreground" numberOfLines={1}>
            {s.label}
          </Text>
          <View className="flex-row items-center gap-1.5">
            <Icon name="download" size={12} colorClassName="accent-muted-foreground" />
            <Text className={cn('text-xs', many ? 'font-semibold text-saffron-strong' : 'text-muted-foreground')} numberOfLines={1}>
              {many ? t('fromLoads', { n: s.loads.length }) : s.loads[0]?.code}
            </Text>
            {many && <Icon name={open ? 'chevron-up' : 'chevron-down'} size={13} colorClassName="accent-saffron-strong" />}
          </View>
        </View>
        <View className="items-end">
          <Text className="text-base font-bold tabular-nums text-foreground font-display">
            {int(s.pieces)}
            <Text className="text-xs font-semibold text-muted-foreground"> {t('pieces')}</Text>
          </Text>
          <Text className="text-xs tabular-nums text-muted-foreground">{num3(s.cft)} CFT</Text>
        </View>
      </View>
      {many && open && (
        <View className="ml-[18px] gap-1 border-l-2 border-border pl-3">
          {s.loads.map((l) => (
            <Pressable key={l.id} onPress={() => router.push(`/imports/${l.id}`)} accessibilityRole="link" className="min-h-9 flex-row items-center justify-between active:opacity-60">
              <Text className="text-[13px] font-medium text-foreground">{l.code}</Text>
              <Text className="text-[13px] tabular-nums text-muted-foreground">
                {int(l.pieces)} {t('pieces')}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </>
  );
  const frame = cn('-mx-4 gap-2 px-4 py-3', !last && 'border-b border-border');
  // a size from one load opens that load; one from several expands to list them
  return many ? (
    <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${s.label}, ${s.wood}, ${int(s.pieces)} ${t('pieces')}, ${num3(s.cft)} CFT, ${t('fromLoads', { n: s.loads.length })}`} className={cn(frame, 'active:bg-secondary')}>
      {body}
    </Pressable>
  ) : (
    <Pressable onPress={() => s.loads[0] && router.push(`/imports/${s.loads[0].id}`)} accessibilityRole="button" accessibilityLabel={`${s.label}, ${s.wood}, ${int(s.pieces)} ${t('pieces')}, ${num3(s.cft)} CFT, ${s.loads[0]?.code ?? ''}`} className={cn(frame, 'active:bg-secondary')}>
      {body}
    </Pressable>
  );
}

// ───────── raw: what is left in each load ─────────

function RawStock() {
  const t = useT();
  const router = useRouter();
  const q = useApi<Balances>('/stock');
  const [search, setSearch] = useState('');
  const [wood, setWood] = useState('');
  const needle = squash(search);
  const totals = q.data?.totals;
  const all = (q.data?.raw ?? []).filter((r) => r.cft > 0);
  const woods = [...new Set(all.map((r) => r.woodType))].sort();
  const raw = all.filter((r) => (!wood || r.woodType === wood) && match(needle, `${r.importCode} ${r.woodType}`)).sort((a, b) => b.cft - a.cft);

  const hero = !totals ? (
    <Skeleton className="h-24 rounded-2xl opacity-20" />
  ) : (
    <HeroCard bare label={t('rawStock')} value={num3(totals.rawCft)} unit="CFT" icon="layers">
      <HeroStats
        items={[
          { label: t('loadsWithRaw'), value: int(totals.rawLoads), accent: true },
          { label: t('woodTypes'), value: int(woods.length) },
          { label: t('finishedStock'), value: `${num3(totals.finishedCft)} CFT` },
        ]}
      />
    </HeroCard>
  );

  return (
    <SheetList
      hero={hero}
      data={raw}
      keyExtractor={(r) => `raw:${r.importLoadId}`}
      refreshControl={refresher(q.isRefetching, () => void q.refetch())}
      ListHeaderComponent={
        <View className="gap-3 pb-1">
          {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
          <SearchBar value={search} onChange={setSearch} placeholder={t('searchLoads')} />
          {woods.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
              <Chip text={t('all')} on={!wood} onPress={() => setWood('')} />
              {woods.map((w) => (
                <Chip key={w} text={w} on={wood === w} onPress={() => setWood(w)} />
              ))}
            </ScrollView>
          )}
          {q.isPending && <SkeletonList />}
        </View>
      }
      ListEmptyComponent={q.isPending ? null : <EmptyState icon="layers" title={needle || wood ? t('noResults') : t('noStock')} />}
      renderItem={({ item: r, index }) => {
        const pct = r.receivedCft > 0 ? Math.min(100, (r.cft / r.receivedCft) * 100) : 0;
        return (
          <Tap
            scale={0.99}
            onPress={() => router.push(`/imports/${r.importLoadId}`)}
            accessibilityRole="button"
            accessibilityLabel={`${r.importCode}, ${r.woodType}, ${num3(r.cft)} / ${num3(r.receivedCft)} CFT`}
            className={cn('-mx-4 gap-2 px-4 py-3 active:bg-secondary', index < raw.length - 1 && 'border-b border-border')}
          >
            <View className="flex-row items-center gap-3">
              <View className="flex-1 gap-0.5">
                <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
                  {r.woodType}
                </Text>
                <Muted lines={1}>
                  {r.importCode} · {dateOnly(r.arrivalAt)} · {int(r.logs)} {t('logs')}
                </Muted>
              </View>
              <Text className="text-base font-bold tabular-nums text-foreground font-display">
                {num3(r.cft)}
                <Text className="text-xs font-semibold text-muted-foreground"> CFT</Text>
              </Text>
            </View>
            <View className="flex-row items-center gap-2.5">
              <View className="flex-1">
                <ProgressBar pct={pct} />
              </View>
              <Text className="text-[11px] tabular-nums text-muted-foreground">
                {Math.round(pct)}% · {num3(r.receivedCft)}
              </Text>
            </View>
          </Tap>
        );
      }}
    />
  );
}

// ───────── movements: the ledger as a timeline ─────────

const TYPES: { value: MovementSource; labelKey: TKey; icon: IconName }[] = [
  { value: 'IMPORT', labelKey: 'srcImport', icon: 'download' },
  { value: 'PRODUCTION_INPUT', labelKey: 'srcProductionIn', icon: 'axe' },
  { value: 'PRODUCTION_OUTPUT', labelKey: 'srcProductionOut', icon: 'package' },
  { value: 'EXPORT', labelKey: 'srcExport', icon: 'upload' },
  { value: 'ADJUSTMENT', labelKey: 'srcAdjustment', icon: 'sliders' },
];

function Movements() {
  const t = useT();
  const [source, setSource] = useState<MovementSource | ''>('');
  const [wood, setWood] = useState('');
  const [period, setPeriod] = useState<Period | null>(null);
  const [more, setMore] = useState(false);
  const stock = useApi<Balances>('/stock');
  const woods = useMemo(() => [...new Set([...(stock.data?.raw ?? []), ...(stock.data?.finished ?? [])].map((r) => r.woodType))].sort(), [stock.data]);

  // filters are applied by the API, so paging through the result stays complete
  const query = [
    'take=40',
    source && `source=${source}`,
    wood && `woodType=${encodeURIComponent(wood)}`,
    period && periodQuery(period),
  ]
    .filter(Boolean)
    .join('&');
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
  // a heading per local day (with that day's net change), then its movements
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
  const extra = (wood ? 1 : 0) + (period ? 1 : 0);
  const filtered = !!source || extra > 0;

  return (
    <SheetList
      data={rows}
      keyExtractor={(r) => (r.type === 'day' ? `day:${r.day}` : `movement:${r.m.id}`)}
      refreshControl={refresher(q.isRefetching && !q.isFetchingNextPage, () => void q.refetch())}
      onEndReachedThreshold={0.4}
      onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
      ListHeaderComponent={
        <View className="gap-2.5 pb-3">
          {/* what kind of movement — the main filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
            <Chip text={t('allTypes')} on={!source} onPress={() => setSource('')} />
            {TYPES.map((x) => (
              <Chip key={x.value} text={t(x.labelKey)} on={source === x.value} onPress={() => setSource(x.value)} />
            ))}
          </ScrollView>
          {/* wood and date, behind one button so the timeline starts high */}
          <Pressable
            onPress={() => setMore((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: more }}
            className="min-h-10 flex-row items-center gap-1.5 self-start rounded-full px-1 active:opacity-70"
          >
            <Icon name="sliders" size={14} colorClassName="accent-saffron-strong" />
            <Text className="text-[13px] font-semibold text-saffron-strong">
              {t('woodType')} · {t('period')}
              {extra ? ` (${extra})` : ''}
            </Text>
            <Icon name={more ? 'chevron-up' : 'chevron-down'} size={14} colorClassName="accent-saffron-strong" />
          </Pressable>
          {more && (
            <Card className="gap-3">
              {woods.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
                  <Chip text={t('all')} on={!wood} onPress={() => setWood('')} />
                  {woods.map((w) => (
                    <Chip key={w} text={w} on={wood === w} onPress={() => setWood(w)} />
                  ))}
                </ScrollView>
              )}
              <View className="gap-2">
                <View className="flex-row">
                  <Chip text={t('anyDate')} on={!period} onPress={() => setPeriod(null)} />
                </View>
                <PeriodPicker value={period} onChange={setPeriod} />
              </View>
            </Card>
          )}
          {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
          {q.isPending && <SkeletonList />}
        </View>
      }
      ListEmptyComponent={q.isPending ? null : <EmptyState icon="activity" title={filtered ? t('noResults') : t('noMovements')} />}
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

// ───────── corrections ─────────

function Corrections() {
  const t = useT();
  return (
    <RecordList<Adjustment>
      path="/stock-adjustments"
      statusFilter
      empty={{ icon: 'sliders', title: t('noAdjustments'), body: t('adjustHint') }}
      renderItem={(a) => <CorrectionRow a={a} />}
    />
  );
}

/**
 * One stock correction: code and status; which stock (raw or finished, wood, size, load); the
 * change as Increase / Decrease with its CFT and pieces; the reason; when and by whom.
 */
function CorrectionRow({ a }: { a: Adjustment }) {
  const t = useT();
  const router = useRouter();
  const up = a.cftDelta > 0;
  const size = a.thicknessIn != null && a.widthIn != null && a.lengthFt != null ? sizeLabel(a.thicknessIn, a.widthIn, a.lengthFt) : null;
  return (
    <Tap
      scale={0.99}
      onPress={() => router.push(`/stock/adjustments/${a.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${a.code}, ${t(up ? 'increase' : 'decrease')} ${signed3(a.cftDelta)} CFT, ${a.woodType}`}
      className="-mx-4 gap-2 border-b border-border px-4 py-3.5 active:bg-secondary"
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text className="shrink text-[15px] font-bold text-foreground font-display" numberOfLines={1}>
          {a.code}
        </Text>
        <StatusPill status={a.status} />
      </View>
      <View className="flex-row items-center gap-1.5">
        <View className={cn('rounded-md px-1.5 py-px', a.kind === 'RAW' ? 'bg-saffron-soft' : 'bg-primary-soft')}>
          <Text className={cn('text-[11px] font-semibold', a.kind === 'RAW' ? 'text-saffron-strong' : 'text-primary')}>{t(a.kind === 'RAW' ? 'raw' : 'finished')}</Text>
        </View>
        <Text className="shrink text-[13px] text-muted-foreground" numberOfLines={1}>
          {a.woodType}
          {size ? ` · ${size}` : ''} · {a.importCode}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <Icon name={up ? 'trending-up' : 'trending-down'} size={15} colorClassName={up ? 'accent-success' : 'accent-destructive'} />
        <Text className={cn('text-[13px] font-semibold', up ? 'text-success' : 'text-destructive')}>{t(up ? 'increase' : 'decrease')}</Text>
        <Text className={cn('text-[15px] font-bold tabular-nums', up ? 'text-success' : 'text-destructive')}>
          {signed3(a.cftDelta)} CFT
          {a.piecesDelta ? <Text className="text-[13px] font-semibold"> · {signedInt(a.piecesDelta)} {t('pieces')}</Text> : null}
        </Text>
      </View>
      {!!a.reason && <Muted lines={2}>{a.reason}</Muted>}
      {!!a.rejectionReason && <Text className="text-[13px] text-destructive">{a.rejectionReason}</Text>}
      <Muted lines={1}>
        {dateTime(a.createdAt)} · {a.createdByName}
      </Muted>
    </Tap>
  );
}

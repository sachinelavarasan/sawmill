/**
 * Stock in the simple view (web: pages/Stock.tsx → SimpleStock, RawCard, SizeCard): no tables, no
 * paging, no adjustments — what is there, and the next thing to do with it.
 *
 *  - Two big switch cards instead of tabs: Logs (raw) — CFT and loads; Sawn pieces — pieces and CFT.
 *  - One filter: the wood ("All · Neem · Pine …" with counts); a search box only past 12 items.
 *  - Logs: one card per load with wood left, newest first — CFT left in large type, a fill bar
 *    "of N received", and a full-width "Saw this" (New Sawing with that load chosen).
 *  - Sawn: a heading per wood with its pieces and CFT, then a card per size — pieces in large type;
 *    tap the card to see which loads they came from; "Load out" opens New Load Out with the wood.
 *  - Measured loads and sawn sizes still waiting approval sit in the same lists, dashed and tagged:
 *    they are not stock yet (stock changes only when the owner approves).
 */
import { sizeLabel } from '@timbertrail/shared';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { int, num3 } from '../lib/format';
import { useT } from '../lib/i18n';
import { useApi } from '../lib/query';
import { useTabBarInset } from '../lib/tab-chrome';
import type { Balances, FinishedStockRow } from '../lib/types';
import { Text } from './text';
import { HeroPanel } from './header';
import { Button, Chip, cn, EmptyState, ErrorBox, Icon, type IconName, type Mod, ProgressBar, refresher, SearchBar, Segmented, SkeletonList } from './ui';

type RawItem = { importLoadId: string; importCode: string; woodType: string; arrivalAt: string; logs: number; cft: number; receivedCft: number; pending: boolean };
type SizeItem = { key: string; wood: string; size: string; pieces: number; cft: number; pending: boolean; sources: { key: string; label: string; pieces: number; runId?: string }[] };

export function SimpleStock() {
  const t = useT();
  const q = useApi<Balances>('/stock');
  const tabBar = useTabBarInset();
  const [tab, setTab] = useState<'raw' | 'finished'>('raw');
  const [wood, setWood] = useState('');
  const [search, setSearch] = useState('');
  const data = q.data;

  const rawItems = useMemo<RawItem[]>(
    () =>
      data
        ? [
            ...data.raw.filter((r) => r.cft > 0).map((r) => ({ ...r, pending: false })),
            ...(data.pendingRaw ?? []).map((r) => ({ ...r, receivedCft: r.cft, pending: true })),
          ].sort((a, b) => String(b.arrivalAt).localeCompare(String(a.arrivalAt)))
        : [],
    [data],
  );
  const sizeItems = useMemo<SizeItem[]>(() => {
    if (!data) return [];
    const m = new Map<string, SizeItem>();
    const add = (f: FinishedStockRow, pending: boolean, source: SizeItem['sources'][number]) => {
      if (f.pieces <= 0) return;
      const size = sizeLabel(f.thicknessIn, f.widthIn, f.lengthFt);
      const key = `${f.woodType}|${size}|${pending ? 'p' : ''}`;
      const g = m.get(key) ?? { key, wood: f.woodType, size, pieces: 0, cft: 0, sources: [], pending };
      g.pieces += f.pieces;
      g.cft += f.cft;
      g.sources.push(source);
      m.set(key, g);
    };
    data.finished.forEach((f) => add(f, false, { key: f.importLoadId, label: f.importCode, pieces: f.pieces }));
    (data.pendingFinished ?? []).forEach((f) => add(f, true, { key: f.runId, label: `${f.runCode} · ${f.importCode}`, pieces: f.pieces, runId: f.runId }));
    // by wood, then the sizes in stock before the ones waiting
    return [...m.values()].sort((a, b) => a.wood.localeCompare(b.wood) || Number(a.pending) - Number(b.pending) || a.size.localeCompare(b.size, undefined, { numeric: true }));
  }, [data]);

  const woodOf = (x: RawItem | SizeItem) => ('wood' in x ? x.wood : x.woodType);
  const items: (RawItem | SizeItem)[] = tab === 'raw' ? rawItems : sizeItems;
  const woods = [...new Set(items.map(woodOf))].sort();
  const k = search.trim().toLowerCase();
  const shown = items.filter((x) => (!wood || woodOf(x) === wood) && (!k || ('size' in x ? `${x.wood} ${x.size}` : `${x.woodType} ${x.importCode}`).toLowerCase().includes(k)));
  const switchTo = (next: 'raw' | 'finished') => {
    setWood('');
    setSearch('');
    setTab(next);
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-4 px-4 pt-4" contentContainerStyle={{ paddingBottom: 32 + tabBar }} refreshControl={refresher(q.isRefetching, () => void q.refetch())}>
      {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
      {!data && !q.error && <SkeletonList rows={3} />}
      {data && (
        <>
          {/* the two kinds of stock, then the chosen one's total on the walnut card */}
          <Segmented
            value={tab}
            onChange={switchTo}
            options={[
              { value: 'raw', label: t('stockLogs') },
              { value: 'finished', label: t('stockSawn') },
            ]}
          />
          <HeroPanel className="gap-1">
            <Text className="text-[15px] text-hero-muted">{tab === 'raw' ? t('stockLogs') : t('stockSawn')}</Text>
            <Text className="text-[40px] font-bold leading-[46px] tabular-nums text-hero-foreground font-display" numberOfLines={1} adjustsFontSizeToFit>
              {num3(tab === 'raw' ? data.totals.rawCft : data.totals.finishedCft)}
              <Text className="text-[18px] font-semibold text-hero-muted"> CFT</Text>
            </Text>
            <Text className="text-[14px] tabular-nums text-saffron-soft">
              {tab === 'raw' ? t('loadsCount', { n: int(data.totals.rawLoads) }) : `${int(data.totals.finishedPieces)} ${t('pieces').toLowerCase()}`}
            </Text>
          </HeroPanel>

          {/* one plain filter: the wood */}
          {items.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
              <Chip text={t('all')} count={items.length} on={!wood} onPress={() => setWood('')} />
              {woods.map((w) => (
                <Chip key={w} text={w} count={items.filter((x) => woodOf(x) === w).length} on={wood === w} onPress={() => setWood(w)} />
              ))}
            </ScrollView>
          )}
          {items.length > 12 && <SearchBar value={search} onChange={setSearch} placeholder={t(tab === 'raw' ? 'searchLoads' : 'searchSizes')} />}

          {tab === 'raw' ? (
            rawItems.length === 0 ? (
              <EmptyStock text={t('noLogsInStock')} to="/imports/new" action={t('simpleLoadIn')} icon="truck" mod="logs" />
            ) : (
              (shown as RawItem[]).map((r) => <RawCard key={`${r.importLoadId}${r.pending ? ':p' : ''}`} r={r} />)
            )
          ) : sizeItems.length === 0 ? (
            <EmptyStock text={t('nothingSawn')} to="/production/new" action={t('simpleCut')} icon="factory" mod="stock" />
          ) : (
            // sawn pieces, under a heading per wood with its totals (stock only; waiting sizes are not stock yet)
            [...new Set((shown as SizeItem[]).map((s) => s.wood))].map((w) => {
              const sizes = (shown as SizeItem[]).filter((s) => s.wood === w);
              const ready = sizes.filter((s) => !s.pending);
              return (
                <View key={w} className="gap-2.5">
                  <View className="flex-row flex-wrap items-baseline gap-x-3 pt-1">
                    <Text className="text-lg font-bold text-foreground font-display">{w}</Text>
                    <Text className="text-sm font-medium tabular-nums text-muted-foreground">
                      {int(ready.reduce((n, s) => n + s.pieces, 0))} {t('pieces').toLowerCase()} · {num3(ready.reduce((n, s) => n + s.cft, 0))} CFT
                    </Text>
                  </View>
                  {sizes.map((s) => (
                    <SizeCard key={s.key} s={s} />
                  ))}
                </View>
              );
            })
          )}
        </>
      )}
    </ScrollView>
  );
}

function PendingTag() {
  const t = useT();
  return (
    <View className="self-start rounded-full bg-warning-soft px-2.5 py-1">
      <Text className="text-xs font-semibold text-warning">{t('pendingApproval')}</Text>
    </View>
  );
}

/** One load's raw logs: how much is left, and "Saw this". */
function RawCard({ r }: { r: RawItem }) {
  const t = useT();
  const router = useRouter();
  const share = !r.pending && r.receivedCft > 0 ? Math.min(100, Math.max(0, (r.cft / r.receivedCft) * 100)) : 0;
  return (
    <View className={cn('gap-4 rounded-3xl bg-card p-4', r.pending ? 'border-2 border-dashed border-warning' : 'shadow-sm shadow-black/5')}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-xl font-bold text-foreground font-display" numberOfLines={1}>
            {r.woodType}
          </Text>
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {r.importCode} · {int(r.logs)} {t('logs').toLowerCase()}
          </Text>
        </View>
        {r.pending && <PendingTag />}
      </View>
      <View className="gap-1.5">
        <View className="flex-row items-baseline gap-2">
          <Text className="text-[30px] font-bold leading-9 tabular-nums text-foreground font-display">{num3(r.cft)}</Text>
          <Text className="text-sm text-muted-foreground">{t('cftLeft')}</Text>
        </View>
        {!r.pending && (
          <>
            <ProgressBar pct={share} />
            <Text className="text-xs tabular-nums text-muted-foreground">{t('ofReceived', { n: num3(r.receivedCft) })}</Text>
          </>
        )}
      </View>
      <Button icon="factory" title={t('sawThis')} onPress={() => router.push({ pathname: '/production/new', params: { load: r.importLoadId } })} />
    </View>
  );
}

/** One sawn size: how many pieces; tap to see which loads they came from; "Load out". */
function SizeCard({ s }: { s: SizeItem }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <View className={cn('gap-3 rounded-3xl bg-card p-4', s.pending ? 'border-2 border-dashed border-warning' : 'shadow-sm shadow-black/5')}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} className="flex-row items-center justify-between gap-3">
        <View className="h-14 w-14 items-center justify-center rounded-2xl bg-mod-peach-soft">
          <View className="h-6 w-9 rounded-[5px] border-2 border-mod-peach bg-saffron-soft" />
        </View>
        <View className="flex-1">
          <Text className="text-[20px] font-bold leading-6 tabular-nums text-foreground font-display">{s.size}</Text>
          <View className="mt-1 flex-row items-center gap-1">
            <Icon name={open ? 'chevron-up' : 'chevron-down'} size={14} colorClassName="accent-muted-foreground" />
            <Text className="text-xs text-muted-foreground">{t('fromLoads', { n: s.sources.length })}</Text>
          </View>
        </View>
        <View className="items-end">
          <Text className="text-[28px] font-bold leading-8 tabular-nums text-foreground font-display">{int(s.pieces)}</Text>
          <Text className="text-xs tabular-nums text-muted-foreground">
            {t('pieces').toLowerCase()} · {num3(s.cft)} CFT
          </Text>
        </View>
      </Pressable>
      {s.pending && <PendingTag />}
      {open && (
        <View className="rounded-xl bg-background px-3">
          {s.sources.map((x, i) => (
            <Pressable
              key={x.key}
              disabled={!x.runId}
              onPress={() => x.runId && router.push(`/production/${x.runId}`)}
              className={cn('min-h-10 flex-row items-center justify-between gap-3 py-2', i < s.sources.length - 1 && 'border-b border-border')}
            >
              <Text className={cn('flex-1 text-sm', x.runId ? 'font-medium text-saffron-strong' : 'text-foreground')} numberOfLines={1}>
                {x.label}
              </Text>
              <Text className="text-sm font-semibold tabular-nums text-foreground">{int(x.pieces)}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <Button kind="secondary" size="md" icon="truck-out" title={t('loadOutThis')} onPress={() => router.push({ pathname: '/exports/new', params: { wood: s.wood } })} />
    </View>
  );
}

function EmptyStock({ text, to, action, icon, mod }: { text: string; to: '/imports/new' | '/production/new'; action: string; icon: IconName; mod: Mod }) {
  const router = useRouter();
  return <EmptyState mod={mod} icon={mod === 'logs' ? 'ruler' : 'boxes'} title={text} action={{ label: action, icon, onPress: () => router.push(to) }} />;
}

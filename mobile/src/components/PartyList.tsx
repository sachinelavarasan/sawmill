/** [OWNER-ONLY] Clients or suppliers: searchable list with what each one owes / is owed this year. */
import type { TKey } from '@timbertrail/shared';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { inr, periodQuery, presets } from '../lib/format';
import { useT } from '../lib/i18n';
import { rowKey, useApi } from '../lib/query';
import type { AccountsSummary, Party } from '../lib/types';
import { HeaderButton, ScreenHeader, SheetList, StickyFooter } from './header';
import { Text } from './text';
import { Avatar, Button, Chip, EmptyState, ErrorBox, Icon, type IconName, Muted, PressableCard, refresher, SearchBar, SkeletonList } from './ui';

export function PartyList({ kind }: { kind: 'clients' | 'suppliers' }) {
  const t = useT();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [owing, setOwing] = useState(false);
  const list = useApi<Party[]>(`/${kind}`);
  const summary = useApi<AccountsSummary>(`/accounts/summary?${periodQuery(presets().thisYear)}`);
  const balances = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of (kind === 'clients' ? summary.data?.receivables : summary.data?.payables) ?? []) if (b.id) m.set(b.id, b.balance);
    return m;
  }, [summary.data, kind]);

  const L = {
    clients: { title: 'clients', sub: 'clientsSub', add: 'addClient', empty: 'noClients', icon: 'users' },
    suppliers: { title: 'suppliers', sub: 'suppliersSub', add: 'addSupplier', empty: 'noSuppliers', icon: 'truck' },
  }[kind] as { title: TKey; sub: TKey; add: TKey; empty: TKey; icon: IconName };

  const needle = q.trim().toLowerCase();
  const items = (list.data ?? []).filter(
    (p) => (!owing || (balances.get(p.id) ?? 0) > 0) && (!needle || `${p.name} ${p.phone ?? ''} ${p.gstNumber ?? ''}`.toLowerCase().includes(needle)),
  );
  const owingCount = (list.data ?? []).filter((p) => (balances.get(p.id) ?? 0) > 0).length;
  const add = () => router.push({ pathname: '/parties/form', params: { kind } });

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={t(L.title)} subtitle={t(L.sub)} back right={<HeaderButton icon="plus" label={t(L.add)} onPress={add} />} />
      <SheetList
        data={items}
        keyExtractor={rowKey('party')}
        refreshControl={refresher(list.isRefetching, () => void list.refetch())}
        ListHeaderComponent={
          <View className="gap-3 pb-1">
            <SearchBar value={q} onChange={setQ} placeholder={t('search')} />
            <View className="flex-row gap-2">
              <Chip text={t('all')} on={!owing} count={list.data?.length} onPress={() => setOwing(false)} />
              <Chip text={t('outstandingBalances')} on={owing} count={owingCount} onPress={() => setOwing(true)} />
            </View>
            {list.error && <ErrorBox message={(list.error as Error).message} onRetry={() => void list.refetch()} />}
            {list.isPending && <SkeletonList rows={3} />}
          </View>
        }
        ListEmptyComponent={list.isPending ? null : needle || owing ? <EmptyState icon="search" title={t('noResults')} /> : <EmptyState icon={L.icon} title={t(L.empty)} action={{ label: t(L.add), onPress: add }} />}
        renderItem={({ item: p }) => {
          const bal = balances.get(p.id) ?? 0;
          return (
            <PressableCard label={p.name} onPress={() => router.push({ pathname: '/parties/form', params: { kind, id: p.id } })}>
              <View className="flex-row items-center gap-3">
                <Avatar name={p.name} />
                <View className="flex-1 gap-0.5">
                  <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
                    {p.name}
                  </Text>
                  {p.phone || p.gstNumber ? (
                    <Muted lines={1}>{[p.phone, p.gstNumber && `GST ${p.gstNumber}`].filter(Boolean).join(' · ')}</Muted>
                  ) : p.address ? (
                    <Muted lines={1}>{p.address}</Muted>
                  ) : null}
                </View>
                {bal > 0 ? (
                  <View className="items-end">
                    <Text className="text-[15px] font-bold tabular-nums text-warning">{inr(bal)}</Text>
                    <Text className="text-[11px] text-muted-foreground">{t(kind === 'clients' ? 'pendingReceivables' : 'pendingPayables')}</Text>
                  </View>
                ) : (
                  <Icon name="chevron-right" size={18} colorClassName="accent-muted-foreground" />
                )}
              </View>
            </PressableCard>
          );
        }}
      />
      <StickyFooter tabBar>
        <Button icon="plus" title={t(L.add)} onPress={add} />
      </StickyFooter>
    </View>
  );
}

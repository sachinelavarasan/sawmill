/** [OWNER-ONLY] Clients or suppliers: searchable list with what each one owes / is owed this year. */
import type { TKey } from '@sawmill/shared';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { inr, periodQuery, presets } from '../lib/format';
import { useT } from '../lib/i18n';
import { useApi } from '../lib/query';
import type { AccountsSummary, Party } from '../lib/types';
import { ScreenHeader } from './header';
import { Button, EmptyState, ErrorBox, type IconName, Muted, PressableCard, refresher, SearchBar, SkeletonList } from './ui';

export function PartyList({ kind }: { kind: 'clients' | 'suppliers' }) {
  const t = useT();
  const router = useRouter();
  const [q, setQ] = useState('');
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
  const items = (list.data ?? []).filter((p) => !needle || `${p.name} ${p.phone ?? ''} ${p.gstNumber ?? ''}`.toLowerCase().includes(needle));
  const add = () => router.push({ pathname: '/parties/form', params: { kind } });

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={t(L.title)} back right={<Button size="md" icon="plus" title={t(L.add)} onPress={add} className="mr-2" />} />
      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        contentContainerClassName="gap-2.5 p-4 pb-6"
        keyboardShouldPersistTaps="handled"
        refreshControl={refresher(list.isRefetching, () => void list.refetch())}
        ListHeaderComponent={
          <View className="gap-3 pb-1">
            <Muted>{t(L.sub)}</Muted>
            <SearchBar value={q} onChange={setQ} placeholder={t('search')} />
            {list.error && <ErrorBox message={(list.error as Error).message} onRetry={() => void list.refetch()} />}
            {list.isPending && <SkeletonList rows={3} />}
          </View>
        }
        ListEmptyComponent={list.isPending ? null : needle ? <EmptyState icon="search" title={t('noResults')} /> : <EmptyState icon={L.icon} title={t(L.empty)} action={{ label: t(L.add), onPress: add }} />}
        renderItem={({ item: p }) => {
          const bal = balances.get(p.id) ?? 0;
          return (
            <PressableCard onPress={() => router.push({ pathname: '/parties/form', params: { kind, id: p.id } })}>
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 text-[15px] font-bold text-foreground">{p.name}</Text>
                {bal > 0 && <Text className="text-sm font-bold tabular-nums text-warning">{inr(bal)}</Text>}
              </View>
              {(p.phone || p.gstNumber) && <Muted>{[p.phone, p.gstNumber && `GST ${p.gstNumber}`].filter(Boolean).join(' · ')}</Muted>}
              {!!p.address && <Muted lines={2}>{p.address}</Muted>}
            </PressableCard>
          );
        }}
      />
    </View>
  );
}

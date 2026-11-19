/** [OWNER-ONLY] Clients or suppliers: financial summary, search, filters, and detail navigation. */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { periodQuery, presets } from '../lib/format';
import { useT } from '../lib/i18n';
import { rowKey, useApi } from '../lib/query';
import type { AccountsSummary, Party } from '../lib/types';
import { SheetList, StickyFooter } from './header';
import { BusinessPartnerFilters } from './partners/BusinessPartnerFilters';
import { BusinessPartnerHeader } from './partners/BusinessPartnerHeader';
import { BusinessPartnerListItem } from './partners/BusinessPartnerListItem';
import { BusinessPartnerSearch } from './partners/BusinessPartnerSearch';
import { BusinessPartnerSummary } from './partners/BusinessPartnerSummary';
import { PARTNER_META, type PartnerFilter, type PartnerKind } from './partners/types';
import { Button, EmptyState, ErrorBox, refresher, SkeletonList } from './ui';

export function PartyList({ kind }: { kind: PartnerKind }) {
  const t = useT();
  const router = useRouter();
  const meta = PARTNER_META[kind];
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<PartnerFilter>('all');
  const list = useApi<Party[]>(`/${kind}`);
  const summary = useApi<AccountsSummary>(`/accounts/summary?${periodQuery(presets().thisYear)}`);

  const financialsAvailable = Boolean(summary.data) && !summary.error;

  const balances = useMemo(() => {
    const m = new Map<string, number>();
    const rows = kind === 'clients' ? summary.data?.receivables : summary.data?.payables;
    for (const b of rows ?? []) {
      if (b.id) m.set(b.id, b.balance);
    }
    return m;
  }, [summary.data, kind]);

  const { outstandingCount, settledCount, totalOutstanding } = useMemo(() => {
    const partners = list.data ?? [];
    if (!financialsAvailable) {
      return { outstandingCount: undefined, settledCount: undefined, totalOutstanding: undefined };
    }
    let outCount = 0;
    let total = 0;
    for (const p of partners) {
      const bal = balances.get(p.id) ?? 0;
      if (bal > 0) {
        outCount += 1;
        total += bal;
      }
    }
    return {
      outstandingCount: outCount,
      settledCount: partners.length - outCount,
      totalOutstanding: total,
    };
  }, [list.data, balances, financialsAvailable]);

  const activeFilter: PartnerFilter = financialsAvailable ? filter : 'all';
  const needle = q.trim().toLowerCase();

  const items = useMemo(() => {
    return (list.data ?? []).filter((p) => {
      const bal = balances.get(p.id) ?? 0;
      if (activeFilter === 'outstanding' && bal <= 0) return false;
      if (activeFilter === 'settled' && bal > 0) return false;
      if (!needle) return true;
      return `${p.name} ${p.phone ?? ''} ${p.gstNumber ?? ''}`.toLowerCase().includes(needle);
    });
  }, [list.data, balances, activeFilter, needle]);

  const add = () => router.push({ pathname: '/parties/form', params: { kind } });
  const refreshAll = () => {
    void list.refetch();
    void summary.refetch();
  };

  return (
    <View className="flex-1 bg-background">
      <BusinessPartnerHeader kind={kind} onAdd={add} />
      <SheetList
        compact
        data={items}
        keyExtractor={rowKey('party')}
        refreshControl={refresher(list.isRefetching || summary.isRefetching, refreshAll)}
        hero={
          <BusinessPartnerSummary
            kind={kind}
            totalCount={list.data?.length}
            outstandingCount={outstandingCount}
            totalOutstanding={totalOutstanding}
            loading={list.isPending && summary.isPending}
            financialsAvailable={financialsAvailable}
            financialsError={Boolean(summary.error)}
          />
        }
        ListHeaderComponent={
          <View className="gap-3 pb-1">
            <BusinessPartnerSearch value={q} onChange={setQ} />
            <BusinessPartnerFilters
              value={activeFilter}
              onChange={setFilter}
              totalCount={list.data?.length}
              outstandingCount={outstandingCount}
              settledCount={settledCount}
              financialsAvailable={financialsAvailable}
            />
            {list.error && <ErrorBox message={(list.error as Error).message} onRetry={refreshAll} />}
            {list.isPending && <SkeletonList rows={3} />}
          </View>
        }
        ListEmptyComponent={
          list.isPending ? null : needle || activeFilter !== 'all' ? (
            <EmptyState icon="search" title={t('noResults')} />
          ) : (
            <EmptyState icon={meta.icon} title={t(meta.emptyLabel)} action={{ label: t(meta.addLabel), onPress: add }} />
          )
        }
        renderItem={({ item: p }) => (
          <BusinessPartnerListItem
            kind={kind}
            partner={p}
            balance={balances.get(p.id)}
            financialsAvailable={financialsAvailable}
            onPress={() => router.push({ pathname: '/statement/[kind]/[id]', params: { kind, id: p.id } })}
          />
        )}
      />
      <StickyFooter tabBar>
        <Button icon="plus" title={t(meta.addLabel)} onPress={add} />
      </StickyFooter>
    </View>
  );
}

/** [OWNER-ONLY] Profit and loss for a period, the expense breakdown, and who still owes / is owed. */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Page, ScreenHeader } from '../../../../components/header';
import { PeriodPicker } from '../../../../components/sheet';
import { Card, cn, Divider, EmptyState, ErrorBox, KV, MenuGroup, Muted, Pill, Segmented, SectionTitle, Skeleton, SkeletonList } from '../../../../components/ui';
import { inr, int, periodQuery, presets } from '../../../../lib/format';
import { useT } from '../../../../lib/i18n';
import { useApi } from '../../../../lib/query';
import type { AccountsSummary, PartyBalance } from '../../../../lib/types';

export default function AccountsScreen() {
  const t = useT();
  const router = useRouter();
  const [period, setPeriod] = useState(presets().thisMonth);
  const [side, setSide] = useState<'receivables' | 'payables'>('receivables');
  const q = useApi<AccountsSummary>(`/accounts/summary?${periodQuery(period)}`);
  const p = q.data?.pnl;
  const loss = !!p && p.profit < 0;
  const balances: PartyBalance[] = (q.data?.[side] ?? []).filter((b) => b.balance > 0);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={t('accounts')} back right={<Pill icon="lock" text={t('ownerOnly')} />} />
      <Page bottomInset={false} refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
        <PeriodPicker value={period} onChange={setPeriod} />
        {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
        {!p ? (
          <>
            <Skeleton className="h-24 rounded-xl" />
            <SkeletonList rows={2} />
          </>
        ) : (
          <>
            <View className={cn('gap-1 rounded-xl p-4', loss ? 'bg-destructive-soft' : 'bg-primary')}>
              <Text className={cn('text-[13px] font-medium', loss ? 'text-destructive' : 'text-primary-foreground opacity-85')}>{loss ? t('netLoss') : t('netProfit')}</Text>
              <Text className={cn('text-3xl font-bold tabular-nums', loss ? 'text-destructive' : 'text-primary-foreground')}>{inr(p.profit)}</Text>
            </View>

            <SectionTitle>{t('income')}</SectionTitle>
            <Card>
              <KV label={t('sales')} value={inr(p.sales)} strong />
            </Card>

            <SectionTitle>{t('expensesHead')}</SectionTitle>
            <Card>
              <KV label={t('purchases')} value={inr(p.purchases)} />
              <KV label={t('transport')} value={inr(p.transport)} />
              <KV label={t('unloadingCharges')} value={inr(p.unloading)} />
              {p.otherExpenses.map((e) => (
                <KV key={e.category} label={e.category} value={inr(e.amount)} />
              ))}
              <Divider />
              <KV label={t('totalExpenses')} value={inr(p.totalExpenses)} strong />
            </Card>
            <Text onPress={() => router.push('/more/expenses')} accessibilityRole="link" className="self-start py-1 text-sm font-semibold text-primary">
              {t('otherExpenses')} →
            </Text>

            <SectionTitle>{t('outstandingBalances')}</SectionTitle>
            <Segmented
              value={side}
              onChange={setSide}
              options={[
                { value: 'receivables', label: t('pendingReceivables') },
                { value: 'payables', label: t('pendingPayables') },
              ]}
            />
            {balances.length === 0 ? (
              <EmptyState icon="check-circle" title={t('noOutstanding')} />
            ) : (
              <MenuGroup>
                {balances.map((b, i) => (
                  <View key={b.id ?? `none-${i}`} className={cn('flex-row items-center gap-3 px-4 py-3', i < balances.length - 1 && 'border-b border-border')}>
                    <View className="flex-1">
                      <Text className="text-[15px] font-semibold text-foreground">{b.name ?? t(side === 'receivables' ? 'noClientName' : 'noSupplierName')}</Text>
                      <Muted>
                        {t('loadsCount', { n: int(b.loads) })} · {inr(b.amount)}
                      </Muted>
                    </View>
                    <Text className="text-[15px] font-bold tabular-nums text-warning">{inr(b.balance)}</Text>
                  </View>
                ))}
              </MenuGroup>
            )}
            <Muted>{t('outstandingNote')}</Muted>
          </>
        )}
      </Page>
    </View>
  );
}

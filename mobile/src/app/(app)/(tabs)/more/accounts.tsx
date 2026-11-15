/** [OWNER-ONLY] Profit and loss for a period, the expense breakdown, and who still owes / is owed. */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Page, ScreenHeader } from '../../../../components/header';
import { PeriodPicker } from '../../../../components/sheet';
import { Text } from '../../../../components/text';
import { Avatar, Button, Card, cn, Divider, EmptyState, ErrorBox, HeroCard, Icon, KV, MenuGroup, Muted, Segmented, SectionTitle, Skeleton, SkeletonList } from '../../../../components/ui';
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
      <ScreenHeader title={t('accounts')} subtitle={t('ownerOnly')} back />
      <Page
        bottomInset={false}
        refreshing={q.isRefetching}
        onRefresh={() => void q.refetch()}
        hero={
          p ? (
            <HeroCard bare label={loss ? t('netLoss') : t('netProfit')} value={inr(p.profit)} icon={loss ? 'trending-down' : 'trending-up'}>
              <View className="flex-row gap-3 border-t border-hero-border pt-4">
                {[
                  { label: t('sales'), value: inr(p.sales) },
                  { label: t('totalExpenses'), value: inr(p.totalExpenses) },
                ].map((x) => (
                  <View key={x.label} className="flex-1 gap-0.5">
                    <Text className="text-[11px] text-hero-muted">{x.label}</Text>
                    <Text className="text-[15px] font-semibold tabular-nums text-hero-foreground" numberOfLines={1} adjustsFontSizeToFit>
                      {x.value}
                    </Text>
                  </View>
                ))}
              </View>
            </HeroCard>
          ) : (
            <Skeleton className="h-28 rounded-2xl opacity-20" />
          )
        }
      >
        <PeriodPicker value={period} onChange={setPeriod} />
        {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
        {!p ? (
          <>
            <Skeleton className="h-24 rounded-xl" />
            <SkeletonList rows={2} />
          </>
        ) : (
          <>

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
            <Button kind="ghost" size="md" icon="receipt" title={t('otherExpenses')} onPress={() => router.push('/more/expenses')} className="self-start" />

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
                  <Pressable
                    key={b.id ?? `none-${i}`}
                    disabled={!b.id}
                    accessibilityRole="button"
                    accessibilityHint={t('viewStatement')}
                    onPress={() => b.id && router.push({ pathname: '/statement/[kind]/[id]', params: { kind: side === 'receivables' ? 'clients' : 'suppliers', id: b.id } })}
                    className={cn('min-h-[64px] flex-row items-center gap-3 px-4 py-3 active:bg-secondary', i < balances.length - 1 && 'border-b border-border')}
                  >
                    <Avatar name={b.name ?? '?'} size="sm" />
                    <View className="flex-1">
                      <Text className="text-[15px] font-semibold text-foreground">{b.name ?? t(side === 'receivables' ? 'noClientName' : 'noSupplierName')}</Text>
                      <Muted>
                        {t('loadsCount', { n: int(b.loads) })} · {inr(b.amount)}
                      </Muted>
                    </View>
                    <Text className="text-[15px] font-bold tabular-nums text-warning">{inr(b.balance)}</Text>
                    {b.id && <Icon name="chevron-right" size={18} colorClassName="accent-muted-foreground" />}
                  </Pressable>
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

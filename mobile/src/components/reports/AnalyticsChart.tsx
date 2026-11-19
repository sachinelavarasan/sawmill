import { View } from 'react-native';
import { inrShort, monthShort } from '../../lib/format';
import { useT } from '../../lib/i18n';
import type { AccountsSummary, OwnerCharts } from '../../lib/types';
import { Text } from '../text';
import { BarChart, Card, LegendDot, Muted, ProgressBar, Skeleton } from '../ui';

/** Compact financial analytics charts using actual backend series and period expense breakdown. */
export function AnalyticsChart({
  cash,
  pnl,
  loading,
}: {
  cash?: OwnerCharts['cash'];
  pnl?: AccountsSummary['pnl'];
  loading?: boolean;
}) {
  const t = useT();

  if (loading && !cash && !pnl) {
    return <Skeleton className="h-44 rounded-2xl" />;
  }

  const hasCash = (cash ?? []).some((c) => c.sales > 0 || c.expenses > 0);
  const expenseItems = pnl
    ? [
        { label: t('purchases'), amount: pnl.purchases },
        { label: t('transport'), amount: pnl.transport },
        { label: t('unloadingCharges'), amount: pnl.unloading },
        ...pnl.otherExpenses.map((e) => ({ label: e.category, amount: e.amount })),
      ]
        .filter((x) => x.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5)
    : [];
  const maxExpense = Math.max(1, ...expenseItems.map((e) => e.amount));

  return (
    <View className="gap-3">
      <Card>
        <View className="flex-row items-baseline justify-between gap-2">
          <Text className="text-[15px] font-semibold text-foreground">{t('chartCashTitle')}</Text>
          <Muted>{t('month')}</Muted>
        </View>
        {hasCash && cash ? (
          <View className="gap-3 pt-1">
            <BarChart
              height={108}
              data={cash.map((c) => ({ label: monthShort(c.month), values: [c.sales, c.expenses] }))}
              accessibilityLabel={t('chartCashTitle')}
            />
            <View className="flex-row gap-5">
              <LegendDot className="bg-saffron" label={t('sales')} />
              <LegendDot className="bg-chart-2" label={t('expensesHead')} />
            </View>
          </View>
        ) : (
          <Muted className="py-4 text-center">{t('noChartData')}</Muted>
        )}
      </Card>

      <Card>
        <View className="flex-row items-baseline justify-between gap-2">
          <Text className="text-[15px] font-semibold text-foreground">{t('expenseBreakdown')}</Text>
          {pnl ? <Text className="text-xs font-semibold tabular-nums text-muted-foreground">{inrShort(pnl.totalExpenses)}</Text> : null}
        </View>
        {expenseItems.length > 0 ? (
          <View className="gap-2.5 pt-1">
            {expenseItems.map((e, idx) => (
              <View key={e.label} className="gap-1">
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="flex-1 text-[13px] font-medium text-foreground" numberOfLines={1}>
                    {e.label}
                  </Text>
                  <Text className="text-[13px] font-semibold tabular-nums text-foreground">{inrShort(e.amount)}</Text>
                </View>
                <ProgressBar pct={(e.amount / maxExpense) * 100} tone={idx === 0 ? 'saffron' : 'navy'} />
              </View>
            ))}
          </View>
        ) : (
          <Muted className="py-3 text-center">{t('noExpenses')}</Muted>
        )}
      </Card>
    </View>
  );
}

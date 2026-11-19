import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { inr, inrShort } from '../../lib/format';
import { useT } from '../../lib/i18n';
import type { AccountsSummary } from '../../lib/types';
import { ErrorBox, HeroCard, HeroStats, Pill, Skeleton, SkeletonGrid } from '../ui';
import { FinancialKpiCard } from './FinancialKpiCard';

/**
 * Business Overview financial summary:
 * - Distinct Net Profit / Loss hero card using backend `pnl.profit` directly (never recalculated in UI)
 * - Compact secondary KPI row for Sales, Purchases, and Total Expenses
 */
export function FinancialSummary({
  pnl,
  loading,
  error,
  onRetry,
}: {
  pnl?: AccountsSummary['pnl'];
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}) {
  const t = useT();
  const router = useRouter();

  if (error) return <ErrorBox message={error} onRetry={onRetry} />;

  if (loading || !pnl) {
    return (
      <View className="gap-3">
        <Skeleton className="h-36 rounded-3xl" />
        <SkeletonGrid tiles={3} />
      </View>
    );
  }

  const loss = pnl.profit < 0;

  return (
    <View className="gap-3">
      <HeroCard
        label={loss ? t('netLoss') : t('netProfit')}
        value={inr(pnl.profit)}
        icon={loss ? 'trending-down' : 'trending-up'}
        sub={<Pill tone={loss ? 'bad' : 'good'} text={loss ? t('netLoss') : t('netProfit')} icon={loss ? 'trending-down' : 'trending-up'} />}
        onPress={() => router.push('/more/accounts')}
      >
        <HeroStats
          items={[
            { label: t('sales'), value: inrShort(pnl.sales), accent: true },
            { label: t('purchases'), value: inrShort(pnl.purchases) },
            { label: t('totalExpenses'), value: inrShort(pnl.totalExpenses) },
          ]}
        />
      </HeroCard>

      <View className="flex-row gap-2.5">
        <FinancialKpiCard
          icon="trending-up"
          label={t('sales')}
          value={inrShort(pnl.sales)}
          tone="good"
          onPress={() => router.push('/more/accounts')}
        />
        <FinancialKpiCard
          icon="download"
          label={t('purchases')}
          value={inrShort(pnl.purchases)}
          onPress={() => router.push('/more/accounts')}
        />
        <FinancialKpiCard
          icon="receipt"
          label={t('totalExpenses')}
          value={inrShort(pnl.totalExpenses)}
          onPress={() => router.push('/more/expenses')}
        />
      </View>
    </View>
  );
}

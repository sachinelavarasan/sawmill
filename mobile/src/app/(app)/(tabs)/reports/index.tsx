/**
 * Reports: for the owner, a money snapshot for a chosen period (sales, purchases, the
 * six-month sales chart); for everyone, the reports they may open — the API lists only those.
 */
import { Permission, type TKey } from '@timbertrail/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Page, ScreenHeader } from '../../../../components/header';
import { PeriodPicker } from '../../../../components/sheet';
import { Text } from '../../../../components/text';
import {
  BarChart,
  EmptyState,
  ErrorBox,
  Grid,
  HeroCard,
  type IconName,
  LegendDot,
  Kpi,
  Tile,
  TileGrid,
  type TileTone,
  Muted,
  Pill,
  SectionTitle,
  Skeleton,
  SkeletonGrid,
  SkeletonList,
} from '../../../../components/ui';
import { inr, inrShort, monthShort, type Period, periodQuery, presets } from '../../../../lib/format';
import { useLang, useT } from '../../../../lib/i18n';
import { useApi } from '../../../../lib/query';
import { useSession } from '../../../../lib/session';
import type { AccountsSummary, OwnerCharts, ReportInfo } from '../../../../lib/types';

/** Subtitle and icon per report key (the titles come from the API, already translated). */
const META: Record<string, { sub?: TKey; icon: IconName; tone: TileTone }> = {
  imports: { sub: 'reportImportsSub', icon: 'download', tone: 'info' },
  production: { sub: 'reportProductionSub', icon: 'settings', tone: 'saffron' },
  yieldWood: { sub: 'reportYieldWoodSub', icon: 'pie-chart', tone: 'saffron' },
  exports: { sub: 'reportExportsSub', icon: 'upload', tone: 'good' },
  stock: { sub: 'reportStockSub', icon: 'layers', tone: 'navy' },
  pnl: { sub: 'reportPnlSub', icon: 'trending-up', tone: 'good' },
  payables: { sub: 'reportPayablesSub', icon: 'arrow-up-circle', tone: 'bad' },
  receivables: { sub: 'reportReceivablesSub', icon: 'arrow-down-circle', tone: 'info' },
  yieldSupplier: { sub: 'reportYieldSupplierSub', icon: 'truck', tone: 'navy' },
  expenses: { sub: 'reportExpensesSub', icon: 'receipt', tone: 'warn' },
};

export default function ReportsHome() {
  const t = useT();
  const { lang } = useLang();
  const router = useRouter();
  const { can } = useSession();
  const q = useApi<ReportInfo[]>(`/reports?lang=${lang}`);
  const owner = can(Permission.FINANCE_VIEW);
  const [period, setPeriod] = useState(presets().thisMonth);
  const groups = (['operational', 'financial'] as const).map((g) => ({ g, items: (q.data ?? []).filter((r) => r.group === g) })).filter((x) => x.items.length);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={t('reports')} large />
      <Page bottomInset={false} refreshing={q.isRefetching} onRefresh={() => void q.refetch()} hero={owner ? <SalesHero period={period} /> : undefined}>
        {owner && <MoneyTiles period={period} onPeriod={setPeriod} />}

        {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
        {q.isPending && <SkeletonList rows={4} />}
        {q.isSuccess && groups.length === 0 && <EmptyState icon="file-text" title={t('noData')} />}
        {groups.map(({ g, items }) => (
          <View key={g} className="gap-3">
            <SectionTitle right={g === 'financial' ? <Pill icon="lock" text={t('ownerOnly')} /> : undefined}>
              {t(g === 'operational' ? 'operationalReports' : 'financialReports')}
            </SectionTitle>
            <TileGrid columns={2}>
              {items.map((r) => {
                const meta = META[r.key] ?? { icon: 'file-text' as IconName, tone: 'neutral' as TileTone };
                return (
                  <Tile
                    key={r.key}
                    variant="stack"
                    icon={meta.icon}
                    tone={meta.tone}
                    title={r.title}
                    subtitle={meta.sub ? t(meta.sub) : undefined}
                    onPress={() => router.push({ pathname: '/reports/[key]', params: { key: r.key, title: r.title } })}
                  />
                );
              })}
            </TileGrid>
          </View>
        ))}
        <Muted className="pt-1 text-center">{t('reportsSub')}</Muted>
      </Page>
    </View>
  );
}

/** [OWNER-ONLY] Sales for the chosen period, and sales vs expenses by month — on the navy. */
function SalesHero({ period }: { period: Period }) {
  const t = useT();
  const router = useRouter();
  const money = useApi<AccountsSummary>(`/accounts/summary?${periodQuery(period)}`);
  const charts = useApi<OwnerCharts>('/dashboard/owner/charts');
  const p = money.data?.pnl;
  const cash = charts.data?.cash ?? [];
  if (!p || charts.isPending) return <Skeleton className="h-44 rounded-2xl opacity-20" />;
  return (
    <HeroCard bare label={t('salesInPeriod')} value={inr(p.sales)} onPress={() => router.push('/more/accounts')}>
      {cash.some((c) => c.sales || c.expenses) ? (
        <View className="gap-3">
          <BarChart onDark height={72} data={cash.map((c) => ({ label: monthShort(c.month), values: [c.sales, c.expenses] }))} />
          <View className="flex-row gap-5">
            <LegendDot onDark className="bg-saffron" label={t('sales')} />
            <LegendDot onDark className="bg-hero-muted" label={t('expensesHead')} />
          </View>
        </View>
      ) : (
        <Text className="text-[13px] text-hero-muted">{t('noChartData')}</Text>
      )}
    </HeroCard>
  );
}

/** [OWNER-ONLY] The period, then purchases, expenses and profit for it. */
function MoneyTiles({ period, onPeriod }: { period: Period; onPeriod: (p: Period) => void }) {
  const t = useT();
  const router = useRouter();
  const money = useApi<AccountsSummary>(`/accounts/summary?${periodQuery(period)}`);
  const p = money.data?.pnl;
  return (
    <>
      <PeriodPicker value={period} onChange={onPeriod} />
      {money.error && <ErrorBox message={(money.error as Error).message} onRetry={() => void money.refetch()} />}
      {!p ? (
        <SkeletonGrid tiles={4} />
      ) : (
        <Grid>
          <Kpi icon="trending-up" label={t('sales')} value={inrShort(p.sales)} tone="good" onPress={() => router.push('/more/accounts')} />
          <Kpi icon="download" label={t('purchases')} value={inrShort(p.purchases)} onPress={() => router.push('/more/accounts')} />
          <Kpi icon="receipt" label={t('totalExpenses')} value={inrShort(p.totalExpenses)} onPress={() => router.push('/more/expenses')} />
          <Kpi
            icon={p.profit < 0 ? 'trending-down' : 'wallet'}
            label={p.profit < 0 ? t('netLoss') : t('netProfit')}
            value={inrShort(p.profit)}
            tone={p.profit < 0 ? 'bad' : undefined}
            onPress={() => router.push('/more/accounts')}
          />
        </Grid>
      )}
    </>
  );
}

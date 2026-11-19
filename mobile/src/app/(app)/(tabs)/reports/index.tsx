/**
 * Reports Dashboard — Business Intelligence view:
 * 1. Business Overview (Period selector, Net Profit hero + Sales/Purchases/Expenses KPIs, Analytics charts)
 * 2. Financial Reports (compact grouped rows, owner only)
 * 3. Operational Reports (compact grouped rows)
 */
import { Permission } from '@timbertrail/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Page, ScreenHeader } from '../../../../components/header';
import { AnalyticsChart } from '../../../../components/reports/AnalyticsChart';
import { FinancialReportList } from '../../../../components/reports/FinancialReportList';
import { FinancialSummary } from '../../../../components/reports/FinancialSummary';
import { OperationalReportList } from '../../../../components/reports/OperationalReportList';
import { ReportPeriodSelector } from '../../../../components/reports/ReportPeriodSelector';
import { EmptyState, ErrorBox, Muted, SectionTitle, SkeletonList } from '../../../../components/ui';
import { periodQuery, presets } from '../../../../lib/format';
import { useLang, useT } from '../../../../lib/i18n';
import { useApi } from '../../../../lib/query';
import { useSession } from '../../../../lib/session';
import type { AccountsSummary, OwnerCharts, ReportInfo } from '../../../../lib/types';

export default function ReportsHome() {
  const t = useT();
  const { lang } = useLang();
  const router = useRouter();
  const { can } = useSession();
  const owner = can(Permission.FINANCE_VIEW);
  const [period, setPeriod] = useState(presets().thisMonth);

  const q = useApi<ReportInfo[]>(`/reports?lang=${lang}`);
  const money = useApi<AccountsSummary>(`/accounts/summary?${periodQuery(period)}`, { enabled: owner });
  const charts = useApi<OwnerCharts>('/dashboard/owner/charts', { enabled: owner });

  const openReport = (r: ReportInfo) =>
    router.push({
      pathname: '/reports/[key]',
      params: { key: r.key, title: r.title, from: period.from, to: period.to },
    });

  const operational = (q.data ?? []).filter((r) => r.group === 'operational');
  const financial = (q.data ?? []).filter((r) => r.group === 'financial');

  const refetchAll = () => {
    void q.refetch();
    if (owner) {
      void money.refetch();
      void charts.refetch();
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader compact title={t('reports')} />
      <Page
        compact
        bottomInset={false}
        refreshing={q.isRefetching || money.isRefetching}
        onRefresh={refetchAll}
      >
        {owner && (
          <View className="gap-3">
            <SectionTitle>{t('businessOverview')}</SectionTitle>
            <ReportPeriodSelector value={period} onChange={setPeriod} />
            <FinancialSummary
              pnl={money.data?.pnl}
              loading={money.isPending}
              error={money.error ? (money.error as Error).message : undefined}
              onRetry={() => void money.refetch()}
            />
            <SectionTitle>{t('financialAnalytics')}</SectionTitle>
            <AnalyticsChart
              cash={charts.data?.cash}
              pnl={money.data?.pnl}
              loading={charts.isPending || money.isPending}
            />
          </View>
        )}

        {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
        {q.isPending && <SkeletonList rows={4} />}
        {q.isSuccess && (q.data ?? []).length === 0 && <EmptyState icon="file-text" title={t('noData')} />}

        <FinancialReportList items={financial} onOpen={openReport} />
        <OperationalReportList
          items={operational}
          onOpen={openReport}
          onOpenInventory={() => router.push('/(app)/(tabs)/inventory')}
        />

        <Muted className="pt-1 text-center">{t('reportsSub')}</Muted>
      </Page>
    </View>
  );
}

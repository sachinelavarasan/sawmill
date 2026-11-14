import type { TKey } from '@sawmill/shared';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Page, ScreenHeader } from '../../../../components/header';
import { EmptyState, ErrorBox, type IconName, MenuGroup, MenuRow, Muted, Pill, SectionTitle, SkeletonList } from '../../../../components/ui';
import { useLang, useT } from '../../../../lib/i18n';
import { useApi } from '../../../../lib/query';
import type { ReportInfo } from '../../../../lib/types';

/** Subtitle and icon per report key (the titles come from the API, already translated). */
const META: Record<string, { sub?: TKey; icon: IconName }> = {
  imports: { sub: 'reportImportsSub', icon: 'download' },
  production: { sub: 'reportProductionSub', icon: 'settings' },
  exports: { sub: 'reportExportsSub', icon: 'upload' },
  stock: { sub: 'reportStockSub', icon: 'layers' },
  pnl: { sub: 'reportPnlSub', icon: 'trending-up' },
  payables: { sub: 'reportPayablesSub', icon: 'arrow-up-circle' },
  receivables: { sub: 'reportReceivablesSub', icon: 'arrow-down-circle' },
  expenses: { sub: 'reportExpensesSub', icon: 'credit-card' },
};

/** The reports this person may open — the API lists only those. */
export default function ReportsHome() {
  const t = useT();
  const { lang } = useLang();
  const router = useRouter();
  const q = useApi<ReportInfo[]>(`/reports?lang=${lang}`);
  const groups = (['operational', 'financial'] as const).map((g) => ({ g, items: (q.data ?? []).filter((r) => r.group === g) })).filter((x) => x.items.length);

  return (
    <>
      <ScreenHeader title={t('reports')} large />
      <Page bottomInset={false} refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
        <Muted>{t('reportsSub')}</Muted>
        {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
        {q.isPending && <SkeletonList rows={4} />}
        {q.isSuccess && groups.length === 0 && <EmptyState icon="file-text" title={t('noData')} />}
        {groups.map(({ g, items }) => (
          <View key={g} className="gap-3">
            <SectionTitle right={g === 'financial' ? <Pill icon="lock" text={t('ownerOnly')} /> : undefined}>
              {t(g === 'operational' ? 'operationalReports' : 'financialReports')}
            </SectionTitle>
            <MenuGroup>
              {items.map((r, n) => {
                const meta = META[r.key] ?? { icon: 'file-text' as IconName };
                return (
                  <MenuRow
                    key={r.key}
                    icon={meta.icon}
                    title={r.title}
                    subtitle={meta.sub ? t(meta.sub) : undefined}
                    last={n === items.length - 1}
                    onPress={() => router.push({ pathname: '/reports/[key]', params: { key: r.key, title: r.title } })}
                  />
                );
              })}
            </MenuGroup>
          </View>
        ))}
      </Page>
    </>
  );
}

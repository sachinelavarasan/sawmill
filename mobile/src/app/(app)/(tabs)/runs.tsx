/**
 * Production: today's output and the last 7 days (from the production report, all statuses),
 * runs by approval status (list totals per status), then every run — searchable, filterable.
 */
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { ProductionCard } from '../../../components/cards';
import { HeaderButton, ScreenHeader, StickyFooter } from '../../../components/header';
import { RecordList } from '../../../components/RecordList';
import { Text } from '../../../components/text';
import { BarChart, Button, Card, Donut, ErrorBox, HeroCard, HeroStats, LegendDot, SectionTitle, Skeleton } from '../../../components/ui';
import { dayNum, int, isoDay, num3, todayIso } from '../../../lib/format';
import { useLang, useT } from '../../../lib/i18n';
import { useApi } from '../../../lib/query';
import { useSimple } from '../../../lib/session';
import type { Paged, ProductionSummary, ReportData, Status } from '../../../lib/types';

const WEEK = 7;

function lastDays(n: number) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (n - 1 - i))));
}

export default function ProductionTab() {
  const t = useT();
  const simple = useSimple();
  const router = useRouter();
  const add = () => router.push('/production/new');
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={simple ? t('simpleCut') : t('production')} large right={<HeaderButton icon="plus" label={t('newProduction')} onPress={add} />} />
      <RecordList<ProductionSummary>
        path="/production"
        search={t('searchProduction')}
        statusFilter
        hero={<TodayHero />}
        header={<Summary />}
        renderItem={(i) => <ProductionCard item={i} />}
        empty={{ mod: 'cut', icon: 'factory', title: t('noProduction'), action: { label: t('newProduction'), onPress: add } }}
      />
      <StickyFooter tabBar>
        <Button icon="plus" title={t('newProduction')} onPress={add} />
      </StickyFooter>
    </View>
  );
}

function useStatusTotal(status: Status) {
  return useApi<Paged<ProductionSummary>>(`/production?status=${status}&take=1`).data?.total;
}

/** Today's output and the last seven days, on the navy (production report, all statuses). */
function TodayHero() {
  const t = useT();
  const { lang } = useLang();
  const days = useMemo(() => lastDays(WEEK), []);
  const today = todayIso();
  const report = useApi<ReportData>(`/reports/production?from=${days[0]}&to=${today}&status=ALL&lang=${lang}`);
  const byDay = useMemo(() => {
    const m = new Map<string, { out: number; runs: number }>();
    for (const r of report.data?.rows ?? []) {
      const d = String(r.productionDate ?? '').slice(0, 10);
      const x = m.get(d) ?? { out: 0, runs: 0 };
      x.out += Number(r.outputCft ?? 0);
      x.runs += 1;
      m.set(d, x);
    }
    return m;
  }, [report.data]);
  if (report.error) return <ErrorBox message={(report.error as Error).message} onRetry={() => void report.refetch()} />;
  if (report.isPending) return <Skeleton className="h-44 rounded-2xl opacity-20" />;
  const todayX = byDay.get(today);
  const totals = report.data?.totals ?? {};
  const weekIn = Number(totals.inputCft ?? 0);
  const weekOut = Number(totals.outputCft ?? 0);
  const recovery = weekIn > 0 ? Math.round((weekOut / weekIn) * 1000) / 10 : null;
  return (
    <HeroCard bare label={t('todayProduction')} value={num3(todayX?.out ?? 0)} unit="CFT" sub={t('runsCount', { n: todayX?.runs ?? 0 })} icon="factory">
      <BarChart onDark height={60} data={days.map((d) => ({ label: dayNum(d), values: [byDay.get(d)?.out ?? 0] }))} />
      <HeroStats
        items={[
          { label: t('lastSevenDays'), value: `${num3(weekOut)} CFT` },
          { label: t('recovery'), value: recovery != null ? `${recovery}%` : '—', accent: true },
          { label: t('wasteCft'), value: `${num3(Number(totals.wasteCft ?? 0))}` },
        ]}
      />
    </HeroCard>
  );
}

/** Runs by approval status. */
function Summary() {
  const t = useT();
  const counts = {
    APPROVED: useStatusTotal('APPROVED'),
    SUBMITTED: useStatusTotal('SUBMITTED'),
    DRAFT: useStatusTotal('DRAFT'),
    REJECTED: useStatusTotal('REJECTED'),
  };
  const countsReady = Object.values(counts).every((v) => v != null);
  const total = countsReady ? Object.values(counts).reduce<number>((sum, v) => sum + (v ?? 0), 0) : 0;

  return (
    <View className="gap-3 pb-2">
      <SectionTitle>{t('productionSummary')}</SectionTitle>
      {!countsReady ? (
        <Skeleton className="h-36 rounded-2xl" />
      ) : (
        <Card className="flex-row items-center gap-5">
          <Donut
            size={112}
            segments={[
              { value: counts.APPROVED ?? 0, color: 'success' },
              { value: counts.SUBMITTED ?? 0, color: 'saffron' },
              { value: counts.DRAFT ?? 0, color: 'muted' },
              { value: counts.REJECTED ?? 0, color: 'destructive' },
            ]}
            center={
              <View className="items-center">
                <Text className="text-xl font-bold tabular-nums text-foreground font-display">{int(total)}</Text>
                <Text className="text-[11px] text-muted-foreground">{t('runs')}</Text>
              </View>
            }
          />
          <View className="flex-1 gap-2.5">
            <LegendDot className="bg-success" label={t('approved')} value={int(counts.APPROVED ?? 0)} />
            <LegendDot className="bg-saffron" label={t('pending')} value={int(counts.SUBMITTED ?? 0)} />
            <LegendDot className="bg-muted-foreground" label={t('draft')} value={int(counts.DRAFT ?? 0)} />
            <LegendDot className="bg-destructive" label={t('rejected')} value={int(counts.REJECTED ?? 0)} />
          </View>
        </Card>
      )}

      <SectionTitle>{t('allRuns')}</SectionTitle>
    </View>
  );
}

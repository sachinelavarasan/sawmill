/**
 * Home: the dashboard for whoever is signed in.
 * Owner — headline figures, what waits for approval, money for a chosen period, sales and
 *         wood-flow charts, recent records.
 * Accountant — today's entries and their status, own measuring, loads still being measured.
 * Never shows the accountant prices, sales, expenses or profit (the API refuses them anyway).
 */
import { Permission } from '@timbertrail/shared';
import { useRouter } from 'expo-router';
import { ReactNode, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExportCard, ImportCard, MovementRow, ProductionCard } from '../../../components/cards';
import { HeaderButton, SHEET_TOP } from '../../../components/header';
import { Appear, Tap } from '../../../components/motion';
import { ProfileSheet } from '../../../components/ProfileSheet';
import { QuickAddSheet } from '../../../components/QuickAddSheet';
import { PeriodPicker, useSheet } from '../../../components/sheet';
import { Text } from '../../../components/text';
import {
  Avatar,
  BarChart,
  Card,
  cn,
  CountBadge,
  Donut,
  EmptyState,
  ErrorBox,
  Grid,
  HeroCard,
  Icon,
  type IconName,
  Kpi,
  KV,
  LegendDot,
  MenuGroup,
  Muted,
  Pill,
  refresher,
  SectionTitle,
  Segmented,
  Skeleton,
  SkeletonGrid,
  SkeletonList,
} from '../../../components/ui';
import { dateOnly, dayNum, inr, inrShort, int, monthShort, num3, PERIOD_KEYS, periodQuery, presets, todayIso } from '../../../lib/format';
import { useT } from '../../../lib/i18n';
import type { ImportSummary } from '../../../lib/imports-api';
import { QUICK_ADD, visible } from '../../../lib/nav';
import { useApi } from '../../../lib/query';
import { useSession, useUser } from '../../../lib/session';
import type {
  AccountantCharts,
  AccountantDashboard,
  AccountsSummary,
  ExportSummary,
  Movement,
  OwnerCharts,
  OwnerDashboard,
  Paged,
  ProductionSummary,
} from '../../../lib/types';

export default function HomeScreen() {
  const { can } = useSession();
  return can(Permission.DASHBOARD_OWNER) ? <OwnerHome /> : <AccountantHome />;
}

// ───────── shared frame ─────────

function greetingKey() {
  const h = new Date().getHours();
  return h < 12 ? 'goodMorning' : h < 17 ? 'goodAfternoon' : 'goodEvening';
}

/**
 * Navy band with the greeting, the mill, the bell and the profile. It scrolls with the
 * page; the figures below overlap its lower edge.
 */
function HomeHero({ pending, children }: { pending?: number; children?: ReactNode }) {
  const t = useT();
  const user = useUser();
  const router = useRouter();
  const profile = useSheet();
  return (
    <View className="gap-6 px-5 pb-8 pt-3">
      <View className="flex-row items-center gap-3">
        <Image source={require('../../../../assets/icon-dark.png')} className="h-10 w-10 rounded-xl" accessible={false} />
        <View className="flex-1">
          <Text className="text-[13px] text-hero-muted" numberOfLines={1}>
            {t(greetingKey())},
          </Text>
          <Text className="text-xl font-bold tracking-tight text-hero-foreground" numberOfLines={1} accessibilityRole="header">
            {user.name}
          </Text>
        </View>
        {pending !== undefined && (
          <HeaderButton icon="bell" label={t('notifications')} onPress={() => router.push('/more/approvals')} badge={pending ? <CountBadge n={pending} onDark /> : undefined} />
        )}
        <Pressable onPress={profile.open} accessibilityRole="button" accessibilityLabel={t('profile')} className="h-11 w-11 items-center justify-center rounded-full active:opacity-80">
          <Avatar name={user.name} size="sm" tone="saffron" />
        </Pressable>
      </View>
      <View className="-mt-2 flex-row items-center gap-2 self-start rounded-full bg-hero-chip py-1.5 pl-2.5 pr-3.5">
        <Icon name="building" size={14} colorClassName="accent-saffron" />
        <Text className="text-[13px] font-medium text-hero-foreground" numberOfLines={1}>
          {user.mill.name}
        </Text>
      </View>
      {children}
      <ProfileSheet ref={profile.ref} />
    </View>
  );
}

function Body({ hero, children, refreshing, onRefresh }: { hero: ReactNode; children: ReactNode; refreshing: boolean; onRefresh: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-hero">
      {/* the status-bar strip stays navy while the hero scrolls away under it */}
      <View className="bg-hero" style={{ height: insets.top }} />
      <ScrollView className="flex-1 bg-hero" contentContainerClassName="grow" refreshControl={refresher(refreshing, onRefresh)}>
        {hero}
        <View className={cn('grow gap-3 px-4 pb-10 pt-6', SHEET_TOP)}>{children}</View>
      </ScrollView>
    </View>
  );
}

/** "3 entries wait for your approval" banner. */
function AttentionBanner({ icon, text, onPress, tone }: { icon: IconName; text: string; onPress: () => void; tone: 'warn' | 'bad' }) {
  return (
    <Tap
      scale={0.98}
      onPress={onPress}
      accessibilityRole="button"
      className={cn('flex-row items-center gap-3 rounded-2xl border p-3.5 active:opacity-85', tone === 'warn' ? 'border-saffron/40 bg-saffron-soft' : 'border-destructive/30 bg-destructive-soft')}
    >
      <View className={cn('h-10 w-10 items-center justify-center rounded-xl', tone === 'warn' ? 'bg-saffron' : 'bg-destructive')}>
        <Icon name={icon} size={18} colorClassName={tone === 'warn' ? 'accent-saffron-foreground' : 'accent-white'} />
      </View>
      <Text className={cn('flex-1 text-[15px] font-semibold', tone === 'warn' ? 'text-foreground' : 'text-destructive')}>{text}</Text>
      <Icon name="chevron-right" size={18} colorClassName={tone === 'warn' ? 'accent-foreground' : 'accent-destructive'} />
    </Tap>
  );
}

/** Four shortcuts in one card; the last one opens the full Quick Add sheet. */
function QuickActions() {
  const t = useT();
  const router = useRouter();
  const { can } = useSession();
  const quick = useSheet();
  const items = QUICK_ADD.filter((i) => visible(i, can)).slice(0, 3);
  if (!items.length) return null;
  const action = (key: string, icon: IconName, label: string, onPress: () => void, accent?: boolean) => (
    <Tap key={key} scale={0.92} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} className="min-h-[84px] flex-1 items-center gap-2 rounded-xl px-1 py-2 active:bg-secondary">
      <View className={cn('h-12 w-12 items-center justify-center rounded-2xl', accent ? 'bg-saffron' : 'bg-saffron-soft')}>
        <Icon name={icon} size={21} colorClassName={accent ? 'accent-saffron-foreground' : 'accent-saffron-strong'} />
      </View>
      <Text className="text-center text-xs font-medium leading-4 text-foreground" numberOfLines={2}>
        {label}
      </Text>
    </Tap>
  );
  return (
    <>
      <SectionTitle>{t('quickActions')}</SectionTitle>
      <Appear index={2} className="-mx-1 flex-row">
        {items.map((i) => action(i.key, i.icon, t(i.labelKey), () => router.push(i.href as never)))}
        {action('more', 'plus', t('quickAdd'), quick.open, true)}
      </Appear>
      <QuickAddSheet ref={quick.ref} />
    </>
  );
}

/** Imports | Production | Exports — the latest three of whichever is picked. */
function RecentRecords({
  imports,
  production,
  exports,
}: {
  imports?: { data?: Paged<ImportSummary>; isPending: boolean };
  production: { data?: Paged<ProductionSummary>; isPending: boolean };
  exports: { data?: Paged<ExportSummary>; isPending: boolean };
}) {
  const t = useT();
  const router = useRouter();
  const [tab, setTab] = useState<'imports' | 'production' | 'exports'>(imports ? 'imports' : 'production');
  const href = { imports: '/more/imports', production: '/runs', exports: '/more/exports' }[tab];
  const q = tab === 'imports' ? imports! : tab === 'production' ? production : exports;
  const items = (q.data?.items ?? []).slice(0, 3);
  const empty = { imports: t('noImports'), production: t('noProduction'), exports: t('noExports') }[tab];
  return (
    <>
      <SectionTitle action={{ label: t('viewAll'), onPress: () => router.push(href as never) }}>{t('recentEntries')}</SectionTitle>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          ...(imports ? [{ value: 'imports' as const, label: t('imports') }] : []),
          { value: 'production' as const, label: t('production') },
          { value: 'exports' as const, label: t('exports') },
        ]}
      />
      {q.isPending ? (
        <SkeletonList rows={2} />
      ) : items.length === 0 ? (
        <EmptyState icon={tab === 'imports' ? 'download' : tab === 'production' ? 'settings' : 'upload'} title={empty} />
      ) : (
        items.map((i) =>
          tab === 'imports' ? (
            <ImportCard key={i.id} item={i as ImportSummary} />
          ) : tab === 'production' ? (
            <ProductionCard key={i.id} item={i as ProductionSummary} />
          ) : (
            <ExportCard key={i.id} item={i as ExportSummary} />
          ),
        )
      )}
    </>
  );
}

/** Card with a title row, a legend, and a chart. */
function ChartCard({ title, sub, legend, children }: { title: string; sub?: string; legend?: ReactNode; children: ReactNode }) {
  return (
    <Appear>
      <Card className="gap-4">
        <View className="gap-0.5">
          <Text className="text-[15px] font-semibold text-foreground">{title}</Text>
          {!!sub && <Muted>{sub}</Muted>}
        </View>
        {legend}
        {children}
      </Card>
    </Appear>
  );
}

// ───────── owner ─────────

function OwnerHome() {
  const t = useT();
  const router = useRouter();
  const [period, setPeriod] = useState(presets().thisMonth);

  const dash = useApi<OwnerDashboard>('/dashboard/owner');
  const charts = useApi<OwnerCharts>('/dashboard/owner/charts');
  const money = useApi<AccountsSummary>(`/accounts/summary?${periodQuery(period)}`);
  const imports = useApi<Paged<ImportSummary>>('/imports?take=5');
  const production = useApi<Paged<ProductionSummary>>('/production?take=30');
  const exports = useApi<Paged<ExportSummary>>('/exports?take=5');
  const movements = useApi<Paged<Movement>>('/stock/movements?take=5');

  const k = dash.data?.kpis;
  const today = todayIso();
  const todayRuns = production.data?.items.filter((p) => p.productionDate.slice(0, 10) === today);
  const todayOutput = todayRuns?.reduce((s, p) => s + p.outputCft, 0) ?? 0;
  const pnl = money.data?.pnl;
  const p = presets();
  const periodKey = PERIOD_KEYS.find((x) => p[x].from === period.from && p[x].to === period.to);
  const periodLabel = periodKey ? t(periodKey) : `${dateOnly(period.from)} – ${dateOnly(period.to)}`;
  const loss = !!pnl && pnl.profit < 0;
  const cash = charts.data?.cash ?? [];
  const flow = (charts.data?.flow ?? []).slice(-14);
  const refreshing = dash.isRefetching || money.isRefetching || charts.isRefetching;
  const refresh = () => {
    for (const q of [dash, charts, money, imports, production, exports, movements]) void q.refetch();
  };

  return (
    <Body
      hero={
        <HomeHero pending={k?.pendingApprovals ?? 0}>
          {!k ? (
            <Skeleton className="h-40 rounded-2xl opacity-20" />
          ) : (
            <Appear>
              <HeroCard
                bare
                label={t('totalStock')}
                value={num3(k.rawStockCft + k.finishedStockCft)}
                unit="CFT"
                sub={`${t('raw')} ${num3(k.rawStockCft)} · ${t('finished')} ${num3(k.finishedStockCft)}`}
                onPress={() => router.push('/inventory')}
              >
                {flow.some((f) => f.receivedCft || f.shippedCft) && (
                  <View className="gap-3">
                    <BarChart onDark height={56} labelEvery={3} data={flow.map((f) => ({ label: dayNum(f.day), values: [f.receivedCft, f.shippedCft] }))} />
                    <View className="flex-row gap-5">
                      <LegendDot onDark className="bg-saffron" label={t('receivedCft')} />
                      <LegendDot onDark className="bg-hero-muted" label={t('shippedCft')} />
                    </View>
                  </View>
                )}
              </HeroCard>
            </Appear>
          )}
        </HomeHero>
      }
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {!k ? (
        <SkeletonGrid tiles={4} />
      ) : (
        <Appear index={0}>
          <Grid>
            <Kpi icon="trending-up" label={t('sales')} value={pnl ? inrShort(pnl.sales) : '—'} hint={periodLabel} onPress={() => router.push('/more/accounts')} />
            <Kpi icon="wallet" label={t('outstandingBalances')} value={inrShort(k.pendingReceivables)} tone={k.pendingReceivables ? 'warn' : undefined} onPress={() => router.push('/more/accounts')} />
            <Kpi icon="clock" label={t('pendingPayments')} value={inrShort(k.pendingPayables)} tone={k.pendingPayables ? 'warn' : undefined} onPress={() => router.push('/more/accounts')} />
            <Kpi
              icon="factory"
              label={t('todayProduction')}
              value={todayRuns ? num3(todayOutput) : '—'}
              unit="CFT"
              hint={todayRuns ? t('runsCount', { n: todayRuns.length }) : undefined}
              onPress={() => router.push('/runs')}
            />
          </Grid>
        </Appear>
      )}
      {dash.error && <ErrorBox message={(dash.error as Error).message} onRetry={() => void dash.refetch()} />}

      {!!k?.pendingApprovals && (
        <Appear index={1}>
          <AttentionBanner icon="check-circle" tone="warn" text={t('approvalsWaiting', { n: k.pendingApprovals })} onPress={() => router.push('/more/approvals')} />
        </Appear>
      )}

      <QuickActions />

      <SectionTitle right={<Pill icon="lock" text={t('ownerOnly')} />}>{t('financialOverview')}</SectionTitle>
      <PeriodPicker value={period} onChange={setPeriod} />
      {money.error && <ErrorBox message={(money.error as Error).message} onRetry={() => void money.refetch()} />}
      {!pnl || !k ? (
        <Skeleton className="h-44 rounded-2xl" />
      ) : (
        <HeroCard label={loss ? t('netLoss') : t('netProfit')} value={inr(pnl.profit)} icon={loss ? 'trending-down' : 'trending-up'} onPress={() => router.push('/more/accounts')}>
          <View className="flex-row gap-3 border-t border-hero-border pt-4">
            {[
              { label: t('sales'), value: inrShort(pnl.sales) },
              { label: t('totalExpenses'), value: inrShort(pnl.totalExpenses) },
              { label: t('outstandingBalances'), value: inrShort(k.pendingReceivables) },
            ].map((x) => (
              <View key={x.label} className="flex-1 gap-0.5">
                <Text className="text-[11px] text-hero-muted" numberOfLines={1}>
                  {x.label}
                </Text>
                <Text className="text-[15px] font-semibold tabular-nums text-hero-foreground" numberOfLines={1} adjustsFontSizeToFit>
                  {x.value}
                </Text>
              </View>
            ))}
          </View>
        </HeroCard>
      )}

      <SectionTitle>{t('analytics')}</SectionTitle>
      {charts.error && <ErrorBox message={(charts.error as Error).message} onRetry={() => void charts.refetch()} />}
      {charts.isPending ? (
        <Skeleton className="h-56 rounded-2xl" />
      ) : (
        <>
          <ChartCard
            title={t('chartCashTitle')}
            sub={t('chartCashSub')}
            legend={
              <View className="flex-row gap-5">
                <LegendDot className="bg-saffron" label={t('sales')} />
                <LegendDot className="bg-chart-2" label={t('expensesHead')} />
              </View>
            }
          >
            {cash.some((c) => c.sales || c.expenses) ? (
              <BarChart
                data={cash.map((c) => ({ label: monthShort(c.month), values: [c.sales, c.expenses] }))}
                accessibilityLabel={cash.map((c) => `${monthShort(c.month)}: ${inr(c.sales)} / ${inr(c.expenses)}`).join(', ')}
              />
            ) : (
              <Muted>{t('noChartData')}</Muted>
            )}
          </ChartCard>
        </>
      )}

      <RecentRecords imports={imports} production={production} exports={exports} />

      <SectionTitle action={{ label: t('viewAll'), onPress: () => router.push('/inventory') }}>{t('recentActivity')}</SectionTitle>
      {movements.isPending ? (
        <SkeletonList rows={2} />
      ) : !movements.data?.items.length ? (
        <EmptyState icon="activity" title={t('noMovements')} />
      ) : (
        <MenuGroup>
          {movements.data.items.map((m, i, all) => (
            <MovementRow key={m.id} m={m} last={i === all.length - 1} />
          ))}
        </MenuGroup>
      )}
    </Body>
  );
}

// ───────── accountant ─────────

function AccountantHome() {
  const t = useT();
  const router = useRouter();
  const dash = useApi<AccountantDashboard>('/dashboard/accountant');
  const charts = useApi<AccountantCharts>('/dashboard/accountant/charts');
  const production = useApi<Paged<ProductionSummary>>('/production?take=5');
  const exports = useApi<Paged<ExportSummary>>('/exports?take=5');
  const k = dash.data?.kpis;
  const progress = dash.data?.measurementProgress ?? [];
  const logs = charts.data?.logsByDay ?? [];
  const statusTotal = k ? k.draftEntries + k.pendingSubmissions + k.approvedEntries + k.rejectedEntries : 0;

  return (
    <Body
      hero={
        <HomeHero>
          {logs.length > 0 && (
            <Appear>
              <HeroCard bare label={t('chartLogsTitle')} value={int(logs.reduce((sum, l) => sum + l.logs, 0))} unit={t('logs')} sub={t('chartLogsSub')}>
                {logs.some((l) => l.logs) && <BarChart onDark height={56} labelEvery={2} data={logs.map((l) => ({ label: dayNum(l.day), values: [l.logs] }))} />}
              </HeroCard>
            </Appear>
          )}
        </HomeHero>
      }
      refreshing={dash.isRefetching}
      onRefresh={() => {
        for (const q of [dash, charts, production, exports]) void q.refetch();
      }}
    >
      {!k ? (
        <SkeletonGrid tiles={4} />
      ) : (
        <Appear index={0}>
          <Grid>
            <Kpi icon="download" label={t('todayImports')} value={int(k.todayImports)} onPress={() => router.push('/more/imports')} />
            <Kpi icon="upload" label={t('todayExports')} value={int(k.todayExports)} onPress={() => router.push('/more/exports')} />
            <Kpi icon="clock" label={t('pendingSubmissions')} value={int(k.pendingSubmissions)} tone={k.pendingSubmissions ? 'warn' : undefined} />
            <Kpi icon="x-circle" label={t('rejectedEntries')} value={int(k.rejectedEntries)} tone={k.rejectedEntries ? 'bad' : undefined} />
          </Grid>
        </Appear>
      )}
      {dash.error && <ErrorBox message={(dash.error as Error).message} onRetry={() => void dash.refetch()} />}

      {!!k?.rejectedEntries && (
        <Appear index={1}>
          <AttentionBanner icon="alert-triangle" tone="bad" text={t('needsCorrection', { n: k.rejectedEntries })} onPress={() => router.push('/more/imports')} />
        </Appear>
      )}

      <QuickActions />

      <SectionTitle>{t('entryStatus')}</SectionTitle>
      {!k ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : (
        <Card className="flex-row items-center gap-5">
          <Donut
            size={116}
            segments={[
              { value: k.approvedEntries, color: 'success' },
              { value: k.pendingSubmissions, color: 'saffron' },
              { value: k.draftEntries, color: 'muted' },
              { value: k.rejectedEntries, color: 'destructive' },
            ]}
            center={
              <View className="items-center">
                <Text className="text-xl font-bold tabular-nums text-foreground">{int(statusTotal)}</Text>
                <Text className="text-[11px] text-muted-foreground">{t('entries')}</Text>
              </View>
            }
          />
          <View className="flex-1 gap-2.5">
            <LegendDot className="bg-success" label={t('approved')} value={int(k.approvedEntries)} />
            <LegendDot className="bg-saffron" label={t('pending')} value={int(k.pendingSubmissions)} />
            <LegendDot className="bg-muted-foreground" label={t('draft')} value={int(k.draftEntries)} />
            <LegendDot className="bg-destructive" label={t('rejected')} value={int(k.rejectedEntries)} />
          </View>
        </Card>
      )}


      <SectionTitle action={{ label: t('viewAll'), onPress: () => router.push('/more/measurement') }}>{t('measurementProgress')}</SectionTitle>
      {dash.isPending ? (
        <SkeletonList rows={2} />
      ) : progress.length === 0 ? (
        <EmptyState icon="edit-3" title={t('noOpenLoads')} action={{ label: t('newImport'), onPress: () => router.push('/imports/new') }} />
      ) : (
        progress.slice(0, 4).map((l) => (
          <ImportCard key={l.id} measure item={{ ...l, arrivalAt: '', totalLogs: l.totalLogs, createdByName: '', updatedAt: '' } as ImportSummary} />
        ))
      )}

      <RecentRecords production={production} exports={exports} />
    </Body>
  );
}

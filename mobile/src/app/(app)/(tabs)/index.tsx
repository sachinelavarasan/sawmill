/**
 * Home: the dashboard for whoever is signed in.
 * Owner — today's wood, money for a chosen period, what waits for approval, recent records.
 * Accountant — today's entries and their status, loads still being measured, quick actions.
 * Never shows the accountant prices, sales, expenses or profit (the API refuses them anyway).
 */
import { Permission } from '@sawmill/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExportCard, ImportCard, MovementRow, ProductionCard } from '../../../components/cards';
import { HeaderButton } from '../../../components/header';
import { ProfileSheet } from '../../../components/ProfileSheet';
import { PeriodPicker, useSheet } from '../../../components/sheet';
import {
  Avatar,
  cn,
  CountBadge,
  EmptyState,
  ErrorBox,
  Grid,
  Icon,
  type IconName,
  Kpi,
  MenuGroup,
  Pill,
  refresher,
  SectionTitle,
  Skeleton,
  SkeletonGrid,
  SkeletonList,
} from '../../../components/ui';
import { inr, int, num3, periodQuery, presets, todayIso } from '../../../lib/format';
import { useT } from '../../../lib/i18n';
import type { ImportSummary } from '../../../lib/imports-api';
import { useApi } from '../../../lib/query';
import { useSession, useUser } from '../../../lib/session';
import type { AccountantDashboard, AccountsSummary, ExportSummary, Movement, OwnerDashboard, Paged, ProductionSummary } from '../../../lib/types';

export default function HomeScreen() {
  const { can } = useSession();
  return can(Permission.DASHBOARD_OWNER) ? <OwnerHome /> : <AccountantHome />;
}

// ───────── shared header ─────────

function greetingKey() {
  const h = new Date().getHours();
  return h < 12 ? 'goodMorning' : h < 17 ? 'goodAfternoon' : 'goodEvening';
}

function HomeHeader({ pending }: { pending?: number }) {
  const t = useT();
  const user = useUser();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useSheet();
  return (
    <View className="border-b border-border bg-card" style={{ paddingTop: insets.top }}>
      <View className="min-h-16 flex-row items-center gap-3 pl-4 pr-2">
        <Image source={require('../../../../assets/icon.png')} className="h-10 w-10 rounded-lg" accessible={false} />
        <View className="flex-1">
          <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
            {t(greetingKey())}, {user.name.split(' ')[0]}
          </Text>
          <Text className="text-[17px] font-bold text-foreground" numberOfLines={1} accessibilityRole="header">
            {user.mill.name}
          </Text>
        </View>
        {pending !== undefined && (
          <HeaderButton icon="bell" label={t('notifications')} onPress={() => router.push('/transactions/approvals')} badge={pending ? <CountBadge n={pending} /> : undefined} />
        )}
        <Pressable onPress={profile.open} accessibilityRole="button" accessibilityLabel={t('profile')} className="h-11 w-11 items-center justify-center rounded-full active:bg-secondary">
          <Avatar name={user.name} size="sm" />
        </Pressable>
      </View>
      <ProfileSheet ref={profile.ref} />
    </View>
  );
}

function Body({ children, refreshing, onRefresh }: { children: React.ReactNode; refreshing: boolean; onRefresh: () => void }) {
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-3 p-4 pb-8" refreshControl={refresher(refreshing, onRefresh)}>
      {children}
    </ScrollView>
  );
}

/** "3 entries wait for your approval" banner. */
function AttentionBanner({ icon, text, onPress, tone }: { icon: IconName; text: string; onPress: () => void; tone: 'warn' | 'bad' }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={cn('flex-row items-center gap-3 rounded-xl p-3.5 active:opacity-85', tone === 'warn' ? 'bg-saffron-soft' : 'bg-destructive-soft')}
    >
      <View className={cn('h-10 w-10 items-center justify-center rounded-full', tone === 'warn' ? 'bg-saffron' : 'bg-destructive')}>
        <Icon name={icon} size={18} colorClassName={tone === 'warn' ? 'accent-saffron-foreground' : 'accent-card'} />
      </View>
      <Text className={cn('flex-1 text-[15px] font-semibold', tone === 'warn' ? 'text-warning' : 'text-destructive')}>{text}</Text>
      <Icon name="chevron-right" size={18} colorClassName={tone === 'warn' ? 'accent-warning' : 'accent-destructive'} />
    </Pressable>
  );
}

function RecentList<T extends { id: string }>({
  title,
  href,
  query,
  render,
  emptyText,
}: {
  title: string;
  href: string;
  query: { data?: Paged<T>; isPending: boolean; error: unknown };
  render: (item: T) => React.ReactElement;
  emptyText: string;
}) {
  const t = useT();
  const router = useRouter();
  const items = query.data?.items.slice(0, 3) ?? [];
  return (
    <>
      <SectionTitle action={{ label: t('viewAll'), onPress: () => router.push(href as never) }}>{title}</SectionTitle>
      {query.isPending ? (
        <SkeletonList rows={2} />
      ) : items.length === 0 ? (
        <Text className="text-[13px] text-muted-foreground">{emptyText}</Text>
      ) : (
        items.map((i) => <View key={i.id}>{render(i)}</View>)
      )}
    </>
  );
}

// ───────── owner ─────────

function OwnerHome() {
  const t = useT();
  const router = useRouter();
  const [period, setPeriod] = useState(presets().thisMonth);

  const dash = useApi<OwnerDashboard>('/dashboard/owner');
  const money = useApi<AccountsSummary>(`/accounts/summary?${periodQuery(period)}`);
  const imports = useApi<Paged<ImportSummary>>('/imports?take=5');
  const production = useApi<Paged<ProductionSummary>>('/production?take=30');
  const exports = useApi<Paged<ExportSummary>>('/exports?take=5');
  const movements = useApi<Paged<Movement>>('/stock/movements?take=5');

  const k = dash.data?.kpis;
  const today = todayIso();
  const todayProduction = production.data?.items.filter((p) => p.productionDate.slice(0, 10) === today).length;
  const pnl = money.data?.pnl;
  const loss = !!pnl && pnl.profit < 0;
  const refreshing = dash.isRefetching || money.isRefetching;
  const refresh = () => {
    void dash.refetch();
    void money.refetch();
    void imports.refetch();
    void production.refetch();
    void exports.refetch();
    void movements.refetch();
  };

  return (
    <View className="flex-1 bg-background">
      <HomeHeader pending={k?.pendingApprovals ?? 0} />
      <Body refreshing={refreshing} onRefresh={refresh}>
        {dash.error && <ErrorBox message={(dash.error as Error).message} onRetry={() => void dash.refetch()} />}

        {!!k?.pendingApprovals && (
          <AttentionBanner icon="check-circle" tone="warn" text={t('approvalsWaiting', { n: k.pendingApprovals })} onPress={() => router.push('/transactions/approvals')} />
        )}

        <SectionTitle>{t('businessOverview')}</SectionTitle>
        {!k ? (
          <SkeletonGrid tiles={6} />
        ) : (
          <Grid>
            <Kpi icon="layers" label={t('rawStock')} value={num3(k.rawStockCft)} unit="CFT" onPress={() => router.push('/more/stock')} />
            <Kpi icon="package" label={t('finishedStock')} value={num3(k.finishedStockCft)} unit="CFT" onPress={() => router.push('/more/stock')} />
            <Kpi icon="download" label={t('todayImports')} value={int(k.todayImports)} onPress={() => router.push('/transactions/imports')} />
            <Kpi icon="settings" label={t('todayProduction')} value={todayProduction != null ? int(todayProduction) : '—'} onPress={() => router.push('/transactions/production')} />
            <Kpi icon="upload" label={t('todayExports')} value={int(k.todayExports)} onPress={() => router.push('/transactions/exports')} />
            <Kpi icon="truck" label={t('totalImportLoads')} value={int(k.totalImportLoads)} onPress={() => router.push('/transactions/imports')} />
          </Grid>
        )}

        <SectionTitle right={<Pill icon="lock" text={t('ownerOnly')} />}>{t('financialOverview')}</SectionTitle>
        <PeriodPicker value={period} onChange={setPeriod} />
        {money.error && <ErrorBox message={(money.error as Error).message} onRetry={() => void money.refetch()} />}
        {!pnl ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : (
          <Pressable
            onPress={() => router.push('/more/accounts')}
            accessibilityRole="button"
            className={cn('gap-1 rounded-xl p-4 active:opacity-90', loss ? 'bg-destructive-soft' : 'bg-primary')}
          >
            <View className="flex-row items-center justify-between">
              <Text className={cn('text-[13px] font-medium', loss ? 'text-destructive' : 'text-primary-foreground opacity-85')}>
                {loss ? t('netLoss') : t('netProfit')}
              </Text>
              <Icon name="chevron-right" size={16} colorClassName={loss ? 'accent-destructive' : 'accent-primary-foreground'} />
            </View>
            <Text className={cn('text-3xl font-bold tabular-nums', loss ? 'text-destructive' : 'text-primary-foreground')}>{inr(pnl.profit)}</Text>
          </Pressable>
        )}
        {!pnl || !k ? (
          <SkeletonGrid tiles={4} />
        ) : (
          <Grid>
            <Kpi label={t('sales')} value={inr(pnl.sales)} onPress={() => router.push('/more/accounts')} />
            <Kpi label={t('totalExpenses')} value={inr(pnl.totalExpenses)} onPress={() => router.push('/more/accounts')} />
            <Kpi label={t('pendingPayments')} value={inr(k.pendingPayables)} tone={k.pendingPayables ? 'warn' : undefined} onPress={() => router.push('/more/accounts')} />
            <Kpi label={t('outstandingBalances')} value={inr(k.pendingReceivables)} tone={k.pendingReceivables ? 'warn' : undefined} onPress={() => router.push('/more/accounts')} />
          </Grid>
        )}

        <RecentList title={t('recentImports')} href="/transactions/imports" query={imports} emptyText={t('noImports')} render={(i) => <ImportCard item={i} />} />
        <RecentList title={t('recentProduction')} href="/transactions/production" query={production} emptyText={t('noProduction')} render={(i) => <ProductionCard item={i} />} />
        <RecentList title={t('recentExports')} href="/transactions/exports" query={exports} emptyText={t('noExports')} render={(i) => <ExportCard item={i} />} />

        <SectionTitle action={{ label: t('viewAll'), onPress: () => router.push('/more/stock') }}>{t('recentMovements')}</SectionTitle>
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
    </View>
  );
}

// ───────── accountant ─────────

function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="min-h-[84px] flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card p-2 active:bg-secondary">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-saffron-soft">
        <Icon name={icon} size={19} colorClassName="accent-warning" />
      </View>
      <Text className="text-center text-xs font-semibold text-foreground" numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

function AccountantHome() {
  const t = useT();
  const router = useRouter();
  const dash = useApi<AccountantDashboard>('/dashboard/accountant');
  const production = useApi<Paged<ProductionSummary>>('/production?take=5');
  const exports = useApi<Paged<ExportSummary>>('/exports?take=5');
  const k = dash.data?.kpis;
  const progress = dash.data?.measurementProgress ?? [];

  return (
    <View className="flex-1 bg-background">
      <HomeHeader />
      <Body
        refreshing={dash.isRefetching}
        onRefresh={() => {
          void dash.refetch();
          void production.refetch();
          void exports.refetch();
        }}
      >
        {dash.error && <ErrorBox message={(dash.error as Error).message} onRetry={() => void dash.refetch()} />}

        {!!k?.rejectedEntries && (
          <AttentionBanner icon="alert-triangle" tone="bad" text={t('needsCorrection', { n: k.rejectedEntries })} onPress={() => router.push('/transactions/imports')} />
        )}

        <View className="flex-row gap-2.5">
          <QuickAction icon="download" label={t('newImport')} onPress={() => router.push('/imports/new')} />
          <QuickAction icon="edit-3" label={t('measure')} onPress={() => router.push('/transactions/measurement')} />
          <QuickAction icon="settings" label={t('newProduction')} onPress={() => router.push('/production/new')} />
          <QuickAction icon="upload" label={t('newExport')} onPress={() => router.push('/exports/new')} />
        </View>

        <SectionTitle>{t('today')}</SectionTitle>
        {!k ? (
          <SkeletonGrid tiles={6} />
        ) : (
          <Grid>
            <Kpi icon="download" label={t('todayImports')} value={int(k.todayImports)} onPress={() => router.push('/transactions/imports')} />
            <Kpi icon="upload" label={t('todayExports')} value={int(k.todayExports)} onPress={() => router.push('/transactions/exports')} />
            <Kpi icon="edit" label={t('draftEntries')} value={int(k.draftEntries)} />
            <Kpi icon="clock" label={t('pendingSubmissions')} value={int(k.pendingSubmissions)} tone={k.pendingSubmissions ? 'warn' : undefined} />
            <Kpi icon="check-circle" label={t('approvedEntries')} value={int(k.approvedEntries)} tone="good" />
            <Kpi icon="x-circle" label={t('rejectedEntries')} value={int(k.rejectedEntries)} tone={k.rejectedEntries ? 'bad' : undefined} />
          </Grid>
        )}

        <SectionTitle action={{ label: t('viewAll'), onPress: () => router.push('/transactions/measurement') }}>{t('measurementProgress')}</SectionTitle>
        {dash.isPending ? (
          <SkeletonList rows={2} />
        ) : progress.length === 0 ? (
          <EmptyState icon="edit-3" title={t('noOpenLoads')} action={{ label: t('newImport'), onPress: () => router.push('/imports/new') }} />
        ) : (
          progress.slice(0, 4).map((l) => (
            <ImportCard
              key={l.id}
              measure
              item={{ ...l, arrivalAt: '', totalLogs: l.totalLogs, createdByName: '', updatedAt: '' } as ImportSummary}
            />
          ))
        )}

        <RecentList title={t('recentProduction')} href="/transactions/production" query={production} emptyText={t('noProduction')} render={(i) => <ProductionCard item={i} />} />
        <RecentList title={t('recentExports')} href="/transactions/exports" query={exports} emptyText={t('noExports')} render={(i) => <ExportCard item={i} />} />
      </Body>
    </View>
  );
}

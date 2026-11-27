/**
 * Home: the dashboard for whoever is signed in, in sections of falling priority.
 *
 * Owner — stock on the band; key metrics (wood received / shipped this week with the change on
 *         the week before, receivables, payables); quick actions; what waits for approval; money
 *         for a chosen period; today's operations and the 14-day flow; recent records.
 * Accountant — today's loads on the band; corrections to make; own measuring this week (with the
 *         change on the week before), drafts and submissions; quick actions; loads still being
 *         measured; entry status; own recent records (the API returns only theirs).
 *
 * Which sections show, and in what order, is each person's preference (Preferences → Dashboard);
 * a hidden section's data isn't fetched, and a section the role or permissions don't allow is
 * never shown, whatever is stored.
 *
 * Every figure comes from the API. A trend is shown only where the API returns both windows
 * (the zero-filled daily series); nothing is estimated. The accountant's dashboard never asks for
 * prices, sales, expenses or profit (the API refuses them anyway).
 */
import { Permission } from '@timbertrail/shared';
import { useRouter } from 'expo-router';
import { Fragment, ReactNode, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityRow, ApprovalRow, ImportCard, toActivities } from '../../../components/cards';
import { HeaderButton, HeroPanel, useStatusBar } from '../../../components/header';
import { Appear, Tap } from '../../../components/motion';
import { LorryHome } from '../../../components/lorry-flow/LorryHome';
import { ProfileSheet } from '../../../components/ProfileSheet';
import { LORRY_FLOW_ONLY } from '../../../lib/lorry-mode';
import { QuickAddSheet } from '../../../components/QuickAddSheet';
import { PeriodPicker, useSheet } from '../../../components/sheet';
import { Text } from '../../../components/text';
import {
  Avatar,
  BarChart,
  Card,
  CARD_SHADOW,
  cn,
  CountBadge,
  Divider,
  Donut,
  EmptyState,
  ErrorBox,
  Grid,
  HeroCard,
  HeroStats,
  Icon,
  type IconName,
  IconTile,
  Kpi,
  LegendDot,
  MenuGroup,
  MenuRow,
  type Mod,
  ModTile,
  Muted,
  Pill,
  refresher,
  SectionTitle,
  Skeleton,
  SkeletonGrid,
  SkeletonList,
} from '../../../components/ui';
import { dateOnly, dayNum, inr, inrShort, int, monthShort, num3, PERIOD_KEYS, periodQuery, presets, todayIso } from '../../../lib/format';
import { useLang, useT } from '../../../lib/i18n';
import type { ImportSummary } from '../../../lib/imports-api';
import { type DashboardWidget, useDashboardWidgets } from '../../../services/preferences';
import { QUICK_ADD, visible } from '../../../lib/nav';
import { useApi } from '../../../lib/query';
import { useSession, useUser } from '../../../lib/session';
import { useTabBarInset } from '../../../lib/tab-chrome';
import { useThemeToggle } from '../../../lib/theme';
import type {
  AccountantCharts,
  AccountantDashboard,
  AccountsSummary,
  ApprovalQueue,
  ExportSummary,
  MillSettings,
  OwnerCharts,
  OwnerDashboard,
  Paged,
  ProductionSummary,
  UserRow,
} from '../../../lib/types';

export default function HomeScreen() {
  // lorry-only mode (lib/lorry-mode.ts): the three jobs at the gate, nothing else
  if (LORRY_FLOW_ONLY) return <LorryHome />;
  const { can, simple } = useSession();
  if (simple) return <SimpleHome />;
  return can(Permission.DASHBOARD_OWNER) ? <OwnerHome /> : <AccountantHome />;
}

// ───────── simple view ─────────

/**
 * Home in the simple view (the default for everyone; web: pages/SimpleHome.tsx), laid out like the
 * Sawmill Pro mockups:
 *  - owner: the walnut card says how many entries wait for approval (Review now), or "All caught up";
 *    yard stock in two tiles (raw logs, finished wood); lorries in and out today;
 *  - accountant: a red "needs fixing" banner when entries were sent back, or a dashed note when
 *    nothing has been entered today;
 *  - both: "loads still to measure" when there are some, then "Start work" — big tiles for the day's
 *    work, each in its work area's colour.
 * It reuses the dashboards' endpoints; nothing else is fetched.
 */
function SimpleHome() {
  const t = useT();
  const router = useRouter();
  const { can } = useSession();
  const owner = can(Permission.DASHBOARD_OWNER);
  const ownerQ = useApi<OwnerDashboard>(owner ? '/dashboard/owner' : null);
  const openQ = useApi<Paged<ImportSummary>>(owner ? '/imports?take=1&skip=0&open=1' : null);
  const accQ = useApi<AccountantDashboard>(owner ? null : '/dashboard/accountant');
  const queries = owner ? [ownerQ, openQ] : [accQ];
  const loaded = owner ? !!ownerQ.data && !!openQ.data : !!accQ.data;
  const error = queries.map(errorOf).find(Boolean) ?? null;

  const ok = ownerQ.data?.kpis;
  const ak = accQ.data?.kpis;
  const open = accQ.data?.measurementProgress ?? [];
  const today = {
    loadsIn: owner ? ok?.todayImports : ak?.todayImports,
    loadsOut: owner ? ok?.todayExports : ak?.todayExports,
    pending: owner ? (ok?.pendingApprovals ?? 0) : 0,
    rejected: owner ? 0 : (ak?.rejectedEntries ?? 0),
    toMeasure: owner ? (openQ.data?.total ?? 0) : open.length,
  };
  // with exactly one load to measure, its measuring screen opens directly
  const measureTo = !owner && open.length === 1 ? `/imports/${open[0].id}/measure` : '/more/measurement';

  const tiles: { key: string; to: string; label: string; icon: IconName; mod: Mod; badge?: number }[] = can(Permission.OPERATIONS_CREATE)
    ? [
        { key: 'in', to: '/imports/new', label: t('simpleLoadIn'), icon: 'truck', mod: 'in' },
        { key: 'measure', to: '/more/measurement', label: t('simpleMeasure'), icon: 'ruler', mod: 'logs' },
        { key: 'cut', to: '/production/new', label: t('simpleCut'), icon: 'factory', mod: 'cut' },
        { key: 'stock', to: '/inventory', label: t('simpleStock'), icon: 'boxes', mod: 'stock' },
        { key: 'out', to: '/exports/new', label: t('simpleLoadOut'), icon: 'truck-out', mod: 'out' },
        ...(can(Permission.CLIENTS_MANAGE) ? [{ key: 'dues', to: '/more/clients', label: t('simpleDues'), icon: 'wallet' as IconName, mod: 'neutral' as Mod }] : []),
      ]
    : [];

  return (
    <Body refreshing={queries.some((q) => q.isRefetching)} onRefresh={() => refetchAll(queries)} hero={<HomeHero />}>
      {error && <ErrorBox message={error} onRetry={() => refetchAll(queries)} />}

      {owner ? (
        <Appear index={0} className="gap-3">
          {!loaded && !error ? (
            <Skeleton className="h-36 rounded-3xl" />
          ) : (
            <ApprovalHero count={today.pending} onReview={() => router.push('/approvals')} />
          )}
          <Text className="pt-2 text-base font-semibold text-muted-foreground">{t('yardStock')}</Text>
          <View className="flex-row gap-3">
            <StockTile icon="ruler" mod="logs" value={ok ? ok.rawStockCft : null} label={t('cftRawLogs')} onPress={() => router.push('/inventory')} />
            <StockTile icon="boxes" mod="stock" value={ok ? ok.finishedStockCft : null} label={t('cftFinishedWood')} onPress={() => router.push('/inventory')} />
          </View>
          <Card className="flex-row items-center gap-3 py-3.5">
            <TodayCount icon="truck" mod="in" value={today.loadsIn} label={t('loadsInToday')} onPress={() => router.push('/loads-in')} />
            <View className="h-10 w-px bg-border" />
            <TodayCount icon="truck-out" mod="out" value={today.loadsOut} label={t('loadsOutToday')} onPress={() => router.push('/loads-out')} />
          </Card>
        </Appear>
      ) : (
        <Appear index={0} className="gap-3">
          {today.rejected > 0 ? (
            <AttentionBanner icon="alert-circle" tone="bad" text={t('rejectedToFix', { n: today.rejected })} onPress={() => router.push('/loads-in')} />
          ) : loaded && !today.loadsIn && !today.loadsOut ? (
            <View className="mt-1 rounded-3xl border border-dashed border-input bg-card px-5 py-4">
              <Text className="text-[15px] leading-[21px] text-muted-foreground">{t('noEntriesToday', { first: t('simpleLoadIn') })}</Text>
            </View>
          ) : null}
        </Appear>
      )}

      {owner && <FinishSetup />}

      {today.toMeasure > 0 && (
        <Appear index={1}>
          <AttentionBanner icon="ruler" tone="warn" text={t('loadsToMeasure', { n: today.toMeasure })} onPress={() => router.push(measureTo as never)} />
        </Appear>
      )}

      {tiles.length > 0 && (
        <Appear index={2} className="gap-3 pt-2">
          <Text className="text-base font-semibold text-muted-foreground">{t('startWork')}</Text>
          <View className="flex-row flex-wrap gap-3">
            {tiles.map((a) => (
              <Tap
                key={a.key}
                onPress={() => router.push(a.to as never)}
                accessibilityRole="button"
                accessibilityLabel={a.badge ? `${a.label}, ${a.badge}` : a.label}
                className={cn('min-h-[128px] grow basis-[45%] justify-between gap-4 rounded-3xl bg-card p-4', CARD_SHADOW)}
              >
                <ModTile mod={a.mod} icon={a.icon} size="lg" />
                <Text className="text-[18px] font-bold leading-6 tracking-tight text-foreground font-display" numberOfLines={2}>
                  {a.label}
                </Text>
                {!!a.badge && <CountBadge n={a.badge} className="absolute right-3 top-3" />}
              </Tap>
            ))}
          </View>
        </Appear>
      )}

      {/* the lists of what has been entered: each opens with its own "New" button at the foot */}
      <Appear index={3} className="gap-3 pt-2">
        <Text className="text-base font-semibold text-muted-foreground">{t('entries')}</Text>
        <MenuGroup>
          <MenuRow mod="in" icon="truck" title={t('simpleLoadIn')} onPress={() => router.push('/loads-in')} />
          <MenuRow mod="cut" icon="factory" title={t('simpleCut')} onPress={() => router.push('/runs')} />
          <MenuRow mod="out" icon="truck-out" title={t('simpleLoadOut')} last onPress={() => router.push('/loads-out')} />
        </MenuGroup>
      </Appear>
    </Body>
  );
}

/**
 * The owner's one-time setup, as a checklist card on Home (Sawmill Pro): each row is ticked once
 * it is done, and the card goes away when everything is. Only what the owner may set is listed.
 */
function FinishSetup() {
  const t = useT();
  const router = useRouter();
  const { can } = useSession();
  const users = useApi<UserRow[]>(can(Permission.USERS_MANAGE) ? '/users' : null);
  const settings = useApi<MillSettings>(can(Permission.SETTINGS_MANAGE) ? '/settings' : null);
  const suppliers = useApi<unknown[]>(can(Permission.SUPPLIERS_MANAGE) ? '/suppliers' : null);

  const all: { key: string; label: string; done: boolean | undefined; to: string; failed: boolean }[] = [
    ...(can(Permission.USERS_MANAGE) ? [{ key: 'acc', failed: !!users.error, label: t('setupAccountant'), done: users.data?.some((u) => u.role === 'ACCOUNTANT' && u.isActive), to: '/more/users' }] : []),
    ...(can(Permission.SETTINGS_MANAGE)
      ? [
          { key: 'rate', failed: !!settings.error, label: t('setupUnloadingRate'), done: settings.data ? (settings.data.defaultUnloadingRatePerHour ?? 0) > 0 : undefined, to: '/mill-settings' },
          { key: 'wood', failed: !!settings.error, label: t('setupWoodTypes'), done: settings.data ? settings.data.woodTypes.length > 0 : undefined, to: '/mill-settings' },
        ]
      : []),
    ...(can(Permission.SUPPLIERS_MANAGE) ? [{ key: 'sup', failed: !!suppliers.error, label: t('setupSuppliers'), done: suppliers.data ? suppliers.data.length > 0 : undefined, to: '/more/suppliers' }] : []),
  ];
  // a check that could not be loaded is left out, so it never keeps the card from showing
  const items = all.filter((i) => !i.failed);
  // wait for every answer (no flashing card), and hide it once all is done
  if (!items.length || items.some((i) => i.done === undefined) || items.every((i) => i.done)) return null;

  return (
    <Appear index={1}>
      <Card className="gap-0 px-0 pb-1 pt-4">
        <View className="gap-0.5 px-4 pb-3">
          <Text className="text-[17px] font-bold tracking-tight text-foreground font-display">{t('finishSetup')}</Text>
          <Muted>{t('finishSetupSub')}</Muted>
        </View>
        {items.map((i) => (
          <Pressable
            key={i.key}
            onPress={() => router.push(i.to as never)}
            accessibilityRole="button"
            accessibilityState={{ checked: !!i.done }}
            className="min-h-[60px] flex-row items-center gap-3.5 border-t border-border px-4 py-3 active:bg-secondary"
          >
            {i.done ? (
              <View className="h-8 w-8 items-center justify-center rounded-full bg-success">
                <Icon name="check" size={17} colorClassName="accent-white" />
              </View>
            ) : (
              <View className="h-8 w-8 rounded-full border-2 border-input" />
            )}
            <Text className={cn('flex-1 text-[16px] font-semibold', i.done ? 'text-muted-foreground line-through' : 'text-foreground')}>{i.label}</Text>
            <Icon name="chevron-right" size={18} colorClassName="accent-muted-foreground" />
          </Pressable>
        ))}
      </Card>
    </Appear>
  );
}

/** The walnut card at the top of the owner's home: entries waiting, or all caught up. */
function ApprovalHero({ count, onReview }: { count: number; onReview: () => void }) {
  const t = useT();
  if (!count)
    return (
      <HeroPanel className="flex-row items-center gap-4 py-6">
        <View className="h-14 w-14 items-center justify-center rounded-full bg-hero-chip">
          <Icon name="check" size={26} colorClassName="accent-saffron" />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-[22px] font-bold tracking-tight text-hero-foreground font-display">{t('allCaughtUp')}</Text>
          <Text className="text-[14px] text-hero-muted">{t('nothingWaitingApproval')}</Text>
        </View>
      </HeroPanel>
    );
  return (
    <Tap scale={0.985} onPress={onReview} accessibilityRole="button" accessibilityLabel={`${count} ${t(count === 1 ? 'oneEntryNeedsApproval' : 'entriesNeedApproval')}. ${t('reviewNow')}`}>
      <HeroPanel className="gap-3 py-6">
        <Text className="text-[48px] font-bold leading-[54px] tabular-nums text-hero-foreground font-display">{int(count)}</Text>
        <Text className="-mt-1 text-[17px] text-hero-foreground">{t(count === 1 ? 'oneEntryNeedsApproval' : 'entriesNeedApproval')}</Text>
        <View className="mt-1 flex-row items-center gap-2 self-start rounded-2xl bg-saffron px-5 py-3">
          <Text className="text-[16px] font-semibold text-saffron-foreground">{t('reviewNow')}</Text>
          <Icon name="arrow-right" size={18} colorClassName="accent-saffron-foreground" />
        </View>
      </HeroPanel>
    </Tap>
  );
}

/** One yard-stock figure: the area's tile, the CFT large, what it is under it. */
function StockTile({ icon, mod, value, label, onPress }: { icon: IconName; mod: Mod; value: number | null; label: string; onPress: () => void }) {
  return (
    <Tap scale={0.97} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${value == null ? '' : num3(value)} ${label}`} className={cn('flex-1 gap-4 rounded-3xl bg-card p-4', CARD_SHADOW)}>
      <ModTile mod={mod} icon={icon} />
      {value == null ? (
        <Skeleton className="h-8 w-20" />
      ) : (
        <View>
          <Text className={cn('text-[30px] font-bold leading-9 tabular-nums font-display', value ? 'text-foreground' : 'text-muted-foreground/70')} numberOfLines={1} adjustsFontSizeToFit>
            {int(Math.round(value))}
          </Text>
          <Text className="text-[14px] text-muted-foreground" numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Tap>
  );
}

/** "2 · Lorries in today" — an area tile beside a count. */
function TodayCount({ icon, mod, value, label, onPress }: { icon: IconName; mod: Mod; value: number | undefined; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="flex-1 flex-row items-center gap-3 rounded-2xl active:opacity-70" accessibilityLabel={`${value ?? '–'} ${label}`}>
      <ModTile mod={mod} icon={icon} size="sm" />
      <View className="flex-1">
        <Text className="text-[22px] font-bold leading-7 tabular-nums text-foreground font-display">{value == null ? '–' : int(value)}</Text>
        <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

// ───────── figures ─────────

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

/**
 * The last 7 days of a daily series (oldest first, ending today) and the change against the 7
 * days before. `pct` is null when the series is shorter than 14 days or the earlier week is zero
 * (a percentage of nothing means nothing).
 */
function weekTrend(values: number[]): { now: number; pct: number | null } {
  const n = values.length;
  const now = sum(values.slice(Math.max(0, n - 7)));
  const prev = sum(values.slice(Math.max(0, n - 14), Math.max(0, n - 7)));
  return { now, pct: n >= 14 && prev > 0 ? Math.round(((now - prev) / prev) * 100) : null };
}

/** Refresh what is on screen. */
function refetchAll(queries: { refetch: () => unknown }[]) {
  for (const q of queries) void q.refetch();
}

const errorOf = (q: { error: unknown }) => (q.error ? (q.error as Error).message : null);

// ───────── shared frame ─────────

/** "Sunday, 22 November" in the app's language (falls back to the plain date). */
function longToday(lang: string) {
  try {
    return new Date().toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {
    return dateOnly(todayIso());
  }
}

/**
 * The top of Home, straight on the cream page: "Hello, Ravi", today's date, the bell (when given)
 * and the profile circle; then the screen's headline (`children`).
 */
function HomeHero({ bell, children }: { bell?: { count: number; label: string; onPress: () => void }; children?: ReactNode }) {
  const t = useT();
  const { lang } = useLang();
  const user = useUser();
  const profile = useSheet();
  const first = user.name.trim().split(/\s+/)[0] ?? user.name;
  return (
    <View className="gap-4 px-4 pb-2 pt-3">
      <View className="flex-row items-center gap-2 pl-1">
        <View className="flex-1 gap-0.5">
          <Text
            className="text-[30px] font-bold leading-9 tracking-tight text-foreground font-display"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            accessibilityRole="header"
          >
            {t('helloName', { name: first })}
          </Text>
          <Text className="text-[15px] text-muted-foreground" numberOfLines={1}>
            {longToday(lang)}
          </Text>
        </View>
        {bell && <HeaderButton icon="bell" label={bell.label} onPress={bell.onPress} badge={bell.count ? <CountBadge n={bell.count} /> : undefined} />}
        <Pressable onPress={profile.open} accessibilityRole="button" accessibilityLabel={t('profile')} className="h-14 w-14 items-center justify-center rounded-full active:opacity-80">
          <Avatar name={first} size="lg" tone="hero" />
        </Pressable>
      </View>
      {children}
      <ProfileSheet ref={profile.ref} />
    </View>
  );
}

function Body({ hero, children, refreshing, onRefresh }: { hero: ReactNode; children: ReactNode; refreshing: boolean; onRefresh: () => void }) {
  const insets = useSafeAreaInsets();
  const tabBar = useTabBarInset();
  const { dark } = useThemeToggle();
  useStatusBar(dark);
  return (
    <View className="flex-1 bg-background">
      <View style={{ height: insets.top }} />
      <ScrollView className="flex-1" contentContainerClassName="grow" refreshControl={refresher(refreshing, onRefresh)}>
        {hero}
        <View className="grow gap-3 px-4 pt-2" style={{ paddingBottom: 40 + tabBar }}>
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

/** A titled section that fades in at its place in the order. */
function Section({ index, title, right, action, children }: { index: number; title: string; right?: ReactNode; action?: { label: string; onPress: () => void }; children: ReactNode }) {
  return (
    <Appear index={index} className="gap-3">
      <SectionTitle right={right} action={action}>
        {title}
      </SectionTitle>
      {children}
    </Appear>
  );
}

/** "3 entries need correcting" — the one thing to do first. */
function AttentionBanner({ icon, text, onPress, tone }: { icon: IconName; text: string; onPress: () => void; tone: 'warn' | 'bad' }) {
  return (
    <Tap
      scale={0.98}
      onPress={onPress}
      accessibilityRole="button"
      className={cn('mt-1 min-h-14 flex-row items-center gap-3 rounded-3xl px-5 py-3.5 active:opacity-85', tone === 'warn' ? 'bg-saffron-soft' : 'bg-destructive-soft')}
    >
      <Icon name={icon} size={22} colorClassName={tone === 'warn' ? 'accent-saffron-strong' : 'accent-destructive'} />
      <Text className={cn('flex-1 text-[15px] font-semibold', tone === 'warn' ? 'text-foreground' : 'text-destructive')}>{text}</Text>
      <Icon name="chevron-right" size={18} colorClassName={tone === 'warn' ? 'accent-foreground' : 'accent-destructive'} />
    </Tap>
  );
}

/**
 * New import · New production · New export · View stock — the first three only for whoever may
 * create records. "More" opens the full Quick Add sheet when it holds anything else.
 */
function QuickActions({ index }: { index: number }) {
  const t = useT();
  const router = useRouter();
  const { can } = useSession();
  const quick = useSheet();
  const icon: Record<string, IconName> = { newImport: 'truck', newProduction: 'factory', newExport: 'truck-out' };
  const allowed = QUICK_ADD.filter((i) => visible(i, can));
  const actions = [
    ...allowed.filter((i) => i.key in icon).map((i) => ({ key: i.key, icon: icon[i.key], label: t(i.labelKey), href: i.href })),
    { key: 'stock', icon: 'boxes' as IconName, label: t('viewStock'), href: '/inventory' },
  ];
  const extra = allowed.length > actions.length - 1;
  return (
    <Section index={index} title={t('quickActions')} action={extra ? { label: t('more'), onPress: quick.open } : undefined}>
      <View className="flex-row gap-2.5">
        {actions.map((a) => (
          <Tap
            key={a.key}
            scale={0.94}
            onPress={() => router.push(a.href as never)}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            className="min-h-[96px] flex-1 items-center gap-2.5 rounded-2xl bg-background px-1 py-3.5 active:bg-secondary"
          >
            <View className="h-11 w-11 items-center justify-center rounded-full bg-primary">
              <Icon name={a.icon} size={20} colorClassName="accent-primary-foreground" />
            </View>
            <Text className="text-center text-xs font-semibold leading-4 text-foreground" numberOfLines={2}>
              {a.label}
            </Text>
          </Tap>
        ))}
      </View>
      {extra && <QuickAddSheet ref={quick.ref} />}
    </Section>
  );
}

/** Small figures side by side inside a panel: label over value. */
function FigureRow({ items }: { items: { label: string; value: string; unit?: string }[] }) {
  return (
    <View className="flex-row gap-3">
      {items.map((x) => (
        <View key={x.label} className="flex-1 gap-0.5" accessible accessibilityLabel={`${x.label}: ${x.value}${x.unit ? ` ${x.unit}` : ''}`}>
          <Text className="text-[11px] font-medium text-muted-foreground" numberOfLines={2}>
            {x.label}
          </Text>
          <Text className="text-[17px] font-bold tabular-nums text-foreground font-display" numberOfLines={1} adjustsFontSizeToFit>
            {x.value}
            {x.unit ? <Text className="text-[11px] font-semibold text-muted-foreground"> {x.unit}</Text> : null}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Panel with a chart title, an optional legend and the chart. */
function ChartPanel({ title, sub, legend, children }: { title: string; sub?: string; legend?: ReactNode; children: ReactNode }) {
  return (
    <Card className="gap-4">
      <View className="gap-0.5">
        <Text className="text-[15px] font-semibold text-foreground">{title}</Text>
        {!!sub && <Muted>{sub}</Muted>}
      </View>
      {legend}
      {children}
    </Card>
  );
}

/** Recent records as one timeline, or an empty state. */
function RecentActivity({ index, title, loading, error, onRetry, items }: { index: number; title: string; loading: boolean; error: string | null; onRetry: () => void; items: ReturnType<typeof toActivities> }) {
  const t = useT();
  return (
    <Section index={index} title={title}>
      {error ? (
        <ErrorBox message={error} onRetry={onRetry} />
      ) : loading ? (
        <SkeletonList rows={3} />
      ) : items.length === 0 ? (
        <EmptyState icon="activity" title={t('noActivity')} />
      ) : (
        <MenuGroup>
          {items.map((a, i) => (
            <ActivityRow key={`${a.kind}:${a.id}`} a={a} last={i === items.length - 1} />
          ))}
        </MenuGroup>
      )}
    </Section>
  );
}

// ───────── owner ─────────

function OwnerHome() {
  const t = useT();
  const router = useRouter();
  const { can } = useSession();
  const [period, setPeriod] = useState(presets().thisMonth);

  const widgets = useDashboardWidgets('owner', can);
  const has = (...ws: DashboardWidget[]) => ws.some((w) => widgets.includes(w));
  // a hidden section's data isn't fetched (the band's stock and the bell always are)
  const dash = useApi<OwnerDashboard>('/dashboard/owner');
  const charts = useApi<OwnerCharts>(has('keyMetrics', 'finance', 'operations') ? '/dashboard/owner/charts' : null);
  const queue = useApi<ApprovalQueue>(has('approvals') ? '/approvals' : null);
  const money = useApi<AccountsSummary>(has('finance') ? `/accounts/summary?${periodQuery(period)}` : null);
  const production = useApi<Paged<ProductionSummary>>(has('operations', 'activity') ? '/production?take=30' : null);
  const imports = useApi<Paged<ImportSummary>>(has('activity') ? '/imports?take=6' : null);
  const exports = useApi<Paged<ExportSummary>>(has('activity') ? '/exports?take=6' : null);

  const k = dash.data?.kpis;
  const today = todayIso();
  const todayRuns = production.data?.items.filter((p) => p.productionDate.slice(0, 10) === today);
  const todayOutput = sum(todayRuns?.map((p) => p.outputCft) ?? []);
  const flow = charts.data?.flow ?? [];
  const received = weekTrend(flow.map((f) => f.receivedCft));
  const shipped = weekTrend(flow.map((f) => f.shippedCft));
  const flow14 = flow.slice(-14);
  const cash = charts.data?.cash ?? [];
  const pnl = money.data?.pnl;
  const loss = !!pnl && pnl.profit < 0;
  const p = presets();
  const periodKey = PERIOD_KEYS.find((x) => p[x].from === period.from && p[x].to === period.to);
  const periodLabel = periodKey ? t(periodKey) : `${dateOnly(period.from)} – ${dateOnly(period.to)}`;
  const waiting = queue.data?.items ?? [];
  const pendingCount = queue.data?.counts.total ?? k?.pendingApprovals ?? 0;
  const activity = toActivities(t, imports.data?.items, production.data?.items.slice(0, 6), exports.data?.items);
  // only queries that have a path: refetch() would run a disabled one anyway
  const all = [
    dash,
    ...(has('keyMetrics', 'finance', 'operations') ? [charts] : []),
    ...(has('approvals') ? [queue] : []),
    ...(has('finance') ? [money] : []),
    ...(has('operations', 'activity') ? [production] : []),
    ...(has('activity') ? [imports, exports] : []),
  ];
  const refreshing = all.some((q) => q.isRefetching);
  const trend = (pct: number | null) => (pct == null ? null : { pct, label: t('vsPrevWeek') });

  /** the sections this person shows, in their order (services/preferences; permissions already applied) */
  const blocks: Partial<Record<DashboardWidget, (i: number) => ReactNode>> = {
    keyMetrics: (i: number) => (
      <>
        {/* key metrics */}
        <Section index={i} title={t('keyMetrics')}>
          {errorOf(dash) && <ErrorBox message={errorOf(dash)!} onRetry={() => void dash.refetch()} />}
          {errorOf(charts) && <ErrorBox message={errorOf(charts)!} onRetry={() => void charts.refetch()} />}
          {!k || charts.isPending ? (
            <SkeletonGrid tiles={4} />
          ) : (
            <Grid>
              <Kpi icon="truck" label={t('receivedCft')} value={num3(received.now)} unit="CFT" trend={trend(received.pct)} hint={t('lastSevenDays')} onPress={() => router.push('/loads-in')} />
              <Kpi icon="truck-out" label={t('shippedCft')} value={num3(shipped.now)} unit="CFT" trend={trend(shipped.pct)} hint={t('lastSevenDays')} onPress={() => router.push('/loads-out')} />
              <Kpi icon="arrow-down-circle" label={t('pendingReceivables')} value={inrShort(k.pendingReceivables)} tone={k.pendingReceivables ? 'warn' : undefined} onPress={() => router.push('/more/accounts')} />
              <Kpi icon="arrow-up-circle" label={t('pendingPayables')} value={inrShort(k.pendingPayables)} onPress={() => router.push('/more/accounts')} />
            </Grid>
          )}
        </Section>
      </>
    ),
    quickActions: (i: number) => (
      <>
        {/* quick actions */}
        <QuickActions index={i} />
      </>
    ),
    approvals: (i: number) => (
      <>
        {/* pending approvals */}
        {can(Permission.OPERATIONS_APPROVE) && (
          <Section
            index={i}
            title={t('pendingApprovals')}
            right={pendingCount ? <CountBadge n={pendingCount} /> : undefined}
            action={waiting.length > 3 ? { label: t('viewAll'), onPress: () => router.push('/approvals') } : undefined}
          >
            {errorOf(queue) ? (
              <ErrorBox message={errorOf(queue)!} onRetry={() => void queue.refetch()} />
            ) : queue.isPending ? (
              <SkeletonList rows={2} />
            ) : waiting.length === 0 ? (
              <View className="flex-row items-center gap-3 rounded-2xl bg-background p-4">
                <IconTile icon="check-circle" tone="good" size="sm" />
                <Text className="flex-1 text-sm font-medium text-muted-foreground">{t('nothingToApprove')}</Text>
              </View>
            ) : (
              <MenuGroup>
                {waiting.slice(0, 3).map((i, n, shown) => (
                  <ApprovalRow key={`${i.type}:${i.id}`} item={i} last={n === shown.length - 1} />
                ))}
              </MenuGroup>
            )}
          </Section>
        )}
      </>
    ),
    finance: (i: number) => (
      <>
        {/* money for a period */}
        <Section index={i} title={t('financialOverview')} right={<Pill icon="lock" text={t('ownerOnly')} />}>
          <PeriodPicker value={period} onChange={setPeriod} />
          {errorOf(money) && <ErrorBox message={errorOf(money)!} onRetry={() => void money.refetch()} />}
          {!pnl ? (
            !errorOf(money) && <Skeleton className="h-40 rounded-3xl" />
          ) : (
            <HeroCard label={`${loss ? t('netLoss') : t('netProfit')} · ${periodLabel}`} value={inr(pnl.profit)} icon={loss ? 'trending-down' : 'trending-up'} onPress={() => router.push('/more/accounts')}>
              <HeroStats
                items={[
                  { label: t('sales'), value: inrShort(pnl.sales) },
                  { label: t('totalExpenses'), value: inrShort(pnl.totalExpenses) },
                  { label: t('margin'), value: pnl.sales > 0 ? `${Math.round((pnl.profit / pnl.sales) * 1000) / 10}%` : '—', accent: true },
                ]}
              />
            </HeroCard>
          )}
          {cash.some((c) => c.sales || c.expenses) && (
            <ChartPanel
              title={t('chartCashTitle')}
              sub={t('chartCashSub')}
              legend={
                <View className="flex-row gap-5">
                  <LegendDot className="bg-saffron" label={t('sales')} />
                  <LegendDot className="bg-chart-2" label={t('expensesHead')} />
                </View>
              }
            >
              <BarChart
                data={cash.map((c) => ({ label: monthShort(c.month), values: [c.sales, c.expenses] }))}
                accessibilityLabel={cash.map((c) => `${monthShort(c.month)}: ${inr(c.sales)} / ${inr(c.expenses)}`).join(', ')}
              />
            </ChartPanel>
          )}
        </Section>
      </>
    ),
    operations: (i: number) => (
      <>
        {/* today's operations and the flow of wood */}
        <Section index={i} title={t('operationalOverview')}>
          {!k ? (
            <Skeleton className="h-56 rounded-2xl" />
          ) : (
            <Card className="gap-4">
              <FigureRow
                items={[
                  { label: t('todayImports'), value: int(k.todayImports) },
                  { label: t('todayExports'), value: int(k.todayExports) },
                  { label: t('todayProduction'), value: todayRuns ? num3(todayOutput) : '—', unit: 'CFT' },
                ]}
              />
              {flow14.some((f) => f.receivedCft || f.shippedCft) && (
                <>
                  <Divider />
                  <View className="gap-3">
                    <Text className="text-[13px] font-semibold text-foreground">{t('chartFlowTitle')}</Text>
                    <View className="flex-row gap-5">
                      <LegendDot className="bg-saffron" label={t('receivedCft')} />
                      <LegendDot className="bg-chart-2" label={t('shippedCft')} />
                    </View>
                    <BarChart
                      labelEvery={3}
                      data={flow14.map((f) => ({ label: dayNum(f.day), values: [f.receivedCft, f.shippedCft] }))}
                      accessibilityLabel={`${t('chartFlowTitle')}: ${t('receivedCft')} ${num3(sum(flow14.map((f) => f.receivedCft)))} CFT, ${t('shippedCft')} ${num3(sum(flow14.map((f) => f.shippedCft)))} CFT`}
                    />
                  </View>
                </>
              )}
            </Card>
          )}
        </Section>
      </>
    ),
    activity: (i: number) => (
      <>
        {/* recent records */}
        <RecentActivity
          index={i}
          title={t('recentActivity')}
          loading={imports.isPending || production.isPending || exports.isPending}
          error={errorOf(imports) ?? errorOf(production) ?? errorOf(exports)}
          onRetry={() => refetchAll([imports, production, exports])}
          items={activity}
        />
      </>
    ),
  };

  return (
    <Body
      hero={
        <HomeHero bell={{ count: pendingCount, label: t('approvals'), onPress: () => router.push('/approvals') }}>
          {!k ? (
            <Skeleton className="h-36 rounded-3xl" />
          ) : (
            <Appear>
              <HeroCard label={t('totalStock')} value={num3(k.rawStockCft + k.finishedStockCft)} unit="CFT" icon="boxes" onPress={() => router.push('/inventory')}>
                <HeroStats
                  items={[
                    { label: t('rawStock'), value: `${num3(k.rawStockCft)} CFT` },
                    { label: t('finishedStock'), value: `${num3(k.finishedStockCft)} CFT`, accent: true },
                  ]}
                />
              </HeroCard>
            </Appear>
          )}
        </HomeHero>
      }
      refreshing={refreshing}
      onRefresh={() => refetchAll(all)}
    >
      {widgets.map((id, i) => (
        <Fragment key={id}>{blocks[id]?.(i)}</Fragment>
      ))}
      {widgets.length === 0 && <EmptyState icon="sliders" title={t('dashboardLayout')} body={t('dashboardLayoutSub')} action={{ label: t('preferences'), onPress: () => router.push({ pathname: '/preferences', params: { section: 'dashboard' } }) }} />}
    </Body>
  );
}

// ───────── accountant ─────────

function AccountantHome() {
  const t = useT();
  const router = useRouter();
  const { can } = useSession();
  const widgets = useDashboardWidgets('accountant', can);
  const has = (...ws: DashboardWidget[]) => ws.some((w) => widgets.includes(w));
  // a hidden section's data isn't fetched (the band's figures always are)
  const dash = useApi<AccountantDashboard>('/dashboard/accountant');
  const charts = useApi<AccountantCharts>(has('keyMetrics', 'measuring') ? '/dashboard/accountant/charts' : null);
  // lists are the accountant's own records (the API filters them)
  const imports = useApi<Paged<ImportSummary>>(has('activity') ? '/imports?take=6' : null);
  const production = useApi<Paged<ProductionSummary>>(has('activity') ? '/production?take=6' : null);
  const exports = useApi<Paged<ExportSummary>>(has('activity') ? '/exports?take=6' : null);

  const k = dash.data?.kpis;
  const progress = dash.data?.measurementProgress ?? [];
  const days = charts.data?.logsByDay ?? [];
  const logs = weekTrend(days.map((d) => d.logs));
  const cft = weekTrend(days.map((d) => d.cft));
  const statusTotal = k ? k.draftEntries + k.pendingSubmissions + k.approvedEntries + k.rejectedEntries : 0;
  const activity = toActivities(t, imports.data?.items, production.data?.items, exports.data?.items);
  const all = [dash, ...(has('keyMetrics', 'measuring') ? [charts] : []), ...(has('activity') ? [imports, production, exports] : [])];
  const trend = (pct: number | null) => (pct == null ? null : { pct, label: t('vsPrevWeek') });

  /** the sections this person shows, in their order (services/preferences; permissions already applied) */
  const blocks: Partial<Record<DashboardWidget, (i: number) => ReactNode>> = {
    keyMetrics: (i: number) => (
      <>
        {/* key metrics: own measuring this week, drafts and submissions */}
        <Section index={i} title={t('keyMetrics')}>
          {errorOf(dash) && <ErrorBox message={errorOf(dash)!} onRetry={() => void dash.refetch()} />}
          {errorOf(charts) && <ErrorBox message={errorOf(charts)!} onRetry={() => void charts.refetch()} />}
          {!k || charts.isPending ? (
            <SkeletonGrid tiles={4} />
          ) : (
            <Grid>
              <Kpi icon="ruler" label={t('logsMeasured')} value={int(logs.now)} trend={trend(logs.pct)} hint={t('lastSevenDays')} onPress={() => router.push('/more/measurement')} />
              <Kpi icon="layers" label={t('totalCft')} value={num3(cft.now)} unit="CFT" trend={trend(cft.pct)} hint={t('lastSevenDays')} onPress={() => router.push('/more/measurement')} />
              <Kpi icon="edit-3" label={t('draft')} value={int(k.draftEntries)} onPress={() => router.push('/loads-in')} />
              <Kpi icon="clock" label={t('pending')} value={int(k.pendingSubmissions)} tone={k.pendingSubmissions ? 'warn' : undefined} onPress={() => router.push('/loads-in')} />
            </Grid>
          )}
        </Section>
      </>
    ),
    quickActions: (i: number) => (
      <>
        {/* quick actions */}
        <QuickActions index={i} />
      </>
    ),
    measuring: (i: number) => (
      <>
        {/* operations: loads still being measured, and the last two weeks of measuring */}
        <Section index={i} title={t('measurementProgress')} action={progress.length > 3 ? { label: t('viewAll'), onPress: () => router.push('/more/measurement') } : undefined}>
          {dash.isPending ? (
            <SkeletonList rows={2} />
          ) : progress.length === 0 ? (
            <EmptyState mod="logs" icon="ruler" title={t('noOpenLoads')} action={{ label: t('newImport'), onPress: () => router.push('/imports/new') }} />
          ) : (
            progress.slice(0, 3).map((l) => <ImportCard key={l.id} measure item={{ ...l, arrivalAt: '', createdByName: '', updatedAt: '' } as ImportSummary} />)
          )}
          {days.some((d) => d.logs) && (
            <ChartPanel title={t('chartLogsTitle')} sub={t('chartLogsSub')}>
              <BarChart
                labelEvery={2}
                data={days.map((d) => ({ label: dayNum(d.day), values: [d.logs] }))}
                accessibilityLabel={`${t('chartLogsTitle')}: ${int(sum(days.map((d) => d.logs)))} ${t('logs')}`}
              />
            </ChartPanel>
          )}
        </Section>
      </>
    ),
    entryStatus: (i: number) => (
      <>
        {/* submissions: where every entry stands with the owner */}
        <Section index={i} title={t('entryStatus')}>
          {!k ? (
            <Skeleton className="h-40 rounded-2xl" />
          ) : (
            <Card className="flex-row items-center gap-5">
              <Donut
                size={112}
                segments={[
                  { value: k.approvedEntries, color: 'success' },
                  { value: k.pendingSubmissions, color: 'saffron' },
                  { value: k.draftEntries, color: 'muted' },
                  { value: k.rejectedEntries, color: 'destructive' },
                ]}
                center={
                  <View className="items-center">
                    <Text className="text-xl font-bold tabular-nums text-foreground font-display">{int(statusTotal)}</Text>
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
        </Section>
      </>
    ),
    activity: (i: number) => (
      <>
        {/* own recent records */}
        <RecentActivity
          index={i}
          title={t('myActivity')}
          loading={imports.isPending || production.isPending || exports.isPending}
          error={errorOf(imports) ?? errorOf(production) ?? errorOf(exports)}
          onRetry={() => refetchAll([imports, production, exports])}
          items={activity}
        />
      </>
    ),
  };

  return (
    <Body
      hero={
        <HomeHero bell={{ count: k?.rejectedEntries ?? 0, label: t('notifications'), onPress: () => router.push('/loads-in') }}>
          {!k ? (
            <Skeleton className="h-28 rounded-3xl" />
          ) : (
            <Appear>
              <HeroPanel>
              <HeroStats
                items={[
                  { label: t('todayImports'), value: int(k.todayImports) },
                  { label: t('todayExports'), value: int(k.todayExports) },
                  { label: t('measurementProgress'), value: int(progress.length), accent: progress.length > 0 },
                ]}
              />
              </HeroPanel>
            </Appear>
          )}
        </HomeHero>
      }
      refreshing={all.some((q) => q.isRefetching)}
      onRefresh={() => refetchAll(all)}
    >
      {!!k?.rejectedEntries && (
        <Appear index={0}>
          <AttentionBanner icon="alert-triangle" tone="bad" text={t('needsCorrection', { n: k.rejectedEntries })} onPress={() => router.push('/loads-in')} />
        </Appear>
      )}

      {widgets.map((id, i) => (
        <Fragment key={id}>{blocks[id]?.(i)}</Fragment>
      ))}
      {widgets.length === 0 && <EmptyState icon="sliders" title={t('dashboardLayout')} body={t('dashboardLayoutSub')} action={{ label: t('preferences'), onPress: () => router.push({ pathname: '/preferences', params: { section: 'dashboard' } }) }} />}
    </Body>
  );
}

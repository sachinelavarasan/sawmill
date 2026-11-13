import { Feather } from '@expo/vector-icons';
import { Permission } from '@sawmill/shared';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { api, Profile } from '../api';
import { useNav } from '../nav';
import { useTheme } from '../theme';
import { Grid, inr, Kpi, num3, Pill, StatusPill, useStyles, useT } from '../ui';

type Kpis = Record<string, number>;
interface DashData {
  kpis: Kpis;
  accountantActivity?: {
    accountantId: string;
    accountantName: string;
    logsMeasured: number;
    totalCft: number;
    pendingEntries: number;
    approvedEntries: number;
    rejectedEntries: number;
  }[];
  measurementProgress?: {
    id: string;
    code: string;
    lorryNumber: string;
    woodType: string;
    totalLogs: number;
    totalCft: number;
    status: string;
    rejectionReason?: string | null;
  }[];
}

/** Home tab: the role-based dashboard. */
export function HomeScreen({ user }: { user: Profile }) {
  const t = useT();
  const { c } = useTheme();
  const s = useStyles();
  const nav = useNav();
  const isOwner = user.permissions.includes(Permission.DASHBOARD_OWNER);
  const [data, setData] = useState<DashData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      setData(await api<DashData>(isOwner ? '/dashboard/owner' : '/dashboard/accountant'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [isOwner]);

  useEffect(() => {
    load();
  }, [load, nav.version]);

  const k = data?.kpis;

  return (
    <ScrollView
      style={[s.fill, { backgroundColor: c.bg }]}
      contentContainerStyle={s.body}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={load} tintColor={c.primary} colors={[c.primary]} progressBackgroundColor={c.surface} />
      }
    >
      <Text style={s.h1}>{t('dashboard')}</Text>
      {error && <Text style={s.error}>{error}</Text>}
      {!k && !error && <ActivityIndicator color={c.primary} style={{ marginTop: 32 }} />}

      {k && isOwner && (
        <>
          {k.pendingApprovals > 0 && (
            <View style={s.pendingCard}>
              <View style={s.pendingCount}>
                <Text style={s.pendingCountText}>{k.pendingApprovals}</Text>
              </View>
              <Text style={s.pendingText}>{t('approvalsWaiting', { n: k.pendingApprovals })}</Text>
            </View>
          )}

          <Text style={s.section}>{t('operations')}</Text>
          <Grid>
            <Kpi label={t('rawStock')} value={num3(k.rawStockCft)} unit="CFT" />
            <Kpi label={t('finishedStock')} value={num3(k.finishedStockCft)} unit="CFT" />
            <Kpi label={t('todayImports')} value={k.todayImports} />
            <Kpi label={t('todayExports')} value={k.todayExports} />
            <Kpi label={t('totalImportLoads')} value={k.totalImportLoads} />
            <Kpi label={t('totalExportLoads')} value={k.totalExportLoads} />
          </Grid>

          <View style={s.sectionRow}>
            <Text style={s.section}>{t('financials')}</Text>
            <View style={s.lockChip}>
              <Feather name="lock" size={11} color={c.primary} />
              <Text style={s.lockChipText}>{t('ownerOnly')}</Text>
            </View>
          </View>
          <View style={[s.heroCard, k.profitLoss < 0 && { backgroundColor: c.badSoft }]}>
            <Text style={[s.heroCardLabel, k.profitLoss < 0 && { color: c.bad }]}>{t('profitLoss')}</Text>
            <Text style={[s.heroCardValue, k.profitLoss < 0 && { color: c.bad }]}>{inr(k.profitLoss)}</Text>
          </View>
          <Grid>
            <Kpi label={t('totalSales')} value={inr(k.totalSales)} />
            <Kpi label={t('totalExpenses')} value={inr(k.totalExpenses)} />
            <Kpi label={t('pendingReceivables')} value={inr(k.pendingReceivables)} />
            <Kpi label={t('pendingPayables')} value={inr(k.pendingPayables)} />
          </Grid>

          <Text style={s.section}>{t('accountantActivity')}</Text>
          {data!.accountantActivity!.length === 0 && <Text style={s.muted}>{t('noAccountants')}</Text>}
          {data!.accountantActivity!.map((a) => (
            <View key={a.accountantId} style={s.card}>
              <View style={s.row}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{a.accountantName.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={s.fill}>
                  <Text style={s.cardTitle}>{a.accountantName}</Text>
                  <Text style={s.muted}>
                    {t('logsMeasured')}: {a.logsMeasured}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.cardNumber}>{num3(a.totalCft)}</Text>
                  <Text style={s.muted}>CFT</Text>
                </View>
              </View>
              <View style={s.pillRow}>
                <Pill tone="warn" text={`${a.pendingEntries} ${t('pending')}`} />
                <Pill tone="good" text={`${a.approvedEntries} ${t('approved')}`} />
                <Pill tone="bad" text={`${a.rejectedEntries} ${t('rejected')}`} />
              </View>
            </View>
          ))}
        </>
      )}

      {k && !isOwner && (
        <>
          <Grid>
            <Kpi label={t('todayImports')} value={k.todayImports} />
            <Kpi label={t('todayExports')} value={k.todayExports} />
            <Kpi label={t('draftEntries')} value={k.draftEntries} />
            <Kpi label={t('pendingSubmissions')} value={k.pendingSubmissions} tone={k.pendingSubmissions ? 'warn' : undefined} />
            <Kpi label={t('approvedEntries')} value={k.approvedEntries} tone="good" />
            <Kpi label={t('rejectedEntries')} value={k.rejectedEntries} tone={k.rejectedEntries ? 'bad' : undefined} />
          </Grid>

          <Text style={s.section}>{t('measurementProgress')}</Text>
          {data!.measurementProgress!.length === 0 && <Text style={s.muted}>{t('noData')}</Text>}
          {data!.measurementProgress!.map((l) => (
            <Pressable
              key={l.id}
              style={({ pressed }) => [s.card, pressed && { backgroundColor: c.surface2 }]}
              onPress={() => nav.push({ name: 'measure', id: l.id })}
              accessibilityRole="button"
            >
              <View style={s.rowBetween}>
                <Text style={s.cardTitle}>{l.code}</Text>
                <StatusPill status={l.status} />
              </View>
              <Text style={s.muted}>
                {t('lorry')} {l.lorryNumber} · {l.woodType}
              </Text>
              <View style={s.statRow}>
                <Text style={s.statText}>
                  <Text style={s.statStrong}>{l.totalLogs}</Text> {t('logs')}
                </Text>
                <Text style={s.statText}>
                  <Text style={s.statStrong}>{num3(l.totalCft)}</Text> CFT
                </Text>
              </View>
              {!!l.rejectionReason && <Text style={s.reason}>{l.rejectionReason}</Text>}
            </Pressable>
          ))}
        </>
      )}
    </ScrollView>
  );
}

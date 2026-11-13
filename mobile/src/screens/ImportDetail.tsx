import { Feather } from '@expo/vector-icons';
import { formatDuration } from '@sawmill/shared';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ImportDetail, importsApi, Unloading } from '../imports-api';
import { useNav } from '../nav';
import { useTheme } from '../theme';
import { BackBar, Button, dateTime, ErrorBox, inr, Loading, num3, StatusPill, timeOnly, useStyles, useT } from '../ui';

export function ImportDetailScreen({ id }: { id: string }) {
  const t = useT();
  const { c } = useTheme();
  const s = useStyles();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const [load, setLoad] = useState<ImportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLoad = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      setLoad(await importsApi.get(id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [id]);

  // refetch when returning from Measure / Edit
  useEffect(() => {
    fetchLoad();
  }, [fetchLoad, nav.version]);

  const details: [string, string | null][] = load
    ? [
        [t('arrival'), dateTime(load.arrivalAt)],
        [t('woodType'), load.woodType],
        [t('woodCategory'), load.woodCategory],
        [t('originLocation'), load.originLocation],
        [t('driverName'), load.driverName],
        [t('driverMobile'), load.driverMobile],
        [t('lorryOwnerName'), load.lorryOwnerName],
        [t('lorryOwnerMobile'), load.lorryOwnerMobile],
        [t('createdBy'), load.createdByName],
      ]
    : [];

  return (
    <SafeAreaView style={[s.fill, { backgroundColor: c.hero }]} edges={['top']}>
      <BackBar
        title={load ? `${load.code} · ${load.lorryNumber}` : t('importDetails')}
        subtitle={load?.woodType}
        onBack={nav.pop}
        right={
          load?.editable ? (
            <Pressable
              onPress={() => nav.push({ name: 'editImport', id })}
              style={[s.iconBtn, s.iconBtnHero]}
              accessibilityRole="button"
              accessibilityLabel={t('edit')}
            >
              <Feather name="edit-2" size={20} color={c.heroText} />
            </Pressable>
          ) : null
        }
      />
      <ScrollView
        style={[s.fill, { backgroundColor: c.bg }]}
        contentContainerStyle={[s.body, { paddingBottom: 32 + insets.bottom }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchLoad} tintColor={c.primary} colors={[c.primary]} progressBackgroundColor={c.surface} />
        }
      >
        {error && <ErrorBox message={error} onRetry={fetchLoad} />}
        {!load && !error && <Loading />}

        {load && (
          <>
            <View style={s.rowBetween}>
              <StatusPill status={load.status} />
            </View>
            {!!load.rejectionReason && <Text style={s.reason}>{load.rejectionReason}</Text>}
            {!load.editable && <Text style={s.notice}>{t('lockedRecord')}</Text>}

            <View style={s.mStats}>
              <View style={s.mStat}>
                <Text style={s.mStatLabel}>{t('logsMeasured')}</Text>
                <Text style={s.mStatValue}>{load.totalLogs}</Text>
              </View>
              <View style={[s.mStat, s.mStatPrimary]}>
                <Text style={[s.mStatLabel, { color: c.onPrimary, opacity: 0.85 }]}>{t('totalCft')}</Text>
                <Text style={[s.mStatValue, { color: c.onPrimary }]}>{num3(load.totalCft)}</Text>
              </View>
            </View>
            <Button
              icon="edit-3"
              title={load.editable ? t('measure') : t('logs')}
              onPress={() => nav.push({ name: 'measure', id })}
            />

            <Text style={s.section}>{t('unloading')}</Text>
            <UnloadingSection load={load} onChanged={fetchLoad} />

            <Text style={s.section}>{t('importDetails')}</Text>
            <View style={s.card}>
              {details
                .filter(([, v]) => !!v)
                .map(([k, v]) => (
                  <View key={k} style={s.kv}>
                    <Text style={s.kvKey}>{k}</Text>
                    <Text style={s.kvVal}>{v}</Text>
                  </View>
                ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Start an unloading vehicle now, end it now — the server works out duration and charges. */
function UnloadingSection({ load, onChanged }: { load: ImportDetail; onChanged: () => void }) {
  const t = useT();
  const { c } = useTheme();
  const s = useStyles();
  const [open, setOpen] = useState(false);
  const [vehicle, setVehicle] = useState('');
  const [driver, setDriver] = useState('');
  const [rate, setRate] = useState(load.defaultUnloadingRate != null ? String(load.defaultUnloadingRate) : '');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      onChanged();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function start() {
    const r = rate.trim() === '' ? undefined : Number(rate);
    const ok = await run('start', () =>
      importsApi.startUnloading(load.id, {
        vehicleNumber: vehicle.trim(),
        driverName: driver.trim() || undefined,
        ratePerHour: r !== undefined && Number.isFinite(r) ? r : undefined,
      }),
    );
    if (ok) {
      setOpen(false);
      setVehicle('');
      setDriver('');
    }
  }

  function remove(u: Unloading) {
    Alert.alert(u.vehicleNumber, t('confirmDelete'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => run(u.id, () => importsApi.removeUnloading(load.id, u.id)) },
    ]);
  }

  const total = load.unloadings.reduce((sum, u) => sum + (u.totalCharges ?? 0), 0);

  return (
    <View style={{ gap: 10 }}>
      {load.unloadings.length === 0 && !open && <Text style={s.muted}>{t('noUnloading')}</Text>}

      {load.unloadings.map((u) => (
        <View key={u.id} style={s.card}>
          <View style={s.rowBetween}>
            <Text style={s.cardTitle}>{u.vehicleNumber}</Text>
            {u.endAt ? (
              <Text style={s.cardNumber}>{u.totalCharges != null ? inr(u.totalCharges) : '—'}</Text>
            ) : (
              <Text style={[s.pillText, { color: c.accent }]}>{t('inProgress')}</Text>
            )}
          </View>
          <Text style={s.muted}>
            {timeOnly(u.startAt)} → {u.endAt ? timeOnly(u.endAt) : '…'}
            {u.durationMinutes != null && ` · ${formatDuration(u.durationMinutes)}`}
            {u.ratePerHour != null && ` · ${inr(u.ratePerHour)}/h`}
            {u.driverName ? ` · ${u.driverName}` : ''}
          </Text>
          {load.editable && (
            <View style={s.row}>
              {!u.endAt && (
                <View style={s.fill}>
                  <Button
                    icon="square"
                    title={t('endNow')}
                    busy={busy === u.id}
                    onPress={() => run(u.id, () => importsApi.endUnloading(load.id, u.id))}
                  />
                </View>
              )}
              <Pressable onPress={() => remove(u)} style={s.iconBtn} accessibilityRole="button" accessibilityLabel={t('delete')}>
                <Feather name="trash-2" size={18} color={c.bad} />
              </Pressable>
            </View>
          )}
        </View>
      ))}

      {load.unloadings.some((u) => u.totalCharges != null) && (
        <View style={s.kv}>
          <Text style={s.kvKey}>{t('totalUnloadingCharges')}</Text>
          <Text style={s.kvVal}>{inr(total)}</Text>
        </View>
      )}

      {error && <ErrorBox message={error} />}

      {load.editable &&
        (open ? (
          <View style={s.card}>
            <View style={s.field}>
              <Text style={s.label}>
                {t('vehicleNumber')}
                <Text style={{ color: c.bad }}> *</Text>
              </Text>
              <TextInput style={s.input} value={vehicle} onChangeText={setVehicle} autoCapitalize="characters" accessibilityLabel={t('vehicleNumber')} />
            </View>
            <View style={s.field}>
              <Text style={s.label}>{t('driverName')}</Text>
              <TextInput style={s.input} value={driver} onChangeText={setDriver} autoCapitalize="words" accessibilityLabel={t('driverName')} />
            </View>
            <View style={s.field}>
              <Text style={s.label}>{t('ratePerHour')}</Text>
              <TextInput style={s.input} value={rate} onChangeText={setRate} keyboardType="decimal-pad" accessibilityLabel={t('ratePerHour')} />
            </View>
            <Text style={s.muted}>{t('calcFromRate')}</Text>
            <View style={s.row}>
              <View style={s.fill}>
                <Button kind="secondary" title={t('cancel')} onPress={() => setOpen(false)} />
              </View>
              <View style={s.fill}>
                <Button icon="play" title={t('startUnloading')} busy={busy === 'start'} disabled={vehicle.trim().length < 2} onPress={start} />
              </View>
            </View>
          </View>
        ) : (
          <Button kind="secondary" icon="truck" title={t('startUnloading')} onPress={() => setOpen(true)} />
        ))}
    </View>
  );
}

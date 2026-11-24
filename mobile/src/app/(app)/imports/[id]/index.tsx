/** One import load: status and approval, measured totals, unloading vehicles, lorry details, and (owner) purchase. */
import { formatDuration, Permission } from '@timbertrail/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useCSSVariable } from 'uniwind';
import { TreeRings } from '../../../../components/glow';
import { Text } from '../../../../components/text';
import { useConfirm } from '../../../../components/confirm';
import { Fold } from '../../../../components/fold';
import { NumberField, Field } from '../../../../components/form';
import { HeaderButton, Page, ScreenHeader } from '../../../../components/header';
import { PurchaseDetails } from '../../../../components/PurchaseDetails';
import { AppBottomSheet, SheetActions, useSheet } from '../../../../components/bottom-sheet';
import {
  Button,
  Card,
  cn,
  ErrorBox,
  Icon,
  IconButton,
  KV,
  ModTile,
  Muted,
  Notice,
  Reason,
  SectionTitle,
  SkeletonList,
  StatPair,
  StatusPill,
} from '../../../../components/ui';
import { toast } from '../../../../components/toast';
import { WorkflowBar } from '../../../../components/workflow';
import { BackToSawingBar } from '../../../../components/way-back-bar';
import { param, sawingLink } from '../../../../lib/ways-back';
import { dateTime, inr, int, num3, parseNum, timeOnly } from '../../../../lib/format';
import { useLocked, useSubmit } from '../../../../lib/hooks';
import { useT } from '../../../../lib/i18n';
import { type ImportDetail, importsApi, type Unloading } from '../../../../lib/imports-api';
import { usePendingLogs } from '../../../../lib/offline-logs';
import { invalidateOperations, useApi } from '../../../../lib/query';
import { useSession } from '../../../../lib/session';

export default function ImportDetailScreen() {
  const { id, back } = useLocalSearchParams<{ id: string; back?: string }>();
  const t = useT();
  const router = useRouter();
  const { can, user, simple } = useSession();
  const forSawing = sawingLink(param(back));
  const q = useApi<ImportDetail>(`/imports/${id}`);
  const load = q.data;
  /** logs measured offline for this load that the server hasn't got yet */
  const pending = usePendingLogs(user?.id, id);
  const waiting = pending.filter((p) => !p.error).length;

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
        [t('notes'), load.notes],
        [t('createdBy'), load.createdByName],
      ]
    : [];

  const unloading = load && (
    <>
      <SectionTitle>{t('unloading')}</SectionTitle>
      <UnloadingSection load={load} onChanged={() => void q.refetch()} />
    </>
  );
  const moreDetails = load && (
    <>
      <SectionTitle>{t('importDetails')}</SectionTitle>
      <Card>
        {details
          .filter((d): d is [string, string] => !!d[1])
          .map(([k, v]) => (
            <KV key={k} label={k} value={v} />
          ))}
      </Card>
    </>
  );

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader compact
        back
        title={load ? load.code : t('importDetails')}
        subtitle={load ? `${load.lorryNumber} · ${load.woodType}` : undefined}
        right={load?.editable ? <HeaderButton icon="edit-2" label={t('edit')} onPress={() => router.push(`/imports/${id}/edit`)} /> : null}
      />
      <Page compact refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
        {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
        {!load && !q.error && <SkeletonList rows={3} />}

        {load && (
          <>
            {forSawing && <BackToSawingBar back={forSawing} loadId={load.id} />}
            <View className="flex-row items-center gap-2">
              <StatusPill status={load.status} />
              <Muted>{dateTime(load.arrivalAt)}</Muted>
            </View>
            {!!load.rejectionReason && <Reason>{load.rejectionReason}</Reason>}
            {!load.editable && load.status !== 'APPROVED' && load.status !== 'SUBMITTED' && <Notice icon="lock">{t('lockedRecord')}</Notice>}

            <StatPair a={{ label: t('logsMeasured'), value: int(load.totalLogs) }} b={{ label: t('totalCft'), value: num3(load.totalCft) }} />
            {pending.length > 0 && <Notice icon="upload-cloud">{waiting > 0 ? `${t('pendingLogs', { n: waiting })}. ${t('pendingLogsSub')}` : t('notSent')}</Notice>}
            <Button
              kind={load.editable ? 'primary' : 'secondary'}
              icon={load.editable ? 'edit-3' : 'list'}
              title={load.editable ? t('measure') : t('measurementHistory')}
              onPress={() => router.push({ pathname: '/imports/[id]/measure', params: { id, ...(forSawing && { back: forSawing }) } })}
            />

            <WorkflowBar
              base={`/imports/${id}`}
              code={load.code}
              status={load.status}
              canSubmit={load.canSubmit}
              canReview={load.canReview}
              confirmApprove={t('confirmApprove', { code: load.code, cft: num3(load.totalCft) })}
              submitBlocked={pending.length > 0 ? t('submitPendingBlocked') : load.totalLogs === 0 ? t('needLogsToSubmit') : null}
              approvedNote={t('approvedStockNote')}
              onDone={() => void q.refetch()}
            />

            {simple ? (
              // simple view: the daily work up front (measure, send), the purchase, then the rest folded away
              <>
                {unloading}
                {can(Permission.FINANCE_VIEW) && <PurchaseDetails importId={load.id} totalCft={load.totalCft} />}
                <Fold title={t('moreDetails')}>
                  {moreDetails}
                </Fold>
              </>
            ) : (
              <>
                {unloading}
                {moreDetails}
                {can(Permission.FINANCE_VIEW) && <PurchaseDetails importId={load.id} totalCft={load.totalCft} />}
              </>
            )}
          </>
        )}
      </Page>
    </View>
  );
}

/** Start an unloading vehicle now, end it now — the server works out duration and charges. */
function UnloadingSection({ load, onChanged }: { load: ImportDetail; onChanged: () => void }) {
  const t = useT();
  const confirm = useConfirm();
  const sheet = useSheet();
  const [vehicle, setVehicle] = useState('');
  const [driver, setDriver] = useState('');
  const [rate, setRate] = useState(load.defaultUnloadingRate != null ? String(load.defaultUnloadingRate) : '');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const [start, starting, startError] = useSubmit(async () => {
    const r = parseNum(rate);
    await importsApi.startUnloading(load.id, { vehicleNumber: vehicle.trim(), driverName: driver.trim() || undefined, ratePerHour: r ?? undefined });
    await invalidateOperations();
    sheet.close();
    setVehicle('');
    setDriver('');
    toast(t('unloadingAddedToast'), 'success', vehicle.trim());
    onChanged();
  });

  // End / Delete: one at a time, locked on the tap (a busy state alone lets a double tap through)
  const locked = useLocked();
  async function run(u: Unloading, fn: () => Promise<unknown>, done: string) {
    setBusyId(u.id);
    setRowError(null);
    try {
      await fn();
      await invalidateOperations();
      toast(done, 'success', u.vehicleNumber);
      onChanged();
    } catch (e) {
      setRowError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const end = locked((u: Unloading) => run(u, () => importsApi.endUnloading(load.id, u.id), t('unloadingEndedToast')));
  const remove = locked(async (u: Unloading) => {
    if (await confirm({ title: u.vehicleNumber, message: t('confirmDelete'), confirmText: t('delete'), cancelText: t('cancel'), destructive: true })) {
      await run(u, () => importsApi.removeUnloading(load.id, u.id), t('unloadingDeletedToast'));
    }
  });

  const total = load.unloadings.reduce((sum, u) => sum + (u.totalCharges ?? 0), 0);

  return (
    <View className="gap-2.5">
      {load.unloadings.length === 0 && <Muted>{t('noUnloading')}</Muted>}
      {load.unloadings.map((u) =>
        u.endAt ? (
          <Card key={u.id} className="flex-row items-center gap-3">
            <ModTile mod="unload" icon="truck" size="sm" />
            <View className="flex-1 gap-0.5">
              <Text className="text-[16px] font-bold text-foreground">{u.vehicleNumber}</Text>
              <Muted>
                {timeOnly(u.startAt)} → {timeOnly(u.endAt)}
                {u.durationMinutes != null && ` · ${formatDuration(u.durationMinutes)}`}
                {u.driverName ? ` · ${u.driverName}` : ''}
              </Muted>
            </View>
            <Text className="text-[16px] font-bold tabular-nums text-foreground">{u.totalCharges != null ? inr(u.totalCharges) : '—'}</Text>
            {load.editable && <IconButton icon="trash-2" tone="bad" label={t('delete')} onPress={() => void remove(u)} />}
          </Card>
        ) : (
          <RunningUnloading key={u.id} u={u} editable={load.editable} busy={busyId === u.id} onEnd={() => void end(u)} onRemove={() => void remove(u)} />
        ),
      )}
      {load.unloadings.some((u) => u.totalCharges != null) && <KV label={t('totalUnloadingCharges')} value={inr(total)} strong />}
      {rowError && <ErrorBox message={rowError} />}
      {load.editable && (
        <Pressable
          onPress={sheet.open}
          accessibilityRole="button"
          className="min-h-[76px] flex-row items-center gap-3.5 rounded-3xl border border-dashed border-input bg-card px-4 py-3 active:bg-secondary"
        >
          <ModTile mod="unload" icon="truck" />
          <View className="flex-1 gap-0.5">
            <Text className="text-[16px] font-bold text-foreground">{t('startUnloading')}</Text>
            <Muted>{t('unloadingVehicleHint')}</Muted>
          </View>
          <Icon name="plus" size={22} colorClassName="accent-saffron-strong" />
        </Pressable>
      )}

      <AppBottomSheet
        ref={sheet.ref}
        variant="medium"
        title={t('startUnloading')}
        // once something is typed, only back or × closes it
        protect={!!(vehicle.trim() || driver.trim())}
        footer={<SheetActions primary={{ icon: 'play', title: t('startUnloading'), busy: starting, disabled: vehicle.trim().length < 2, onPress: () => void start() }} />}
      >
        <View className="gap-3.5">
          <Field label={t('vehicleNumber')} required value={vehicle} onChangeText={setVehicle} autoCapitalize="characters" hint={t('unloadingVehicleHint')} />
          <Field label={t('driverName')} value={driver} onChangeText={setDriver} autoCapitalize="words" />
          <NumberField label={t('ratePerHour')} unit="₹/h" value={rate} onChangeText={setRate} hint={t('calcFromRate')} />
          {startError && <ErrorBox message={startError} />}
        </View>
      </AppBottomSheet>
    </View>
  );
}

/** "h:mm" from minutes */
const clock = (min: number) => `${Math.floor(min / 60)}:${String(Math.floor(min % 60)).padStart(2, '0')}`;

/**
 * An unloading still running: the teal timer card (time since it started, ticking each half
 * minute), Stop, and the charge so far at its rate per hour. The server works out the final
 * duration and charge when it is stopped.
 */
function RunningUnloading({ u, editable, busy, onEnd, onRemove }: { u: Unloading; editable: boolean; busy: boolean; onEnd: () => void; onRemove: () => void }) {
  const t = useT();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(h);
  }, []);
  const minutes = Math.max(0, (now - new Date(u.startAt).getTime()) / 60_000);
  const soFar = u.ratePerHour != null ? Math.round((minutes / 60) * u.ratePerHour) : null;
  const [ring] = useCSSVariable(['--color-hero-foreground']).map(String);
  return (
    <View className="gap-3">
      <View className="gap-1 overflow-hidden rounded-3xl bg-mod-teal p-5">
        <TreeRings color={ring} placement="top-right" size={240} opacity={0.12} />
        <View className="flex-row items-center gap-2">
          <View className="h-2.5 w-2.5 rounded-full bg-mod-green-soft" />
          <Text className="flex-1 text-[15px] font-semibold text-white" numberOfLines={1}>
            {u.vehicleNumber}
            {u.driverName ? ` · ${u.driverName}` : ''}
          </Text>
          {editable && (
            <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={t('delete')} hitSlop={8} className="h-9 w-9 items-center justify-center rounded-full active:bg-white/15">
              <Icon name="trash-2" size={17} colorClassName="accent-white" />
            </Pressable>
          )}
        </View>
        <Text className="text-center text-[64px] font-bold leading-[72px] tabular-nums text-white font-display" accessibilityLabel={formatDuration(Math.round(minutes))}>
          {clock(minutes)}
        </Text>
        <Text className="text-center text-[14px] text-white/80">
          {t('inProgress')} · {timeOnly(u.startAt)}
        </Text>
        {editable && (
          <Pressable
            onPress={onEnd}
            disabled={busy}
            accessibilityRole="button"
            className={cn('mt-3 min-h-[56px] flex-row items-center justify-center gap-2.5 rounded-2xl bg-white active:opacity-85', busy && 'opacity-70')}
          >
            <View className="h-4 w-4 rounded-[4px] bg-destructive" />
            <Text className="text-[17px] font-bold text-destructive">{t('endNow')}</Text>
          </Pressable>
        )}
      </View>
      {soFar != null && (
        <Card className="flex-row items-center justify-between">
          <View>
            <Muted>{t('chargeSoFar')}</Muted>
            <Text className="text-[24px] font-bold tabular-nums text-foreground font-display">{inr(soFar)}</Text>
          </View>
          <Text className="text-right text-[14px] text-muted-foreground">{inr(u.ratePerHour!)} / h</Text>
        </Card>
      )}
    </View>
  );
}

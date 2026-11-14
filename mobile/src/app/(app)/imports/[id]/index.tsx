/** One import load: status and approval, measured totals, unloading vehicles, lorry details, and (owner) purchase. */
import { formatDuration, Permission } from '@sawmill/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useConfirm } from '../../../../components/confirm';
import { NumberField, Field } from '../../../../components/form';
import { HeaderButton, Page, ScreenHeader } from '../../../../components/header';
import { PurchaseDetails } from '../../../../components/PurchaseDetails';
import { Sheet, useSheet } from '../../../../components/sheet';
import {
  Button,
  Card,
  ErrorBox,
  IconButton,
  KV,
  Muted,
  Notice,
  Reason,
  SectionTitle,
  SkeletonList,
  StatPair,
  StatusPill,
} from '../../../../components/ui';
import { WorkflowBar } from '../../../../components/workflow';
import { dateTime, inr, int, num3, parseNum, timeOnly } from '../../../../lib/format';
import { useSubmit } from '../../../../lib/hooks';
import { useT } from '../../../../lib/i18n';
import { type ImportDetail, importsApi, type Unloading } from '../../../../lib/imports-api';
import { invalidateOperations, useApi } from '../../../../lib/query';
import { useSession } from '../../../../lib/session';

export default function ImportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const router = useRouter();
  const { can } = useSession();
  const q = useApi<ImportDetail>(`/imports/${id}`);
  const load = q.data;

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

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        back
        title={load ? load.code : t('importDetails')}
        subtitle={load ? `${load.lorryNumber} · ${load.woodType}` : undefined}
        right={load?.editable ? <HeaderButton icon="edit-2" label={t('edit')} onPress={() => router.push(`/imports/${id}/edit`)} /> : null}
      />
      <Page refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
        {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
        {!load && !q.error && <SkeletonList rows={3} />}

        {load && (
          <>
            <View className="flex-row items-center gap-2">
              <StatusPill status={load.status} />
              <Muted>{dateTime(load.arrivalAt)}</Muted>
            </View>
            {!!load.rejectionReason && <Reason>{load.rejectionReason}</Reason>}
            {!load.editable && load.status !== 'APPROVED' && load.status !== 'SUBMITTED' && <Notice icon="lock">{t('lockedRecord')}</Notice>}

            <StatPair a={{ label: t('logsMeasured'), value: int(load.totalLogs) }} b={{ label: t('totalCft'), value: num3(load.totalCft) }} />
            <Button
              kind={load.editable ? 'primary' : 'secondary'}
              icon={load.editable ? 'edit-3' : 'list'}
              title={load.editable ? t('measure') : t('measurementHistory')}
              onPress={() => router.push(`/imports/${id}/measure`)}
            />

            <WorkflowBar
              base={`/imports/${id}`}
              code={load.code}
              status={load.status}
              canSubmit={load.canSubmit}
              canReview={load.canReview}
              confirmApprove={t('confirmApprove', { code: load.code, cft: num3(load.totalCft) })}
              submitBlocked={load.totalLogs === 0 ? t('needLogsToSubmit') : null}
              approvedNote={t('approvedStockNote')}
              onDone={() => void q.refetch()}
            />

            <SectionTitle>{t('unloading')}</SectionTitle>
            <UnloadingSection load={load} onChanged={() => void q.refetch()} />

            <SectionTitle>{t('importDetails')}</SectionTitle>
            <Card>
              {details
                .filter((d): d is [string, string] => !!d[1])
                .map(([k, v]) => (
                  <KV key={k} label={k} value={v} />
                ))}
            </Card>

            {can(Permission.FINANCE_VIEW) && <PurchaseDetails importId={load.id} totalCft={load.totalCft} />}
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
    onChanged();
  });

  async function run(u: Unloading, fn: () => Promise<unknown>) {
    if (busyId) return;
    setBusyId(u.id);
    setRowError(null);
    try {
      await fn();
      await invalidateOperations();
      onChanged();
    } catch (e) {
      setRowError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(u: Unloading) {
    if (await confirm({ title: u.vehicleNumber, message: t('confirmDelete'), confirmText: t('delete'), cancelText: t('cancel'), destructive: true })) {
      await run(u, () => importsApi.removeUnloading(load.id, u.id));
    }
  }

  const total = load.unloadings.reduce((sum, u) => sum + (u.totalCharges ?? 0), 0);

  return (
    <View className="gap-2.5">
      {load.unloadings.length === 0 && <Muted>{t('noUnloading')}</Muted>}
      {load.unloadings.map((u) => (
        <Card key={u.id}>
          <View className="flex-row items-center justify-between gap-2.5">
            <Text className="text-[15px] font-semibold text-foreground">{u.vehicleNumber}</Text>
            {u.endAt ? (
              <Text className="text-[15px] font-bold tabular-nums text-foreground">{u.totalCharges != null ? inr(u.totalCharges) : '—'}</Text>
            ) : (
              <Text className="text-xs font-semibold text-warning">{t('inProgress')}</Text>
            )}
          </View>
          <Muted>
            {timeOnly(u.startAt)} → {u.endAt ? timeOnly(u.endAt) : '…'}
            {u.durationMinutes != null && ` · ${formatDuration(u.durationMinutes)}`}
            {u.ratePerHour != null && ` · ${inr(u.ratePerHour)}/h`}
            {u.driverName ? ` · ${u.driverName}` : ''}
          </Muted>
          {load.editable && (
            <View className="flex-row items-center gap-2.5">
              {!u.endAt && (
                <Button className="flex-1" size="md" icon="square" title={t('endNow')} busy={busyId === u.id} onPress={() => void run(u, () => importsApi.endUnloading(load.id, u.id))} />
              )}
              <View className="flex-1" />
              <IconButton icon="trash-2" tone="bad" label={t('delete')} onPress={() => void remove(u)} />
            </View>
          )}
        </Card>
      ))}
      {load.unloadings.some((u) => u.totalCharges != null) && <KV label={t('totalUnloadingCharges')} value={inr(total)} strong />}
      {rowError && <ErrorBox message={rowError} />}
      {load.editable && <Button kind="secondary" icon="truck" title={t('startUnloading')} onPress={sheet.open} />}

      <Sheet
        ref={sheet.ref}
        title={t('startUnloading')}
        footer={<Button icon="play" title={t('startUnloading')} busy={starting} disabled={vehicle.trim().length < 2} onPress={() => void start()} />}
      >
        <View className="gap-3.5 px-5">
          <Field label={t('vehicleNumber')} required value={vehicle} onChangeText={setVehicle} autoCapitalize="characters" hint={t('unloadingVehicleHint')} />
          <Field label={t('driverName')} value={driver} onChangeText={setDriver} autoCapitalize="words" />
          <NumberField label={t('ratePerHour')} unit="₹/h" value={rate} onChangeText={setRate} hint={t('calcFromRate')} />
          {startError && <ErrorBox message={startError} />}
        </View>
      </Sheet>
    </View>
  );
}

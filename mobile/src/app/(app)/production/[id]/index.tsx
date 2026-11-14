/**
 * One production run: raw wood in, finished sizes out, waste and recovery, and approval.
 * Sizes are added in a sheet that keeps thickness and width for the next size, so a run
 * of many lengths is quick to enter. CFT = T × W × L × pieces / 144 (shared formula, 3 decimals).
 */
import { exportPieceCft, sizeLabel } from '@sawmill/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useConfirm } from '../../../../components/confirm';
import { NumberField, Row } from '../../../../components/form';
import { HeaderButton, Page, ScreenHeader } from '../../../../components/header';
import { Sheet, useSheet } from '../../../../components/sheet';
import { toast } from '../../../../components/toast';
import {
  Button,
  Card,
  cn,
  EmptyState,
  ErrorBox,
  Icon,
  KV,
  MenuGroup,
  Muted,
  Notice,
  Reason,
  SectionTitle,
  SkeletonList,
  StatPair,
  StatusPill,
} from '../../../../components/ui';
import { WorkflowBar } from '../../../../components/workflow';
import { api } from '../../../../lib/api';
import { dateOnly, dateTime, int, num3, parseNum } from '../../../../lib/format';
import { useSubmit } from '../../../../lib/hooks';
import { useT } from '../../../../lib/i18n';
import { invalidateOperations, useApi } from '../../../../lib/query';
import type { Output, ProductionDetail } from '../../../../lib/types';

type SizeForm = { thickness: string; width: string; length: string; pieces: string };
const EMPTY: SizeForm = { thickness: '', width: '', length: '', pieces: '' };

export default function ProductionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const router = useRouter();
  const confirm = useConfirm();
  const q = useApi<ProductionDetail>(`/production/${id}`);
  const run = q.data;
  const sheet = useSheet();
  const [size, setSize] = useState<SizeForm>(EMPTY);
  const [editing, setEditing] = useState<Output | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const T = parseNum(size.thickness);
  const W = parseNum(size.width);
  const L = parseNum(size.length);
  const N = parseNum(size.pieces);
  const valid = !!T && !!W && !!L && !!N && T > 0 && W > 0 && L > 0 && N > 0 && T <= 999 && W <= 999 && L <= 999 && Number.isInteger(N);
  const live = valid ? exportPieceCft(T!, W!, L!, N!) : null;

  const [saveSize, saving, sizeError] = useSubmit(async () => {
    if (!run || !valid) return;
    const body = JSON.stringify({ thicknessIn: T, widthIn: W, lengthFt: L, pieces: N });
    if (editing) await api(`/production/${run.id}/outputs/${editing.id}`, { method: 'PATCH', body });
    else await api(`/production/${run.id}/outputs`, { method: 'POST', body });
    await q.refetch();
    void invalidateOperations();
    toast(`${sizeLabel(T!, W!, L!)} · ${int(N!)} ${t('pieces')}`);
    if (editing) {
      setEditing(null);
      sheet.close();
    } else {
      // keep thickness and width for the next size
      setSize((s) => ({ ...s, length: '', pieces: '' }));
    }
  });

  function openAdd() {
    setEditing(null);
    setSize((s) => ({ ...EMPTY, thickness: s.thickness, width: s.width }));
    sheet.open();
  }
  function openEdit(o: Output) {
    setEditing(o);
    setSize({ thickness: String(o.thicknessIn), width: String(o.widthIn), length: String(o.lengthFt), pieces: String(o.pieces) });
    sheet.open();
  }
  async function removeSize(o: Output) {
    if (!run) return;
    const ok = await confirm({ title: sizeLabel(o.thicknessIn, o.widthIn, o.lengthFt), message: t('confirmDelete'), confirmText: t('delete'), cancelText: t('cancel'), destructive: true });
    if (!ok) return;
    setRowError(null);
    try {
      await api(`/production/${run.id}/outputs/${o.id}`, { method: 'DELETE' });
      await q.refetch();
      void invalidateOperations();
    } catch (e) {
      setRowError((e as Error).message);
    }
  }

  const blocked = !run
    ? null
    : run.inputCft == null || run.outputs.length === 0
      ? t('needInputAndOutput')
      : run.outputCft > run.inputCft
        ? t('outputExceedsInput')
        : null;
  const outputAfter = run && live != null ? run.outputCft - (editing?.cft ?? 0) + live : null;

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        back
        title={run?.code ?? t('productionDetails')}
        subtitle={run ? `${run.importCode} · ${run.woodType}` : undefined}
        right={run?.editable ? <HeaderButton icon="edit-2" label={t('edit')} onPress={() => router.push(`/production/${id}/edit`)} /> : null}
      />
      <Page refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
        {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
        {!run && !q.error && <SkeletonList rows={3} />}
        {run && (
          <>
            <View className="flex-row items-center gap-2">
              <StatusPill status={run.status} />
              <Muted>{dateOnly(run.productionDate)}</Muted>
            </View>
            {!!run.rejectionReason && <Reason>{run.rejectionReason}</Reason>}

            <StatPair
              a={{ label: t('inputCft'), value: run.inputCft != null ? num3(run.inputCft) : '—' }}
              b={{ label: t('outputCft'), value: num3(run.outputCft) }}
            />
            <Card>
              <KV label={t('wasteCft')} value={run.wasteCft != null ? `${num3(run.wasteCft)} CFT` : '—'} />
              <KV label={t('recovery')} value={run.recoveryPercent != null ? `${run.recoveryPercent}%` : '—'} />
              {run.editable && <KV label={t('rawLeftInLoad')} value={`${num3(run.rawAvailableCft)} CFT`} />}
              {run.recoveryPercent != null && <Muted>{t('recoveryLine', { n: run.recoveryPercent })}</Muted>}
            </Card>
            {blocked === t('outputExceedsInput') && <Notice tone="bad">{blocked}</Notice>}

            <SectionTitle action={run.editable ? { label: `+ ${t('addSize')}`, onPress: openAdd } : undefined}>
              {t('outputSizes')} · {int(run.outputs.length)}
            </SectionTitle>
            {run.outputs.length === 0 ? (
              <EmptyState icon="package" title={t('noOutputs')} body={run.editable ? t('sizeHint') : undefined} action={run.editable ? { label: t('addSize'), onPress: openAdd } : undefined} />
            ) : (
              <MenuGroup>
                {run.outputs.map((o, i) => (
                  <Pressable
                    key={o.id}
                    disabled={!run.editable}
                    onPress={() => openEdit(o)}
                    onLongPress={() => void removeSize(o)}
                    accessibilityRole={run.editable ? 'button' : undefined}
                    className={cn('min-h-14 flex-row items-center gap-3 px-4 py-3 active:bg-secondary', i < run.outputs.length - 1 && 'border-b border-border')}
                  >
                    <View className="flex-1">
                      <Text className="text-[15px] font-semibold text-foreground">{sizeLabel(o.thicknessIn, o.widthIn, o.lengthFt)}</Text>
                      <Muted>{t('piecesCount', { n: int(o.pieces) })}</Muted>
                    </View>
                    <Text className="text-[15px] font-bold tabular-nums text-foreground">{num3(o.cft)}</Text>
                    {run.editable && <Icon name="edit-2" size={15} colorClassName="accent-muted-foreground" />}
                  </Pressable>
                ))}
              </MenuGroup>
            )}
            {rowError && <ErrorBox message={rowError} />}
            {run.editable && run.outputs.length > 0 && <Button kind="secondary" icon="plus" title={t('addSize')} onPress={openAdd} />}

            <WorkflowBar
              base={`/production/${id}`}
              code={run.code}
              status={run.status}
              canSubmit={run.canSubmit}
              canReview={run.canReview}
              confirmApprove={t('confirmApproveProduction', { code: run.code, input: num3(run.inputCft ?? 0), output: num3(run.outputCft) })}
              submitBlocked={blocked}
              approvedNote={t('approvedProductionNote')}
              onDone={() => void q.refetch()}
            />

            <SectionTitle>{t('runDetails')}</SectionTitle>
            <Card>
              <KV label={t('sourceLoad')} value={`${run.importCode} · ${run.importLorryNumber}`} />
              {!!run.cuttingMachine && <KV label={t('cuttingMachine')} value={run.cuttingMachine} />}
              {!!run.machineOperator && <KV label={t('machineOperator')} value={run.machineOperator} />}
              {!!run.workerDetails && <KV label={t('workerDetails')} value={run.workerDetails} />}
              {!!run.startAt && <KV label={t('startTime')} value={dateTime(run.startAt)} />}
              {!!run.endAt && <KV label={t('endTime')} value={dateTime(run.endAt)} />}
              {!!run.wasteNotes && <KV label={t('wasteNotes')} value={run.wasteNotes} />}
              <KV label={t('createdBy')} value={run.createdByName} />
            </Card>
            <Button kind="ghost" size="md" icon="external-link" title={t('openLoad')} onPress={() => router.push(`/imports/${run.importLoadId}`)} />
          </>
        )}
      </Page>

      <Sheet
        ref={sheet.ref}
        title={editing ? t('edit') : t('addSize')}
        onDismiss={() => setEditing(null)}
        footer={<Button icon={editing ? 'check' : 'plus'} title={editing ? t('save') : t('addSize')} busy={saving} disabled={!valid} onPress={() => void saveSize()} />}
      >
        <View className="gap-3.5 px-5">
          <Row>
            <NumberField label={t('thickness')} unit="in" value={size.thickness} onChangeText={(thickness) => setSize((s) => ({ ...s, thickness }))} />
            <NumberField label={t('width')} unit="in" value={size.width} onChangeText={(width) => setSize((s) => ({ ...s, width }))} />
          </Row>
          <Row>
            <NumberField label={t('lengthFt')} unit="ft" value={size.length} onChangeText={(length) => setSize((s) => ({ ...s, length }))} />
            <NumberField label={t('pieces')} decimals={0} value={size.pieces} onChangeText={(pieces) => setSize((s) => ({ ...s, pieces }))} />
          </Row>
          <View className="flex-row items-center justify-between rounded-xl bg-saffron-soft px-4 py-3">
            <Text className="text-sm font-semibold text-warning">{t('thisSize')}</Text>
            <Text className="text-xl font-bold tabular-nums text-warning">{num3(live ?? 0)} CFT</Text>
          </View>
          {outputAfter != null && run?.inputCft != null && (
            <Muted>
              {t('finishedAfterSize')}: {num3(outputAfter)} / {num3(run.inputCft)} CFT
            </Muted>
          )}
          <Muted>{t('sizeHint')}</Muted>
          {sizeError && <ErrorBox message={sizeError} />}
        </View>
      </Sheet>
    </View>
  );
}

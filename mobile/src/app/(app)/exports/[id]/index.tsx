/**
 * One export load: the measured lines (each taken from one import load's finished stock),
 * totals, approval, lorry details and (owner) the sale. Lines are picked from what is in
 * stock for this wood type; CFT = T × W × L × pieces / 144 (shared formula, 3 decimals).
 */
import { exportPieceCft, Permission, sizeLabel } from '@sawmill/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useConfirm } from '../../../../components/confirm';
import { NumberField } from '../../../../components/form';
import { HeaderButton, Page, ScreenHeader } from '../../../../components/header';
import { SaleDetails } from '../../../../components/SaleDetails';
import { SelectField, Sheet, useSheet } from '../../../../components/sheet';
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
import { useSession } from '../../../../lib/session';
import type { Balances, ExportDetail, ExportLine, FinishedStockRow } from '../../../../lib/types';

const posKey = (l: { importLoadId: string | null; thicknessIn: number; widthIn: number; lengthFt: number }) => `${l.importLoadId}|${l.thicknessIn}|${l.widthIn}|${l.lengthFt}`;

export default function ExportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const router = useRouter();
  const confirm = useConfirm();
  const { can } = useSession();
  const q = useApi<ExportDetail>(`/exports/${id}`);
  const exp = q.data;
  const stock = useApi<Balances>(exp?.editable ? '/stock' : null);
  const sheet = useSheet();
  const [editing, setEditing] = useState<ExportLine | null>(null);
  const [pick, setPick] = useState('');
  const [pieces, setPieces] = useState('');
  const [rowError, setRowError] = useState<string | null>(null);

  const rows = useMemo(() => (stock.data?.finished ?? []).filter((r) => r.woodType === exp?.woodType && r.pieces > 0), [stock.data, exp?.woodType]);
  const options = rows.map((r) => ({
    value: posKey(r),
    label: sizeLabel(r.thicknessIn, r.widthIn, r.lengthFt),
    hint: `${r.importCode} · ${t('piecesCount', { n: int(r.pieces) })} ${t('inStock')}`,
  }));
  const chosen: FinishedStockRow | ExportLine | undefined = rows.find((r) => posKey(r) === pick) ?? (editing && posKey(editing) === pick ? editing : undefined);

  const N = parseNum(pieces);
  const okPieces = N != null && Number.isInteger(N) && N > 0;
  const live = chosen && okPieces ? exportPieceCft(chosen.thicknessIn, chosen.widthIn, chosen.lengthFt, N!) : null;
  const available = chosen ? ('availablePieces' in chosen ? chosen.availablePieces : chosen.pieces) : 0;
  const alreadyWanted = exp && chosen ? exp.lines.filter((l) => posKey(l) === posKey(chosen) && l.id !== editing?.id).reduce((s, l) => s + l.pieces, 0) : 0;
  const over = okPieces && chosen ? N! + alreadyWanted > available : false;

  const [saveLine, saving, lineError] = useSubmit(async () => {
    if (!exp || !chosen || !okPieces) return;
    const body = JSON.stringify({ importLoadId: chosen.importLoadId ?? undefined, thicknessIn: chosen.thicknessIn, widthIn: chosen.widthIn, lengthFt: chosen.lengthFt, pieces: N });
    if (editing) await api(`/exports/${exp.id}/measurements/${editing.id}`, { method: 'PATCH', body });
    else await api(`/exports/${exp.id}/measurements`, { method: 'POST', body });
    await q.refetch();
    void invalidateOperations();
    toast(`${sizeLabel(chosen.thicknessIn, chosen.widthIn, chosen.lengthFt)} · ${int(N!)} ${t('pieces')}`);
    setEditing(null);
    setPick('');
    setPieces('');
    sheet.close();
  });

  function openAdd() {
    setEditing(null);
    setPick('');
    setPieces('');
    sheet.open();
  }
  function openEdit(l: ExportLine) {
    setEditing(l);
    setPick(posKey(l));
    setPieces(String(l.pieces));
    sheet.open();
  }
  async function removeLine(l: ExportLine) {
    if (!exp) return;
    const ok = await confirm({ title: `${t('lineNo')}${l.lineNumber}`, message: t('confirmDelete'), confirmText: t('delete'), cancelText: t('cancel'), destructive: true });
    if (!ok) return;
    setRowError(null);
    try {
      await api(`/exports/${exp.id}/measurements/${l.id}`, { method: 'DELETE' });
      await q.refetch();
      void invalidateOperations();
    } catch (e) {
      setRowError((e as Error).message);
    }
  }

  const wanted = new Map<string, number>();
  exp?.lines.forEach((l) => wanted.set(posKey(l), (wanted.get(posKey(l)) ?? 0) + l.pieces));
  const short = (l: ExportLine) => exp?.status !== 'APPROVED' && (wanted.get(posKey(l)) ?? 0) > l.availablePieces;

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        back
        title={exp?.code ?? t('exportDetails')}
        subtitle={exp ? `${exp.lorryNumber} · ${exp.woodType}` : undefined}
        right={exp?.editable ? <HeaderButton icon="edit-2" label={t('edit')} onPress={() => router.push(`/exports/${id}/edit`)} /> : null}
      />
      <Page refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
        {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
        {!exp && !q.error && <SkeletonList rows={3} />}
        {exp && (
          <>
            <View className="flex-row items-center gap-2">
              <StatusPill status={exp.status} />
              <Muted>{dateOnly(exp.exportDate)}</Muted>
            </View>
            {!!exp.rejectionReason && <Reason>{exp.rejectionReason}</Reason>}
            <StatPair a={{ label: t('totalPieces'), value: int(exp.totalPieces) }} b={{ label: t('totalCft'), value: num3(exp.totalCft) }} />

            <SectionTitle action={exp.editable ? { label: `+ ${t('addLine')}`, onPress: openAdd } : undefined}>
              {t('measuredLines')} · {int(exp.lines.length)}
            </SectionTitle>
            {exp.lines.length === 0 ? (
              <EmptyState icon="package" title={t('noLines')} body={exp.editable ? t('pickFromStockHint') : undefined} action={exp.editable ? { label: t('addLine'), onPress: openAdd } : undefined} />
            ) : (
              <MenuGroup>
                {exp.lines.map((l, i) => (
                  <Pressable
                    key={l.id}
                    disabled={!exp.editable}
                    onPress={() => openEdit(l)}
                    onLongPress={() => void removeLine(l)}
                    accessibilityRole={exp.editable ? 'button' : undefined}
                    className={cn('min-h-14 flex-row items-center gap-3 px-4 py-3 active:bg-secondary', i < exp.lines.length - 1 && 'border-b border-border')}
                  >
                    <Text className="w-8 text-[13px] font-bold text-muted-foreground">#{l.lineNumber}</Text>
                    <View className="flex-1 gap-0.5">
                      <Text className="text-[15px] font-semibold text-foreground">{sizeLabel(l.thicknessIn, l.widthIn, l.lengthFt)}</Text>
                      <Muted>
                        {t('piecesCount', { n: int(l.pieces) })} · {l.importCode}
                      </Muted>
                      {short(l) && (
                        <Text className="text-xs font-semibold text-destructive">
                          {t('moreThanStock')}: {int(l.availablePieces)}
                        </Text>
                      )}
                    </View>
                    <Text className="text-[15px] font-bold tabular-nums text-foreground">{num3(l.cft)}</Text>
                    {exp.editable && <Icon name="edit-2" size={15} colorClassName="accent-muted-foreground" />}
                  </Pressable>
                ))}
              </MenuGroup>
            )}
            {rowError && <ErrorBox message={rowError} />}
            {exp.editable && exp.lines.length > 0 && <Button kind="secondary" icon="plus" title={t('addLine')} onPress={openAdd} />}

            <WorkflowBar
              base={`/exports/${id}`}
              code={exp.code}
              status={exp.status}
              canSubmit={exp.canSubmit}
              canReview={exp.canReview}
              confirmApprove={t('confirmApproveExport', { code: exp.code, pieces: int(exp.totalPieces), cft: num3(exp.totalCft) })}
              submitBlocked={exp.lines.length === 0 ? t('needLinesToSubmit') : null}
              approvedNote={t('approvedExportNote')}
              onDone={() => void q.refetch()}
            />

            <SectionTitle>{t('exportDetails')}</SectionTitle>
            <Card>
              <KV label={t('exportDate')} value={dateOnly(exp.exportDate)} />
              <KV label={t('defaultLoad')} value={exp.importCode ?? t('notSet')} />
              {!!exp.driverName && <KV label={t('driverName')} value={exp.driverName} />}
              {!!exp.driverMobile && <KV label={t('driverMobile')} value={exp.driverMobile} />}
              {!!exp.lorryOwnerName && <KV label={t('lorryOwnerName')} value={exp.lorryOwnerName} />}
              {!!exp.lorryOwnerMobile && <KV label={t('lorryOwnerMobile')} value={exp.lorryOwnerMobile} />}
              {!!exp.startAt && <KV label={t('startTime')} value={dateTime(exp.startAt)} />}
              {!!exp.endAt && <KV label={t('endTime')} value={dateTime(exp.endAt)} />}
              {!!exp.notes && <KV label={t('notes')} value={exp.notes} />}
              <KV label={t('createdBy')} value={exp.createdByName} />
            </Card>

            {can(Permission.FINANCE_VIEW) && <SaleDetails exportId={exp.id} totalCft={exp.totalCft} />}
          </>
        )}
      </Page>

      <Sheet
        ref={sheet.ref}
        title={editing ? `${t('edit')} · ${t('lineNo')}${editing.lineNumber}` : t('addLine')}
        onDismiss={() => setEditing(null)}
        footer={<Button icon={editing ? 'check' : 'plus'} title={editing ? t('save') : t('addLine')} busy={saving} disabled={!chosen || !okPieces} onPress={() => void saveLine()} />}
      >
        <View className="gap-3.5 px-5">
          <SelectField
            label={t('pickFromStock')}
            required
            value={pick}
            options={editing && !options.some((o) => o.value === posKey(editing)) ? [{ value: posKey(editing), label: sizeLabel(editing.thicknessIn, editing.widthIn, editing.lengthFt), hint: editing.importCode }, ...options] : options}
            searchable
            hint={t('pickFromStockHint')}
            emptyText={exp ? t('noFinishedOfWood', { wood: exp.woodType }) : undefined}
            onChange={setPick}
          />
          <NumberField label={t('pieces')} required decimals={0} value={pieces} onChangeText={setPieces} hint={chosen ? `${t('inStock')}: ${int(available)}` : undefined} error={over ? `${t('moreThanStock')}: ${int(available)}` : undefined} />
          <View className="flex-row items-center justify-between rounded-xl bg-saffron-soft px-4 py-3">
            <Text className="text-sm font-semibold text-warning">{t('lineCft')}</Text>
            <Text className="text-xl font-bold tabular-nums text-warning">{num3(live ?? 0)} CFT</Text>
          </View>
          {lineError && <ErrorBox message={lineError} />}
        </View>
      </Sheet>
    </View>
  );
}

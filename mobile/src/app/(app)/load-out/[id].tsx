/**
 * One load out, the simple way (lorry-only mode, lib/lorry-mode.ts) — opened from the Loads out list.
 * Instead of the full record (calculator, size chips, load filters), the same few things the Lorry
 * Out steps showed:
 *
 *   where it stands     draft · waiting for the owner · approved · sent back (with the owner's reason)
 *   the walnut card     the lorry, wood · loading time, pieces and CFT
 *   the pieces          by the lorry they came from; "Change" while it can still be changed
 *   More details        driver, lorry owner, date and times, who entered it
 *   the one action      Send to owner (a draft, or one sent back) · the owner approves or sends back
 *
 * "Change pieces" opens the Lorry Out stepper (components/lorry-flow/pieces.tsx) on what is already
 * on the lorry: − / + per size, from one or more lorries. Saving changes only the lines that changed.
 */
import { sizeLabel } from '@timbertrail/shared';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useConfirm } from '../../../components/confirm';
import { Fold } from '../../../components/fold';
import { BigButton, StepScreen, useLeaveFlow } from '../../../components/lorry-flow/parts';
import {
  buildSources,
  type ExistingLine,
  type Line,
  linesOf,
  PiecesPicker,
  PiecesSummary,
  type Qty,
  SendCard,
  type Size,
  sizeKey,
  TotalBar,
  useLorryStock,
} from '../../../components/lorry-flow/pieces';
import { toast } from '../../../components/toast';
import { EmptyState, ErrorBox, KV, Notice, Reason, SkeletonList, StatusPill } from '../../../components/ui';
import { WorkflowBar } from '../../../components/workflow';
import { api } from '../../../lib/api';
import { dateOnly, dateTime, int, num3, timeOnly } from '../../../lib/format';
import { useSubmit } from '../../../lib/hooks';
import { useT } from '../../../lib/i18n';
import { invalidateOperations, useApi } from '../../../lib/query';
import type { ExportDetail, ExportLine } from '../../../lib/types';

const sizeOf = (l: ExportLine) => ({ t: l.thicknessIn, w: l.widthIn, l: l.lengthFt });

export default function LoadOutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const leave = useLeaveFlow();
  const confirm = useConfirm();
  const q = useApi<ExportDetail>(`/exports/${id}`);
  const exp = q.data;
  const [editing, setEditing] = useState(false);

  // what is on the lorry, in the stepper's terms (the load each line came from, keyed by size)
  const loadIdOf = useCallback((l: ExportLine) => l.importLoadId ?? exp?.importLoadId ?? '', [exp?.importLoadId]);
  const existing = useMemo<ExistingLine[]>(
    () =>
      (exp?.lines ?? []).map((l) => ({
        loadId: loadIdOf(l),
        code: l.importCode,
        plate: l.importLorryNumber ?? null,
        ...sizeOf(l),
        pieces: l.pieces,
        available: l.availablePieces,
      })),
    [exp?.lines, loadIdOf],
  );
  const saved = useMemo<Line[]>(
    () => existing.map((e) => ({ loadId: e.loadId, code: e.code, plate: e.plate, t: e.t, w: e.w, l: e.l, pieces: e.pieces, cft: exp?.lines.find((l) => loadIdOf(l) === e.loadId && l.thicknessIn === e.t && l.widthIn === e.w && l.lengthFt === e.l)?.cft ?? 0 })),
    [existing, exp?.lines, loadIdOf],
  );

  // ── submit ──
  const [submit, submitting, submitError] = useSubmit(async () => {
    if (!exp) return;
    const ok = await confirm({ title: t('submitForApproval'), message: t('submitHint'), confirmText: t('submitForApproval'), cancelText: t('cancel') });
    if (!ok) return;
    await api(`/exports/${exp.id}/submit`, { method: 'POST' });
    await invalidateOperations();
    toast(t('sentForApprovalToast'), 'success', `${exp.code} · ${exp.lorryNumber}`);
    void q.refetch();
  });

  if (editing && exp) return <ChangePieces exp={exp} existing={existing} onDone={() => (setEditing(false), void q.refetch())} />;

  const back = leave;
  if (!exp)
    return (
      <StepScreen step={1} dots={false} title={t('exportDetails')} onBack={back} footer={null}>
        {q.error ? <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} /> : <SkeletonList rows={3} />}
      </StepScreen>
    );

  const time = exp.startAt ? timeOnly(exp.startAt) : '';
  return (
    <StepScreen
      step={1}
      dots={false}
      title={exp.code}
      sub={`${dateOnly(exp.exportDate)} · ${exp.createdByName}`}
      onBack={back}
      footer={exp.canSubmit ? <BigButton title={t('submitForApproval')} icon="send" disabled={!exp.lines.length} busy={submitting} onPress={() => void submit()} /> : null}
    >
      <View className="flex-row items-center gap-2 pb-3">
        <StatusPill status={exp.status} />
      </View>
      {!!exp.rejectionReason && (
        <View className="pb-3">
          <Reason>{exp.rejectionReason}</Reason>
        </View>
      )}

      <SendCard plate={exp.lorryNumber} wood={exp.woodType} time={time} pieces={exp.totalPieces} cft={exp.totalCft} />
      {exp.lines.length ? (
        <PiecesSummary lines={saved} onChange={exp.editable ? () => setEditing(true) : undefined} />
      ) : (
        <EmptyState
          mod="out"
          icon="truck-out"
          title={t('nothingOnLorry')}
          body={exp.editable ? t('nothingOnLorrySub') : undefined}
          action={exp.editable ? { label: t('addPieces'), onPress: () => setEditing(true) } : undefined}
        />
      )}

      {/* where it stands with the owner */}
      <View className="gap-3 pt-3">
        {exp.status === 'SUBMITTED' && !exp.canReview && <Notice icon="clock">{t('waitingApproval')}</Notice>}
        {exp.status === 'APPROVED' && (
          <Notice tone="good" icon="check-circle">
            {t('approvedExportNote')}
          </Notice>
        )}
        {/* the owner decides here too (approve, or send back with a reason) */}
        {exp.canReview && (
          <WorkflowBar
            base={`/exports/${exp.id}`}
            code={exp.code}
            status={exp.status}
            canSubmit={false}
            canReview
            confirmApprove={t('confirmApproveExport', { code: exp.code, pieces: int(exp.totalPieces), cft: num3(exp.totalCft) })}
            onDone={() => void q.refetch()}
          />
        )}
        {submitError && <ErrorBox message={submitError} />}

        <Fold title={t('moreDetails')}>
          <KV label={t('exportDate')} value={dateOnly(exp.exportDate)} />
          {!!exp.driverName && <KV label={t('driverName')} value={exp.driverMobile ? `${exp.driverName} · ${exp.driverMobile}` : exp.driverName} />}
          {!!exp.lorryOwnerName && <KV label={t('lorryOwnerName')} value={exp.lorryOwnerMobile ? `${exp.lorryOwnerName} · ${exp.lorryOwnerMobile}` : exp.lorryOwnerName} />}
          {!!exp.startAt && <KV label={t('startTime')} value={dateTime(exp.startAt)} />}
          {!!exp.endAt && <KV label={t('endTime')} value={dateTime(exp.endAt)} />}
          {!!exp.notes && <KV label={t('notes')} value={exp.notes} />}
          <KV label={t('createdBy')} value={exp.createdByName} />
        </Fold>
      </View>
    </StepScreen>
  );
}

/**
 * "Change pieces": the Lorry Out stepper on what is already on the lorry. Save sends only what
 * changed — a size taken off is deleted, a new one added, a changed count updated.
 */
function ChangePieces({ exp, existing, onDone }: { exp: ExportDetail; existing: ExistingLine[]; onDone: () => void }) {
  const t = useT();
  const confirm = useConfirm();
  const { stock, finished, plateOf } = useLorryStock();
  const [custom, setCustom] = useState<Record<string, Size[]>>({});
  const sources = useMemo(() => buildSources(finished, exp.woodType, plateOf, custom, existing), [finished, exp.woodType, plateOf, custom, existing]);
  const start = useMemo<Qty>(() => {
    const q: Qty = {};
    for (const e of existing) q[sizeKey(e.loadId, e)] = (q[sizeKey(e.loadId, e)] ?? 0) + e.pieces;
    return q;
  }, [existing]);
  const [qty, setQty] = useState<Qty>(start);
  const lines = useMemo(() => linesOf(sources, qty), [sources, qty]);
  const changed = Object.keys({ ...start, ...qty }).some((k) => (start[k] ?? 0) !== (qty[k] ?? 0));

  const [save, saving, error] = useSubmit(async () => {
    // the lines there now, by load + size
    const have = new Map<string, ExportLine[]>();
    for (const l of exp.lines) {
      const k = sizeKey(l.importLoadId ?? exp.importLoadId ?? '', sizeOf(l));
      have.set(k, [...(have.get(k) ?? []), l]);
    }
    const keys = new Set([...have.keys(), ...Object.keys(qty).filter((k) => (qty[k] ?? 0) > 0)]);
    for (const k of keys) {
      const want = qty[k] ?? 0;
      const [first, ...extra] = have.get(k) ?? [];
      const [loadId, T, W, L] = k.split('|');
      const body = { importLoadId: loadId || undefined, thicknessIn: Number(T), widthIn: Number(W), lengthFt: Number(L), pieces: want };
      // one line per size: extra copies go, the first is kept, changed or removed
      for (const x of extra) await api(`/exports/${exp.id}/measurements/${x.id}`, { method: 'DELETE' });
      if (!first) {
        if (want > 0) await api(`/exports/${exp.id}/measurements`, { method: 'POST', body });
      } else if (want === 0) await api(`/exports/${exp.id}/measurements/${first.id}`, { method: 'DELETE' });
      else if (first.pieces !== want) await api(`/exports/${exp.id}/measurements/${first.id}`, { method: 'PATCH', body });
    }
    await invalidateOperations();
    toast(t('saved'), 'success', `${exp.code} · ${sizeLabelCount(lines, t('pcsShort'))}`);
    onDone();
  });

  const back = useCallback(async () => {
    if (changed && !(await confirm({ title: t('leaveTitle'), message: t('unsavedChanges'), confirmText: t('discardChanges'), cancelText: t('keepEditing'), destructive: true }))) return;
    onDone();
  }, [changed, confirm, onDone, t]);

  const loading = !stock.data && !stock.error;
  return (
    <StepScreen
      step={1}
      dots={false}
      title={t('changePieces')}
      sub={`${exp.lorryNumber} · ${exp.woodType}`}
      onBack={() => void back()}
      footerPanel
      footer={<TotalBar lines={lines} button={<BigButton title={t('save')} icon="check" disabled={!changed} busy={saving} onPress={() => void save()} />} />}
    >
      {stock.error && <ErrorBox message={(stock.error as Error).message} onRetry={() => void stock.refetch()} />}
      {loading ? (
        <SkeletonList rows={3} />
      ) : sources.length ? (
        <PiecesPicker sources={sources} qty={qty} onQty={setQty} onAddCustom={(loadId, size) => setCustom((c) => ({ ...c, [loadId]: [...(c[loadId] ?? []), size] }))} />
      ) : (
        <EmptyState mod="out" icon="layers" title={t('noWoodToLoad')} body={t('noWoodToLoadSub')} />
      )}
      {error && (
        <View className="mt-3">
          <ErrorBox message={error} />
        </View>
      )}
    </StepScreen>
  );
}

/** "40 pcs" (or the one size × its pieces) for the line under "Saved" */
function sizeLabelCount(lines: Line[], pcsWord: string) {
  const pcs = lines.reduce((a, x) => a + x.pieces, 0);
  return lines.length === 1 ? `${sizeLabel(lines[0].t, lines[0].w, lines[0].l)} × ${int(pcs)}` : `${int(pcs)} ${pcsWord}`;
}

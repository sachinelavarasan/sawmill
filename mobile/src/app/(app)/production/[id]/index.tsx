/**
 * One production run: raw wood in, finished sizes out, waste and recovery, and approval
 * (web: pages/ProductionDetail.tsx).
 *
 * Sizes are entered on the calculator (components/calc-pad.tsx): Thickness × Width × Length × Pieces,
 * CFT = T × W × L × pieces ÷ 144 (shared formula). After a save thickness and width are kept and the
 * cursor goes to Length, so a run of many lengths is quick to enter.
 *
 * Simple view: three plain numbers on top — Raw CFT used (typed right there, with Save: submitting
 * needs it), Finished CFT and Waste with recovery — then the sizes, then Send to owner, then
 * "More details" folded away.
 *
 * Started from a load out (`t w l pcs back backCode`): a bar "Sawing for load out EXP-…" with
 * "Back to load out EXP-…", and the size it needs already in the keys with the cursor on Pieces.
 *
 * Sizes saved here show at once as "Waiting approval" stock on Load Out and Stock; real stock changes
 * only when the owner approves (and a sawing of an unapproved load in can't be approved before it).
 */
import { exportPieceCft, productionWaste, sizeLabel } from '@timbertrail/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { CalcPad, type CalcEntry, CalcTape } from '../../../../components/calc-pad';
import { useConfirm } from '../../../../components/confirm';
import { Fold } from '../../../../components/fold';
import { HeaderButton, Page, ScreenHeader } from '../../../../components/header';
import { Text, TextInput } from '../../../../components/text';
import { toast } from '../../../../components/toast';
import { Button, Card, cn, ErrorBox, HeroCard, HeroStats, Icon, KV, Muted, Notice, ProgressBar, Reason, SectionTitle, SkeletonList, StatusPill } from '../../../../components/ui';
import { WorkflowBar } from '../../../../components/workflow';
import { api } from '../../../../lib/api';
import { cleanDecimal, dateOnly, dateTime, int, num3 } from '../../../../lib/format';
import { useLocked } from '../../../../lib/hooks';
import { useT } from '../../../../lib/i18n';
import { invalidateOperations, useApi } from '../../../../lib/query';
import { useSession } from '../../../../lib/session';
import type { Output, ProductionDetail } from '../../../../lib/types';
import { loadOutLink, param } from '../../../../lib/ways-back';

/**
 * Where the run stands: raw input → output sizes → review. Done steps are near-black with a tick,
 * the first open step is orange (what to do next), later ones grey.
 */
function Steps({ items }: { items: { label: string; done: boolean }[] }) {
  const current = items.findIndex((s) => !s.done);
  return (
    <View className="flex-row items-start rounded-3xl bg-card px-2 py-3 shadow-sm shadow-black/5" accessibilityRole="progressbar">
      {items.map((s, i) => {
        const now = i === current;
        return (
          <View key={s.label} className="flex-1 items-center gap-1.5" accessible accessibilityLabel={`${i + 1}. ${s.label}`} accessibilityState={{ checked: s.done }}>
            <View className={cn('h-8 w-8 items-center justify-center rounded-full', s.done ? 'bg-primary' : now ? 'bg-saffron' : 'bg-background')}>
              {s.done ? (
                <Icon name="check" size={16} colorClassName="accent-primary-foreground" />
              ) : (
                <Text className={cn('text-[13px] font-bold', now ? 'text-saffron-foreground' : 'text-muted-foreground')}>{i + 1}</Text>
              )}
            </View>
            <Text className={cn('px-1 text-center text-[11px] leading-[14px]', s.done || now ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground')} numberOfLines={2}>
              {s.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

type SizeForm = { thickness: string; width: string; length: string; pieces: string };
const EMPTY: SizeForm = { thickness: '', width: '', length: '', pieces: '' };
const LENGTH = 2;
const PIECES = 3;

export default function ProductionDetailScreen() {
  const params = useLocalSearchParams<Record<string, string>>();
  const id = param(params.id);
  const t = useT();
  const router = useRouter();
  const { simple } = useSession();
  const q = useApi<ProductionDetail>(`/production/${id}`);
  const run = q.data;
  // started from a load out: the size it needs, and the way back to it
  const forLoadOut = loadOutLink(param(params.back), param(params.backCode));
  const wanted: SizeForm | null = param(params.t) ? { thickness: param(params.t), width: param(params.w), length: param(params.l), pieces: param(params.pcs) } : null;

  const blocked = !run
    ? null
    : run.inputCft == null || run.outputs.length === 0
      ? t('needInputAndOutput')
      : run.outputCft > run.inputCft
        ? t('outputExceedsInput')
        : null;

  const sizes = run && <OutputsSection run={run} start={wanted} onChanged={() => void q.refetch()} />;
  const workflow = run && (
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
  );
  const details = run && (
    <>
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
  );

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader compact
        back
        title={run?.code ?? t('productionDetails')}
        subtitle={run ? `${run.importCode} · ${run.woodType}` : undefined}
        right={run?.editable ? <HeaderButton icon="edit-2" label={t('edit')} onPress={() => router.push(`/production/${id}/edit`)} /> : null}
      />
      <Page compact refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
        {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
        {!run && !q.error && <SkeletonList rows={3} />}
        {run && (
          <>
            {forLoadOut && (
              <View className="gap-2.5 rounded-2xl bg-primary-soft p-3.5">
                <Text className="text-[14px] font-medium text-foreground">{t('sawingForLoadOut', { code: forLoadOut.code })}</Text>
                {/* back to the load out already open, not a new copy of it */}
                <Button icon="arrow-left" title={t('backToLoadOut', { code: forLoadOut.code })} onPress={() => router.dismissTo(forLoadOut.to)} />
              </View>
            )}
            <View className="flex-row items-center gap-2">
              <StatusPill status={run.status} />
              <Muted>{dateOnly(run.productionDate)}</Muted>
            </View>
            {!!run.rejectionReason && <Reason>{run.rejectionReason}</Reason>}

            {simple ? (
              <>
                <SimpleRunStrip run={run} onSaved={() => void q.refetch()} />
                {blocked === t('outputExceedsInput') && <Notice tone="bad">{blocked}</Notice>}
                {sizes}
                {workflow}
                <Fold title={t('moreDetails')}>{details}</Fold>
              </>
            ) : (
              <>
                <Steps
                  items={[
                    { label: t('secRawInput'), done: run.inputCft != null },
                    { label: t('outputSizes'), done: run.outputs.length > 0 },
                    { label: t('review'), done: run.status === 'APPROVED' },
                  ]}
                />
                {/* the run's calculation: raw in, finished out, what was lost */}
                <HeroCard label={t('outputCft')} value={num3(run.outputCft)} unit="CFT" icon="factory">
                  {run.inputCft != null && run.inputCft > 0 && (
                    <View className="gap-1.5">
                      <ProgressBar onDark pct={(run.outputCft / run.inputCft) * 100} />
                      <Text className="text-xs text-hero-muted">
                        {num3(run.outputCft)} / {num3(run.inputCft)} CFT
                      </Text>
                    </View>
                  )}
                  <HeroStats
                    items={[
                      { label: t('inputCft'), value: run.inputCft != null ? num3(run.inputCft) : '—' },
                      { label: t('wasteCft'), value: run.wasteCft != null ? num3(run.wasteCft) : '—' },
                      { label: t('recovery'), value: run.recoveryPercent != null ? `${run.recoveryPercent}%` : '—', accent: true },
                    ]}
                  />
                </HeroCard>
                {(run.editable || run.recoveryPercent != null) && (
                  <Card>
                    {run.editable && <KV label={t('rawLeftInLoad')} value={`${num3(run.rawAvailableCft)} CFT`} />}
                    {run.recoveryPercent != null && <Muted>{t('recoveryLine', { n: run.recoveryPercent })}</Muted>}
                  </Card>
                )}
                {blocked === t('outputExceedsInput') && <Notice tone="bad">{blocked}</Notice>}
                {sizes}
                {workflow}
                {details}
              </>
            )}
          </>
        )}
      </Page>
    </View>
  );
}

/**
 * The simple view's top of a sawing run: raw used, finished, waste — three plain numbers. The raw
 * CFT used (needed before sending) is typed right here instead of under "More details".
 */
function SimpleRunStrip({ run, onSaved }: { run: ProductionDetail; onSaved: () => void }) {
  const t = useT();
  /** the raw CFT being typed; null = showing the saved figure */
  const [raw, setRaw] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const editingRaw = raw != null || (run.editable && run.inputCft == null);
  const value = raw ?? (run.inputCft != null ? String(run.inputCft) : '');
  const n = Number(value);

  async function save() {
    if (lock.current || !(n > 0)) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await api(`/production/${run.id}`, { method: 'PATCH', body: { inputCft: n } });
      setRaw(null);
      void invalidateOperations();
      toast(t('saved'), 'success', `${t('inputCft')}: ${num3(n)} CFT`);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const big = 'text-[28px] font-bold leading-9 tabular-nums font-display';
  return (
    <View className="gap-2">
      <View className="overflow-hidden rounded-2xl border border-border bg-border" style={{ gap: 1 }}>
        <View className="gap-1.5 bg-card px-4 py-3.5">
          <Text className="text-[13px] text-muted-foreground">{t('inputCft')}</Text>
          {editingRaw && run.editable ? (
            <View className="flex-row items-center gap-2">
              <View className="flex-1 flex-row items-center rounded-xl border border-input bg-card">
                <TextInput
                  value={value}
                  onChangeText={(v) => setRaw(cleanDecimal(v, 3))}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  accessibilityLabel={t('inputCft')}
                  placeholder="0.000"
                  placeholderTextColorClassName="accent-muted-foreground"
                  className="min-h-[52px] flex-1 px-4 text-[22px] font-bold tabular-nums text-foreground"
                />
                <Text className="pr-4 text-[15px] font-medium text-muted-foreground">CFT</Text>
              </View>
              <Button title={t('save')} busy={busy} disabled={!(n > 0)} onPress={() => void save()} />
            </View>
          ) : (
            <View className="flex-row items-center gap-2">
              <Text className={cn(big, 'text-foreground')}>{run.inputCft != null ? num3(run.inputCft) : '—'}</Text>
              {run.editable && (
                <Button kind="ghost" size="md" icon="edit-2" title={t('edit')} onPress={() => setRaw(value)} />
              )}
            </View>
          )}
          {run.editable && <Muted>{`${t('rawLeftInLoad')}: ${num3(run.rawAvailableCft)} CFT`}</Muted>}
        </View>
        <View className="flex-row" style={{ gap: 1 }}>
          <View className="flex-1 gap-1 bg-primary-soft px-4 py-3.5">
            <Text className="text-[13px] text-muted-foreground">{t('outputCft')}</Text>
            <Text className={cn(big, 'text-foreground')}>{num3(run.outputCft)}</Text>
          </View>
          <View className="flex-1 gap-1 bg-card px-4 py-3.5">
            <Text className="text-[13px] text-muted-foreground">{t('wasteCft')}</Text>
            <Text className={cn(big, run.wasteCft != null && run.wasteCft < 0 ? 'text-destructive' : 'text-foreground')}>{run.wasteCft != null ? num3(run.wasteCft) : '—'}</Text>
            {run.recoveryPercent != null && <Text className="text-[12px] text-muted-foreground">{`${t('recovery')}: ${run.recoveryPercent}%`}</Text>}
          </View>
        </View>
      </View>
      {error && <ErrorBox message={error} />}
    </View>
  );
}

const positive = (v: string) => {
  const n = Number(v);
  return v.trim() !== '' && Number.isFinite(n) && n > 0 && n <= 999 ? n : null;
};

function OutputsSection({ run, start, onChanged }: { run: ProductionDetail; /** a size to start from (sent from a load out) */ start: SizeForm | null; onChanged: () => void }) {
  const t = useT();
  const confirm = useConfirm();
  const locked = useLocked();
  const [entry, setEntry] = useState<SizeForm>(() => start ?? EMPTY);
  // a size sent from a load out is already typed: only the pieces may need changing
  const [active, setActive] = useState(start ? PIECES : 0);
  /** a saved size loaded into the keys to be corrected */
  const [editing, setEditing] = useState<Output | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const T = positive(entry.thickness);
  const W = positive(entry.width);
  const L = positive(entry.length);
  const N = positive(entry.pieces);
  const valid = T != null && W != null && L != null && N != null && Number.isInteger(N);
  const live = valid ? exportPieceCft(T, W, L, N) : null;
  // previews while typing: finished after this size, and the waste it leaves
  const outputAfter = live != null ? run.outputCft - (editing?.cft ?? 0) + live : run.outputCft;
  const wasteAfter = run.inputCft != null ? productionWaste(run.inputCft, outputAfter) : null;

  async function saveSize(): Promise<boolean> {
    if (inFlight.current || !valid || live == null) return false;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const body = { thicknessIn: T, widthIn: W, lengthFt: L, pieces: N };
    try {
      if (editing) await api(`/production/${run.id}/outputs/${editing.id}`, { method: 'PATCH', body });
      else await api(`/production/${run.id}/outputs`, { method: 'POST', body });
      void invalidateOperations();
      if (editing) toast(t('sizeUpdatedToast'), 'success', `${sizeLabel(T, W, L)} × ${int(N)}`);
      else toast(t('sizeAddedToast', { size: sizeLabel(T, W, L), pcs: int(N), cft: num3(live) }));
      setEditing(null);
      // the next size usually shares thickness × width: keep them, clear the rest
      setEntry((e) => ({ ...e, length: '', pieces: '' }));
      onChanged();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const editOutput = (o: Output) => {
    setEditing(o);
    setEntry({ thickness: String(o.thicknessIn), width: String(o.widthIn), length: String(o.lengthFt), pieces: String(o.pieces) });
    setActive(PIECES);
    setError(null);
  };
  const cancelEdit = () => {
    setEditing(null);
    setEntry(EMPTY);
    setActive(0);
  };

  const removeSize = locked(async (o: Output) => {
    const ok = await confirm({ title: sizeLabel(o.thicknessIn, o.widthIn, o.lengthFt), message: t('confirmDelete'), confirmText: t('delete'), cancelText: t('cancel'), destructive: true });
    if (!ok) return;
    setError(null);
    try {
      await api(`/production/${run.id}/outputs/${o.id}`, { method: 'DELETE' });
      void invalidateOperations();
      toast(t('sizeDeletedToast'), 'success', sizeLabel(o.thicknessIn, o.widthIn, o.lengthFt));
      if (editing?.id === o.id) cancelEdit();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  });

  const entries: CalcEntry[] = [...run.outputs].reverse().map((o, i, all) => ({
    key: o.id,
    no: all.length - i,
    label: `${sizeLabel(o.thicknessIn, o.widthIn, o.lengthFt)} × ${int(o.pieces)}`,
    cft: o.cft,
    onEdit: run.editable ? () => editOutput(o) : undefined,
    onDelete: run.editable ? () => void removeSize(o) : undefined,
  }));

  return (
    <View className="gap-3">
      <SectionTitle>{t('secFinishedOutput')}</SectionTitle>
      {run.editable && (
        // the next size usually shares thickness × width, so the length is typed next
        <CalcPad
          title={t('size')}
          editing={editing ? { label: `${t('edit')} · ${sizeLabel(editing.thicknessIn, editing.widthIn, editing.lengthFt)}`, onCancel: cancelEdit } : null}
          fields={[
            { key: 'thickness', label: t('thickness'), unit: 'in', value: entry.thickness },
            { key: 'width', label: t('width'), unit: 'in', value: entry.width },
            { key: 'length', label: t('lengthFt'), unit: 'ft', value: entry.length },
            { key: 'pieces', label: t('pieces'), value: entry.pieces, integer: true },
          ]}
          onChange={(k, v) => {
            setError(null);
            setEntry((e) => ({ ...e, [k]: v }));
          }}
          active={active}
          setActive={setActive}
          result={live}
          formula={valid ? `${entry.thickness} × ${entry.width} × ${entry.length} × ${entry.pieces} ÷ 144` : `${t('cftFormulaLabel')}: ${t('thickness')} × ${t('width')} × ${t('lengthFt')} × ${t('pieces')} ÷ 144`}
          total={outputAfter}
          totalLabel={t('outputCft')}
          problem={wasteAfter != null && wasteAfter < 0 ? t('outputExceedsInput') : null}
          canSave={valid}
          busy={busy}
          onSave={saveSize}
          saveLabel={editing ? t('save') : t('addSize')}
          afterSave={LENGTH}
        />
      )}
      {error && <ErrorBox message={error} />}
      <CalcTape title={t('outputSizes')} entries={entries} total={run.outputCft} empty={t('noOutputs')} selectedKey={editing?.id} />
    </View>
  );
}

/**
 * Lorry Out, one question per screen ("Sawmill Pro – Lorry In & Out" mockup, pages 4–6 and 10–12):
 *
 *   1  Which lorry is loading?  number plate (or a lorry seen before) · loading start time ·
 *                               driver and lorry owner
 *   2  What goes on it?         the wood (only woods with sawn pieces in stock) · the lorries those
 *                               pieces came in on · each size with "120 left" and − 10 + ·
 *                               "+ Custom size" · the running total: pieces · lorries · CFT
 *   3  Ready to send?           the lorry, pieces and CFT on the walnut card, then each source lorry
 *                               with its sizes and pieces
 *      → Finish loading & send: the load out is created with its lines and sent to the owner.
 *
 * Only approved sawn stock is offered ("Finished wood shows here after the owner approves cutting").
 * Pieces can come from several lorries; each line keeps the load it came from. A size can't take
 * more pieces than that lorry has left (a custom size has no stock count to check against).
 * The pieces part is shared with a load out's own page (components/lorry-flow/pieces.tsx).
 */
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  BigButton,
  BoxField,
  BoxRow,
  cleanPlate,
  GroupLabel,
  PlateField,
  StepScreen,
  TimeChip,
  useLeaveFlow,
  whenText,
} from '../../components/lorry-flow/parts';
import { buildSources, linesOf, PiecesPicker, PiecesSummary, type Qty, SendCard, type Size, totalsOf, TotalBar, useLorryStock, WoodSwitch } from '../../components/lorry-flow/pieces';
import { fillFromLorry, type Lorry } from '../../components/LorryPicker';
import { SelectSheet, useSheet } from '../../components/sheet';
import { toast } from '../../components/toast';
import { EmptyState, ErrorBox, SkeletonList } from '../../components/ui';
import { api } from '../../lib/api';
import { timeOnly, todayIso } from '../../lib/format';
import { useSubmit, useUnsavedGuard } from '../../lib/hooks';
import { useT } from '../../lib/i18n';
import { invalidateOperations, useApi } from '../../lib/query';

const PHONE = /^[0-9+ ]{7,15}$/;

type People = { driverName: string; driverMobile: string; lorryOwnerName: string; lorryOwnerMobile: string };

export default function LorryOutScreen() {
  const t = useT();
  const router = useRouter();
  const leave = useLeaveFlow();
  const [step, setStep] = useState(1);
  /** the moment loading began, when no other time is picked */
  const [openedAt] = useState(() => new Date().toISOString());

  // ── step 1 ──
  const [plate, setPlate] = useState('');
  const [startAt, setStartAt] = useState<string | null>(null);
  const [people, setPeople] = useState<People>({ driverName: '', driverMobile: '', lorryOwnerName: '', lorryOwnerMobile: '' });
  const setP = (k: keyof People) => (v: string) => setPeople((p) => ({ ...p, [k]: v }));
  const lorrySheet = useSheet();
  const lorries = useApi<{ items: Lorry[] }>('/imports/lorries').data?.items ?? [];
  const pickLorry = (v: string) => {
    setPlate(v);
    setPeople((p) => fillFromLorry(p, lorries.find((l) => l.lorryNumber === v) ?? null));
    lorrySheet.close();
  };

  // ── step 2: approved sawn stock, by wood, then by the lorry it came in on ──
  const { stock, finished, woods, plateOf } = useLorryStock();
  const [woodPick, setWoodPick] = useState('');
  const wood = woods.includes(woodPick) ? woodPick : (woods[0] ?? '');
  /** custom sizes added per lorry (no stock count) */
  const [custom, setCustom] = useState<Record<string, Size[]>>({});
  const sources = useMemo(() => buildSources(finished, wood, plateOf, custom), [finished, wood, plateOf, custom]);
  const [qty, setQty] = useState<Qty>({});
  // only this wood's pieces go on the lorry (one load out carries one wood)
  const lines = useMemo(() => linesOf(sources, qty), [sources, qty]);
  const { pieces, cft } = totalsOf(lines);

  // ── checks ──
  const plateOk = cleanPlate(plate).trim().length >= 4;
  const phoneError = (v: string) => (v.trim() && !PHONE.test(v.trim()) ? t('invalidMobile') : null);
  const phonesOk = !phoneError(people.driverMobile) && !phoneError(people.lorryOwnerMobile);
  const dirty = !!(plate || people.driverName || people.driverMobile || people.lorryOwnerName || people.lorryOwnerMobile || pieces);
  const release = useUnsavedGuard(dirty);

  // ── send: the load out, its lines, then to the owner ──
  const [send, sending, error] = useSubmit(async () => {
    const created = await api<{ id: string; code: string }>('/exports', {
      method: 'POST',
      body: {
        exportDate: todayIso(),
        lorryNumber: plate.trim(),
        woodType: wood,
        driverName: people.driverName.trim() || undefined,
        driverMobile: people.driverMobile.trim() || undefined,
        lorryOwnerName: people.lorryOwnerName.trim() || undefined,
        lorryOwnerMobile: people.lorryOwnerMobile.trim() || undefined,
        startAt: startAt ?? openedAt,
        endAt: new Date().toISOString(),
        importLoadId: lines[0]?.loadId,
      },
    });
    release();
    // the load out now exists: anything that fails from here is finished on its own page
    try {
      for (const x of lines)
        await api(`/exports/${created.id}/measurements`, { method: 'POST', body: { importLoadId: x.loadId, thicknessIn: x.t, widthIn: x.w, lengthFt: x.l, pieces: x.pieces } });
      await api(`/exports/${created.id}/submit`, { method: 'POST' });
    } catch (e) {
      await invalidateOperations();
      toast(t('savedButNot', { what: (e as Error).message }), 'error', created.code);
      router.replace(`/load-out/${created.id}`);
      return;
    }
    await invalidateOperations();
    toast(t('sentForApprovalToast'), 'success', `${created.code} · ${plate.trim()}`);
    leave();
  });

  const back = useCallback(() => (step > 1 ? setStep(step - 1) : leave()), [step, leave]);
  const startedLabel = startAt ? t('loadingStartedAt', { when: whenText(startAt, t) }) : t('loadingStartsNow');

  // ───────── 1 · the lorry ─────────
  if (step === 1)
    return (
      <StepScreen step={1} title={t('whichLorryOut')} sub={t('plateSub')} onBack={back} footer={<BigButton title={t('next')} disabled={!plateOk || !phonesOk} onPress={() => setStep(2)} />}>
        <PlateField value={plate} onChange={setPlate} onPick={lorrySheet.open} />
        <TimeChip label={startedLabel} value={startAt} onChange={setStartAt} title={t('startTime')} />

        <GroupLabel>{t('secDriver')}</GroupLabel>
        <BoxRow>
          <BoxField label={t('name')} value={people.driverName} onChange={setP('driverName')} placeholder={t('driverNamePh')} />
          <BoxField label={t('phone')} phone value={people.driverMobile} onChange={setP('driverMobile')} placeholder={t('tenDigits')} error={phoneError(people.driverMobile)} />
        </BoxRow>

        <GroupLabel>{t('secLorryOwner')}</GroupLabel>
        <BoxRow>
          <BoxField label={t('name')} value={people.lorryOwnerName} onChange={setP('lorryOwnerName')} placeholder={t('ownerNamePh')} />
          <BoxField label={t('phone')} phone value={people.lorryOwnerMobile} onChange={setP('lorryOwnerMobile')} placeholder={t('tenDigits')} error={phoneError(people.lorryOwnerMobile)} />
        </BoxRow>

        <SelectSheet
          ref={lorrySheet.ref}
          title={t('lorryNumber')}
          value={plate}
          searchable
          options={lorries.map((l) => ({ value: l.lorryNumber, label: l.lorryNumber, hint: l.driverName || undefined }))}
          onPick={pickLorry}
        />
      </StepScreen>
    );

  // ───────── 2 · the pieces ─────────
  if (step === 2) {
    const loading = !stock.data && !stock.error;
    return (
      <StepScreen
        step={2}
        title={t('whatGoesOnIt')}
        sub={t('takeFromLorries')}
        onBack={back}
        footerPanel
        footer={<TotalBar lines={lines} button={<BigButton title={t('next')} disabled={!pieces} onPress={() => setStep(3)} />} />}
        scroll={!!woods.length || loading}
      >
        {stock.error && <ErrorBox message={(stock.error as Error).message} onRetry={() => void stock.refetch()} />}
        {loading && <SkeletonList rows={3} />}
        {!loading && !stock.error && !woods.length && (
          <View className="flex-1 justify-center pb-10">
            <EmptyState mod="out" icon="layers" title={t('noWoodToLoad')} body={t('noWoodToLoadSub')} />
          </View>
        )}
        {!!woods.length && (
          <>
            {/* the wood: one lorry out carries one wood */}
            <WoodSwitch woods={woods} value={wood} onChange={setWoodPick} />
            <PiecesPicker
              key={wood}
              sources={sources}
              qty={qty}
              onQty={setQty}
              onAddCustom={(loadId, size) => setCustom((c) => ({ ...c, [loadId]: [...(c[loadId] ?? []), size] }))}
            />
          </>
        )}
      </StepScreen>
    );
  }

  // ───────── 3 · check and send ─────────
  return (
    <StepScreen
      step={3}
      title={t('readyToSend')}
      sub={t('checkOnceSend')}
      onBack={back}
      scroll={!!pieces}
      footer={<BigButton title={t('finishLoadingSend')} icon="check" disabled={!pieces || !plateOk} busy={sending} onPress={() => void send()} />}
    >
      <SendCard plate={plateOk ? plate.trim() : ''} wood={wood} time={timeOnly(startAt ?? openedAt)} pieces={pieces} cft={cft} />
      {pieces ? (
        <PiecesSummary lines={lines} onChange={() => setStep(2)} />
      ) : (
        <View className="flex-1 justify-center pb-6">
          <EmptyState mod="out" icon="truck-out" title={t('nothingOnLorry')} body={t('nothingOnLorrySub')} action={{ label: t('addPieces'), onPress: () => setStep(2) }} />
        </View>
      )}
      {!plateOk && pieces > 0 && (
        <View className="mt-3">
          <ErrorBox message={t('addToSendLorryOut')} />
        </View>
      )}
      {error && (
        <View className="mt-3">
          <ErrorBox message={error} />
        </View>
      )}
    </StepScreen>
  );
}

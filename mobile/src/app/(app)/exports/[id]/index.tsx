/**
 * One export load: the measured lines (each taken from one import load's finished stock), totals,
 * approval, lorry details and (owner) the sale.
 *
 * Lines are entered on the calculator (components/calc-pad.tsx), as on the web
 * (web/src/pages/ExportDetail.tsx → LinesSection):
 *  - Thickness (in) × Width (in) × Length (ft) × Pieces; CFT = T × W × L × pieces ÷ 144 (shared formula).
 *  - Above the keys, one chip per size in stock with its pieces; a row of load chips ("All loads · 17",
 *    then each load) chooses whose sizes are shown, starting on the load chosen for this load out.
 *    Sizes sawn but waiting approval have a dashed border. Tapping a chip fills the size; the cursor
 *    goes to Pieces.
 *  - "From load", inside the display: only the loads that hold the typed size. The load is chosen for
 *    you — the one shown in the filter if it holds enough, else the current one, else the oldest load
 *    with enough pieces, else the one with the most — and another can be tapped.
 *  - A size that isn't in stock: "This size is not in stock" + Add sawing (opens New Sawing with the
 *    wood, size and pieces, and the way back here).
 *
 * Simple view: lines first, then Send to owner, then the sale, then "More details" folded away.
 */
import { exportPieceCft, Permission, sizeLabel } from '@timbertrail/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { CalcPad, type CalcEntry, CalcTape } from '../../../../components/calc-pad';
import { useConfirm } from '../../../../components/confirm';
import { Fold } from '../../../../components/fold';
import { HeaderButton, Page, ScreenHeader } from '../../../../components/header';
import { SaleDetails } from '../../../../components/SaleDetails';
import { Text } from '../../../../components/text';
import { toast } from '../../../../components/toast';
import { Button, Card, Chip, cn, ErrorBox, Icon, KV, Muted, Reason, SectionTitle, SkeletonList, StatPair, StatusPill } from '../../../../components/ui';
import { WorkflowBar } from '../../../../components/workflow';
import { api } from '../../../../lib/api';
import { dateOnly, dateTime, int, num3 } from '../../../../lib/format';
import { useLocked } from '../../../../lib/hooks';
import { useT } from '../../../../lib/i18n';
import { invalidateOperations, useApi } from '../../../../lib/query';
import { useSession } from '../../../../lib/session';
import type { Balances, ExportDetail, ExportLine, FinishedStockRow } from '../../../../lib/types';

const posKey = (l: { importLoadId: string | null; thicknessIn: number; widthIn: number; lengthFt: number }) => `${l.importLoadId}|${l.thicknessIn}|${l.widthIn}|${l.lengthFt}`;
const sizeKey = (f: { thicknessIn: number; widthIn: number; lengthFt: number }) => `${f.thicknessIn}|${f.widthIn}|${f.lengthFt}`;

const positive = (v: string) => {
  const n = Number(v);
  return v.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null;
};
const wholePositive = (v: string) => {
  const n = positive(v);
  return n != null && Number.isInteger(n) ? n : null;
};

export default function ExportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const router = useRouter();
  const { can, simple } = useSession();
  const q = useApi<ExportDetail>(`/exports/${id}`);
  const exp = q.data;
  const stock = useApi<Balances>(exp?.editable ? '/stock' : null);
  const refresh = () => {
    void q.refetch();
    void stock.refetch();
  };

  const lines = exp && <ExportLines exp={exp} stock={stock.data} onChanged={refresh} />;
  const workflow = exp && (
    <WorkflowBar
      base={`/exports/${id}`}
      code={exp.code}
      status={exp.status}
      canSubmit={exp.canSubmit}
      canReview={exp.canReview}
      confirmApprove={t('confirmApproveExport', { code: exp.code, pieces: int(exp.totalPieces), cft: num3(exp.totalCft) })}
      submitBlocked={exp.lines.length === 0 ? t('needLinesToSubmit') : null}
      approvedNote={t('approvedExportNote')}
      onDone={refresh}
      // the lorry's whole load is checked on one page, which sends it
      onSubmit={() => router.push(`/exports/${id}/check`)}
      submitLabel={t('checkAndSend')}
    />
  );
  const details = exp && (
    <>
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
    </>
  );
  const sale = exp && can(Permission.FINANCE_VIEW) && <SaleDetails exportId={exp.id} totalCft={exp.totalCft} />;

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader compact
        back
        title={exp?.code ?? t('exportDetails')}
        subtitle={exp ? `${exp.lorryNumber} · ${exp.woodType}` : undefined}
        right={exp?.editable ? <HeaderButton icon="edit-2" label={t('edit')} onPress={() => router.push(`/exports/${id}/edit`)} /> : null}
      />
      <Page compact refreshing={q.isRefetching} onRefresh={refresh}>
        {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
        {!exp && !q.error && <SkeletonList rows={3} />}
        {exp && (
          <>
            <View className="flex-row items-center gap-2">
              <StatusPill status={exp.status} />
              <Muted>{dateOnly(exp.exportDate)}</Muted>
            </View>
            {!!exp.rejectionReason && <Reason>{exp.rejectionReason}</Reason>}
            {simple ? (
              // the simple view: what is loaded first (the calculator shows the totals), the details folded away
              <>
                {lines}
                {workflow}
                {sale}
                <Fold title={t('moreDetails')}>{details}</Fold>
              </>
            ) : (
              <>
                <StatPair a={{ label: t('totalPieces'), value: int(exp.totalPieces) }} b={{ label: t('totalCft'), value: num3(exp.totalCft) }} />
                {lines}
                {workflow}
                {details}
                {sale}
              </>
            )}
          </>
        )}
      </Page>
    </View>
  );
}

// ───────── measurement lines ─────────

type Entry = { importLoadId: string; thickness: string; width: string; length: string; pieces: string };
type StockChoice = FinishedStockRow & { pendingRun?: string };
const PIECES = 3;

function ExportLines({ exp, stock, onChanged }: { exp: ExportDetail; stock: Balances | undefined; onChanged: () => void }) {
  const t = useT();
  const router = useRouter();
  const confirm = useConfirm();
  const locked = useLocked();
  const blank = (): Entry => ({ importLoadId: exp.importLoadId ?? '', thickness: '', width: '', length: '', pieces: '' });
  const [entry, setEntry] = useState<Entry>(blank);
  const [active, setActive] = useState(0);
  /** a saved line loaded into the keys to be corrected */
  const [editing, setEditing] = useState<ExportLine | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  // a newly chosen default load becomes the default for the next line
  useEffect(() => setEntry((e) => (e.importLoadId ? e : { ...e, importLoadId: exp.importLoadId ?? '' })), [exp.importLoadId]);

  // approved stock first, then sizes sawn but still waiting for approval (they can be loaded out now)
  const sameWood = useMemo<StockChoice[]>(
    () => [
      ...(stock?.finished ?? []).filter((f) => f.woodType === exp.woodType && f.pieces > 0),
      ...(stock?.pendingFinished ?? []).filter((f) => f.woodType === exp.woodType && f.pieces > 0).map((f) => ({ ...f, pendingRun: f.runCode })),
    ],
    [stock, exp.woodType],
  );

  const tIn = positive(entry.thickness);
  const wIn = positive(entry.width);
  const lFt = positive(entry.length);
  const pcs = wholePositive(entry.pieces);
  const liveCft = tIn != null && wIn != null && lFt != null && pcs != null ? exportPieceCft(tIn, wIn, lFt, pcs) : null;

  // the loads holding this wood, each with how many sizes it has
  const stockLoads = useMemo(() => {
    const m = new Map<string, { code: string; sizes: Set<string> }>();
    for (const f of sameWood) {
      const l = m.get(f.importLoadId) ?? { code: f.importCode, sizes: new Set<string>() };
      l.sizes.add(sizeKey(f));
      m.set(f.importLoadId, l);
    }
    return m;
  }, [sameWood]);

  // starts on the load chosen for this load out (when it holds stock), so its sizes are seen together
  const [loadFilter, setLoadFilter] = useState('');
  const chosenHasStock = !!exp.importLoadId && stockLoads.has(exp.importLoadId);
  const filterStarted = useRef(false);
  useEffect(() => {
    // stock arrives after the page: start on the chosen load once, then leave it to the person
    if (filterStarted.current || !chosenHasStock) return;
    filterStarted.current = true;
    setLoadFilter(exp.importLoadId ?? '');
  }, [chosenHasStock, exp.importLoadId]);

  // one chip per size (of all loads, or of the load chosen above)
  const bySize = useMemo(() => {
    const m = new Map<string, { key: string; f: StockChoice; pieces: number; pending: boolean }>();
    for (const f of sameWood.filter((x) => !loadFilter || x.importLoadId === loadFilter)) {
      const g = m.get(sizeKey(f)) ?? { key: sizeKey(f), f, pieces: 0, pending: true };
      g.pieces += f.pieces;
      g.pending &&= !!f.pendingRun; // dashed only when none of it is approved stock yet
      m.set(sizeKey(f), g);
    }
    return [...m.values()];
  }, [sameWood, loadFilter]);

  const typedSize = tIn != null && wIn != null && lFt != null ? `${tIn}|${wIn}|${lFt}` : null;
  /** loads holding the typed size: approved stock first (oldest load first), then sawn and waiting */
  const sources = useMemo(() => {
    const m = new Map<string, { id: string; code: string; pieces: number; pending: boolean }>();
    for (const f of sameWood.filter((x) => typedSize && sizeKey(x) === typedSize)) {
      const s = m.get(f.importLoadId) ?? { id: f.importLoadId, code: f.importCode, pieces: 0, pending: true };
      s.pieces += f.pieces;
      s.pending &&= !!f.pendingRun;
      m.set(f.importLoadId, s);
    }
    return [...m.values()].sort((a, b) => Number(a.pending) - Number(b.pending) || a.code.localeCompare(b.code));
  }, [sameWood, typedSize]);
  const sourceKey = sources.map((x) => `${x.id}:${x.pieces}`).join(',');

  // the size (or the count) changed: choose its load — unless the load already chosen holds enough of it
  useEffect(() => {
    if (!sourceKey) return;
    const list = sourceKey.split(',').map((x) => ({ id: x.split(':')[0], pieces: Number(x.split(':')[1]) }));
    const need = pcs ?? 0;
    setEntry((e) => {
      // the load being looked at wins whenever it holds enough of this size
      const shown = loadFilter ? list.find((x) => x.id === loadFilter) : undefined;
      if (shown && shown.pieces >= need) return shown.id === e.importLoadId ? e : { ...e, importLoadId: shown.id };
      const current = list.find((x) => x.id === e.importLoadId);
      if (current && current.pieces >= need) return e;
      const best = list.find((x) => x.pieces >= need) ?? [...list].sort((a, b) => b.pieces - a.pieces)[0];
      return best.id === e.importLoadId ? e : { ...e, importLoadId: best.id };
    });
  }, [sourceKey, pcs, loadFilter]);

  // pieces in stock + sawn and waiting approval, for the size and load chosen
  const chosenKey = `${entry.importLoadId}|${entry.thickness}|${entry.width}|${entry.length}`;
  const pickedRows = sameWood.filter((f) => posKey(f) === chosenKey);
  const picked = pickedRows.length > 0;
  const pickedPieces = pickedRows.reduce((n, f) => n + f.pieces, 0);
  // as on the web: compared with what the load holds; lines asking for more in total turn red in the list
  const free = pickedPieces;
  const tooMany = picked && pcs != null && pcs > free;

  const pickSize = (g: { f: StockChoice }) => {
    setEntry((e) => ({ ...e, thickness: String(g.f.thicknessIn), width: String(g.f.widthIn), length: String(g.f.lengthFt), ...(loadFilter && { importLoadId: loadFilter }) }));
    setActive(PIECES); // the size is filled in: only the count is left to type
  };

  /** New Sawing with this wood, the typed size and pieces, and the way back to this load out. */
  const addSawing = () =>
    router.push({
      pathname: '/production/new',
      params: {
        wood: exp.woodType,
        ...(entry.thickness && { t: entry.thickness }),
        ...(entry.width && { w: entry.width }),
        ...(entry.length && { l: entry.length }),
        ...(entry.pieces && { pcs: entry.pieces }),
        back: `/exports/${exp.id}`,
        backCode: exp.code,
      },
    });

  async function saveLine(): Promise<boolean> {
    if (inFlight.current || liveCft == null || !entry.importLoadId || tooMany) return false;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const body = { importLoadId: entry.importLoadId, thicknessIn: tIn, widthIn: wIn, lengthFt: lFt, pieces: pcs };
    try {
      if (editing) await api(`/exports/${exp.id}/measurements/${editing.id}`, { method: 'PATCH', body });
      else await api(`/exports/${exp.id}/measurements`, { method: 'POST', body });
      void invalidateOperations();
      toast(editing ? t('lineUpdatedToast', { n: editing.lineNumber }) : t('lineAddedToast', { cft: num3(liveCft) }), 'success', `${sizeLabel(tIn!, wIn!, lFt!)} × ${int(pcs!)}`);
      setEditing(null);
      setEntry((e) => ({ ...e, pieces: '' })); // the same size again is common: just clear the count
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

  const editLine = (l: ExportLine) => {
    setEditing(l);
    setEntry({ importLoadId: l.importLoadId ?? '', thickness: String(l.thicknessIn), width: String(l.widthIn), length: String(l.lengthFt), pieces: String(l.pieces) });
    setActive(PIECES);
    setError(null);
  };
  const cancelEdit = () => {
    setEditing(null);
    setEntry(blank());
    setActive(0);
  };

  const removeLine = locked(async (l: ExportLine) => {
    const ok = await confirm({ title: `${t('lineNo')}${l.lineNumber}`, message: t('confirmDelete'), confirmText: t('delete'), cancelText: t('cancel'), destructive: true });
    if (!ok) return;
    setError(null);
    try {
      await api(`/exports/${exp.id}/measurements/${l.id}`, { method: 'DELETE' });
      void invalidateOperations();
      toast(t('lineDeletedToast', { n: l.lineNumber }));
      if (editing?.id === l.id) cancelEdit();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  });

  // Before approval, a line asking for more of a size than the load holds turns red
  // (pieces sawn but waiting approval count towards what is there).
  const wanted = new Map<string, number>();
  exp.lines.forEach((l) => wanted.set(posKey(l), (wanted.get(posKey(l)) ?? 0) + l.pieces));
  const pendingPieces = new Map<string, number>();
  (stock?.pendingFinished ?? []).forEach((p) => pendingPieces.set(posKey(p), (pendingPieces.get(posKey(p)) ?? 0) + p.pieces));
  const short = (l: ExportLine) => exp.status !== 'APPROVED' && (wanted.get(posKey(l)) ?? 0) > l.availablePieces + (pendingPieces.get(posKey(l)) ?? 0);

  const entries: CalcEntry[] = [...exp.lines].reverse().map((x) => ({
    key: x.id,
    no: x.lineNumber,
    label: `${sizeLabel(x.thicknessIn, x.widthIn, x.lengthFt)} × ${int(x.pieces)}`,
    sub: short(x) ? `${x.importCode} · ${t('moreThanStock')}: ${int(x.availablePieces)}` : x.importCode,
    subTone: short(x) ? 'bad' : undefined,
    cft: x.cft,
    warn: short(x),
    onEdit: exp.editable ? () => editLine(x) : undefined,
    onDelete: exp.editable ? () => void removeLine(x) : undefined,
  }));

  const tape = <CalcTape title={t('measuredLines')} entries={entries} total={exp.totalCft} empty={t('noLines')} selectedKey={editing?.id} />;
  if (!exp.editable) return tape;

  // which load the pieces come from: only the loads that hold this size
  const fromLoad = (
    <View className="gap-2">
      <Text className="text-[13px] font-semibold text-muted-foreground">{t('fromLoad')}</Text>
      {!typedSize ? (
        <Text className="text-[13px] text-muted-foreground">{t('loadAutoHint')}</Text>
      ) : sources.length === 0 ? (
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-[13px] font-medium text-saffron-strong">{t('sizeNotInStock')}</Text>
          <Pressable onPress={addSawing} accessibilityRole="button" className="flex-row items-center gap-1.5 rounded-full bg-saffron px-3 py-1.5 active:opacity-80">
            <Icon name="factory" size={14} colorClassName="accent-saffron-foreground" />
            <Text className="text-[13px] font-semibold text-saffron-foreground">{t('addSawing')}</Text>
          </Pressable>
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {sources.map((src) => {
            const on = src.id === entry.importLoadId;
            return (
              <Pressable
                key={src.id}
                onPress={() => setEntry((e) => ({ ...e, importLoadId: src.id }))}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                className={cn('min-h-9 flex-row items-center rounded-full px-3 py-1.5', on ? 'bg-primary' : 'bg-secondary', src.pending && 'border border-dashed border-saffron')}
              >
                <Text className={cn('text-[13px] font-semibold tabular-nums', on ? 'text-primary-foreground' : 'text-foreground')}>
                  {src.code} · {int(src.pieces)}
                  {src.pending ? ` · ${t('pendingApproval')}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );

  return (
    <View className="gap-3">
      <SectionTitle>{t('exportMeasurement')}</SectionTitle>

      {/* 1 · what is in stock: one tap fills the size */}
      {stockLoads.size > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          <Chip text={t('allLoads')} count={new Set(sameWood.map(sizeKey)).size} on={!loadFilter} onPress={() => setLoadFilter('')} />
          {[...stockLoads].map(([lid, l]) => (
            <Chip key={lid} text={l.code} count={l.sizes.size} on={loadFilter === lid} onPress={() => setLoadFilter(lid)} />
          ))}
        </ScrollView>
      )}
      {sameWood.length === 0 ? (
        stock && <Muted>{t('noFinishedOfWood', { wood: exp.woodType })}</Muted>
      ) : (
        <ScrollView nestedScrollEnabled style={{ maxHeight: 236 }} contentContainerClassName="flex-row flex-wrap gap-2" accessibilityLabel={t('pickSize')}>
          {bySize.map((g) => {
            const on = typedSize === g.key;
            return (
              <Pressable
                key={g.key}
                onPress={() => pickSize(g)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                className={cn(
                  'min-h-14 grow basis-[46%] flex-row items-center justify-between gap-2 rounded-2xl border px-3 py-2',
                  on ? 'border-saffron bg-saffron-soft' : g.pending ? 'border-dashed border-warning bg-card' : 'border-border bg-card',
                )}
              >
                <Text className="shrink text-[14px] font-semibold tabular-nums text-foreground">{sizeLabel(g.f.thicknessIn, g.f.widthIn, g.f.lengthFt)}</Text>
                <View className="items-end">
                  <Text className="text-[16px] font-bold tabular-nums text-foreground">{int(g.pieces)}</Text>
                  <Text className={cn('text-[11px]', g.pending ? 'font-medium text-warning' : 'text-muted-foreground')}>{g.pending ? t('pendingApproval') : t('inStock')}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      {/* the size isn't sawn yet: record the sawing (calculator and all), then come back */}
      <Button kind="secondary" size="md" icon="factory" title={t('notInStockAddSawing')} onPress={addSawing} />

      {/* 2 · the line itself */}
      <CalcPad
        title={`${t('lineNo')}${exp.lines.length + 1}`}
        editing={editing ? { label: `${t('edit')} · ${t('lineNo')}${editing.lineNumber}`, onCancel: cancelEdit } : null}
        fields={[
          { key: 'thickness', label: t('thickness'), unit: 'in', value: entry.thickness },
          { key: 'width', label: t('width'), unit: 'in', value: entry.width },
          { key: 'length', label: t('lengthFt'), unit: 'ft', value: entry.length },
          { key: 'pieces', label: picked ? `${t('pieces')} / ${int(free)}` : t('pieces'), value: entry.pieces, integer: true },
        ]}
        onChange={(k, v) => {
          setError(null);
          setEntry((e) => ({ ...e, [k]: v }));
        }}
        active={active}
        setActive={setActive}
        result={liveCft}
        formula={
          tIn != null && wIn != null && lFt != null && pcs != null
            ? `${entry.thickness} × ${entry.width} × ${entry.length} × ${entry.pieces} ÷ 144`
            : `${t('cftFormulaLabel')}: ${t('thickness')} × ${t('width')} × ${t('lengthFt')} × ${t('pieces')} ÷ 144`
        }
        total={liveCft != null ? exp.totalCft - (editing?.cft ?? 0) + liveCft : exp.totalCft}
        totalLabel={t('loadTotal')}
        problem={tooMany ? t('moreThanInStock', { n: int(free) }) : null}
        canSave={liveCft != null && !!entry.importLoadId && !tooMany}
        busy={busy}
        onSave={saveLine}
        saveLabel={editing ? t('save') : t('addLine')}
        afterSave={PIECES}
        extra={fromLoad}
      />
      {error && <ErrorBox message={error} />}
      {tape}
    </View>
  );
}

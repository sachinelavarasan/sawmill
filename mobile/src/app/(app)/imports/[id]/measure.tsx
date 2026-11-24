/**
 * Log measurement — the calculator layout, as on the web (components/calc-pad.tsx): the boxes are
 * Length (ft) then Girth (in), the working is shown with the typed numbers
 * (12 × 48 × 48 ÷ 2304 = 12.000 CFT, the same shared formula the server uses), "=" reads
 * "Next →" until the last box and then saves, and every saved log is listed below the keys,
 * newest first, with Edit and Delete.
 *
 * Logs off one lorry are mostly the same length, so the length is kept from the last log and the
 * cursor goes to Girth after a save: usually only the girth is typed. The first key pressed on a
 * kept length replaces it.
 *
 * No signal: a new log is kept on the phone (lib/offline-logs.ts), listed with a "waiting"
 * mark and a provisional number, counted in the totals, and sent by itself when the connection
 * is back. Logs still waiting can be corrected or deleted here; saved logs need the connection.
 */
import { importLogCft, type TKey } from '@timbertrail/shared';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalcPad, type CalcEntry, CalcTape } from '../../../../components/calc-pad';
import { BackToSawingBar } from '../../../../components/way-back-bar';
import { useConfirm } from '../../../../components/confirm';
import { ScreenHeader } from '../../../../components/header';
import { Text } from '../../../../components/text';
import { toast } from '../../../../components/toast';
import { Button, ErrorBox, Notice, SkeletonList } from '../../../../components/ui';
import { ApiError } from '../../../../lib/api';
import { int, num3 } from '../../../../lib/format';
import { useT } from '../../../../lib/i18n';
import { type ImportDetail, importsApi, type Log } from '../../../../lib/imports-api';
import { enqueueLog, flushPending, isOffline, newLogRef, onLogSent, type PendingLog, pendingFor, removePending, updatePending, usePendingLogs } from '../../../../lib/offline-logs';
import { invalidateOperations, queryClient } from '../../../../lib/query';
import { useUser } from '../../../../lib/session';
import { param } from '../../../../lib/ways-back';

/** the boxes, in the order they are typed */
const LENGTH = 0;
const GIRTH = 1;

/** One row of the history: a log the server has, or one still on the phone (with its provisional number). */
type Row = { kind: 'saved'; log: Log } | { kind: 'pending'; p: PendingLog; no: number };

const parse = (v: string) => {
  const n = Number(v);
  return v && Number.isFinite(n) && n > 0 ? n : null;
};

/** What is wrong with a typed girth / length, in words — the limits the server enforces. Null while empty or fine. */
const measureProblem = (v: string): TKey | null => {
  if (!v) return null;
  if (parse(v) == null) return 'errPositive';
  if (Number(v) > 999) return 'errMax999';
  if (!/^\d*(\.\d{0,2})?$/.test(v)) return 'errTwoDecimals';
  return null;
};

export default function MeasureScreen() {
  const { id, back } = useLocalSearchParams<{ id: string; back?: string }>();
  const t = useT();
  const confirm = useConfirm();
  const user = useUser();
  const insets = useSafeAreaInsets();
  const pending = usePendingLogs(user.id, id);
  const scroll = useRef<ScrollView>(null);

  const [load, setLoad] = useState<ImportDetail | null>(null);
  /** showing the copy loaded earlier because the server can't be reached */
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [girth, setGirth] = useState('');
  /** the length typed for this entry; ignored while `kept` */
  const [length, setLength] = useState('');
  /** true until a length key is pressed: the entry uses the newest log's length */
  const [kept, setKept] = useState(true);
  /** the box the keys type into; null = automatic (Girth when a length is kept, else Length) */
  const [active, setActive] = useState<number | null>(null);
  const [editing, setEditing] = useState<Log | null>(null);
  /** a log still on the phone being corrected */
  const [editingPending, setEditingPending] = useState<PendingLog | null>(null);
  const [busy, setBusy] = useState(false);
  /** the log just saved: highlighted for a moment */
  const [fresh, setFresh] = useState<string | null>(null);
  /** one save or delete at a time; set synchronously on the tap (see lib/hooks useLocked) */
  const inFlight = useRef(false);
  const changed = useRef(false);

  const fetchLoad = useCallback(async () => {
    setError(null);
    try {
      setLoad(await importsApi.get(id));
      setStale(false);
    } catch (e) {
      // No signal: keep measuring on the copy the load screen already fetched (logs then go to the phone's queue).
      const cached = isOffline(e) ? queryClient.getQueryData<ImportDetail>(['api', `/imports/${id}`]) : undefined;
      if (cached) {
        setLoad((prev) => prev ?? cached);
        setStale(true);
      } else setError((e as Error).message);
    }
  }, [id]);

  // A waiting log reached the server (sent from here or in the background): move it into the list.
  useEffect(
    () =>
      onLogSent(({ pending: p, log, totals }) => {
        if (p.loadId !== id) return;
        changed.current = true;
        setStale(false);
        setLoad((prev) => prev && { ...prev, ...totals, logs: prev.logs.some((x) => x.id === log.id) ? prev.logs : [...prev.logs, log] });
      }),
    [id],
  );

  useEffect(() => {
    if (!fresh) return;
    const timer = setTimeout(() => setFresh(null), 1800);
    return () => clearTimeout(timer);
  }, [fresh]);

  useEffect(() => {
    void fetchLoad();
    // lists and dashboards pick up the new totals once, when leaving
    return () => {
      if (changed.current) void invalidateOperations();
    };
  }, [fetchLoad]);

  // newest first; sorted only when the logs change, not on every key press
  const logs = load?.logs;
  const saved = useMemo(() => (logs ? [...logs].sort((a, b) => b.logNumber - a.logNumber) : []), [logs]);
  const lastSavedNo = saved[0]?.logNumber ?? 0;
  /** waiting logs take the numbers after the server's, in the order measured (refused ones get none) */
  const waiting = useMemo(() => pending.filter((p) => !p.error), [pending]);
  const history = useMemo<Row[]>(() => {
    const queued = waiting.map((p, i) => ({ kind: 'pending' as const, p, no: lastSavedNo + i + 1 }));
    const refused = pending.filter((p) => p.error).map((p) => ({ kind: 'pending' as const, p, no: 0 }));
    return [...refused, ...queued.reverse(), ...saved.map((log) => ({ kind: 'saved' as const, log }))];
  }, [pending, waiting, saved, lastSavedNo]);
  const newestLength = waiting.length ? waiting[waiting.length - 1].lengthFt : saved[0]?.lengthFt;
  const lastLength = newestLength != null ? String(newestLength) : '';
  const lengthShown = kept ? lastLength : length;
  const waitingCft = waiting.reduce((sum, p) => sum + p.cft, 0);
  const shownTotalCft = (load?.totalCft ?? 0) + waitingCft;

  const g = parse(girth);
  const l = parse(lengthShown);
  const girthProblem = measureProblem(girth);
  const lengthProblem = measureProblem(lengthShown);
  const canSave = !!load?.editable && g != null && l != null && !girthProblem && !lengthProblem;
  const liveCft = canSave ? importLogCft(g!, l!) : null;
  const nextNo = lastSavedNo + waiting.length + 1;
  const pendingNo = (ref: string) => lastSavedNo + waiting.findIndex((p) => p.ref === ref) + 1;
  const currentNo = editing ? editing.logNumber : editingPending ? pendingNo(editingPending.ref) : nextNo;
  const replaced = editing?.cft ?? (editingPending && !editingPending.error ? editingPending.cft : 0);
  const totalAfter = liveCft != null ? shownTotalCft - replaced + liveCft : shownTotalCft;
  const activeBox = active ?? (kept && lastLength ? GIRTH : LENGTH);

  function onChange(key: string, v: string) {
    setError(null);
    if (key === 'girth') return setGirth(v);
    // the first key on a kept length replaces it (CalcPad starts from '' for `replaceOnType`)
    setKept(false);
    setLength(v);
  }

  /** Ready for the next log: girth empty, length carried over from the newest log, cursor on Girth. */
  function resetEntry() {
    setGirth('');
    setLength('');
    setKept(true);
    setActive(null);
    setEditing(null);
    setEditingPending(null);
  }

  /** Load a log into the keys to correct it ("Edit · Log #3 — Cancel"); = saves the correction. */
  function startEdit(row: Row) {
    const v = row.kind === 'saved' ? row.log : row.p;
    setEditing(row.kind === 'saved' ? row.log : null);
    setEditingPending(row.kind === 'pending' ? row.p : null);
    setGirth(String(v.girthIn));
    setLength(String(v.lengthFt));
    setKept(false);
    setActive(LENGTH);
    setError(null);
    scroll.current?.scrollTo({ y: 0, animated: true }); // the keys are above the list
  }

  /** Try the server now; anything that was waiting goes first so the numbers stay in measuring order. */
  function sendWaiting() {
    void flushPending(user.id);
  }

  /**
   * The paths that finish on the phone (queue, correct a waiting log) need no request, but a second
   * "=" in the same frame would still see the old girth: hold the lock until the next frame has drawn.
   */
  function holdUntilNextFrame() {
    inFlight.current = true;
    requestAnimationFrame(() => {
      inFlight.current = false;
    });
  }

  /** "=": save this log. Returns false when nothing was saved, so the cursor stays where it is. */
  async function save(): Promise<boolean> {
    if (!load || inFlight.current || g == null || l == null) return false;
    if (editingPending) {
      holdUntilNextFrame();
      updatePending(editingPending.ref, g, l);
      toast(t('logUpdatedToast', { n: pendingNo(editingPending.ref) }));
      resetEntry();
      sendWaiting();
      return true;
    }
    // Something is already waiting (for any load): queue behind it rather than overtake it.
    if (!editing && pendingFor(user.id).some((p) => !p.error)) {
      holdUntilNextFrame();
      enqueueLog({ ref: newLogRef(), userId: user.id, loadId: load.id, loadCode: load.code, girthIn: g, lengthFt: l });
      resetEntry();
      sendWaiting();
      return true;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const ref = newLogRef();
    try {
      const res = editing ? await importsApi.updateLog(load.id, editing.id, g, l) : await importsApi.addLog(load.id, g, l, ref);
      changed.current = true;
      setStale(false);
      setLoad(
        (prev) =>
          prev && {
            ...prev,
            totalLogs: res.totalLogs,
            totalCft: res.totalCft,
            logs: editing ? prev.logs.map((x) => (x.id === res.log.id ? res.log : x)) : [...prev.logs, res.log],
          },
      );
      toast(editing ? t('logUpdatedToast', { n: res.log.logNumber }) : t('logAddedToast', { n: res.log.logNumber, cft: num3(res.log.cft) }));
      setFresh(res.log.id);
      resetEntry();
      return true;
    } catch (e) {
      if (!editing && isOffline(e)) {
        // No signal: keep it on the phone; it is sent by itself later (the same ref makes a resend safe).
        enqueueLog({ ref, userId: user.id, loadId: load.id, loadCode: load.code, girthIn: g, lengthFt: l });
        toast(t('offlineSaved'), 'info');
        resetEntry();
        return true;
      }
      setError((e as Error).message);
      if (e instanceof ApiError && e.status === 409) void fetchLoad(); // load was submitted meanwhile
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  /** Held from the tap through the confirmation and the request: one dialog, one delete. */
  async function locked(fn: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await fn();
    } finally {
      inFlight.current = false;
    }
  }

  const removeRow = (row: Row) =>
    locked(async () => {
      if (row.kind === 'saved') return deleteSaved(row.log);
      const ok = await confirm({ title: row.no ? `${t('logNo')}${row.no}` : t('notSent'), message: t('confirmDelete'), confirmText: t('delete'), cancelText: t('cancel'), destructive: true });
      if (!ok) return;
      removePending(row.p.ref);
      if (row.no) toast(t('logDeletedToast', { n: row.no }));
      if (editingPending?.ref === row.p.ref) resetEntry();
    });

  async function deleteSaved(log: Log) {
    if (!load) return;
    const ok = await confirm({ title: `${t('logNo')}${log.logNumber}`, message: t('confirmDelete'), confirmText: t('delete'), cancelText: t('cancel'), destructive: true });
    if (!ok) return;
    setBusy(true);
    try {
      const totals = await importsApi.removeLog(load.id, log.id);
      changed.current = true;
      setLoad((prev) => prev && { ...prev, ...totals, logs: prev.logs.filter((x) => x.id !== log.id) });
      toast(t('logDeletedToast', { n: log.logNumber }));
      if (editing?.id === log.id) resetEntry();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // ── the list below the keys ──
  const entries: CalcEntry[] = history.map((row) => {
    if (row.kind === 'saved') {
      const x = row.log;
      return {
        key: x.id,
        no: x.logNumber,
        label: `${x.lengthFt} ft × ${x.girthIn} in`,
        cft: x.cft,
        fresh: x.id === fresh,
        onEdit: load?.editable ? () => startEdit(row) : undefined,
        onDelete: load?.editable ? () => void removeRow(row) : undefined,
      };
    }
    const p = row.p;
    return {
      key: `pending:${p.ref}`,
      no: p.error ? null : row.no,
      label: `${p.lengthFt} ft × ${p.girthIn} in`,
      sub: p.error ? `${t('notSent')}: ${p.error}` : t('waitingToSend'),
      subTone: p.error ? 'bad' : 'info',
      cft: p.cft,
      strike: !!p.error,
      // a waiting log can always be corrected; a refused one only deleted
      onEdit: p.error ? undefined : () => startEdit(row),
      onDelete: () => void removeRow(row),
    };
  });
  const selectedKey = editing ? editing.id : editingPending ? `pending:${editingPending.ref}` : null;

  const problem = lengthProblem ? t(lengthProblem) : girthProblem ? t(girthProblem) : null;
  const formula = g != null && l != null ? `${lengthShown} × ${girth} × ${girth} ÷ 2304` : `${t('cftFormulaLabel')}: ${t('lengthFt')} × ${t('girth')} × ${t('girth')} ÷ 2304`;

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        compact
        back
        title={t('simpleMeasure')}
        subtitle={load ? `${load.code} · ${load.woodType} · ${load.lorryNumber}` : undefined}
        step={load?.editable ? { at: 2, of: 2 } : undefined}
      />
      {!load && !error && (
        <View className="p-4">
          <SkeletonList rows={2} />
        </View>
      )}
      {!load && error && (
        <View className="p-4">
          <ErrorBox message={error} onRetry={fetchLoad} />
        </View>
      )}

      {load && (
        <ScrollView ref={scroll} className="flex-1 bg-background" contentContainerClassName="gap-3 px-4 pt-2" contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
          {/* started from New Sawing: back to it with this load chosen */}
          <BackToSawingBar back={param(back)} loadId={load.id} />
          {!load.editable && <Notice icon="lock">{t('lockedRecord')}</Notice>}
          {(stale || waiting.length > 0) && (
            <View className="gap-2">
              <Notice icon={stale ? 'cloud-off' : 'upload-cloud'} tone="info">
                {waiting.length > 0 ? `${t('pendingLogs', { n: waiting.length })}. ${t('pendingLogsSub')}` : t('connectionLost')}
              </Notice>
              {waiting.length > 0 && <Button size="md" kind="secondary" icon="upload-cloud" title={t('sendNow')} onPress={sendWaiting} />}
            </View>
          )}

          {load.editable && (
            <>
              <View className="flex-row gap-3">
                <View className="flex-1 gap-0.5 rounded-3xl bg-saffron-soft px-4 py-3">
                  <Text className="text-[13px] font-semibold text-saffron-strong">{t('logsSaved')}</Text>
                  <Text className="text-[26px] font-bold tabular-nums text-foreground font-display">{int(entries.length)}</Text>
                </View>
                <View className="flex-1 gap-0.5 rounded-3xl bg-saffron-soft px-4 py-3">
                  <Text className="text-[13px] font-semibold text-saffron-strong">{t('totalCft')}</Text>
                  <Text className="text-[26px] font-bold tabular-nums text-foreground font-display">{num3(shownTotalCft)}</Text>
                </View>
              </View>
              <CalcPad
                variant="log"
                hint={t('enterLengthGirth')}
                title={t('logN', { n: currentNo })}
                editing={editing || editingPending ? { label: `${t('edit')} · ${t('logN', { n: currentNo })}`, onCancel: resetEntry } : null}
                fields={[
                  { key: 'length', label: t('lengthFeet'), unit: 'ft', value: lengthShown, note: kept && lengthShown ? t('lengthKept') : undefined, replaceOnType: kept },
                  { key: 'girth', label: t('girthInches'), unit: 'in', value: girth },
                ]}
                onChange={onChange}
                active={activeBox}
                setActive={setActive}
                result={liveCft}
                formula={formula}
                total={totalAfter}
                totalLabel={t('totalAfterLog')}
                problem={problem}
                canSave={canSave}
                busy={busy}
                onSave={save}
                saveLabel={editing || editingPending ? t('save') : t('saveLogN', { n: currentNo })}
                // the length is kept for the next log, so the girth is what is typed next
                afterSave={GIRTH}
              />
              {error && <ErrorBox message={error} />}
            </>
          )}

          <CalcTape title={t('measurementHistory')} entries={entries} total={shownTotalCft} empty={t('noLogsYet')} selectedKey={selectedKey} />
        </ScrollView>
      )}
    </View>
  );
}

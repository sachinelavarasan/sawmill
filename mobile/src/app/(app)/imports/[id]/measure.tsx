/**
 * Log measurement — built for one-handed use in the yard.
 * Girth and length are typed on a big on-screen keypad (no phone keyboard to cover the
 * screen), the CFT is shown live with the same shared formula the server uses (3 decimals),
 * and each saved log gets the next number from the server. Every log stays listed below,
 * newest first: tap to correct it, long-press to delete.
 *
 * Logs off one lorry are mostly the same length, so the length is kept from the last log:
 * usually only the girth is typed. The first key pressed on a kept length replaces it.
 * Keys tick and spring under the thumb; a just-saved log slides in, briefly highlighted.
 *
 * No signal: a new log is kept on the phone (lib/offline-logs.ts), listed with a "waiting"
 * mark and a provisional number, counted in the totals, and sent by itself when the connection
 * is back. Logs still waiting can be corrected or deleted here; saved logs need the connection.
 */
import { importLogCft } from '@timbertrail/shared';
import { useLocalSearchParams } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { FadeInDown } from 'react-native-reanimated';
import { Text } from '../../../../components/text';
import { useConfirm } from '../../../../components/confirm';
import { Page, ScreenHeader } from '../../../../components/header';
import { AnimatedView, Tap } from '../../../../components/motion';
import { toast } from '../../../../components/toast';
import { Button, cn, ErrorBox, Icon, MenuGroup, Muted, Notice, SectionTitle, SkeletonList, StatPair } from '../../../../components/ui';
import { ApiError } from '../../../../lib/api';
import { int, num3 } from '../../../../lib/format';
import { useT } from '../../../../lib/i18n';
import { type ImportDetail, importsApi, type Log } from '../../../../lib/imports-api';
import { enqueueLog, flushPending, isOffline, newLogRef, onLogSent, type PendingLog, pendingFor, removePending, updatePending, usePendingLogs } from '../../../../lib/offline-logs';
import { invalidateOperations, queryClient } from '../../../../lib/query';
import { useUser } from '../../../../lib/session';

type Field = 'girth' | 'length';
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'] as const;
type Key = (typeof KEYS)[number];

/** Keypad input rules (same limits as the API): one dot, max 2 decimals, max 999.99. */
function press(value: string, key: Key): string {
  if (key === 'del') return value.slice(0, -1);
  if (key === '.') return value.includes('.') ? value : (value || '0') + '.';
  const next = value === '0' ? key : value + key;
  const [whole, dec] = next.split('.');
  if (whole.length > 3 || (dec && dec.length > 2)) return value;
  return next;
}

/** A history row's frame: plain, except the log just saved, which slides in highlighted (only it pays for Reanimated). */
function LogRowFrame({ fresh, children }: { fresh: boolean; children: ReactNode }) {
  return fresh ? (
    <AnimatedView entering={FadeInDown.duration(320)} className="bg-success-soft">
      {children}
    </AnimatedView>
  ) : (
    <View>{children}</View>
  );
}

/** One row of the history: a log the server has, or one still on the phone (with its provisional number). */
type Row = { kind: 'saved'; log: Log } | { kind: 'pending'; p: PendingLog; no: number };

const parse = (v: string) => {
  const n = Number(v);
  return v && Number.isFinite(n) && n > 0 ? n : null;
};

export default function MeasureScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const confirm = useConfirm();
  const user = useUser();
  const pending = usePendingLogs(user.id, id);

  const [load, setLoad] = useState<ImportDetail | null>(null);
  /** showing the copy loaded earlier because the server can't be reached */
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [girth, setGirth] = useState('');
  /** the length typed for this entry; ignored while `kept` */
  const [length, setLength] = useState('');
  /** true until a length key is pressed: the entry uses the newest log's length */
  const [kept, setKept] = useState(true);
  const [field, setField] = useState<Field>('girth');
  const [editing, setEditing] = useState<Log | null>(null);
  /** a log still on the phone being corrected */
  const [editingPending, setEditingPending] = useState<PendingLog | null>(null);
  const [busy, setBusy] = useState(false);
  /** the log just saved: slides in and stays highlighted for a moment */
  const [fresh, setFresh] = useState<string | null>(null);
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
  const shownTotalLogs = (load?.totalLogs ?? 0) + waiting.length;

  const g = parse(girth);
  const l = parse(lengthShown);
  const liveCft = g && l ? importLogCft(g, l) : null;
  const nextNo = lastSavedNo + waiting.length + 1;
  const pendingNo = (ref: string) => lastSavedNo + waiting.findIndex((p) => p.ref === ref) + 1;
  const currentNo = editing ? editing.logNumber : editingPending ? pendingNo(editingPending.ref) : nextNo;
  const replaced = editing?.cft ?? (editingPending && !editingPending.error ? editingPending.cft : 0);
  const totalAfter = load && liveCft != null ? shownTotalCft - replaced + liveCft : null;

  function onKey(k: Key) {
    if (field === 'girth') setGirth((v) => press(v, k));
    else if (kept) {
      // a kept length is replaced by the first key, not appended to
      setKept(false);
      setLength(k === 'del' ? '' : press('', k));
    } else setLength((v) => press(v, k));
  }

  /** Ready for the next log: girth empty, length carried over from the newest log. */
  function resetEntry() {
    setGirth('');
    setLength('');
    setKept(true);
    setField('girth');
    setEditing(null);
    setEditingPending(null);
  }

  function startEdit(row: Row) {
    const v = row.kind === 'saved' ? row.log : row.p;
    setEditing(row.kind === 'saved' ? row.log : null);
    setEditingPending(row.kind === 'pending' ? row.p : null);
    setGirth(String(v.girthIn));
    setLength(String(v.lengthFt));
    setKept(false);
    setField('girth');
  }

  /** Try the server now; anything that was waiting goes first so the numbers stay in measuring order. */
  function sendWaiting() {
    void flushPending(user.id);
  }

  async function save() {
    if (!load || inFlight.current) return;
    if (g && !l) {
      setField('length');
      return;
    }
    if (!g || !l) {
      setError(t('enterGirthLength'));
      return;
    }
    if (editingPending) {
      updatePending(editingPending.ref, g, l);
      toast(t('saved'));
      resetEntry();
      sendWaiting();
      return;
    }
    // Something is already waiting (for any load): queue behind it rather than overtake it.
    if (!editing && pendingFor(user.id).some((p) => !p.error)) {
      enqueueLog({ ref: newLogRef(), userId: user.id, loadId: load.id, loadCode: load.code, girthIn: g, lengthFt: l });
      resetEntry();
      sendWaiting();
      return;
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
      toast(t('logSavedLine', { n: res.log.logNumber, cft: num3(res.log.cft) }));
      setFresh(res.log.id);
      resetEntry();
    } catch (e) {
      if (!editing && isOffline(e)) {
        // No signal: keep it on the phone; it is sent by itself later (the same ref makes a resend safe).
        enqueueLog({ ref, userId: user.id, loadId: load.id, loadCode: load.code, girthIn: g, lengthFt: l });
        toast(t('offlineSaved'), 'info');
        resetEntry();
        return;
      }
      setError((e as Error).message);
      if (e instanceof ApiError && e.status === 409) void fetchLoad(); // load was submitted meanwhile
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function removeRow(row: Row) {
    if (row.kind === 'saved') return remove(row.log);
    const ok = await confirm({ title: row.no ? `${t('logNo')}${row.no}` : t('notSent'), message: t('confirmDelete'), confirmText: t('delete'), cancelText: t('cancel'), destructive: true });
    if (!ok) return;
    removePending(row.p.ref);
    resetEntry();
  }

  async function remove(log: Log) {
    if (!load) return;
    const ok = await confirm({ title: `${t('logNo')}${log.logNumber}`, message: t('confirmDelete'), confirmText: t('delete'), cancelText: t('cancel'), destructive: true });
    if (!ok) return;
    try {
      const totals = await importsApi.removeLog(load.id, log.id);
      changed.current = true;
      setLoad((prev) => prev && { ...prev, ...totals, logs: prev.logs.filter((x) => x.id !== log.id) });
      resetEntry();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const saveLabel = editing || editingPending ? `${t('save')} ${t('logNo')}${currentNo}` : g && !l ? t('nextLength') : t('saveLog', { n: currentNo });
  const editingAny = !!(editing || editingPending);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader back title={load ? `${load.code} · ${t('measurement')}` : t('measurement')} subtitle={load ? `${load.lorryNumber} · ${load.woodType}` : undefined} />
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
        <Page
          hero={
            <View className="flex-row gap-6">
              {[
                { label: t('totalCft'), value: num3(shownTotalCft), big: true },
                { label: t('logsMeasured'), value: int(shownTotalLogs), big: false },
              ].map((x) => (
                <View key={x.label} className={x.big ? 'flex-1 gap-1' : 'gap-1'}>
                  <Text className="text-[13px] text-hero-muted">{x.label}</Text>
                  <Text className={x.big ? 'text-[34px] font-bold tracking-tight tabular-nums text-hero-foreground font-display' : 'text-[34px] font-bold tracking-tight tabular-nums text-saffron font-display'}>{x.value}</Text>
                </View>
              ))}
            </View>
          }
        >

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
            <View className="gap-3 rounded-2xl bg-background p-4">
              <View className="flex-row items-baseline justify-between">
                <Text className="text-lg font-bold text-foreground font-display">
                  {editingAny ? t('edit') : t('thisLog')} · {t('logNo')}
                  {currentNo}
                </Text>
                <Text className="text-[22px] font-bold tabular-nums text-warning font-display" accessibilityLiveRegion="polite" accessibilityLabel={`CFT ${num3(liveCft ?? 0)}`}>
                  {num3(liveCft ?? 0)}
                  <Text className="text-sm text-muted-foreground"> CFT</Text>
                </Text>
              </View>

              <View className="flex-row gap-2.5">
                {(['girth', 'length'] as const).map((f) => {
                  const on = field === f;
                  const value = f === 'girth' ? girth : lengthShown;
                  const label = t(f === 'girth' ? 'girth' : 'lengthFt');
                  return (
                    <Pressable
                      key={f}
                      onPress={() => setField(f)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${label} ${value || '0'}`}
                      className={cn('min-h-[88px] flex-1 justify-between rounded-xl border-2 px-3.5 py-2.5', on ? 'border-saffron bg-saffron-soft' : 'border-border bg-background')}
                    >
                      {/* label may wrap (Tamil runs long); the "same as last" note gets its own line */}
                      <View>
                        <Text className="text-[13px] font-semibold text-muted-foreground">{label}</Text>
                        {f === 'length' && kept && !!value && (
                          <Text className="text-[12px] font-medium text-saffron" numberOfLines={1}>
                            {t('lengthKept')}
                          </Text>
                        )}
                      </View>
                      <Text className={cn('text-[34px] font-bold tabular-nums font-display', value ? 'text-foreground' : 'text-muted-foreground')}>
                        {value || '0'}
                        <Text className="text-base font-semibold text-muted-foreground">{f === 'girth' ? ' in' : ' ft'}</Text>
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {totalAfter != null && (
                <Muted>
                  {t('totalAfterLog')}: {num3(totalAfter)} CFT
                </Muted>
              )}

              <View className="flex-row flex-wrap justify-between gap-y-2">
                {KEYS.map((k) => (
                  <Tap
                    key={k}
                    scale={0.92}
                    haptic
                    onPress={() => onKey(k)}
                    accessibilityRole="button"
                    accessibilityLabel={k === 'del' ? t('delete') : k}
                    className="h-[60px] w-[32%] items-center justify-center rounded-xl border border-border bg-background active:bg-secondary"
                  >
                    {k === 'del' ? <Icon name="delete" size={24} colorClassName="accent-foreground" /> : <Text className="text-[26px] font-semibold text-foreground">{k}</Text>}
                  </Tap>
                ))}
              </View>

              {error && <ErrorBox message={error} />}
              <Button title={saveLabel} onPress={() => void save()} busy={busy} disabled={!g} />
              {editingAny && (
                <View className="flex-row gap-2.5">
                  <Button className="flex-1" size="md" kind="secondary" title={t('cancel')} onPress={resetEntry} />
                  <Button
                    className="flex-1"
                    size="md"
                    kind="danger"
                    icon="trash-2"
                    title={t('delete')}
                    onPress={() => void (editing ? remove(editing) : editingPending && removeRow({ kind: 'pending', p: editingPending, no: currentNo }))}
                  />
                </View>
              )}
            </View>
          )}

          <SectionTitle>
            {t('measurementHistory')} · {int(history.length)}
          </SectionTitle>
          {history.length > 0 && load.editable && <Muted>{t('logListHint')}</Muted>}
          {history.length === 0 ? (
            <Muted>{t('noLogsYet')}</Muted>
          ) : (
            <MenuGroup>
              {history.map((row, i) => {
                const isPending = row.kind === 'pending';
                const v = isPending ? row.p : row.log;
                const key = isPending ? `pending:${row.p.ref}` : row.log.id;
                // a waiting log can always be corrected; a refused one only deleted; a saved one needs an open load
                const canTouch = isPending || load.editable;
                const selected = isPending ? editingPending?.ref === row.p.ref : editing?.id === row.log.id;
                return (
                  <LogRowFrame key={key} fresh={!isPending && row.log.id === fresh}>
                    <Pressable
                      disabled={!canTouch}
                      onPress={() => (isPending && row.p.error ? void removeRow(row) : startEdit(row))}
                      onLongPress={() => void removeRow(row)}
                      accessibilityRole={canTouch ? 'button' : undefined}
                      accessibilityHint={canTouch ? t('edit') : undefined}
                      className={cn(
                        'min-h-12 flex-row items-center gap-3 px-4 py-2.5 active:bg-secondary',
                        i < history.length - 1 && 'border-b border-border',
                        selected && 'bg-saffron-soft',
                      )}
                    >
                      <Text className="w-14 text-[15px] font-bold text-foreground">{isPending && !row.no ? '—' : `#${isPending ? row.no : row.log.logNumber}`}</Text>
                      <View className="flex-1">
                        <Text className="text-[15px] tabular-nums text-foreground">
                          {v.girthIn}″ × {v.lengthFt}′
                        </Text>
                        {isPending && (
                          <Text className={cn('text-[12px] font-medium', row.p.error ? 'text-destructive' : 'text-info')} numberOfLines={2}>
                            {row.p.error ? `${t('notSent')}: ${row.p.error}` : t('waitingToSend')}
                          </Text>
                        )}
                      </View>
                      <Text className={cn('text-[15px] font-bold tabular-nums', isPending && row.p.error ? 'text-muted-foreground line-through' : 'text-foreground')}>{num3(isPending ? row.p.cft : row.log.cft)}</Text>
                      {canTouch && <Icon name={isPending ? (row.p.error ? 'trash-2' : 'upload-cloud') : 'edit-2'} size={15} colorClassName={isPending && row.p.error ? 'accent-destructive' : 'accent-muted-foreground'} />}
                    </Pressable>
                  </LogRowFrame>
                );
              })}
            </MenuGroup>
          )}
        </Page>
      )}
    </View>
  );
}

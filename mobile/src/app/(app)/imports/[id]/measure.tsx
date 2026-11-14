/**
 * Log measurement — built for one-handed use in the yard.
 * Girth and length are typed on a big on-screen keypad (no phone keyboard to cover the
 * screen), the CFT is shown live with the same shared formula the server uses (3 decimals),
 * and each saved log gets the next number from the server. Every log stays listed below,
 * newest first: tap to correct it, long-press to delete.
 */
import { importLogCft } from '@sawmill/shared';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConfirm } from '../../../../components/confirm';
import { ScreenHeader } from '../../../../components/header';
import { toast } from '../../../../components/toast';
import { Button, cn, ErrorBox, Icon, MenuGroup, Muted, Notice, SectionTitle, SkeletonList, StatPair } from '../../../../components/ui';
import { ApiError } from '../../../../lib/api';
import { int, num3 } from '../../../../lib/format';
import { useT } from '../../../../lib/i18n';
import { type ImportDetail, importsApi, type Log } from '../../../../lib/imports-api';
import { invalidateOperations } from '../../../../lib/query';

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

const parse = (v: string) => {
  const n = Number(v);
  return v && Number.isFinite(n) && n > 0 ? n : null;
};

export default function MeasureScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const insets = useSafeAreaInsets();
  const confirm = useConfirm();

  const [load, setLoad] = useState<ImportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [girth, setGirth] = useState('');
  const [length, setLength] = useState('');
  const [field, setField] = useState<Field>('girth');
  const [editing, setEditing] = useState<Log | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const changed = useRef(false);

  const fetchLoad = useCallback(async () => {
    setError(null);
    try {
      setLoad(await importsApi.get(id));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void fetchLoad();
    // lists and dashboards pick up the new totals once, when leaving
    return () => {
      if (changed.current) void invalidateOperations();
    };
  }, [fetchLoad]);

  const g = parse(girth);
  const l = parse(length);
  const liveCft = g && l ? importLogCft(g, l) : null;
  const nextNo = (load?.logs.reduce((m, x) => Math.max(m, x.logNumber), 0) ?? 0) + 1;
  const currentNo = editing ? editing.logNumber : nextNo;
  const totalAfter = load && liveCft != null ? load.totalCft - (editing?.cft ?? 0) + liveCft : null;

  function onKey(k: Key) {
    if (field === 'girth') setGirth((v) => press(v, k));
    else setLength((v) => press(v, k));
  }

  function resetEntry() {
    setGirth('');
    setLength('');
    setField('girth');
    setEditing(null);
  }

  function startEdit(log: Log) {
    setEditing(log);
    setGirth(String(log.girthIn));
    setLength(String(log.lengthFt));
    setField('girth');
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
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = editing ? await importsApi.updateLog(load.id, editing.id, g, l) : await importsApi.addLog(load.id, g, l);
      changed.current = true;
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
      resetEntry();
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.status === 409) void fetchLoad(); // load was submitted meanwhile
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
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

  const history = load ? [...load.logs].sort((a, b) => b.logNumber - a.logNumber) : [];
  const saveLabel = editing ? `${t('save')} ${t('logNo')}${currentNo}` : g && !l ? t('nextLength') : t('saveLog', { n: currentNo });

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
        <ScrollView contentContainerClassName="gap-3 p-4" contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}>
          <StatPair a={{ label: t('logsMeasured'), value: int(load.totalLogs) }} b={{ label: t('totalCft'), value: num3(load.totalCft) }} />

          {!load.editable && <Notice icon="lock">{t('lockedRecord')}</Notice>}

          {load.editable && (
            <View className="gap-3 rounded-xl border border-border bg-card p-4">
              <View className="flex-row items-baseline justify-between">
                <Text className="text-lg font-bold text-foreground">
                  {editing ? t('edit') : t('thisLog')} · {t('logNo')}
                  {currentNo}
                </Text>
                <Text className="text-[22px] font-bold tabular-nums text-warning" accessibilityLiveRegion="polite" accessibilityLabel={`CFT ${num3(liveCft ?? 0)}`}>
                  {num3(liveCft ?? 0)}
                  <Text className="text-sm text-muted-foreground"> CFT</Text>
                </Text>
              </View>

              <View className="flex-row gap-2.5">
                {(['girth', 'length'] as const).map((f) => {
                  const on = field === f;
                  const value = f === 'girth' ? girth : length;
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
                      <Text className="text-[13px] font-semibold text-muted-foreground">{label}</Text>
                      <Text className={cn('text-[34px] font-bold tabular-nums', value ? 'text-foreground' : 'text-muted-foreground')}>
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
                  <Pressable
                    key={k}
                    onPress={() => onKey(k)}
                    accessibilityRole="button"
                    accessibilityLabel={k === 'del' ? t('delete') : k}
                    className="h-[60px] w-[32%] items-center justify-center rounded-xl border border-border bg-background active:bg-secondary"
                  >
                    {k === 'del' ? <Icon name="delete" size={24} colorClassName="accent-foreground" /> : <Text className="text-[26px] font-semibold text-foreground">{k}</Text>}
                  </Pressable>
                ))}
              </View>

              {error && <ErrorBox message={error} />}
              <Button title={saveLabel} onPress={() => void save()} busy={busy} disabled={!g} />
              {editing && (
                <View className="flex-row gap-2.5">
                  <Button className="flex-1" size="md" kind="secondary" title={t('cancel')} onPress={resetEntry} />
                  <Button className="flex-1" size="md" kind="danger" icon="trash-2" title={t('delete')} onPress={() => void remove(editing)} />
                </View>
              )}
            </View>
          )}

          <SectionTitle>
            {t('measurementHistory')} · {int(history.length)}
          </SectionTitle>
          {history.length === 0 ? (
            <Muted>{t('noLogsYet')}</Muted>
          ) : (
            <MenuGroup>
              {history.map((log, i) => (
                <Pressable
                  key={log.id}
                  disabled={!load.editable}
                  onPress={() => startEdit(log)}
                  onLongPress={() => void remove(log)}
                  accessibilityRole={load.editable ? 'button' : undefined}
                  accessibilityHint={load.editable ? t('edit') : undefined}
                  className={cn(
                    'min-h-12 flex-row items-center gap-3 px-4 py-2.5 active:bg-secondary',
                    i < history.length - 1 && 'border-b border-border',
                    editing?.id === log.id && 'bg-saffron-soft',
                  )}
                >
                  <Text className="w-14 text-[15px] font-bold text-foreground">#{log.logNumber}</Text>
                  <Text className="flex-1 text-[15px] tabular-nums text-foreground">
                    {log.girthIn}″ × {log.lengthFt}′
                  </Text>
                  <Text className="text-[15px] font-bold tabular-nums text-foreground">{num3(log.cft)}</Text>
                  {load.editable && <Icon name="edit-2" size={15} colorClassName="accent-muted-foreground" />}
                </Pressable>
              ))}
            </MenuGroup>
          )}
        </ScrollView>
      )}
    </View>
  );
}

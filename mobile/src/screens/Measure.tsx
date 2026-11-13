/**
 * Log measurement — built for one-handed use in the yard.
 * Girth and length are typed on a big on-screen keypad (no phone keyboard),
 * the CFT is shown live with the same formula the server uses, and each saved
 * log gets the next number from the server.
 */
import { Feather } from '@expo/vector-icons';
import { importLogCft } from '@sawmill/shared';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../api';
import { ImportDetail, importsApi, Log } from '../imports-api';
import { useNav } from '../nav';
import { useTheme } from '../theme';
import { BackBar, Button, ErrorBox, Loading, num3, useStyles, useT } from '../ui';

type Field = 'girth' | 'length';
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'] as const;

/** Keypad input rules: one dot, max 2 decimals, max 999.99. */
function press(value: string, key: (typeof KEYS)[number]): string {
  if (key === 'del') return value.slice(0, -1);
  if (key === '.') return value.includes('.') ? value : (value || '0') + '.';
  const next = value === '0' ? key : value + key;
  const [int, dec] = next.split('.');
  if (int.length > 3 || (dec && dec.length > 2)) return value;
  return next;
}

const parse = (v: string) => {
  const n = Number(v);
  return v && Number.isFinite(n) && n > 0 ? n : null;
};

export function MeasureScreen({ id }: { id: string }) {
  const t = useT();
  const { c } = useTheme();
  const s = useStyles();
  const nav = useNav();
  const insets = useSafeAreaInsets();

  const [load, setLoad] = useState<ImportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [girth, setGirth] = useState('');
  const [length, setLength] = useState('');
  const [field, setField] = useState<Field>('girth');
  const [editing, setEditing] = useState<Log | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchLoad = useCallback(async () => {
    setError(null);
    try {
      setLoad(await importsApi.get(id));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    fetchLoad();
  }, [fetchLoad]);

  const g = parse(girth);
  const l = parse(length);
  const liveCft = g && l ? importLogCft(g, l) : null;
  const nextNo = (load?.logs.reduce((m, x) => Math.max(m, x.logNumber), 0) ?? 0) + 1;
  const currentNo = editing ? editing.logNumber : nextNo;

  function onKey(k: (typeof KEYS)[number]) {
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
    if (!load) return;
    if (g && !l) {
      setField('length');
      return;
    }
    if (!g || !l) return;
    setBusy(true);
    setError(null);
    try {
      const res = editing
        ? await importsApi.updateLog(load.id, editing.id, g, l)
        : await importsApi.addLog(load.id, g, l);
      setLoad((prev) =>
        prev && {
          ...prev,
          totalLogs: res.totalLogs,
          totalCft: res.totalCft,
          logs: editing ? prev.logs.map((x) => (x.id === res.log.id ? res.log : x)) : [...prev.logs, res.log],
        },
      );
      resetEntry();
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.status === 409) fetchLoad(); // load was submitted meanwhile
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(log: Log) {
    Alert.alert(`${t('logNo')}${log.logNumber}`, t('confirmDelete'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            const totals = await importsApi.removeLog(load!.id, log.id);
            setLoad((prev) => prev && { ...prev, ...totals, logs: prev.logs.filter((x) => x.id !== log.id) });
            resetEntry();
          } catch (e) {
            setError((e as Error).message);
          }
        },
      },
    ]);
  }

  const title = load ? `${load.code} · ${load.lorryNumber} · ${load.woodType}` : t('measurement');
  const recent = load ? [...load.logs].sort((a, b) => b.logNumber - a.logNumber).slice(0, 3) : [];
  const saveLabel = editing ? `${t('save')} ${t('logNo')}${currentNo}` : g && !l ? t('nextLength') : t('saveLog', { n: currentNo });

  return (
    <SafeAreaView style={[s.fill, { backgroundColor: c.hero }]} edges={['top']}>
      <BackBar title={title} onBack={nav.pop} />
      <View style={[s.fill, { backgroundColor: c.bg }]}>
        {!load && !error && <Loading />}
        {!load && error && (
          <View style={s.body}>
            <ErrorBox message={error} onRetry={fetchLoad} />
          </View>
        )}

        {load && (
          <ScrollView contentContainerStyle={[s.body, { paddingBottom: 32 + insets.bottom }, { gap: 10 }]} keyboardShouldPersistTaps="handled">
            <View style={s.mStats}>
              <View style={s.mStat}>
                <Text style={s.mStatLabel}>{t('logsMeasured')}</Text>
                <Text style={s.mStatValue}>{load.totalLogs}</Text>
              </View>
              <View style={[s.mStat, s.mStatPrimary]}>
                <Text style={[s.mStatLabel, { color: c.onPrimary, opacity: 0.85 }]}>{t('totalCft')}</Text>
                <Text style={[s.mStatValue, { color: c.onPrimary }]}>{num3(load.totalCft)}</Text>
              </View>
            </View>

            {!load.editable && <Text style={s.notice}>{t('lockedRecord')}</Text>}
            {error && <ErrorBox message={error} />}

            {load.editable && (
              <>
                <View style={s.mLogHead}>
                  <Text style={s.mLogNo}>
                    {t('logNo')}
                    {currentNo}
                  </Text>
                  <Text style={s.mLive} accessibilityLabel={`CFT ${num3(liveCft ?? 0)}`}>
                    {num3(liveCft ?? 0)} CFT
                  </Text>
                </View>

                <View style={s.mInputs}>
                  {(['girth', 'length'] as const).map((f) => {
                    const on = field === f;
                    const value = f === 'girth' ? girth : length;
                    return (
                      <Pressable
                        key={f}
                        onPress={() => setField(f)}
                        style={[s.mInput, on && s.mInputOn]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={`${t(f === 'girth' ? 'girth' : 'lengthFt')} ${value}`}
                      >
                        <Text style={s.mInputLabel}>{t(f === 'girth' ? 'girth' : 'lengthFt')}</Text>
                        <Text style={[s.mInputValue, !value && { color: c.muted }]}>{value || '0'}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {recent.length > 0 && (
                  <View style={{ gap: 6 }}>
                    {recent.map((log) => (
                      <Pressable
                        key={log.id}
                        onPress={() => startEdit(log)}
                        onLongPress={() => confirmDelete(log)}
                        style={[s.mRecent, editing?.id === log.id && s.mRecentOn]}
                        accessibilityRole="button"
                        accessibilityHint={t('edit')}
                      >
                        <Text style={[s.cardTitle, { width: 52 }]}>#{log.logNumber}</Text>
                        <Text style={[s.text, s.fill]}>
                          {log.girthIn}″ × {log.lengthFt}′
                        </Text>
                        <Text style={s.cardNumber}>{num3(log.cft)}</Text>
                        <Feather name="edit-2" size={16} color={c.muted} />
                      </Pressable>
                    ))}
                  </View>
                )}

                <View style={s.keypad}>
                  {KEYS.map((k) => (
                    <Pressable
                      key={k}
                      onPress={() => onKey(k)}
                      style={({ pressed }) => [s.key, pressed && { backgroundColor: c.surface2 }]}
                      accessibilityRole="button"
                      accessibilityLabel={k === 'del' ? t('delete') : k}
                    >
                      {k === 'del' ? <Feather name="delete" size={24} color={c.text} /> : <Text style={s.keyText}>{k}</Text>}
                    </Pressable>
                  ))}
                </View>

                <Button title={saveLabel} onPress={save} busy={busy} disabled={!g} />
                {editing && (
                  <View style={s.row}>
                    <View style={s.fill}>
                      <Button kind="secondary" title={t('cancel')} onPress={resetEntry} />
                    </View>
                    <View style={s.fill}>
                      <Button kind="danger" icon="trash-2" title={t('delete')} onPress={() => confirmDelete(editing)} />
                    </View>
                  </View>
                )}
              </>
            )}

            {!load.editable && load.logs.length === 0 && <Text style={s.muted}>{t('noLogs')}</Text>}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

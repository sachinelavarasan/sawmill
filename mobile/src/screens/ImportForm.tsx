import type { TKey } from '@sawmill/shared';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ImportForm, importsApi } from '../imports-api';
import { useNav } from '../nav';
import { useTheme } from '../theme';
import { BackBar, Button, ErrorBox, Loading, useStyles, useT } from '../ui';

const EMPTY: ImportForm = {
  lorryNumber: '',
  woodType: '',
  woodCategory: '',
  driverName: '',
  driverMobile: '',
  lorryOwnerName: '',
  lorryOwnerMobile: '',
  originLocation: '',
};

type FieldDef = { key: keyof ImportForm; label: TKey; required?: boolean; phone?: boolean; caps?: boolean; hint?: TKey };

const FIELDS: FieldDef[] = [
  { key: 'lorryNumber', label: 'lorryNumber', required: true, caps: true },
  { key: 'woodType', label: 'woodType', required: true, hint: 'woodTypeHint' },
  { key: 'woodCategory', label: 'woodCategory' },
  { key: 'originLocation', label: 'originLocation' },
  { key: 'driverName', label: 'driverName' },
  { key: 'driverMobile', label: 'driverMobile', phone: true },
  { key: 'lorryOwnerName', label: 'lorryOwnerName' },
  { key: 'lorryOwnerMobile', label: 'lorryOwnerMobile', phone: true },
];

/** New import (id undefined) or edit an existing one. Arrival time is "now" on the server for new loads. */
export function ImportFormScreen({ id }: { id?: string }) {
  const t = useT();
  const { c } = useTheme();
  const s = useStyles();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<ImportForm | null>(id ? null : EMPTY);
  const [focused, setFocused] = useState<keyof ImportForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** The mill's own previous wood types / categories — never a hard-coded list. */
  const [suggest, setSuggest] = useState<{ woodType: string[]; woodCategory: string[] }>({ woodType: [], woodCategory: [] });

  useEffect(() => {
    importsApi
      .list()
      .then(({ items }) => {
        const uniq = (xs: (string | null | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))].slice(0, 8);
        setSuggest({ woodType: uniq(items.map((i) => i.woodType)), woodCategory: [] });
      })
      .catch(() => undefined);
    if (id) {
      importsApi
        .get(id)
        .then((d) =>
          setForm({
            lorryNumber: d.lorryNumber,
            woodType: d.woodType,
            woodCategory: d.woodCategory ?? '',
            driverName: d.driverName ?? '',
            driverMobile: d.driverMobile ?? '',
            lorryOwnerName: d.lorryOwnerName ?? '',
            lorryOwnerMobile: d.lorryOwnerMobile ?? '',
            originLocation: d.originLocation ?? '',
          }),
        )
        .catch((e: Error) => setError(e.message));
    }
  }, [id]);

  const set = (k: keyof ImportForm) => (v: string) => setForm((f) => f && { ...f, [k]: v });
  const valid = !!form && form.lorryNumber.trim().length >= 4 && form.woodType.trim().length >= 2;

  async function submit() {
    if (!form || !valid) return;
    setBusy(true);
    setError(null);
    try {
      if (id) {
        await importsApi.update(id, form);
        nav.pop();
      } else {
        const created = await importsApi.create(form);
        nav.replace({ name: 'import', id: created.id });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={[s.fill, { backgroundColor: c.hero }]} edges={['top']}>
      <BackBar title={id ? t('edit') : t('newImport')} onBack={nav.pop} />
      <KeyboardAvoidingView style={[s.fill, { backgroundColor: c.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {!form ? (
          error ? (
            <View style={s.body}>
              <ErrorBox message={error} />
            </View>
          ) : (
            <Loading />
          )
        ) : (
          <ScrollView contentContainerStyle={[s.body, { paddingBottom: 32 + insets.bottom }]} keyboardShouldPersistTaps="handled">
            {FIELDS.map((f) => (
              <View key={f.key} style={s.field}>
                <Text style={s.label}>
                  {t(f.label)}
                  {f.required && <Text style={{ color: c.bad }}> *</Text>}
                </Text>
                <TextInput
                  style={[s.input, focused === f.key && s.inputFocused]}
                  value={form[f.key]}
                  onChangeText={set(f.key)}
                  onFocus={() => setFocused(f.key)}
                  onBlur={() => setFocused(null)}
                  placeholder={f.hint ? t(f.hint) : undefined}
                  placeholderTextColor={c.muted}
                  autoCapitalize={f.caps ? 'characters' : 'words'}
                  keyboardType={f.phone ? 'phone-pad' : 'default'}
                  accessibilityLabel={t(f.label)}
                />
                {f.key === 'woodType' && suggest.woodType.length > 0 && (
                  <View style={s.pillRow}>
                    {suggest.woodType.map((w) => (
                      <Pressable
                        key={w}
                        onPress={() => set('woodType')(w)}
                        style={[s.chip, form.woodType === w && s.chipOn]}
                        accessibilityRole="button"
                      >
                        <Text style={s.chipText}>{w}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            ))}

            {error && <ErrorBox message={error} />}
            <Button title={id ? t('save') : t('create')} onPress={submit} busy={busy} disabled={!valid} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

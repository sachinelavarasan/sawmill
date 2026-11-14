/** New import load, or edit one that is still a draft / rejected. Arrival is "now" on the server for new loads. */
import type { TKey } from '@sawmill/shared';
import { useRouter } from 'expo-router';
import { type ComponentProps, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Field, FormScreen, FormSection, RequiredNote } from './form';
import { toast } from './toast';
import { Button, Chip, Loading } from './ui';
import { useSubmit, useUnsavedGuard } from '../lib/hooks';
import { useT } from '../lib/i18n';
import { type ImportForm as Form, importsApi } from '../lib/imports-api';
import { invalidateOperations, useApi } from '../lib/query';

const EMPTY: Form = {
  lorryNumber: '',
  woodType: '',
  woodCategory: '',
  driverName: '',
  driverMobile: '',
  lorryOwnerName: '',
  lorryOwnerMobile: '',
  originLocation: '',
};
const PHONE = /^[0-9+ ]{7,15}$/;

export function ImportForm({ id }: { id?: string }) {
  const t = useT();
  const router = useRouter();
  const [initial, setInitial] = useState<Form | null>(id ? null : EMPTY);
  const [form, setForm] = useState<Form | null>(initial);
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // the mill's own previous wood types — never a hard-coded list
  const recent = useApi<{ items: { woodType: string; woodCategory?: string | null }[] }>('/imports?take=100');
  const woodTypes = useMemo(() => [...new Set((recent.data?.items ?? []).map((i) => i.woodType).filter(Boolean))].slice(0, 8), [recent.data]);

  useEffect(() => {
    if (!id) return;
    importsApi
      .get(id)
      .then((d) => {
        const f = {
          lorryNumber: d.lorryNumber,
          woodType: d.woodType,
          woodCategory: d.woodCategory ?? '',
          driverName: d.driverName ?? '',
          driverMobile: d.driverMobile ?? '',
          lorryOwnerName: d.lorryOwnerName ?? '',
          lorryOwnerMobile: d.lorryOwnerMobile ?? '',
          originLocation: d.originLocation ?? '',
        };
        setInitial(f);
        setForm(f);
        setNotes(d.notes ?? '');
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [id]);

  const errors: Partial<Record<keyof Form, string>> = {};
  if (form) {
    if (form.lorryNumber.trim().length < 4) errors.lorryNumber = t('minChars', { n: 4 });
    if (form.woodType.trim().length < 2) errors.woodType = t('minChars', { n: 2 });
    if (form.driverMobile.trim() && !PHONE.test(form.driverMobile.trim())) errors.driverMobile = t('invalidMobile');
    if (form.lorryOwnerMobile.trim() && !PHONE.test(form.lorryOwnerMobile.trim())) errors.lorryOwnerMobile = t('invalidMobile');
  }
  const valid = !!form && Object.keys(errors).length === 0;
  const dirty = !!form && !!initial && JSON.stringify(form) !== JSON.stringify(initial);
  const release = useUnsavedGuard(dirty);

  const [save, busy, error] = useSubmit(async (thenMeasure: boolean) => {
    if (!form) return;
    const body = { ...form, notes };
    if (id) {
      await importsApi.update(id, body);
      release();
      await invalidateOperations();
      toast(t('saved'));
      router.back();
    } else {
      const created = await importsApi.create(body);
      release();
      await invalidateOperations();
      toast(t('saved'), 'success', created.code);
      router.replace(thenMeasure ? `/imports/${created.id}/measure` : `/imports/${created.id}`);
    }
  });

  function submit(thenMeasure: boolean) {
    setTouched(true);
    if (valid) void save(thenMeasure);
  }

  const set = (k: keyof Form) => (v: string) => setForm((f) => f && { ...f, [k]: v });
  const err = (k: keyof Form) => (touched || form?.[k] ? errors[k] : undefined);
  const field = (k: keyof Form, label: TKey, extra: Partial<ComponentProps<typeof Field>> = {}) => (
    <Field label={t(label)} value={form![k]} onChangeText={set(k)} error={err(k)} {...extra} />
  );

  return (
    <FormScreen
      title={id ? t('edit') : t('newImport')}
      error={error ?? loadError}
      footer={
        form && (
          <View className="flex-row gap-2.5">
            {!id && <Button className="flex-1" kind="secondary" title={t('saveDraft')} busy={busy} onPress={() => submit(false)} />}
            <Button className="flex-1" icon={id ? 'check' : 'edit-3'} title={id ? t('save') : t('saveAndMeasure')} busy={busy} onPress={() => submit(!id)} />
          </View>
        )
      }
    >
      {!form ? (
        !loadError && <Loading />
      ) : (
        <>
          <FormSection title={t('secImportInfo')} subtitle={t('secImportInfoSub')}>
            {field('lorryNumber', 'lorryNumber', { required: true, autoCapitalize: 'characters', hint: t('lorryNumberHint') })}
            <Field label={t('woodType')} required value={form.woodType} onChangeText={set('woodType')} error={err('woodType')} placeholder={t('woodTypeHint')} autoCapitalize="words">
              {woodTypes.length > 0 && (
                <View className="flex-row flex-wrap gap-1.5">
                  {woodTypes.map((w) => (
                    <Chip key={w} text={w} on={form.woodType === w} onPress={() => set('woodType')(w)} />
                  ))}
                </View>
              )}
            </Field>
            {field('woodCategory', 'woodCategory', { autoCapitalize: 'words' })}
            <RequiredNote />
          </FormSection>

          <FormSection title={t('secLorry')} subtitle={t('secLorrySub')}>
            {field('driverName', 'driverName', { autoCapitalize: 'words' })}
            {field('driverMobile', 'driverMobile', { keyboardType: 'phone-pad', hint: t('mobileHint') })}
            {field('lorryOwnerName', 'lorryOwnerName', { autoCapitalize: 'words' })}
            {field('lorryOwnerMobile', 'lorryOwnerMobile', { keyboardType: 'phone-pad' })}
          </FormSection>

          <FormSection title={t('secAdditional')} subtitle={t('secAdditionalSub')} collapsible initiallyOpen={!!(form.originLocation || notes)}>
            {field('originLocation', 'originLocation', { autoCapitalize: 'words' })}
            <Field label={t('notes')} value={notes} onChangeText={setNotes} multiline placeholder={t('notesHint')} />
          </FormSection>
        </>
      )}
    </FormScreen>
  );
}

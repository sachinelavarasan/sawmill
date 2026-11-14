/** [OWNER-ONLY] Add or edit a client / supplier (?kind=clients|suppliers&id=). */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Field, FormScreen, FormSection, RequiredNote } from '../../../components/form';
import { toast } from '../../../components/toast';
import { Button } from '../../../components/ui';
import { api } from '../../../lib/api';
import { useSubmit, useUnsavedGuard } from '../../../lib/hooks';
import { useT } from '../../../lib/i18n';
import { invalidate, useApi } from '../../../lib/query';
import type { Party } from '../../../lib/types';

const MOBILE = /^[0-9+ -]{7,15}$/;
const EMPTY = { name: '', phone: '', address: '', gstNumber: '', notes: '' };

export default function PartyFormScreen() {
  const { kind, id } = useLocalSearchParams<{ kind: 'clients' | 'suppliers'; id?: string }>();
  const t = useT();
  const router = useRouter();
  const list = useApi<Party[]>(id ? `/${kind}` : null);
  const [initial, setInitial] = useState(EMPTY);
  const [f, setF] = useState(EMPTY);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const p = list.data?.find((x) => x.id === id);
    if (!p) return;
    const v = { name: p.name, phone: p.phone ?? '', address: p.address ?? '', gstNumber: p.gstNumber ?? '', notes: p.notes ?? '' };
    setInitial(v);
    setF(v);
  }, [list.data, id]);

  const errors = {
    name: f.name.trim() ? undefined : t('required'),
    phone: f.phone.trim() && !MOBILE.test(f.phone.trim()) ? t('invalidMobile') : undefined,
  };
  const valid = !errors.name && !errors.phone;
  const release = useUnsavedGuard(JSON.stringify(f) !== JSON.stringify(initial));

  const [save, busy, error] = useSubmit(async () => {
    await api(id ? `/${kind}/${id}` : `/${kind}`, { method: id ? 'PATCH' : 'POST', body: JSON.stringify(f) });
    release();
    await invalidate(`/${kind}`, '/accounts');
    toast(t('saved'));
    router.back();
  });

  const set = (k: keyof typeof EMPTY) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const isClient = kind === 'clients';

  return (
    <FormScreen
      title={id ? f.name || t('edit') : t(isClient ? 'addClient' : 'addSupplier')}
      error={error ?? (list.error as Error | null)?.message}
      footer={
        <Button
          title={t('save')}
          busy={busy}
          onPress={() => {
            setTouched(true);
            if (valid) void save();
          }}
        />
      }
    >
      <FormSection title={t('secContact')}>
        <Field label={t('name')} required value={f.name} onChangeText={set('name')} autoCapitalize="words" error={touched ? errors.name : undefined} />
        <Field label={t('mobile')} value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" error={errors.phone} hint={t('mobileHint')} />
        <Field label={t('address')} value={f.address} onChangeText={set('address')} multiline />
        <RequiredNote />
      </FormSection>
      <FormSection title={t('secBusiness')} collapsible initiallyOpen={!!(f.gstNumber || f.notes)}>
        <Field label={t('gstNumber')} value={f.gstNumber} onChangeText={set('gstNumber')} autoCapitalize="characters" maxLength={20} />
        <Field label={t('notes')} value={f.notes} onChangeText={set('notes')} multiline />
      </FormSection>
    </FormScreen>
  );
}

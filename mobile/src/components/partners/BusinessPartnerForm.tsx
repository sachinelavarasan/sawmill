import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { api } from '../../lib/api';
import { useSubmit, useUnsavedGuard } from '../../lib/hooks';
import { useT } from '../../lib/i18n';
import { invalidate, useApi } from '../../lib/query';
import type { Party } from '../../lib/types';
import { Field, FormScreen, FormSection, RequiredNote } from '../form';
import { toast } from '../toast';
import { Button, Notice } from '../ui';
import { PARTNER_META, type PartnerKind } from './types';

const MOBILE_RE = /^[0-9+ -]{7,15}$/;
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const EMPTY = { name: '', phone: '', address: '', gstNumber: '', notes: '' };

export function BusinessPartnerForm({
  kind,
  id,
}: {
  kind: PartnerKind;
  id?: string;
}) {
  const t = useT();
  const router = useRouter();
  const meta = PARTNER_META[kind];
  const list = useApi<Party[]>(`/${kind}`);
  const [initial, setInitial] = useState(EMPTY);
  const [f, setF] = useState(EMPTY);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!id) return;
    const p = list.data?.find((x) => x.id === id);
    if (!p) return;
    const v = {
      name: p.name,
      phone: p.phone ?? '',
      address: p.address ?? '',
      gstNumber: p.gstNumber ?? '',
      notes: p.notes ?? '',
    };
    setInitial(v);
    setF(v);
  }, [list.data, id]);

  const trimmedName = f.name.trim();
  const trimmedPhone = f.phone.trim();
  const trimmedGst = f.gstNumber.trim().toUpperCase();

  const errors = {
    name: trimmedName ? undefined : t('required'),
    phone: trimmedPhone && !MOBILE_RE.test(trimmedPhone) ? t('invalidMobile') : undefined,
    gstNumber: trimmedGst && !GSTIN_RE.test(trimmedGst) ? t('invalidGstin') : undefined,
  };
  const valid = !errors.name && !errors.phone && !errors.gstNumber;
  const release = useUnsavedGuard(JSON.stringify(f) !== JSON.stringify(initial));

  const duplicateMatch = useMemo(() => {
    if (!list.data) return null;
    const nameNeedle = trimmedName.toLowerCase();
    const phoneDigits = trimmedPhone.replace(/\D/g, '');
    return (
      list.data.find((p) => {
        if (id && p.id === id) return false;
        if (nameNeedle && p.name.trim().toLowerCase() === nameNeedle) return true;
        if (phoneDigits.length >= 7 && (p.phone ?? '').replace(/\D/g, '') === phoneDigits) return true;
        if (trimmedGst && (p.gstNumber ?? '').trim().toUpperCase() === trimmedGst) return true;
        return false;
      }) ?? null
    );
  }, [list.data, id, trimmedName, trimmedPhone, trimmedGst]);

  const [save, busy, error] = useSubmit(async () => {
    const body = {
      name: trimmedName,
      phone: trimmedPhone || null,
      address: f.address.trim() || null,
      gstNumber: trimmedGst || null,
      notes: f.notes.trim() || null,
    };
    await api(id ? `/${kind}/${id}` : `/${kind}`, { method: id ? 'PATCH' : 'POST', body });
    release();
    await invalidate(`/${kind}`, '/accounts', ...(id ? [`/${kind}/${id}/statement`] : []));
    toast(t('saved'));
    router.back();
  });

  const set = (k: keyof typeof EMPTY) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  return (
    <FormScreen
      title={id ? f.name.trim() || t(meta.editLabel) : t(meta.addLabel)}
      subtitle={t(meta.subtitle)}
      error={error ?? (list.error as Error | null)?.message}
      footer={
        <View className="flex-row gap-3">
          <Button className="flex-1" kind="secondary" title={t('cancel')} disabled={busy} onPress={() => router.back()} />
          <Button
            className="flex-1"
            title={t('save')}
            busy={busy}
            onPress={() => {
              setTouched(true);
              if (valid && !busy) void save();
            }}
          />
        </View>
      }
    >
      {duplicateMatch && (
        <Notice tone="warn" icon="alert-triangle">
          {t('duplicatePartnerWarn', { kind: t(meta.singular).toLowerCase(), name: duplicateMatch.name })}
        </Notice>
      )}

      <FormSection title={t('secBusiness')}>
        <Field
          label={t('businessName')}
          required
          value={f.name}
          onChangeText={set('name')}
          autoCapitalize="words"
          maxLength={120}
          error={touched ? errors.name : undefined}
        />
        <Field
          label={t('mobile')}
          value={f.phone}
          onChangeText={set('phone')}
          keyboardType="phone-pad"
          maxLength={15}
          error={errors.phone}
          hint={t('mobileHint')}
        />
        <RequiredNote />
      </FormSection>

      <FormSection title={t('secTaxInfo')}>
        <Field
          label={t('gstNumber')}
          value={f.gstNumber}
          onChangeText={(v) => set('gstNumber')(v.toUpperCase())}
          autoCapitalize="characters"
          maxLength={15}
          error={touched || trimmedGst.length > 0 ? errors.gstNumber : undefined}
          hint={t('gstHint')}
        />
      </FormSection>

      <FormSection title={t('secAddress')}>
        <Field
          label={t('address')}
          value={f.address}
          onChangeText={set('address')}
          multiline
          maxLength={300}
        />
      </FormSection>

      <FormSection title={t('secAdditionalInfo')} collapsible initiallyOpen={!!(id && f.notes)}>
        <Field
          label={t('notes')}
          value={f.notes}
          onChangeText={set('notes')}
          multiline
          maxLength={1000}
          hint={t('partnerNotesHint')}
        />
      </FormSection>
    </FormScreen>
  );
}

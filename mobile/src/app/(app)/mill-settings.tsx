/**
 * [OWNER-ONLY] The mill's settings: name, standard unloading rate, language for new users
 * and time zone (same fields as the web). Opened from Settings; Save stays pinned at the bottom.
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Field, FormScreen, FormSection, NumberField } from '../../components/form';
import { SelectField } from '../../components/sheet';
import { toast } from '../../components/toast';
import { Button, ErrorBox, Segmented, SkeletonList } from '../../components/ui';
import { api } from '../../lib/api';
import { parseNum } from '../../lib/format';
import { useSubmit, useUnsavedGuard } from '../../lib/hooks';
import { useT } from '../../lib/i18n';
import { invalidate, useApi } from '../../lib/query';
import type { MillSettings } from '../../lib/types';

const OFFSETS = [-300, -240, 0, 60, 120, 180, 240, 270, 300, 330, 345, 360, 390, 420, 480, 540, 570, 600, 660, 720];
const offsetLabel = (m: number) => {
  const a = Math.abs(m);
  return `UTC${m < 0 ? '−' : '+'}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}${m === 330 ? ' (IST)' : ''}`;
};

type Form = { name: string; rate: string; lang: 'en' | 'ta'; offset: string };

export default function MillSettingsScreen() {
  const t = useT();
  const router = useRouter();
  const q = useApi<MillSettings>('/settings');
  const [initial, setInitial] = useState<Form | null>(null);
  const [f, setF] = useState<Form | null>(null);

  useEffect(() => {
    if (!q.data) return;
    const v: Form = {
      name: q.data.name,
      rate: q.data.defaultUnloadingRatePerHour != null ? String(q.data.defaultUnloadingRatePerHour) : '',
      lang: q.data.defaultLanguage,
      offset: String(q.data.utcOffsetMinutes),
    };
    setInitial(v);
    setF(v);
  }, [q.data]);

  const dirty = !!f && JSON.stringify(f) !== JSON.stringify(initial);
  const release = useUnsavedGuard(dirty);
  const nameOk = !!f && f.name.trim().length >= 2;

  const [save, busy, error] = useSubmit(async () => {
    if (!f) return;
    await api('/settings', {
      method: 'PATCH',
      body: { name: f.name.trim(), defaultUnloadingRatePerHour: parseNum(f.rate), defaultLanguage: f.lang, utcOffsetMinutes: Number(f.offset) },
    });
    setInitial(f);
    await invalidate('/settings', '/auth/me');
    toast(t('saved'));
    release?.();
    router.back();
  });

  const offsets = f && !OFFSETS.includes(Number(f.offset)) ? [...OFFSETS, Number(f.offset)].sort((a, b) => a - b) : OFFSETS;

  return (
    <FormScreen
      title={t('millSettings')}
      subtitle={q.data?.code}
      error={error}
      footer={f ? <Button title={t('saveChanges')} icon="check" busy={busy} disabled={!dirty || !nameOk} onPress={() => void save()} /> : undefined}
    >
      {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
      {!f || !q.data ? (
        !q.error && <SkeletonList rows={3} />
      ) : (
        <>
          <FormSection title={t('secMillInfo')} subtitle={t('secMillInfoSub')}>
            <Field label={t('millName')} required value={f.name} onChangeText={(name) => setF({ ...f, name })} error={nameOk ? undefined : t('minChars', { n: 2 })} />
            <Field label={t('millCode')} value={q.data.code} editable={false} hint={t('millCodeHint')} />
          </FormSection>
          <FormSection title={t('secUnloadingRate')} subtitle={t('secUnloadingRateSub')}>
            <NumberField label={t('defaultUnloadingRate')} unit="₹/h" value={f.rate} onChangeText={(rate) => setF({ ...f, rate })} hint={t('defaultUnloadingRateHint')} />
          </FormSection>
          <FormSection title={t('secNewUserLanguage')} subtitle={t('secNewUserLanguageSub')}>
            <Segmented
              value={f.lang}
              onChange={(lang) => setF({ ...f, lang })}
              options={[
                { value: 'en', label: 'English' },
                { value: 'ta', label: 'தமிழ்' },
              ]}
            />
          </FormSection>
          <FormSection title={t('secTimeZone')} subtitle={t('secTimeZoneSub')}>
            <SelectField
              label={t('timeZone')}
              value={f.offset}
              options={offsets.map((m) => ({ value: String(m), label: offsetLabel(m) }))}
              onChange={(offset) => offset && setF({ ...f, offset })}
              hint={t('timeZoneHint')}
            />
          </FormSection>
        </>
      )}
    </FormScreen>
  );
}

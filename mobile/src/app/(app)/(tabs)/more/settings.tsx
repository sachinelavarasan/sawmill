/**
 * Settings. Everyone: language and theme on this phone. Owner: the mill's name, standard
 * unloading rate, language for new users and time zone (same fields as the web).
 */
import { Permission } from '@sawmill/shared';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Field, FormSection, NumberField } from '../../../../components/form';
import { Page, ScreenHeader } from '../../../../components/header';
import { SelectField } from '../../../../components/sheet';
import { toast } from '../../../../components/toast';
import { Button, ErrorBox, LangToggle, Muted, Segmented, SkeletonList } from '../../../../components/ui';
import { api } from '../../../../lib/api';
import { parseNum } from '../../../../lib/format';
import { useSubmit, useUnsavedGuard } from '../../../../lib/hooks';
import { useT } from '../../../../lib/i18n';
import { invalidate, useApi } from '../../../../lib/query';
import { useSession } from '../../../../lib/session';
import { useThemeToggle } from '../../../../lib/theme';
import type { MillSettings } from '../../../../lib/types';

const OFFSETS = [-300, -240, 0, 60, 120, 180, 240, 270, 300, 330, 345, 360, 390, 420, 480, 540, 570, 600, 660, 720];
const offsetLabel = (m: number) => {
  const a = Math.abs(m);
  return `UTC${m < 0 ? '−' : '+'}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}${m === 330 ? ' (IST)' : ''}`;
};

export default function SettingsScreen() {
  const t = useT();
  const { can } = useSession();
  const { dark, toggle } = useThemeToggle();
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={t('settings')} back />
      <Page bottomInset={false}>
        <FormSection title={t('appPreferences')}>
          <View className="gap-1.5">
            <Muted>{t('language')}</Muted>
            <LangToggle />
          </View>
          <View className="gap-1.5">
            <Muted>{t('theme')}</Muted>
            <Segmented
              value={dark ? 'dark' : 'light'}
              onChange={(v) => (v === 'dark') !== dark && toggle()}
              options={[
                { value: 'light', label: t('themeLight') },
                { value: 'dark', label: t('themeDark') },
              ]}
            />
          </View>
        </FormSection>
        {can(Permission.SETTINGS_MANAGE) && <MillSettingsForm />}
      </Page>
    </View>
  );
}

function MillSettingsForm() {
  const t = useT();
  const q = useApi<MillSettings>('/settings');
  const [initial, setInitial] = useState<{ name: string; rate: string; lang: 'en' | 'ta'; offset: string } | null>(null);
  const [f, setF] = useState(initial);

  useEffect(() => {
    if (!q.data) return;
    const v = { name: q.data.name, rate: q.data.defaultUnloadingRatePerHour != null ? String(q.data.defaultUnloadingRatePerHour) : '', lang: q.data.defaultLanguage, offset: String(q.data.utcOffsetMinutes) };
    setInitial(v);
    setF(v);
  }, [q.data]);

  const dirty = !!f && JSON.stringify(f) !== JSON.stringify(initial);
  useUnsavedGuard(dirty);
  const nameOk = !!f && f.name.trim().length >= 2;

  const [save, busy, error] = useSubmit(async () => {
    if (!f) return;
    await api('/settings', {
      method: 'PATCH',
      body: JSON.stringify({ name: f.name.trim(), defaultUnloadingRatePerHour: parseNum(f.rate), defaultLanguage: f.lang, utcOffsetMinutes: Number(f.offset) }),
    });
    setInitial(f);
    await invalidate('/settings', '/auth/me');
    toast(t('saved'));
  });

  if (q.error) return <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />;
  if (!f || !q.data) return <SkeletonList rows={2} />;
  const offsets = OFFSETS.includes(Number(f.offset)) ? OFFSETS : [...OFFSETS, Number(f.offset)].sort((a, b) => a - b);

  return (
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
        <SelectField label={t('timeZone')} value={f.offset} options={offsets.map((m) => ({ value: String(m), label: offsetLabel(m) }))} onChange={(offset) => offset && setF({ ...f, offset })} hint={t('timeZoneHint')} />
      </FormSection>
      {error && <ErrorBox message={error} />}
      <Button title={t('saveChanges')} icon="check" busy={busy} disabled={!dirty || !nameOk} onPress={() => void save()} />
    </>
  );
}

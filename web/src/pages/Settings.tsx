import { FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { api } from '../api';
import { useAuth } from '../auth';
import { useLoad } from '../components/common';
import { Field, FormActions, FormCard, FormGrid, LoadState, Notice, Page, PageHeader } from '../components/page';
import { useI18n } from '../i18n';

interface MillSettings {
  name: string;
  code: string;
  defaultUnloadingRatePerHour: number | null;
  defaultLanguage: 'en' | 'ta';
  utcOffsetMinutes: number;
}

/** Common offsets; the mill's current value is always offered even if it isn't listed. */
const OFFSETS = [-300, -240, 0, 60, 120, 180, 240, 270, 300, 330, 345, 360, 390, 420, 480, 540, 570, 600, 660, 720];
const offsetLabel = (m: number) => {
  const sign = m < 0 ? '−' : '+';
  const a = Math.abs(m);
  return `UTC${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}${m === 330 ? ' (IST)' : ''}`;
};

/** [OWNER-ONLY] Mill-wide defaults. */
export function SettingsPage() {
  const { t } = useI18n();
  const { refreshProfile } = useAuth();
  const { data, loading, error, reload } = useLoad(() => api<MillSettings>('/settings'), []);
  const [form, setForm] = useState<{ name: string; rate: string; lang: 'en' | 'ta'; offset: string } | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data)
      setForm({
        name: data.name,
        rate: data.defaultUnloadingRatePerHour == null ? '' : String(data.defaultUnloadingRatePerHour),
        lang: data.defaultLanguage,
        offset: String(data.utcOffsetMinutes),
      });
  }, [data]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setMessage(null);
    try {
      await api('/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name,
          defaultUnloadingRatePerHour: form.rate.trim() === '' ? null : Number(form.rate),
          defaultLanguage: form.lang,
          utcOffsetMinutes: Number(form.offset),
        }),
      });
      setMessage({ tone: 'ok', text: t('saved') });
      reload();
      await refreshProfile(); // the mill name in the sidebar
    } catch (err) {
      setMessage({ tone: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const offsets = form && !OFFSETS.includes(Number(form.offset)) ? [...OFFSETS, Number(form.offset)].sort((a, b) => a - b) : OFFSETS;

  return (
    <Page className="max-w-3xl">
      <PageHeader title={t('settings')} subtitle={t('settingsSubtitle')} />
      <LoadState loading={loading && !data} error={error} onRetry={reload} />

      {data && form && (
        <FormCard onSubmit={save}>
          <FormGrid className="lg:grid-cols-2">
            <Field id="mill-name" label={`${t('millName')} *`}>
              <Input id="mill-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} maxLength={120} />
            </Field>
            <Field id="mill-code" label={t('millCode')}>
              <Input id="mill-code" value={data.code} disabled readOnly />
            </Field>
            <Field id="mill-rate" label={t('defaultUnloadingRate')} hint={t('defaultUnloadingRateHint')}>
              <Input
                id="mill-rate"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={form.rate}
                onChange={(e) => setForm({ ...form, rate: e.target.value })}
              />
            </Field>
            <Field label={t('defaultLanguage')}>
              <ToggleGroup
                type="single"
                variant="outline"
                value={form.lang}
                onValueChange={(v) => v && setForm({ ...form, lang: v as 'en' | 'ta' })}
                className="w-fit bg-card"
                aria-label={t('defaultLanguage')}
              >
                <ToggleGroupItem value="en" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  English
                </ToggleGroupItem>
                <ToggleGroupItem value="ta" className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  தமிழ்
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <Field label={t('timeZone')} hint={t('timeZoneHint')}>
              <Select value={form.offset} onValueChange={(v) => setForm({ ...form, offset: v })}>
                <SelectTrigger className="w-full" aria-label={t('timeZone')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {offsets.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {offsetLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FormGrid>
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
          <FormActions>
            <Button type="submit" disabled={busy}>
              {t('save')}
            </Button>
          </FormActions>
        </FormCard>
      )}
    </Page>
  );
}

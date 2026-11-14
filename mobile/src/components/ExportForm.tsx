/** New export load (step 1: lorry, wood, when) or edit one. Lines are picked from finished stock on its page (step 2). */
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { int, num3, todayIso } from '../lib/format';
import { useSubmit, useUnsavedGuard } from '../lib/hooks';
import { useT } from '../lib/i18n';
import { invalidateOperations, useApi } from '../lib/query';
import type { Balances, ExportDetail } from '../lib/types';
import { Field, FormScreen, FormSection, RequiredNote } from './form';
import { DateField, DateTimeField, SelectField } from './sheet';
import { toast } from './toast';
import { Button, Loading, Notice } from './ui';

interface Form {
  exportDate: string;
  lorryNumber: string;
  woodType: string;
  importLoadId: string;
  driverName: string;
  driverMobile: string;
  lorryOwnerName: string;
  lorryOwnerMobile: string;
  startAt: string;
  endAt: string;
  notes: string;
}
const PHONE = /^[0-9+ ]{7,15}$/;

export function ExportForm({ id }: { id?: string }) {
  const t = useT();
  const router = useRouter();
  const stock = useApi<Balances>('/stock');
  const [initial, setInitial] = useState<Form | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!id) {
      const f: Form = { exportDate: todayIso(), lorryNumber: '', woodType: '', importLoadId: '', driverName: '', driverMobile: '', lorryOwnerName: '', lorryOwnerMobile: '', startAt: '', endAt: '', notes: '' };
      setInitial(f);
      setForm(f);
      return;
    }
    api<ExportDetail>(`/exports/${id}`)
      .then((d) => {
        const f: Form = {
          exportDate: d.exportDate.slice(0, 10),
          lorryNumber: d.lorryNumber,
          woodType: d.woodType,
          importLoadId: d.importLoadId ?? '',
          driverName: d.driverName ?? '',
          driverMobile: d.driverMobile ?? '',
          lorryOwnerName: d.lorryOwnerName ?? '',
          lorryOwnerMobile: d.lorryOwnerMobile ?? '',
          startAt: d.startAt ?? '',
          endAt: d.endAt ?? '',
          notes: d.notes ?? '',
        };
        setInitial(f);
        setForm(f);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [id]);

  const finished = stock.data?.finished ?? [];
  // wood types that have finished stock, with how much
  const woods = useMemo(() => {
    const m = new Map<string, { pieces: number; cft: number }>();
    for (const r of finished) {
      const w = m.get(r.woodType) ?? { pieces: 0, cft: 0 };
      m.set(r.woodType, { pieces: w.pieces + r.pieces, cft: w.cft + r.cft });
    }
    const opts = [...m].map(([w, v]) => ({ value: w, label: w, hint: `${t('piecesCount', { n: int(v.pieces) })} · ${num3(v.cft)} CFT` }));
    if (form?.woodType && !m.has(form.woodType)) opts.unshift({ value: form.woodType, label: form.woodType, hint: '' });
    return opts;
  }, [finished, form?.woodType, t]);
  const loads = useMemo(() => {
    const m = new Map<string, { code: string; pieces: number }>();
    for (const r of finished.filter((r) => r.woodType === form?.woodType)) {
      const l = m.get(r.importLoadId) ?? { code: r.importCode, pieces: 0 };
      m.set(r.importLoadId, { code: r.importCode, pieces: l.pieces + r.pieces });
    }
    return [...m].map(([v, l]) => ({ value: v, label: l.code, hint: t('piecesCount', { n: int(l.pieces) }) }));
  }, [finished, form?.woodType, t]);

  const errors: Partial<Record<keyof Form, string>> = {};
  if (form) {
    if (!form.exportDate) errors.exportDate = t('required');
    if (form.lorryNumber.trim().length < 4) errors.lorryNumber = t('minChars', { n: 4 });
    if (form.woodType.trim().length < 2) errors.woodType = t('required');
    if (form.driverMobile.trim() && !PHONE.test(form.driverMobile.trim())) errors.driverMobile = t('invalidMobile');
    if (form.lorryOwnerMobile.trim() && !PHONE.test(form.lorryOwnerMobile.trim())) errors.lorryOwnerMobile = t('invalidMobile');
  }
  const valid = Object.keys(errors).length === 0;
  const dirty = !!form && !!initial && JSON.stringify(form) !== JSON.stringify(initial);
  const release = useUnsavedGuard(dirty);

  const [save, busy, error] = useSubmit(async () => {
    if (!form) return;
    const body = {
      ...form,
      importLoadId: form.importLoadId || null,
      startAt: form.startAt || null,
      endAt: form.endAt || null,
    };
    if (id) {
      await api(`/exports/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      release();
      await invalidateOperations();
      toast(t('saved'));
      router.back();
    } else {
      const created = await api<{ id: string; code: string }>('/exports', { method: 'POST', body: JSON.stringify(body) });
      release();
      await invalidateOperations();
      toast(t('saved'), 'success', created.code);
      router.replace(`/exports/${created.id}`);
    }
  });

  const set = <K extends keyof Form>(k: K) => (v: Form[K]) => setForm((f) => f && { ...f, [k]: v });
  const err = (k: keyof Form) => (touched || (form && form[k]) ? errors[k] : undefined);

  return (
    <FormScreen
      title={id ? t('edit') : t('newExport')}
      subtitle={id ? undefined : t('stepOf', { n: 1, total: 2 })}
      error={error ?? loadError}
      footer={
        form && (
          <Button
            icon={id ? 'check' : 'arrow-right'}
            title={id ? t('save') : t('saveAndMeasureLines')}
            busy={busy}
            onPress={() => {
              setTouched(true);
              if (valid) void save();
            }}
          />
        )
      }
    >
      {!form ? (
        !loadError && <Loading />
      ) : (
        <>
          <FormSection title={t('secExportInfo')} subtitle={t('secExportInfoSub')}>
            {stock.isSuccess && finished.length === 0 && !id && <Notice>{t('noStock')}</Notice>}
            <DateField label={t('exportDate')} required value={form.exportDate} max={todayIso()} onChange={set('exportDate')} error={err('exportDate')} />
            <Field label={t('lorryNumber')} required value={form.lorryNumber} onChangeText={set('lorryNumber')} autoCapitalize="characters" error={err('lorryNumber')} hint={t('lorryNumberHint')} />
            <SelectField
              label={t('woodType')}
              required
              value={form.woodType}
              options={woods}
              hint={t('exportWoodHint')}
              error={err('woodType')}
              onChange={(v) => setForm((f) => f && { ...f, woodType: v, importLoadId: f.woodType === v ? f.importLoadId : '' })}
            />
            <SelectField
              label={t('defaultLoad')}
              value={form.importLoadId}
              options={loads}
              allowClear
              disabled={!form.woodType}
              placeholder={t('notSet')}
              hint={t('defaultLoadHint')}
              onChange={set('importLoadId')}
            />
            <RequiredNote />
          </FormSection>

          <FormSection title={t('lorryAndDriver')} subtitle={t('secExportLorrySub')} collapsible initiallyOpen={!!(form.driverName || form.driverMobile)}>
            <Field label={t('driverName')} value={form.driverName} onChangeText={set('driverName')} autoCapitalize="words" />
            <Field label={t('driverMobile')} value={form.driverMobile} onChangeText={set('driverMobile')} keyboardType="phone-pad" error={err('driverMobile')} />
            <Field label={t('lorryOwnerName')} value={form.lorryOwnerName} onChangeText={set('lorryOwnerName')} autoCapitalize="words" />
            <Field label={t('lorryOwnerMobile')} value={form.lorryOwnerMobile} onChangeText={set('lorryOwnerMobile')} keyboardType="phone-pad" error={err('lorryOwnerMobile')} />
          </FormSection>

          <FormSection title={t('loadingDetails')} subtitle={t('secLoadingSub')} collapsible initiallyOpen={!!(form.startAt || form.notes)}>
            <DateTimeField label={t('startTime')} value={form.startAt} onChange={set('startAt')} />
            <DateTimeField label={t('endTime')} value={form.endAt} onChange={set('endAt')} />
            <Field label={t('notes')} value={form.notes} onChangeText={set('notes')} multiline placeholder={t('notesHint')} />
          </FormSection>
        </>
      )}
    </FormScreen>
  );
}

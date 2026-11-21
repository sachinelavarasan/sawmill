/**
 * New export load (step 1: lorry, wood, when) or edit one. Lines are picked from finished stock on its page (step 2).
 *
 * Wood type lists only woods with sawn pieces in stock, each with what it holds
 * ("10 sizes · 739 pcs · 437.639 CFT"); "Take pieces from load" lists only loads of that wood, and
 * the chosen load's sizes are shown underneath ("In this load"). `?wood=` pre-fills the wood
 * (the Stock "Load out" button).
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { sizeLabel } from '@timbertrail/shared';
import { View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { int, num3, todayIso } from '../lib/format';
import { useSubmit, useUnsavedGuard } from '../lib/hooks';
import { useT } from '../lib/i18n';
import { invalidateOperations, useApi } from '../lib/query';
import type { Balances, ExportDetail } from '../lib/types';
import { fillFromLorry, LorryPicker } from './LorryPicker';
import { Field, FormScreen, FormSection, RequiredNote } from './form';
import { DateField, DateTimeField, SelectField } from './sheet';
import { toast } from './toast';
import { Text } from './text';
import { Button, Loading, Notice } from './ui';
import { useSession } from '../lib/session';

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
  const { simple } = useSession();
  const params = useLocalSearchParams<{ wood?: string }>();
  const startWood = typeof params.wood === 'string' ? params.wood : '';
  const stock = useApi<Balances>('/stock');
  const [initial, setInitial] = useState<Form | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!id) {
      const f: Form = { exportDate: todayIso(), lorryNumber: '', woodType: startWood, importLoadId: '', driverName: '', driverMobile: '', lorryOwnerName: '', lorryOwnerMobile: '', startAt: '', endAt: '', notes: '' };
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

  const finished = useMemo(() => (stock.data?.finished ?? []).filter((r) => r.pieces > 0), [stock.data]);
  const summary = (x: { sizes: number; pcs: number; cft: number }) => t('stockSummaryLine', { sizes: x.sizes, pcs: int(x.pcs), cft: num3(x.cft) });
  // every wood with sawn pieces in stock, with what it holds
  const woods = useMemo(() => {
    const m = new Map<string, { sizes: Set<string>; pcs: number; cft: number }>();
    for (const r of finished) {
      const w = m.get(r.woodType) ?? { sizes: new Set<string>(), pcs: 0, cft: 0 };
      w.sizes.add(sizeLabel(r.thicknessIn, r.widthIn, r.lengthFt));
      w.pcs += r.pieces;
      w.cft += r.cft;
      m.set(r.woodType, w);
    }
    const opts = [...m]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([w, v]) => ({ value: w, label: w, hint: summary({ sizes: v.sizes.size, pcs: v.pcs, cft: v.cft }) }));
    // an older load out may carry a wood no longer in stock: keep it pickable
    if (form?.woodType && !m.has(form.woodType)) opts.unshift({ value: form.woodType, label: form.woodType, hint: '' });
    return opts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, form?.woodType, t]);
  // loads holding sawn pieces of the chosen wood, each with its sizes and totals
  const loadInfo = useMemo(() => {
    const m = new Map<string, { code: string; wood: string; sizes: { label: string; pcs: number }[]; pcs: number; cft: number }>();
    for (const r of finished.filter((x) => x.woodType === form?.woodType)) {
      const l = m.get(r.importLoadId) ?? { code: r.importCode, wood: r.woodType, sizes: [], pcs: 0, cft: 0 };
      l.sizes.push({ label: sizeLabel(r.thicknessIn, r.widthIn, r.lengthFt), pcs: r.pieces });
      l.pcs += r.pieces;
      l.cft += r.cft;
      m.set(r.importLoadId, l);
    }
    return m;
  }, [finished, form?.woodType]);
  const loads = [...loadInfo].map(([v, l]) => ({ value: v, label: `${l.code} · ${l.wood}`, hint: summary({ sizes: l.sizes.length, pcs: l.pcs, cft: l.cft }) }));
  const chosenLoad = form?.importLoadId ? loadInfo.get(form.importLoadId) : undefined;

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
      await api(`/exports/${id}`, { method: 'PATCH', body: body });
      release();
      await invalidateOperations();
      toast(t('saved'));
      router.back();
    } else {
      const created = await api<{ id: string; code: string }>('/exports', { method: 'POST', body: body });
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
      title={id ? t('edit') : simple ? t('simpleLoadOut') : t('newExport')}
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
            <LorryPicker
              required
              value={form.lorryNumber}
              error={err('lorryNumber')}
              hint={t('lorryNumberHint')}
              // a lorry seen before brings its driver and owner, where those are still empty
              onChange={(lorryNumber, known) => setForm((f) => f && fillFromLorry({ ...f, lorryNumber }, known))}
            />
            <SelectField
              label={t('woodType')}
              required
              value={form.woodType}
              options={woods}
              hint={finished.length || !stock.isSuccess ? t('exportWoodHint') : t('noSawnStock')}
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
            {/* what the chosen load holds, so there is no guessing */}
            {chosenLoad && (
              <View className="gap-1.5 rounded-xl bg-background px-3 py-2.5">
                <Text className="text-xs font-medium text-muted-foreground">{t('inThisLoad')}</Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {chosenLoad.sizes.slice(0, 8).map((z) => (
                    <View key={z.label} className="rounded-full border border-input bg-card px-2.5 py-1">
                      <Text className="text-xs font-medium tabular-nums text-foreground">
                        {z.label} · <Text className="font-bold">{int(z.pcs)}</Text>
                      </Text>
                    </View>
                  ))}
                  {chosenLoad.sizes.length > 8 && <Text className="px-1 py-1 text-xs text-muted-foreground">{t('moreSizes', { n: chosenLoad.sizes.length - 8 })}</Text>}
                </View>
              </View>
            )}
            <RequiredNote />
          </FormSection>

          <FormSection title={t('lorryAndDriver')} subtitle={t('secExportLorrySub')} collapsible initiallyOpen={!!(form.driverName || form.driverMobile)} forceOpen={!!(err('driverMobile') || err('lorryOwnerMobile'))}>
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

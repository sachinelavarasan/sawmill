/**
 * New production run (step 1: which load, how much raw wood, when) or edit one.
 * Finished sizes are added on the run's page afterwards (step 2).
 */
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { api } from '../lib/api';
import { num3, parseNum, todayIso } from '../lib/format';
import { useSubmit, useUnsavedGuard } from '../lib/hooks';
import { useT } from '../lib/i18n';
import { invalidateOperations, useApi } from '../lib/query';
import type { Balances, ProductionDetail } from '../lib/types';
import { Field, FormScreen, FormSection, NumberField, RequiredNote } from './form';
import { DateField, DateTimeField, SelectField } from './sheet';
import { toast } from './toast';
import { Button, Chip, Loading, Notice } from './ui';

interface Form {
  importLoadId: string;
  productionDate: string;
  inputCft: string;
  cuttingMachine: string;
  machineOperator: string;
  workerDetails: string;
  startAt: string;
  endAt: string;
  wasteNotes: string;
}

export function ProductionForm({ id }: { id?: string }) {
  const t = useT();
  const router = useRouter();
  const stock = useApi<Balances>('/stock');
  const [initial, setInitial] = useState<Form | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rawOfRun, setRawOfRun] = useState<{ id: string; label: string; cft: number } | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!id) {
      const f: Form = { importLoadId: '', productionDate: todayIso(), inputCft: '', cuttingMachine: '', machineOperator: '', workerDetails: '', startAt: '', endAt: '', wasteNotes: '' };
      setInitial(f);
      setForm(f);
      return;
    }
    api<ProductionDetail>(`/production/${id}`)
      .then((d) => {
        const f: Form = {
          importLoadId: d.importLoadId,
          productionDate: d.productionDate.slice(0, 10),
          inputCft: d.inputCft != null ? String(d.inputCft) : '',
          cuttingMachine: d.cuttingMachine ?? '',
          machineOperator: d.machineOperator ?? '',
          workerDetails: d.workerDetails ?? '',
          startAt: d.startAt ?? '',
          endAt: d.endAt ?? '',
          wasteNotes: d.wasteNotes ?? '',
        };
        setRawOfRun({ id: d.importLoadId, label: `${d.importCode} · ${d.woodType}`, cft: d.rawAvailableCft });
        setInitial(f);
        setForm(f);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [id]);

  const loads = useMemo(() => {
    const rows = (stock.data?.raw ?? []).filter((r) => r.cft > 0).map((r) => ({ value: r.importLoadId, label: `${r.importCode} · ${r.woodType}`, hint: `${num3(r.cft)} CFT ${t('inStock')}`, cft: r.cft }));
    if (rawOfRun && !rows.some((r) => r.value === rawOfRun.id)) rows.unshift({ value: rawOfRun.id, label: rawOfRun.label, hint: `${num3(rawOfRun.cft)} CFT`, cft: rawOfRun.cft });
    return rows;
  }, [stock.data, rawOfRun, t]);
  const picked = loads.find((l) => l.value === form?.importLoadId);

  const input = form ? parseNum(form.inputCft) : null;
  const errors: Partial<Record<keyof Form, string>> = {};
  if (form) {
    if (!form.importLoadId) errors.importLoadId = t('required');
    if (!form.productionDate) errors.productionDate = t('required');
    if (form.inputCft && (input == null || input <= 0)) errors.inputCft = t('errPositive');
    else if (input != null && picked && input > picked.cft + 1e-9) errors.inputCft = `${t('rawLeftInLoad')}: ${num3(picked.cft)} CFT`;
  }
  const valid = Object.keys(errors).length === 0;
  const dirty = !!form && !!initial && JSON.stringify(form) !== JSON.stringify(initial);
  const release = useUnsavedGuard(dirty);

  const [save, busy, error] = useSubmit(async () => {
    if (!form) return;
    const body = {
      importLoadId: form.importLoadId,
      productionDate: form.productionDate,
      inputCft: input,
      cuttingMachine: form.cuttingMachine,
      machineOperator: form.machineOperator,
      workerDetails: form.workerDetails,
      wasteNotes: form.wasteNotes,
      // a new run leaves empty times out; an edit sends null to clear them
      startAt: form.startAt || (id ? null : undefined),
      endAt: form.endAt || (id ? null : undefined),
    };
    if (id) {
      await api(`/production/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      release();
      await invalidateOperations();
      toast(t('saved'));
      router.back();
    } else {
      const created = await api<{ id: string; code: string }>('/production', { method: 'POST', body: JSON.stringify(body) });
      release();
      await invalidateOperations();
      toast(t('saved'), 'success', created.code);
      router.replace(`/production/${created.id}`);
    }
  });

  const set = <K extends keyof Form>(k: K) => (v: Form[K]) => setForm((f) => f && { ...f, [k]: v });
  const err = (k: keyof Form) => (touched ? errors[k] : k === 'inputCft' ? errors[k] : undefined);

  return (
    <FormScreen
      title={id ? t('edit') : t('newProduction')}
      subtitle={id ? undefined : t('stepOf', { n: 1, total: 2 })}
      error={error ?? loadError}
      footer={
        form && (
          <Button
            icon={id ? 'check' : 'arrow-right'}
            title={id ? t('save') : t('nextStep')}
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
          <FormSection title={t('secRawInput')}>
            {stock.isSuccess && loads.length === 0 && !id && <Notice>{t('noRawStock')}</Notice>}
            <SelectField
              label={t('sourceLoad')}
              required
              value={form.importLoadId}
              options={loads}
              searchable
              placeholder={t('pickLoad')}
              error={err('importLoadId')}
              emptyText={t('noRawStock')}
              onChange={(v) => setForm((f) => f && { ...f, importLoadId: v, inputCft: f.importLoadId === v ? f.inputCft : '' })}
            />
            <DateField label={t('productionDate')} required value={form.productionDate} max={todayIso()} onChange={set('productionDate')} error={err('productionDate')} />
            <NumberField label={t('inputCft')} unit="CFT" decimals={3} value={form.inputCft} onChangeText={set('inputCft')} error={err('inputCft')} hint={picked ? t('inputCftHint', { cft: num3(picked.cft) }) : undefined}>
              {picked && (
                <View className="flex-row items-center gap-2">
                  <Chip text={`${t('useAll')} · ${num3(picked.cft)}`} on={input === picked.cft} onPress={() => set('inputCft')(String(picked.cft))} />
                </View>
              )}
            </NumberField>
            <RequiredNote />
          </FormSection>

          <FormSection title={t('runDetails')} collapsible initiallyOpen={!!(form.cuttingMachine || form.machineOperator || form.startAt)}>
            <Field label={t('cuttingMachine')} value={form.cuttingMachine} onChangeText={set('cuttingMachine')} />
            <Field label={t('machineOperator')} value={form.machineOperator} onChangeText={set('machineOperator')} autoCapitalize="words" />
            <Field label={t('workerDetails')} value={form.workerDetails} onChangeText={set('workerDetails')} multiline />
            <DateTimeField label={t('startTime')} value={form.startAt} onChange={set('startAt')} />
            <DateTimeField label={t('endTime')} value={form.endAt} onChange={set('endAt')} />
          </FormSection>

          <FormSection title={t('wasteNotes')} collapsible initiallyOpen={!!form.wasteNotes}>
            <Field label={t('wasteNotes')} value={form.wasteNotes} onChangeText={set('wasteNotes')} multiline />
          </FormSection>
        </>
      )}
    </FormScreen>
  );
}

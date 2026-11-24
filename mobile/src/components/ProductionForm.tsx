/**
 * New production run (step 1: which load, how much raw wood, when) or edit one.
 * Finished sizes are added on the run's page afterwards (step 2).
 *
 * The load list shows approved raw stock first, then loads measured but waiting approval ("Waiting
 * approval"): sawing may start on them, and the owner approves the load in before the sawing.
 * "Not in stock? Load in new logs" opens New Load In with the wood and the way back here.
 *
 * Params (web: NewProductionPage): `wood` limits the list to that wood (the only load is chosen);
 * `load` chooses a load (back from New Load In); from a load out, `t w l pcs back backCode` are
 * carried on to the new run, where the size is typed and "Back to load out" shown.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { useSession } from '../lib/session';
import { loadOutLink, param, toQuery } from '../lib/ways-back';

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
  const { simple } = useSession();
  const raw = useLocalSearchParams<Record<string, string>>();
  const p = (k: string) => (id ? '' : param(raw[k]));
  const woodWanted = p('wood').trim().toLowerCase();
  const forLoadOut = loadOutLink(p('back'), p('backCode'));
  const stock = useApi<Balances>('/stock');
  const [initial, setInitial] = useState<Form | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rawOfRun, setRawOfRun] = useState<{ id: string; label: string; cft: number } | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!id) {
      const f: Form = { importLoadId: p('load'), productionDate: todayIso(), inputCft: '', cuttingMachine: '', machineOperator: '', workerDetails: '', startAt: '', endAt: '', wasteNotes: '' };
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
    const sameWood = (w: string) => !woodWanted || w.trim().toLowerCase() === woodWanted;
    // approved raw stock, then loads measured but still waiting for approval (sawing may start on them)
    const rows: { value: string; label: string; hint: string; cft: number; pending?: boolean }[] = [
      ...(stock.data?.raw ?? [])
        .filter((r) => r.cft > 0 && sameWood(r.woodType))
        .map((r) => ({ value: r.importLoadId, label: `${r.importCode} · ${r.woodType}`, hint: `${num3(r.cft)} CFT ${t('inStock')}`, cft: r.cft })),
      ...(stock.data?.pendingRaw ?? [])
        .filter((r) => sameWood(r.woodType))
        // while unapproved, "raw CFT used" is checked against its measured CFT
        .map((r) => ({ value: r.importLoadId, label: `${r.importCode} · ${r.woodType}`, hint: `${num3(r.cft)} CFT · ${t('pendingApproval')}`, cft: r.cft, pending: true })),
    ];
    if (rawOfRun && !rows.some((r) => r.value === rawOfRun.id)) rows.unshift({ value: rawOfRun.id, label: rawOfRun.label, hint: `${num3(rawOfRun.cft)} CFT`, cft: rawOfRun.cft });
    return rows;
  }, [stock.data, rawOfRun, t, woodWanted]);
  const picked = loads.find((l) => l.value === form?.importLoadId);

  // back from New Load In with the new load: choose it (the param arrives on a screen already open)
  const loadParam = p('load');
  useEffect(() => {
    if (loadParam) setForm((f) => (f && f.importLoadId !== loadParam ? { ...f, importLoadId: loadParam, inputCft: '' } : f));
  }, [loadParam]);

  // only one raw load of the wood asked for: it is the one
  useEffect(() => {
    if (!id && woodWanted && loads.length === 1) setForm((f) => (f && !f.importLoadId ? { ...f, importLoadId: loads[0].value } : f));
  }, [id, woodWanted, loads]);

  /** Not there? Load the logs in first, then come back here with that load chosen. */
  const loadInNew = () => {
    const here = `/production/new${(() => {
      const q = toQuery({ wood: p('wood'), t: p('t'), w: p('w'), l: p('l'), pcs: p('pcs'), back: p('back'), backCode: p('backCode') });
      return q ? `?${q}` : '';
    })()}`;
    router.push({ pathname: '/imports/new', params: { ...(p('wood') && { wood: p('wood') }), back: here } });
  };

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
      await api(`/production/${id}`, { method: 'PATCH', body: body });
      release();
      await invalidateOperations();
      toast(t('saved'));
      router.back();
    } else {
      const created = await api<{ id: string; code: string }>('/production', { method: 'POST', body: body });
      release();
      await invalidateOperations();
      toast(t('saved'), 'success', created.code);
      // carry the wanted size and the way back on to the run, where the size is typed
      const carry: Record<string, string> = {};
      for (const k of ['t', 'w', 'l', 'pcs', 'back', 'backCode']) if (p(k)) carry[k] = p(k);
      router.replace({ pathname: '/production/[id]', params: { id: created.id, ...carry } });
    }
  });

  const set = <K extends keyof Form>(k: K) => (v: Form[K]) => setForm((f) => f && { ...f, [k]: v });
  const err = (k: keyof Form) => (touched ? errors[k] : k === 'inputCft' ? errors[k] : undefined);

  return (
    <FormScreen
      title={id ? t('edit') : simple ? t('simpleCut') : t('newProduction')}
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
          {forLoadOut && <Notice icon="truck">{t('sawingForLoadOut', { code: forLoadOut.code })}</Notice>}
          <FormSection title={t('secRawInput')}>
            {stock.isSuccess && loads.length === 0 && !id && <Notice>{woodWanted ? t('noRawOfWood', { wood: p('wood') }) : t('noRawStock')}</Notice>}
            <SelectField
              label={t('sourceLoad')}
              required
              value={form.importLoadId}
              options={loads}
              searchable
              placeholder={t('pickLoad')}
              error={err('importLoadId')}
              emptyText={t('noRawStock')}
              hint={picked?.pending ? t('pendingRawHint') : undefined}
              onChange={(v) => setForm((f) => f && { ...f, importLoadId: v, inputCft: f.importLoadId === v ? f.inputCft : '' })}
            />
            {!id && <Button kind={stock.isSuccess && loads.length === 0 ? 'primary' : 'secondary'} size="md" icon="truck" title={t('loadInNewLogs')} onPress={loadInNew} />}
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

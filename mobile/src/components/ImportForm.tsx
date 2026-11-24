/**
 * New import load, or edit one that is still a draft / rejected (web: pages/Imports.tsx → ImportFields).
 *
 * Simple view: only what is needed to start measuring — Lorry number, Wood type, Arrival, and the
 * Supplier (owner) — with everything else under "More fields (optional)", and one big
 * "Save & start measuring" button ("Save for later" is the quiet second option). A problem in a
 * folded field opens the fold: an error is never hidden inside a closed section.
 *
 * Lorry number is a pick list of every lorry seen before (LorryPicker); picking one fills the
 * driver and owner fields that are still empty.
 *
 * `?wood=` pre-fills the wood and `?back=/production/new…` is the way back (New Load In opened from
 * New Sawing): the note says so, and the back link rides on to measuring, where "Back to sawing" shows.
 */
import { Permission, type TKey } from '@timbertrail/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ComponentProps, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Fold } from './fold';
import { Field, FormScreen, FormSection, RequiredNote } from './form';
import { fillFromLorry, LorryPicker } from './LorryPicker';
import { DateTimeField, SelectField } from './sheet';
import { toast } from './toast';
import { Button, Chip, Loading, Notice } from './ui';
import { api } from '../lib/api';
import { useSubmit, useUnsavedGuard } from '../lib/hooks';
import { useT } from '../lib/i18n';
import { type ImportForm as Form, importsApi } from '../lib/imports-api';
import { useCreateParty } from '../lib/parties';
import { invalidate, invalidateOperations, useApi } from '../lib/query';
import { useSession } from '../lib/session';
import { param, sawingLink } from '../lib/ways-back';
import type { Party } from '../lib/types';

const EMPTY: Form = {
  lorryNumber: '',
  woodType: '',
  woodCategory: '',
  driverName: '',
  driverMobile: '',
  lorryOwnerName: '',
  lorryOwnerMobile: '',
  originLocation: '',
  notes: '',
};
const PHONE = /^[0-9+ ]{7,15}$/;
/** fields that sit under "More fields" in the simple view */
const FOLDED: (keyof Form)[] = ['woodCategory', 'driverName', 'driverMobile', 'lorryOwnerName', 'lorryOwnerMobile', 'originLocation', 'notes'];

export function ImportForm({ id }: { id?: string }) {
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ wood?: string; back?: string }>();
  const forSawing = id ? null : sawingLink(param(params.back));
  const { can, simple } = useSession();
  const startWood = !id && typeof params.wood === 'string' ? params.wood : '';
  const [initial, setInitial] = useState<Form | null>(id ? null : { ...EMPTY, woodType: startWood });
  const [form, setForm] = useState<Form | null>(initial);
  /** arrival date & time (ISO); a new load starts at "now" */
  const [arrivalAt, setArrivalAt] = useState(() => (id ? '' : new Date().toISOString()));
  const [initialArrival, setInitialArrival] = useState(arrivalAt);
  const [supplierId, setSupplierId] = useState('');
  const [touched, setTouched] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // the mill's wood types (Settings → Wood types); with no list yet, the names already used
  const choices = useApi<{ items: string[]; fixed: boolean }>('/wood-types').data;
  const woodTypes = useMemo(() => {
    const items = choices?.items ?? [];
    // an older load may carry a name since removed from the list: keep it selectable
    return form?.woodType && choices?.fixed && !items.includes(form.woodType) ? [form.woodType, ...items] : items;
  }, [choices, form?.woodType]);
  // the owner can add a missing wood to the list right here, without a trip to Settings
  const addWoodType = can(Permission.SETTINGS_MANAGE)
    ? async (name: string) => {
        const r = await api<{ name: string }>('/settings/wood-types', { method: 'POST', body: { name } });
        toast(t('woodTypeAdded', { name: r.name }));
        void invalidate('/wood-types', '/settings');
        return r.name;
      }
    : undefined;

  // the supplier sits on the purchase record, which only the owner may see or set; set here on a new load only
  const canSupplier = !id && can(Permission.FINANCE_VIEW) && can(Permission.SUPPLIERS_MANAGE);
  const suppliers = useApi<Party[]>(canSupplier ? '/suppliers' : null);
  const addSupplier = useCreateParty('suppliers');

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
          notes: d.notes ?? '',
        };
        setInitial(f);
        setForm(f);
        setArrivalAt(d.arrivalAt);
        setInitialArrival(d.arrivalAt);
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
  const dirty = !!form && !!initial && (JSON.stringify(form) !== JSON.stringify(initial) || arrivalAt !== initialArrival || !!supplierId);
  const release = useUnsavedGuard(dirty);

  const [save, busy, error] = useSubmit(async (thenMeasure: boolean) => {
    if (!form) return;
    const body = { ...form, ...(arrivalAt ? { arrivalAt } : {}) };
    if (id) {
      await importsApi.update(id, body);
      release();
      await invalidateOperations();
      toast(t('saved'));
      router.back();
      return;
    }
    const created = await importsApi.create(body);
    // the load now exists; a failure saving the supplier onto it must not lose it
    let missed: string | null = null;
    if (supplierId) await importsApi.saveFinancials(created.id, { supplierId }).catch((e: Error) => (missed = `${t('supplier')} (${e.message})`));
    release();
    await invalidateOperations();
    if (missed) toast(t('savedButNot', { what: missed }), 'info', created.code);
    else toast(t('saved'), 'success', created.code);
    const carry = forSawing ? { back: forSawing } : {};
    router.replace(thenMeasure ? { pathname: '/imports/[id]/measure', params: { id: created.id, ...carry } } : { pathname: '/imports/[id]', params: { id: created.id, ...carry } });
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
  /** a folded field has a problem showing: the fold opens itself */
  const foldedError = FOLDED.some((k) => !!err(k));

  // ── every field once; the two views below only arrange them ──
  const lorry = form && (
    <LorryPicker
      required
      value={form.lorryNumber}
      error={err('lorryNumber')}
      hint={simple ? undefined : t('lorryNumberHint')}
      // a lorry seen before brings its driver and owner, where those are still empty
      onChange={(lorryNumber, known) => setForm((f) => f && fillFromLorry({ ...f, lorryNumber }, known))}
    />
  );
  const wood =
    form &&
    (choices?.fixed ? (
      // a fixed list: picked, never typed, so one wood is never spelled two ways
      <SelectField
        label={t('woodType')}
        required
        value={form.woodType}
        options={woodTypes.map((w) => ({ value: w, label: w }))}
        onChange={(w) => set('woodType')(w)}
        placeholder={t('pickWoodType')}
        error={err('woodType')}
        hint={t(addWoodType ? 'woodTypeAddHint' : 'woodTypeMissing')}
        onCreate={addWoodType}
      />
    ) : (
      <Field label={t('woodType')} required value={form.woodType} onChangeText={set('woodType')} error={err('woodType')} placeholder={t('woodTypeHint')} autoCapitalize="words">
        {woodTypes.length > 0 && (
          <View className="flex-row flex-wrap gap-1.5">
            {woodTypes.slice(0, 12).map((w) => (
              <Chip key={w} text={w} on={form.woodType === w} onPress={() => set('woodType')(w)} />
            ))}
          </View>
        )}
      </Field>
    ));
  const arrival = <DateTimeField label={t('arrivalDateTime')} value={arrivalAt} onChange={setArrivalAt} />;
  const supplier = canSupplier && (
    <SelectField
      label={t('supplier')}
      value={supplierId}
      allowClear
      options={(suppliers.data ?? []).map((s) => ({ value: s.id, label: s.name, hint: s.phone ?? undefined }))}
      onChange={setSupplierId}
      placeholder={t('noSupplier')}
      hint={simple ? undefined : t('supplierHint')}
      emptyText={t('noSuppliers')}
      onCreate={addSupplier}
    />
  );
  const people = form && (
    <>
      {field('driverName', 'driverName', { autoCapitalize: 'words' })}
      {field('driverMobile', 'driverMobile', { keyboardType: 'phone-pad', hint: simple ? undefined : t('mobileHint') })}
      {field('lorryOwnerName', 'lorryOwnerName', { autoCapitalize: 'words' })}
      {field('lorryOwnerMobile', 'lorryOwnerMobile', { keyboardType: 'phone-pad' })}
    </>
  );

  const footer =
    form &&
    (id ? (
      <Button icon="check" title={t('save')} busy={busy} onPress={() => submit(false)} />
    ) : simple ? (
      // one big button that goes straight on to measuring; saving for later is the quiet option
      <View className="gap-1.5">
        <Button icon="ruler" title={t('startMeasuring')} busy={busy} onPress={() => submit(true)} />
        <Button kind="ghost" size="md" title={t('saveDraft')} disabled={busy} onPress={() => submit(false)} />
      </View>
    ) : (
      <View className="flex-row gap-2.5">
        <Button className="flex-1" kind="secondary" title={t('saveDraft')} busy={busy} onPress={() => submit(false)} />
        <Button className="flex-1" icon="edit-3" title={t('saveAndMeasure')} busy={busy} onPress={() => submit(true)} />
      </View>
    ));

  return (
    <FormScreen
      title={id ? t('edit') : simple ? t('simpleLoadIn') : t('newImport')}
      subtitle={id ? undefined : `${t('stepOf', { n: 1, total: 2 })} · ${t('newEntry')}`}
      step={id ? undefined : { at: 1, of: 2 }}
      error={error ?? loadError}
      footer={footer}
    >
      {forSawing && <Notice icon="factory">{t('loadInForSawing')}</Notice>}
      {!form ? (
        !loadError && <Loading />
      ) : simple ? (
        <>
          <FormSection title={t('lorryAndWood')}>
            {lorry}
            {arrival}
            {supplier}
          </FormSection>
          <FormSection title={t('woodType')}>{wood}</FormSection>
          <Fold title={t('moreFields')} forceOpen={foldedError}>
            {field('woodCategory', 'woodCategory', { autoCapitalize: 'words' })}
            {field('originLocation', 'originLocation', { autoCapitalize: 'words' })}
            {people}
            <Field label={t('notes')} value={form.notes} onChangeText={set('notes')} multiline />
          </Fold>
        </>
      ) : (
        <>
          <FormSection title={t('secImportInfo')} subtitle={t('secImportInfoSub')}>
            {arrival}
            {wood}
            {field('woodCategory', 'woodCategory', { autoCapitalize: 'words' })}
            <RequiredNote />
          </FormSection>

          <FormSection title={t(supplier ? 'secSupplierLorry' : 'secLorry')} subtitle={t('secLorrySub')}>
            {supplier}
            {lorry}
            {people}
          </FormSection>

          <FormSection title={t('secAdditional')} subtitle={t('secAdditionalSub')} collapsible initiallyOpen={!!(form.originLocation || form.notes)}>
            {field('originLocation', 'originLocation', { autoCapitalize: 'words' })}
            <Field label={t('notes')} value={form.notes} onChangeText={set('notes')} multiline placeholder={t('notesHint')} />
          </FormSection>
        </>
      )}
    </FormScreen>
  );
}

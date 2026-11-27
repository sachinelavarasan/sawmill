/**
 * Lorry In, one question per screen ("Sawmill Pro – Lorry In & Out" mockup, pages 1–3 and 7–9):
 *
 *   1  Which lorry came in?   number plate (or a lorry seen before) · arrival time · wood type · category
 *   2  Who brought it?        driver and lorry owner (phones optional) · where it came from
 *   3  All correct?           everything on one card, Edit goes back
 *      → Save & start unloading: the load is created and its page opens on the unloading timer,
 *        then the logs are measured;  Save as draft: back to Home.
 *
 * The lorry number, the wood type and the driver are needed; Next stays taupe until they are there.
 * Picking a lorry seen before fills the driver and owner it last came with (only empty fields).
 * Wood types are the mill's list ("+ New" adds one — the owner, when the list is fixed); categories
 * are remembered on this phone once added, so next time they are buttons.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Permission } from '@timbertrail/shared';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  BigButton,
  BoxField,
  BoxRow,
  CheckCard,
  ChoiceGrid,
  GroupLabel,
  NoteCard,
  PlateField,
  QuietButton,
  StepScreen,
  TimeChip,
  useLeaveFlow,
  whenText,
} from '../../components/lorry-flow/parts';
import { usePrompt } from '../../components/confirm';
import { fillFromLorry, type Lorry } from '../../components/LorryPicker';
import { SelectSheet, useSheet } from '../../components/sheet';
import { toast } from '../../components/toast';
import { ErrorBox } from '../../components/ui';
import { api } from '../../lib/api';
import { useSubmit, useUnsavedGuard } from '../../lib/hooks';
import { useT } from '../../lib/i18n';
import { importsApi } from '../../lib/imports-api';
import { invalidate, invalidateOperations, useApi } from '../../lib/query';
import { useSession } from '../../lib/session';

const PHONE = /^[0-9+ ]{7,15}$/;
const CATEGORIES_KEY = 'timbertrail:lorry-flow:categories';

type People = { driverName: string; driverMobile: string; lorryOwnerName: string; lorryOwnerMobile: string };

export default function LorryInScreen() {
  const t = useT();
  const router = useRouter();
  const leave = useLeaveFlow();
  const prompt = usePrompt();
  const { can } = useSession();
  const [step, setStep] = useState(1);

  const [plate, setPlate] = useState('');
  /** null = now (saved as the moment of saving) */
  const [arrivalAt, setArrivalAt] = useState<string | null>(null);
  const [wood, setWood] = useState('');
  const [category, setCategory] = useState('');
  const [people, setPeople] = useState<People>({ driverName: '', driverMobile: '', lorryOwnerName: '', lorryOwnerMobile: '' });
  const [origin, setOrigin] = useState('');
  const setP = (k: keyof People) => (v: string) => setPeople((p) => ({ ...p, [k]: v }));

  // ── the lorries seen before (for the list button) ──
  const lorrySheet = useSheet();
  const lorries = useApi<{ items: Lorry[] }>('/imports/lorries').data?.items ?? [];
  const pickLorry = (n: string) => {
    const known = lorries.find((l) => l.lorryNumber === n) ?? null;
    setPlate(n);
    setPeople((p) => fillFromLorry(p, known));
    lorrySheet.close();
  };

  // ── wood types: the mill's list; a name added here joins it ──
  const woodList = useApi<{ items: string[]; fixed: boolean }>('/wood-types').data;
  const [extraWoods, setExtraWoods] = useState<string[]>([]);
  const woods = useMemo(() => [...new Set([...(woodList?.items ?? []), ...extraWoods])], [woodList, extraWoods]);
  // a fixed list grows only through the owner (Settings → Wood types); a free one takes any name
  const mayAddWood = !woodList?.fixed || can(Permission.SETTINGS_MANAGE);
  const newWood = async () => {
    const name = (await prompt({ title: t('addWoodType'), placeholder: t('typeNewName'), confirmText: t('save'), minLength: 2 }))?.trim();
    if (!name) return;
    try {
      if (woodList?.fixed) {
        const r = await api<{ name: string }>('/settings/wood-types', { method: 'POST', body: { name } });
        void invalidate('/wood-types', '/settings');
        setWood(r.name);
        setExtraWoods((w) => [...w, r.name]);
      } else {
        setExtraWoods((w) => [...w, name]);
        setWood(name);
      }
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  // ── categories: remembered on this phone, so a name added once is a button next time ──
  const [categories, setCategories] = useState<string[]>([]);
  useEffect(() => {
    AsyncStorage.getItem(CATEGORIES_KEY)
      .then((v) => setCategories(v ? (JSON.parse(v) as string[]) : []))
      .catch(() => undefined);
  }, []);
  const newCategory = async () => {
    const name = (await prompt({ title: t('addCategory'), placeholder: t('typeNewName'), confirmText: t('save'), minLength: 2 }))?.trim();
    if (!name) return;
    const next = [...new Set([...categories, name])];
    setCategories(next);
    setCategory(name);
    AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(next)).catch(() => undefined);
  };

  // ── what is needed ──
  const plateOk = plate.trim().length >= 4;
  const woodOk = wood.trim().length >= 2;
  const driverOk = people.driverName.trim().length > 0;
  const phoneError = (v: string) => (v.trim() && !PHONE.test(v.trim()) ? t('invalidMobile') : null);
  const phonesOk = !phoneError(people.driverMobile) && !phoneError(people.lorryOwnerMobile);
  const ready = plateOk && woodOk && driverOk && phonesOk;

  const dirty = !!(plate || wood || category || people.driverName || people.driverMobile || people.lorryOwnerName || people.lorryOwnerMobile || origin);
  const release = useUnsavedGuard(dirty);

  const [save, saving, error] = useSubmit(async (startUnloading: boolean) => {
    const created = await importsApi.create({
      lorryNumber: plate.trim(),
      woodType: wood,
      woodCategory: category,
      ...people,
      originLocation: origin.trim(),
      notes: '',
      arrivalAt: arrivalAt ?? new Date().toISOString(),
    });
    release();
    await invalidateOperations();
    toast(t('saved'), 'success', `${created.code} · ${created.lorryNumber}`);
    // its page opens on the unloading timer; the logs are measured from there
    if (startUnloading) router.replace(`/imports/${created.id}`);
    else leave();
  });

  const back = useCallback(() => (step > 1 ? setStep(step - 1) : leave()), [step, leave]);
  const arrivedLabel = arrivalAt ? t('arrivedAt', { when: whenText(arrivalAt, t) }) : t('arrivedNow');

  if (step === 1)
    return (
      <StepScreen step={1} title={t('whichLorryIn')} sub={t('plateSub')} onBack={back} footer={<BigButton title={t('next')} disabled={!plateOk || !woodOk} onPress={() => setStep(2)} />}>
        <PlateField value={plate} onChange={setPlate} onPick={lorrySheet.open} />
        <TimeChip label={arrivedLabel} value={arrivalAt} onChange={setArrivalAt} title={t('arrivalDateTime')} />

        <GroupLabel>{t('woodType')}</GroupLabel>
        <ChoiceGrid options={woods} value={wood} onChange={setWood} onNew={mayAddWood ? () => void newWood() : undefined} addLabel={t('addWoodType')} emptyHint={t('typesShowNextTime')} />

        <GroupLabel>{t('woodCategory')}</GroupLabel>
        <ChoiceGrid wide options={categories} value={category} onChange={(c) => setCategory(c === category ? '' : c)} onNew={() => void newCategory()} addLabel={t('addCategory')} />

        <SelectSheet
          ref={lorrySheet.ref}
          title={t('lorryNumber')}
          value={plate}
          searchable
          options={lorries.map((l) => ({ value: l.lorryNumber, label: l.lorryNumber, hint: l.driverName || undefined }))}
          onPick={pickLorry}
        />
      </StepScreen>
    );

  if (step === 2)
    return (
      <StepScreen step={2} title={t('whoBroughtIt')} sub={t('phonesOptional')} onBack={back} footer={<BigButton title={t('next')} disabled={!driverOk || !phonesOk} onPress={() => setStep(3)} />}>
        <GroupLabel>{t('secDriver')}</GroupLabel>
        <BoxRow>
          <BoxField label={t('name')} required value={people.driverName} onChange={setP('driverName')} placeholder={t('driverNamePh')} />
          <BoxField label={t('phone')} phone value={people.driverMobile} onChange={setP('driverMobile')} placeholder={t('tenDigits')} error={phoneError(people.driverMobile)} />
        </BoxRow>

        <GroupLabel>{t('secLorryOwner')}</GroupLabel>
        <BoxRow>
          <BoxField label={t('name')} value={people.lorryOwnerName} onChange={setP('lorryOwnerName')} placeholder={t('ownerNamePh')} />
          <BoxField label={t('phone')} phone value={people.lorryOwnerMobile} onChange={setP('lorryOwnerMobile')} placeholder={t('tenDigits')} error={phoneError(people.lorryOwnerMobile)} />
        </BoxRow>

        <GroupLabel>{t('comingFrom')}</GroupLabel>
        <BoxField label={t('place')} value={origin} onChange={setOrigin} placeholder={t('villageOrTown')} />
      </StepScreen>
    );

  return (
    <StepScreen
      step={3}
      title={t('allCorrect')}
      sub={t('checkOnceSave')}
      onBack={back}
      footer={
        <View className="gap-1">
          <BigButton title={t('saveStartUnloading')} icon="check" disabled={!ready} busy={saving} onPress={() => void save(true)} />
          {ready && <QuietButton title={t('saveDraft')} disabled={saving} onPress={() => void save(false)} />}
        </View>
      }
    >
      <CheckCard
        plate={plateOk ? plate.trim() : ''}
        onEdit={() => setStep(1)}
        rows={[
          { label: t('wood'), value: woodOk ? [wood, category].filter(Boolean).join(' · ') : null, needed: true },
          { label: t('arrived'), value: arrivalAt ? whenText(arrivalAt, t).replace(/^./, (c) => c.toUpperCase()) : t('now') },
          { label: t('secDriver'), value: people.driverName.trim() || null, needed: true },
          { label: t('secLorryOwner'), value: people.lorryOwnerName.trim() || null },
          { label: t('from'), value: origin.trim() || null },
        ]}
      />
      {ready ? <NoteCard mod="unload" icon="truck" text={t('nextUnloadThenMeasure')} /> : <NoteCard warn text={t('addToSaveLorryIn')} />}
      {error && (
        <View className="mt-3">
          <ErrorBox message={error} />
        </View>
      )}
    </StepScreen>
  );
}

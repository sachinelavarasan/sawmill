/** [OWNER-ONLY] Record or edit an expense (?id=). Deleting asks first. */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useConfirm } from '../../../components/confirm';
import { Field, FormScreen, FormSection, NumberField, RequiredNote } from '../../../components/form';
import { DateField, SelectField } from '../../../components/sheet';
import { toast } from '../../../components/toast';
import { Button, Chip, Muted } from '../../../components/ui';
import { api } from '../../../lib/api';
import { parseNum, periodQuery, presets, todayIso } from '../../../lib/format';
import { useSubmit, useUnsavedGuard } from '../../../lib/hooks';
import { useT } from '../../../lib/i18n';
import { invalidate, useApi } from '../../../lib/query';
import type { ExpenseList } from '../../../lib/types';

const EMPTY = { date: todayIso(), category: '', amount: '', importLoadId: '', notes: '' };

export default function ExpenseFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const t = useT();
  const router = useRouter();
  const confirm = useConfirm();
  // the mill's own categories, and (when editing) the expense itself, from this year's list
  const year = useApi<ExpenseList>(`/expenses?${periodQuery({ from: `${new Date().getFullYear() - 1}-01-01`, to: presets().thisYear.to })}&take=500`);
  const loads = useApi<{ items: { id: string; code: string; woodType: string }[] }>('/imports?take=200');
  const [initial, setInitial] = useState(EMPTY);
  const [f, setF] = useState(EMPTY);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const e = id ? year.data?.items.find((x) => x.id === id) : undefined;
    if (!e) return;
    const v = { date: e.date.slice(0, 10), category: e.category, amount: String(e.amount), importLoadId: e.importLoadId ?? '', notes: e.notes ?? '' };
    setInitial(v);
    setF(v);
  }, [year.data, id]);

  // an expense older than last year isn't in the list loaded above
  const notFound = !!id && year.isSuccess && !year.data.items.some((x) => x.id === id);
  const categories = useMemo(() => year.data?.categories.slice(0, 10) ?? [], [year.data]);
  const amount = parseNum(f.amount);
  const errors = {
    category: f.category.trim().length >= 2 ? undefined : t('minChars', { n: 2 }),
    amount: amount != null && amount > 0 ? undefined : t('errPositive'),
    date: f.date ? undefined : t('required'),
  };
  const valid = !errors.category && !errors.amount && !errors.date && !notFound;
  const release = useUnsavedGuard(JSON.stringify(f) !== JSON.stringify(initial));

  const [save, busy, error] = useSubmit(async () => {
    const body = { date: f.date, category: f.category.trim(), amount, importLoadId: f.importLoadId || null, notes: f.notes.trim() };
    await api(id ? `/expenses/${id}` : '/expenses', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(body) });
    release();
    await invalidate('/expenses', '/accounts', '/dashboard');
    toast(t('saved'));
    router.back();
  });

  const [remove, removing, removeError] = useSubmit(async () => {
    if (!(await confirm({ title: t('delete'), message: t('confirmDelete'), confirmText: t('delete'), cancelText: t('cancel'), destructive: true }))) return;
    await api(`/expenses/${id}`, { method: 'DELETE' });
    release();
    await invalidate('/expenses', '/accounts', '/dashboard');
    toast(t('expenseDeleted'), 'info');
    router.back();
  });

  const set = (k: keyof typeof EMPTY) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  return (
    <FormScreen
      title={id ? t('editExpense') : t('addExpense')}
      error={error ?? removeError ?? (notFound ? t('noData') : null)}
      footer={
        <View className="flex-row gap-2.5">
          {id && <Button className="flex-1" kind="danger" icon="trash-2" title={t('delete')} busy={removing} onPress={() => void remove()} />}
          <Button
            className="flex-1"
            title={t('save')}
            busy={busy}
            onPress={() => {
              setTouched(true);
              if (valid) void save();
            }}
          />
        </View>
      }
    >
      <FormSection title={t('addExpense')}>
        <DateField label={t('date')} required value={f.date} max={todayIso()} onChange={set('date')} error={touched ? errors.date : undefined} />
        <Field label={t('category')} required value={f.category} onChangeText={set('category')} autoCapitalize="words" placeholder={t('categoryHint')} error={touched ? errors.category : undefined}>
          {categories.length > 0 && (
            <View className="gap-1.5">
              <Muted>{t('commonCategories')}</Muted>
              <View className="flex-row flex-wrap gap-1.5">
                {categories.map((c) => (
                  <Chip key={c} text={c} on={f.category === c} onPress={() => set('category')(c)} />
                ))}
              </View>
            </View>
          )}
        </Field>
        <NumberField label={t('amount')} required unit="₹" value={f.amount} onChangeText={set('amount')} error={touched ? errors.amount : undefined} />
        <RequiredNote />
      </FormSection>
      <FormSection title={t('secAdditional')} collapsible initiallyOpen={!!(f.importLoadId || f.notes)}>
        <SelectField
          label={t('importId')}
          value={f.importLoadId}
          allowClear
          searchable
          placeholder={t('notSet')}
          hint={t('expenseLoadHint')}
          options={(loads.data?.items ?? []).map((l) => ({ value: l.id, label: l.code, hint: l.woodType }))}
          onChange={set('importLoadId')}
        />
        <Field label={t('notes')} value={f.notes} onChangeText={set('notes')} multiline />
      </FormSection>
    </FormScreen>
  );
}

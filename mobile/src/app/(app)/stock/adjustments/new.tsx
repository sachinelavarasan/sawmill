/**
 * Stock correction (breakage, recount …), new or edited (?id=). Raw: the CFT change.
 * Finished: a size and the pieces change — the server works out the CFT. Nothing moves
 * until the owner approves it.
 */
import { exportPieceCft, sizeLabel } from '@sawmill/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Field, FormScreen, FormSection, NumberField, Row } from '../../../../components/form';
import { SelectField } from '../../../../components/sheet';
import { toast } from '../../../../components/toast';
import { Button, Chip, Loading, Muted, Segmented } from '../../../../components/ui';
import { api } from '../../../../lib/api';
import { int, num3, parseNum, signed3 } from '../../../../lib/format';
import { useSubmit, useUnsavedGuard } from '../../../../lib/hooks';
import { useT } from '../../../../lib/i18n';
import { invalidateOperations, useApi } from '../../../../lib/query';
import type { Adjustment, Balances } from '../../../../lib/types';

interface Form {
  kind: 'RAW' | 'FINISHED';
  sign: 'add' | 'remove';
  importLoadId: string;
  thickness: string;
  width: string;
  length: string;
  pieces: string;
  cft: string;
  reason: string;
}

export default function AdjustmentFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const t = useT();
  const router = useRouter();
  const stock = useApi<Balances>('/stock');
  const [initial, setInitial] = useState<Form | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!id) {
      const f: Form = { kind: 'RAW', sign: 'remove', importLoadId: '', thickness: '', width: '', length: '', pieces: '', cft: '', reason: '' };
      setInitial(f);
      setForm(f);
      return;
    }
    api<Adjustment>(`/stock-adjustments/${id}`)
      .then((a) => {
        const neg = a.kind === 'RAW' ? a.cftDelta < 0 : a.piecesDelta < 0;
        const f: Form = {
          kind: a.kind,
          sign: neg ? 'remove' : 'add',
          importLoadId: a.importLoadId,
          thickness: a.thicknessIn != null ? String(a.thicknessIn) : '',
          width: a.widthIn != null ? String(a.widthIn) : '',
          length: a.lengthFt != null ? String(a.lengthFt) : '',
          pieces: a.piecesDelta ? String(Math.abs(a.piecesDelta)) : '',
          cft: a.kind === 'RAW' ? String(Math.abs(a.cftDelta)) : '',
          reason: a.reason,
        };
        setInitial(f);
        setForm(f);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [id]);

  const loads = useMemo(() => {
    const m = new Map<string, { label: string; hint: string }>();
    for (const r of stock.data?.raw ?? []) m.set(r.importLoadId, { label: `${r.importCode} · ${r.woodType}`, hint: `${num3(r.cft)} CFT ${t('raw').toLowerCase()}` });
    for (const r of stock.data?.finished ?? []) if (!m.has(r.importLoadId)) m.set(r.importLoadId, { label: `${r.importCode} · ${r.woodType}`, hint: t('finished') });
    return [...m].map(([value, v]) => ({ value, ...v }));
  }, [stock.data, t]);
  const sizesInLoad = (stock.data?.finished ?? []).filter((r) => r.importLoadId === form?.importLoadId);

  const T = parseNum(form?.thickness ?? '');
  const W = parseNum(form?.width ?? '');
  const L = parseNum(form?.length ?? '');
  const N = parseNum(form?.pieces ?? '');
  const C = parseNum(form?.cft ?? '');
  const sign = form?.sign === 'remove' ? -1 : 1;
  const finishedOk = !!T && !!W && !!L && !!N && Number.isInteger(N) && N > 0;
  const liveCft = form?.kind === 'FINISHED' && finishedOk ? sign * exportPieceCft(T!, W!, L!, N!) : form?.kind === 'RAW' && C ? sign * C : null;

  const errors: Partial<Record<keyof Form, string>> = {};
  if (form) {
    if (!form.importLoadId) errors.importLoadId = t('required');
    if (form.kind === 'RAW' && (!C || C <= 0)) errors.cft = t('errPositive');
    if (form.kind === 'FINISHED') {
      if (!T || T <= 0) errors.thickness = t('errPositive');
      if (!W || W <= 0) errors.width = t('errPositive');
      if (!L || L <= 0) errors.length = t('errPositive');
      if (!N || !Number.isInteger(N) || N <= 0) errors.pieces = t('errPositive');
    }
    if (form.reason.trim().length < 3) errors.reason = t('adjReasonHint');
  }
  const valid = Object.keys(errors).length === 0;
  const dirty = !!form && !!initial && JSON.stringify(form) !== JSON.stringify(initial);
  const release = useUnsavedGuard(dirty);

  const [save, busy, error] = useSubmit(async () => {
    if (!form) return;
    const body =
      form.kind === 'RAW'
        ? { kind: 'RAW', importLoadId: form.importLoadId, cftDelta: sign * C!, piecesDelta: N ? sign * N : 0, thicknessIn: null, widthIn: null, lengthFt: null, reason: form.reason.trim() }
        : { kind: 'FINISHED', importLoadId: form.importLoadId, thicknessIn: T, widthIn: W, lengthFt: L, piecesDelta: sign * N!, reason: form.reason.trim() };
    if (id) {
      await api(`/stock-adjustments/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      release();
      await invalidateOperations();
      toast(t('saved'));
      router.back();
    } else {
      const created = await api<Adjustment>('/stock-adjustments', { method: 'POST', body: JSON.stringify(body) });
      release();
      await invalidateOperations();
      toast(t('saved'), 'success', created.code);
      router.replace(`/stock/adjustments/${created.id}`);
    }
  });

  const set = <K extends keyof Form>(k: K) => (v: Form[K]) => setForm((f) => f && { ...f, [k]: v });
  const err = (k: keyof Form) => (touched ? errors[k] : undefined);

  return (
    <FormScreen
      title={id ? t('edit') : t('newAdjustment')}
      error={error ?? loadError}
      footer={
        form && (
          <Button
            title={t('adjSaveDraft')}
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
          <FormSection title={t('adjWhich')} subtitle={t('adjWhichSub')}>
            <Segmented
              value={form.kind}
              onChange={(kind) => setForm((f) => f && { ...f, kind })}
              options={[
                { value: 'RAW', label: t('raw') },
                { value: 'FINISHED', label: t('finished') },
              ]}
            />
            <SelectField label={t('sourceLoad')} required value={form.importLoadId} options={loads} searchable error={err('importLoadId')} onChange={set('importLoadId')} />
            {form.kind === 'FINISHED' && sizesInLoad.length > 0 && (
              <View className="gap-1.5">
                <Muted>{t('pickFromStock')}</Muted>
                <View className="flex-row flex-wrap gap-1.5">
                  {sizesInLoad.map((r) => (
                    <Chip
                      key={`${r.thicknessIn}|${r.widthIn}|${r.lengthFt}`}
                      text={`${sizeLabel(r.thicknessIn, r.widthIn, r.lengthFt)} · ${int(r.pieces)}`}
                      on={T === r.thicknessIn && W === r.widthIn && L === r.lengthFt}
                      onPress={() => setForm((f) => f && { ...f, thickness: String(r.thicknessIn), width: String(r.widthIn), length: String(r.lengthFt) })}
                    />
                  ))}
                </View>
              </View>
            )}
            {form.kind === 'FINISHED' && (
              <>
                <Row>
                  <NumberField label={t('thickness')} unit="in" value={form.thickness} onChangeText={set('thickness')} error={err('thickness')} />
                  <NumberField label={t('width')} unit="in" value={form.width} onChangeText={set('width')} error={err('width')} />
                </Row>
                <NumberField label={t('lengthFt')} unit="ft" value={form.length} onChangeText={set('length')} error={err('length')} />
              </>
            )}
          </FormSection>

          <FormSection title={t('adjChange')} subtitle={t('adjChangeSub')}>
            <Segmented
              value={form.sign}
              onChange={set('sign')}
              options={[
                { value: 'remove', label: `− ${t('stockOut')}` },
                { value: 'add', label: `+ ${t('stockIn')}` },
              ]}
            />
            {form.kind === 'RAW' ? (
              <Row>
                <NumberField label={t('cftChange')} required unit="CFT" decimals={3} value={form.cft} onChangeText={set('cft')} error={err('cft')} />
                <NumberField label={t('logsChange')} decimals={0} value={form.pieces} onChangeText={set('pieces')} />
              </Row>
            ) : (
              <NumberField label={t('piecesChange')} required decimals={0} value={form.pieces} onChangeText={set('pieces')} error={err('pieces')} />
            )}
            <View className="flex-row items-center justify-between rounded-xl bg-saffron-soft px-4 py-3">
              <Text className="text-sm font-semibold text-warning">{t('change')}</Text>
              <Text className="text-xl font-bold tabular-nums text-warning">{liveCft != null ? signed3(liveCft) : '0.000'} CFT</Text>
            </View>
          </FormSection>

          <FormSection title={t('adjWhy')} subtitle={t('adjWhySub')}>
            <Field label={t('reason')} required value={form.reason} onChangeText={set('reason')} multiline error={err('reason')} hint={t('adjReasonHint')} />
          </FormSection>
        </>
      )}
    </FormScreen>
  );
}

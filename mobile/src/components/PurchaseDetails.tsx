/**
 * [OWNER-ONLY] Purchase side of an import load: supplier, rate, amount, transport, paid.
 * Rendered only for people with finance:view, and the API refuses everyone else.
 * Payment status is worked out by the server from amount and paid.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { inr, num3, parseNum } from '../lib/format';
import { useSubmit } from '../lib/hooks';
import { useT } from '../lib/i18n';
import { importsApi } from '../lib/imports-api';
import { invalidate, useApi } from '../lib/query';
import type { Party, PurchaseFinancials } from '../lib/types';
import { Field, NumberField } from './form';
import { SelectField, Sheet, useSheet } from './sheet';
import { toast } from './toast';
import { Button, Card, ErrorBox, KV, Pill, SectionTitle, Skeleton } from './ui';

const PAY_TONE = { UNPAID: 'bad', PARTIAL: 'warn', PAID: 'good' } as const;

export function PurchaseDetails({ importId, totalCft }: { importId: string; totalCft: number }) {
  const t = useT();
  const path = `/imports/${importId}/financials`;
  const fin = useApi<PurchaseFinancials>(path);
  const suppliers = useApi<Party[]>('/suppliers');
  const sheet = useSheet();
  const [f, setF] = useState({ supplierId: '', rate: '', amount: '', transport: '', paid: '', notes: '' });

  const open = () => {
    const d = fin.data;
    setF({
      supplierId: d?.supplierId ?? '',
      rate: d?.purchaseRatePerCft != null ? String(d.purchaseRatePerCft) : '',
      amount: d?.purchaseAmount != null ? String(d.purchaseAmount) : '',
      transport: d?.transportCharges != null ? String(d.transportCharges) : '',
      paid: d?.amountPaid ? String(d.amountPaid) : '',
      notes: d?.notes ?? '',
    });
    sheet.open();
  };

  const [save, busy, error] = useSubmit(async () => {
    await importsApi.saveFinancials(importId, {
      supplierId: f.supplierId || null,
      purchaseRatePerCft: parseNum(f.rate),
      purchaseAmount: parseNum(f.amount),
      transportCharges: parseNum(f.transport),
      amountPaid: parseNum(f.paid),
      notes: f.notes.trim() || null,
    });
    await invalidate(path, '/accounts', '/dashboard');
    toast(t('saved'));
    sheet.close();
  });

  const d = fin.data;
  const supplierName = suppliers.data?.find((s) => s.id === d?.supplierId)?.name;
  const rateTimesCft = parseNum(f.rate) != null && totalCft > 0 ? Math.round(parseNum(f.rate)! * totalCft * 100) / 100 : null;

  return (
    <>
      <SectionTitle right={<Pill icon="lock" text={t('ownerOnly')} />}>{t('purchaseDetails')}</SectionTitle>
      {fin.error && <ErrorBox message={(fin.error as Error).message} onRetry={() => void fin.refetch()} />}
      {!d ? (
        <Skeleton className="h-28 rounded-xl" />
      ) : (
        <Card>
          <View className="flex-row items-center justify-between">
            <Pill tone={PAY_TONE[d.paymentStatus ?? 'UNPAID']} text={t((d.paymentStatus ?? 'UNPAID').toLowerCase() as 'paid')} />
          </View>
          <KV label={t('supplier')} value={supplierName ?? t('noSupplier')} />
          <KV label={t('purchaseRate')} value={d.purchaseRatePerCft != null ? `${inr(d.purchaseRatePerCft)} / CFT` : '—'} />
          <KV label={t('purchaseAmount')} value={d.purchaseAmount != null ? inr(d.purchaseAmount) : '—'} strong />
          <KV label={t('transportCharges')} value={d.transportCharges != null ? inr(d.transportCharges) : '—'} />
          <KV label={t('amountPaid')} value={inr(d.amountPaid)} />
          {d.purchaseAmount != null && <KV label={t('balance')} value={inr(Math.max(0, d.purchaseAmount - d.amountPaid))} strong />}
          <Button size="md" kind="secondary" icon="edit-2" title={t('edit')} onPress={open} />
        </Card>
      )}
      <Sheet ref={sheet.ref} title={t('purchaseDetails')} footer={<Button title={t('save')} busy={busy} onPress={() => void save()} />}>
        <View className="gap-3.5 px-5">
          <SelectField
            label={t('supplier')}
            value={f.supplierId}
            allowClear
            searchable
            options={(suppliers.data ?? []).map((s) => ({ value: s.id, label: s.name, hint: s.phone ?? undefined }))}
            onChange={(v) => setF((x) => ({ ...x, supplierId: v }))}
            hint={t('supplierHint')}
            emptyText={t('noSuppliers')}
          />
          <NumberField label={t('purchaseRate')} unit="₹/CFT" value={f.rate} onChangeText={(rate) => setF((x) => ({ ...x, rate }))} />
          <NumberField
            label={t('purchaseAmount')}
            unit="₹"
            value={f.amount}
            onChangeText={(amount) => setF((x) => ({ ...x, amount }))}
            hint={rateTimesCft != null ? `${t('rateTimesCft')}: ${inr(rateTimesCft)} (${num3(totalCft)} CFT)` : undefined}
          />
          {rateTimesCft != null && f.amount === '' && (
            <Button size="md" kind="ghost" title={`${t('rateTimesCft')} → ${inr(rateTimesCft)}`} onPress={() => setF((x) => ({ ...x, amount: String(rateTimesCft) }))} />
          )}
          <NumberField label={t('transportCharges')} unit="₹" value={f.transport} onChangeText={(transport) => setF((x) => ({ ...x, transport }))} />
          <NumberField label={t('amountPaid')} unit="₹" value={f.paid} onChangeText={(paid) => setF((x) => ({ ...x, paid }))} />
          <Field label={t('notes')} value={f.notes} onChangeText={(notes) => setF((x) => ({ ...x, notes }))} multiline />
          {error && <ErrorBox message={error} />}
        </View>
      </Sheet>
    </>
  );
}

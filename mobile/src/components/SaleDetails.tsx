/**
 * [OWNER-ONLY] Sale side of an export: client, selling rate, amount, received.
 * Only rendered for finance:view; the API refuses everyone else. Payment status comes from the server.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { api } from '../lib/api';
import { inr, num3, parseNum } from '../lib/format';
import { useSubmit } from '../lib/hooks';
import { useT } from '../lib/i18n';
import { invalidate, useApi } from '../lib/query';
import type { Party, SaleFinancials } from '../lib/types';
import { Field, NumberField } from './form';
import { SelectField, Sheet, useSheet } from './sheet';
import { toast } from './toast';
import { Button, Card, ErrorBox, KV, Pill, SectionTitle, Skeleton } from './ui';

const PAY_TONE = { UNPAID: 'bad', PARTIAL: 'warn', PAID: 'good' } as const;

export function SaleDetails({ exportId, totalCft }: { exportId: string; totalCft: number }) {
  const t = useT();
  const path = `/exports/${exportId}/financials`;
  const fin = useApi<SaleFinancials>(path);
  const clients = useApi<Party[]>('/clients');
  const sheet = useSheet();
  const [f, setF] = useState({ clientId: '', rate: '', amount: '', received: '', notes: '' });

  const open = () => {
    const d = fin.data;
    setF({
      clientId: d?.clientId ?? '',
      rate: d?.sellingRatePerCft != null ? String(d.sellingRatePerCft) : '',
      amount: d?.saleAmount != null ? String(d.saleAmount) : '',
      received: d?.amountReceived ? String(d.amountReceived) : '',
      notes: d?.notes ?? '',
    });
    sheet.open();
  };

  const [save, busy, error] = useSubmit(async () => {
    await api(path, {
      method: 'PUT',
      body: JSON.stringify({
        clientId: f.clientId || null,
        sellingRatePerCft: parseNum(f.rate),
        saleAmount: parseNum(f.amount),
        amountReceived: parseNum(f.received),
        notes: f.notes.trim() || null,
      }),
    });
    await invalidate(path, '/accounts', '/dashboard');
    toast(t('saved'));
    sheet.close();
  });

  const d = fin.data;
  const clientName = clients.data?.find((c) => c.id === d?.clientId)?.name;
  const rate = parseNum(f.rate);
  const suggested = rate != null && totalCft > 0 ? Math.round(rate * totalCft * 100) / 100 : null;

  return (
    <>
      <SectionTitle right={<Pill icon="lock" text={t('ownerOnly')} />}>{t('saleDetails')}</SectionTitle>
      {fin.error && <ErrorBox message={(fin.error as Error).message} onRetry={() => void fin.refetch()} />}
      {!d ? (
        <Skeleton className="h-28 rounded-xl" />
      ) : (
        <Card>
          <Pill tone={PAY_TONE[d.paymentStatus]} text={t(d.paymentStatus.toLowerCase() as 'paid')} />
          <KV label={t('client')} value={clientName ?? t('notSet')} />
          <KV label={t('sellingRate')} value={d.sellingRatePerCft != null ? `${inr(d.sellingRatePerCft)} / CFT` : '—'} />
          <KV label={t('saleAmount')} value={d.saleAmount != null ? inr(d.saleAmount) : '—'} strong />
          <KV label={t('amountReceived')} value={inr(d.amountReceived)} />
          {d.saleAmount != null && <KV label={t('balance')} value={inr(Math.max(0, d.saleAmount - d.amountReceived))} strong />}
          <Button size="md" kind="secondary" icon="edit-2" title={t('edit')} onPress={open} />
        </Card>
      )}
      <Sheet ref={sheet.ref} title={t('saleDetails')} footer={<Button title={t('save')} busy={busy} onPress={() => void save()} />}>
        <View className="gap-3.5 px-5">
          <SelectField
            label={t('client')}
            value={f.clientId}
            allowClear
            searchable
            options={(clients.data ?? []).map((c) => ({ value: c.id, label: c.name, hint: c.phone ?? undefined }))}
            onChange={(v) => setF((x) => ({ ...x, clientId: v }))}
            emptyText={t('noClients')}
          />
          <NumberField label={t('sellingRate')} unit="₹/CFT" value={f.rate} onChangeText={(r) => setF((x) => ({ ...x, rate: r }))} />
          <NumberField
            label={t('saleAmount')}
            unit="₹"
            value={f.amount}
            onChangeText={(amount) => setF((x) => ({ ...x, amount }))}
            hint={suggested != null ? `${t('rateTimesCft')}: ${inr(suggested)} (${num3(totalCft)} CFT)` : undefined}
          />
          {suggested != null && f.amount === '' && (
            <Button size="md" kind="ghost" title={`${t('rateTimesCft')} → ${inr(suggested)}`} onPress={() => setF((x) => ({ ...x, amount: String(suggested) }))} />
          )}
          <NumberField label={t('amountReceived')} unit="₹" value={f.received} onChangeText={(received) => setF((x) => ({ ...x, received }))} />
          <Field label={t('notes')} value={f.notes} onChangeText={(notes) => setF((x) => ({ ...x, notes }))} multiline />
          {error && <ErrorBox message={error} />}
        </View>
      </Sheet>
    </>
  );
}

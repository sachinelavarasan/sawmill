/**
 * [OWNER-ONLY] Payments against one load: money paid to the supplier (import) or received
 * from the client (export). Each payment is its own record; the API sums them into the load's
 * paid figure and works out the status. Shown under Purchase / Sale details.
 */
import { PAYMENT_MODES, type PaymentMode, type TKey } from '@timbertrail/shared';
import { useState } from 'react';
import { View } from 'react-native';
import { api } from '../lib/api';
import { dateOnly, inr, parseNum, todayIso } from '../lib/format';
import { useSubmit } from '../lib/hooks';
import { useT } from '../lib/i18n';
import { invalidate, queryClient, useApi } from '../lib/query';
import type { PaymentSummary } from '../lib/types';
import { useConfirm } from './confirm';
import { Field, NumberField } from './form';
import { DateField, Sheet, useSheet } from './sheet';
import { Text } from './text';
import { toast } from './toast';
import { Button, Card, Chip, cn, ErrorBox, IconButton, KV, Muted, Pill, SectionTitle, Skeleton } from './ui';

export const PAY_TONE = { UNPAID: 'bad', PARTIAL: 'warn', PAID: 'good' } as const;
export const modeKey = (m: PaymentMode) => `mode${m}` as TKey;

export function Payments({ kind, loadId }: { kind: 'imports' | 'exports'; loadId: string }) {
  const t = useT();
  const confirm = useConfirm();
  const path = `/${kind}/${loadId}/payments`;
  const q = useApi<PaymentSummary>(path);
  const sheet = useSheet();
  const blank = { date: todayIso(), amount: '', mode: 'BANK' as PaymentMode, reference: '', notes: '' };
  const [f, setF] = useState(blank);

  /** the API answers with the new summary: show it at once, then refresh the figures that depend on it */
  const settle = async (summary: PaymentSummary) => {
    queryClient.setQueryData(['api', path], summary);
    await invalidate(`/${kind}/${loadId}/financials`, '/accounts', '/dashboard', '/suppliers', '/clients');
  };

  const [add, busy, error] = useSubmit(async () => {
    const amount = parseNum(f.amount);
    if (amount == null || amount <= 0) throw new Error(t('required'));
    await settle(await api<PaymentSummary>(path, { method: 'POST', body: { date: f.date, amount, mode: f.mode, reference: f.reference.trim() || null, notes: f.notes.trim() || null } }));
    toast(t('paymentSaved'));
    sheet.close();
  });

  const remove = async (id: string, label: string) => {
    if (!(await confirm({ title: t('deletePayment'), message: label, confirmText: t('delete'), cancelText: t('cancel'), destructive: true }))) return;
    try {
      await settle(await api<PaymentSummary>(`${path}/${id}`, { method: 'DELETE' }));
      toast(t('paymentDeleted'));
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const open = () => {
    setF((x) => ({ ...blank, mode: x.mode }));
    sheet.open();
  };

  const d = q.data;
  const paidLabel = t(kind === 'imports' ? 'totalPaid' : 'totalReceived');

  return (
    <>
      <SectionTitle action={{ label: t('addPayment'), onPress: open }}>{t(kind === 'imports' ? 'payments' : 'paymentsReceived')}</SectionTitle>
      {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
      {!d ? (
        !q.error && <Skeleton className="h-24 rounded-xl" />
      ) : (
        <Card>
          <View className="flex-row flex-wrap items-center gap-2">
            <Pill tone={PAY_TONE[d.paymentStatus]} text={t(d.paymentStatus.toLowerCase() as 'paid')} />
            {d.overpaid > 0 && <Pill tone="info" text={t('overpaid', { amount: inr(d.overpaid) })} />}
          </View>
          <KV label={paidLabel} value={inr(d.totalPaid)} strong />
          {d.billAmount != null && <KV label={t('balance')} value={inr(d.balance)} strong />}
          {d.items.length === 0 ? (
            <Muted>{t('noPayments')}</Muted>
          ) : (
            <View className="-mx-1">
              {d.items.map((p, i) => (
                <View key={p.id} className={cn('flex-row items-center gap-3 px-1 py-2.5', i > 0 && 'border-t border-border')}>
                  <View className="flex-1 gap-0.5">
                    <Text className="text-[15px] font-semibold tabular-nums text-foreground">{inr(p.amount)}</Text>
                    <Muted lines={1}>{[dateOnly(p.date), t(modeKey(p.mode)), p.reference, p.notes].filter(Boolean).join(' · ')}</Muted>
                  </View>
                  <IconButton icon="trash-2" tone="bad" label={t('delete')} onPress={() => void remove(p.id, `${dateOnly(p.date)} · ${t(modeKey(p.mode))} · ${inr(p.amount)}`)} />
                </View>
              ))}
            </View>
          )}
          <Button size="md" kind="secondary" icon="plus" title={t('addPayment')} onPress={open} />
        </Card>
      )}
      <Sheet ref={sheet.ref} title={t('addPayment')} footer={<Button title={t('save')} busy={busy} disabled={!(parseNum(f.amount)! > 0)} onPress={() => void add()} />}>
        <View className="gap-3.5 px-5">
          <NumberField label={t('amount')} unit="₹" value={f.amount} onChangeText={(amount) => setF((x) => ({ ...x, amount }))} required autoFocus />
          <DateField label={t('date')} value={f.date} max={todayIso()} onChange={(date) => setF((x) => ({ ...x, date }))} />
          <View className="gap-1.5">
            <Text className="text-sm font-medium text-foreground">{t('paymentMode')}</Text>
            <View className="flex-row flex-wrap gap-2">
              {PAYMENT_MODES.map((m) => (
                <Chip key={m} text={t(modeKey(m))} on={f.mode === m} onPress={() => setF((x) => ({ ...x, mode: m }))} />
              ))}
            </View>
          </View>
          {f.mode !== 'CASH' && (
            <Field label={t('paymentReference')} hint={t('paymentReferenceHint')} value={f.reference} onChangeText={(reference) => setF((x) => ({ ...x, reference }))} maxLength={60} autoCapitalize="characters" />
          )}
          <Field label={t('notes')} value={f.notes} onChangeText={(notes) => setF((x) => ({ ...x, notes }))} maxLength={500} />
          {error && <ErrorBox message={error} />}
        </View>
      </Sheet>
    </>
  );
}

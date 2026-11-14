/**
 * The approval strip on every record: Submit (draft or rejected), Approve / Reject with a
 * reason (owner, submitted), or a status note. The API re-checks everything; this only
 * decides what to offer. Stock changes only when the server approves.
 */
import { useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../lib/api';
import { useT } from '../lib/i18n';
import { invalidateOperations } from '../lib/query';
import { useConfirm, usePrompt } from './confirm';
import { toast } from './toast';
import { Button, ErrorBox, Icon, Notice } from './ui';

export function WorkflowBar({
  base,
  code,
  status,
  canSubmit,
  canReview,
  confirmApprove,
  submitBlocked,
  approvedNote,
  onDone,
}: {
  /** API path of the record, e.g. `/imports/<id>` */
  base: string;
  code: string;
  status: string;
  canSubmit: boolean;
  canReview: boolean;
  /** what approving does to stock, shown in the confirmation */
  confirmApprove: string;
  /** why it can't be submitted yet */
  submitBlocked?: string | null;
  approvedNote?: string;
  onDone: () => void;
}) {
  const t = useT();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const [busy, setBusy] = useState<'submit' | 'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(kind: 'submit' | 'approve' | 'reject', body?: object) {
    if (busy) return;
    setBusy(kind);
    setError(null);
    try {
      await api(`${base}/${kind}`, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
      await invalidateOperations();
      if (kind === 'approve') toast(t('approvedToast', { code }));
      else if (kind === 'reject') toast(t('rejectedToast', { code }), 'info');
      else toast(t('waitingApproval'));
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    const ok = await confirm({ title: t('submitForApproval'), message: t('submitHint'), confirmText: t('submitForApproval'), cancelText: t('cancel') });
    if (ok) await act('submit');
  }
  async function approve() {
    const ok = await confirm({ title: t('approve'), message: confirmApprove, confirmText: t('approve'), cancelText: t('cancel') });
    if (ok) await act('approve');
  }
  async function reject() {
    const reason = await prompt({ title: t('reject'), message: t('rejectReasonHint'), placeholder: t('rejectReason'), confirmText: t('reject'), minLength: 3, destructive: true });
    if (reason) await act('reject', { reason });
  }

  return (
    <View className="gap-2.5">
      {error && <ErrorBox message={error} />}
      {canReview && (
        <View className="gap-3 rounded-xl border border-border bg-card p-4">
          <View className="flex-row items-center gap-2">
            <Icon name="clock" size={16} colorClassName="accent-warning" />
            <Text className="flex-1 text-sm font-semibold text-warning">{t('ownerReviewing')}</Text>
          </View>
          <View className="flex-row gap-2.5">
            <Button className="flex-1" kind="danger" icon="x" title={t('reject')} busy={busy === 'reject'} disabled={!!busy} onPress={reject} />
            <Button className="flex-1" kind="success" icon="check" title={t('approve')} busy={busy === 'approve'} disabled={!!busy} onPress={approve} />
          </View>
        </View>
      )}
      {!canReview && status === 'SUBMITTED' && <Notice icon="clock">{t('waitingApproval')}</Notice>}
      {status === 'APPROVED' && (
        <Notice tone="good" icon="check-circle">
          {approvedNote ?? t('approved')}
        </Notice>
      )}
      {canSubmit && (
        <View className="gap-1.5">
          <Button icon="send" title={t('submitForApproval')} busy={busy === 'submit'} disabled={!!submitBlocked || !!busy} onPress={submit} />
          {submitBlocked ? <Text className="text-center text-[13px] text-muted-foreground">{submitBlocked}</Text> : null}
        </View>
      )}
    </View>
  );
}

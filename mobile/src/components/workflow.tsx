/**
 * The approval strip on every record: Submit (draft or rejected), Approve / Reject with a
 * reason (owner, submitted), or a status note. The API re-checks everything; this only
 * decides what to offer. Stock changes only when the server approves.
 */
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { Text } from './text';
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
  onSubmit,
  submitLabel,
}: {
  /** replaces the confirm-and-submit (e.g. open a "Check before sending" page that submits itself) */
  onSubmit?: () => void;
  /** the submit button's text; defaults to "Send to owner" */
  submitLabel?: string;
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
  /** set synchronously, so a second tap before the next render is ignored (busy alone is too late) */
  const lock = useRef(false);

  /** Held from the first tap until the dialog is answered and the request is done: one dialog, one request. */
  function locked(fn: () => Promise<void>) {
    return async () => {
      if (lock.current) return;
      lock.current = true;
      try {
        await fn();
      } finally {
        lock.current = false;
      }
    };
  }

  async function act(kind: 'submit' | 'approve' | 'reject', body?: object) {
    setBusy(kind);
    setError(null);
    try {
      await api(`${base}/${kind}`, { method: 'POST', body });
      await invalidateOperations();
      if (kind === 'approve') toast(t('approvedDoneToast'), 'success', code);
      else if (kind === 'reject') toast(t('sentBackToast'), 'info', code);
      else toast(t('sentForApprovalToast'), 'success', code);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const submit = locked(async () => {
    const ok = await confirm({ title: t('submitForApproval'), message: t('submitHint'), confirmText: t('submitForApproval'), cancelText: t('cancel') });
    if (ok) await act('submit');
  });
  const approve = locked(async () => {
    const ok = await confirm({ title: t('approve'), message: confirmApprove, confirmText: t('approve'), cancelText: t('cancel') });
    if (ok) await act('approve');
  });
  const reject = locked(async () => {
    const reason = await prompt({ title: t('reject'), message: t('rejectReasonHint'), placeholder: t('rejectReason'), confirmText: t('reject'), minLength: 3, destructive: true });
    if (reason) await act('reject', { reason });
  });

  return (
    <View className="gap-2.5">
      {error && <ErrorBox message={error} />}
      {canReview && (
        // the decision: what is waiting, then Reject (outlined) beside Approve (the main action)
        <View className="gap-3.5 rounded-3xl border border-saffron/30 bg-saffron-soft p-4">
          <View className="flex-row items-center gap-2.5">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-saffron">
              <Icon name="clock" size={16} colorClassName="accent-saffron-foreground" />
            </View>
            <Text className="flex-1 text-[15px] font-semibold text-foreground">{t('ownerReviewing')}</Text>
          </View>
          <View className="flex-row gap-2.5">
            <Button className="flex-1" kind="danger" icon="x" title={t('reject')} busy={busy === 'reject'} disabled={!!busy} onPress={reject} />
            <Button className="flex-[1.4]" kind="success" icon="check" title={t('approve')} busy={busy === 'approve'} disabled={!!busy} onPress={approve} />
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
          <Button icon={onSubmit ? 'arrow-right' : 'send'} title={submitLabel ?? t('submitForApproval')} busy={busy === 'submit'} disabled={!!submitBlocked || !!busy} onPress={onSubmit ?? submit} />
          {submitBlocked ? <Text className="text-center text-[13px] text-muted-foreground">{submitBlocked}</Text> : null}
        </View>
      )}
    </View>
  );
}

import { CheckIcon, XIcon } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '../api';
import { useI18n } from '../i18n';
import { useConfirm } from './confirm';
import { Notice } from './page';

/**
 * Owner's Approve / Reject buttons for one submitted record. Approve asks for
 * confirmation (saying what it does to stock); Reject asks for the reason the
 * accountant will see. Both call the record's own endpoint: `${base}/approve|reject`.
 */
export function ReviewActions({
  base,
  code,
  confirmApprove,
  onDone,
  onError,
  size = 'lg',
  compact,
}: {
  /** e.g. `/imports/<id>` */
  base: string;
  /** shown in the dialog titles, e.g. IMP-2026-0012 */
  code?: string;
  confirmApprove: string;
  /** called after the record was approved or rejected, saying which */
  onDone: (outcome: 'approved' | 'rejected') => void;
  onError?: (message: string | null) => void;
  size?: 'sm' | 'lg' | 'default';
  /** icon-only buttons on phones */
  compact?: boolean;
}) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const title = (s: string) => (code ? `${s} ${code}` : s);

  async function approve() {
    if (!(await confirm({ title: title(t('approve')), description: confirmApprove, confirmLabel: t('approve') }))) return;
    setBusy(true);
    onError?.(null);
    try {
      await api(`${base}/approve`, { method: 'POST' });
      onDone('approved');
    } catch (err) {
      onError?.((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reject(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setRejectError(null);
    try {
      await api(`${base}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
      setRejecting(false);
      setReason('');
      onDone('rejected');
    } catch (err) {
      setRejectError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const label = (text: string) => (compact ? <span className="max-md:sr-only">{text}</span> : text);

  return (
    <>
      <Button variant="outline" size={size} disabled={busy} onClick={() => setRejecting(true)} aria-label={t('reject')}>
        <XIcon /> {label(t('reject'))}
      </Button>
      <Button size={size} disabled={busy} onClick={approve} aria-label={t('approve')}>
        <CheckIcon /> {label(t('approve'))}
      </Button>

      <Dialog open={rejecting} onOpenChange={(open) => !busy && setRejecting(open)}>
        <DialogContent>
          <form onSubmit={reject} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>{title(t('reject'))}</DialogTitle>
              <DialogDescription>{t('rejectReasonHint')}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor={`reject-${base}`} className="gap-1">
                {t('rejectReason')}
                <span className="text-destructive" aria-hidden>
                  *
                </span>
              </Label>
              <Textarea id={`reject-${base}`} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={500} rows={3} autoFocus className="bg-card" />
              <div className="text-right text-xs text-muted-foreground tabular-nums" aria-hidden>
                {reason.length} / 500
              </div>
            </div>
            {rejectError && <Notice tone="error">{rejectError}</Notice>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejecting(false)} disabled={busy}>
                {t('cancel')}
              </Button>
              <Button type="submit" variant="destructive" disabled={busy || reason.trim().length < 3}>
                {t('reject')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

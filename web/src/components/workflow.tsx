import { CheckIcon, ClockIcon, SendIcon } from 'lucide-react';
import { ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { api } from '../api';
import { useI18n } from '../i18n';
import { Notice } from './page';
import { ReviewActions } from './review';

interface Props {
  /** API path of the record, e.g. `/imports/<id>`; `/submit`, `/approve`, `/reject` are appended. */
  base: string;
  status: string;
  canSubmit: boolean;
  canReview: boolean;
  /** Shown in the approve confirmation (what approving will do to stock). */
  confirmApprove: string;
  /** Why the record can't be submitted yet; disables the button and is shown next to it. */
  submitBlocked?: string | null;
  /** Shown once approved. */
  approvedNote?: ReactNode;
  onDone: () => void;
}

/** A full-width strip: message on the left, actions on the right (stacked on phones). */
function Strip({ tone = 'neutral', icon, children, actions }: { tone?: 'neutral' | 'ok' | 'warn'; icon?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center',
        tone === 'neutral' && 'bg-card',
        tone === 'ok' && 'border-transparent bg-success-soft text-success',
        tone === 'warn' && 'border-transparent bg-warning-soft text-warning',
      )}
    >
      <div className="flex flex-1 items-start gap-2.5 text-sm">
        {icon && <span className="mt-0.5 shrink-0 [&_svg]:size-4">{icon}</span>}
        <div className={cn(tone === 'neutral' && 'text-muted-foreground')}>{children}</div>
      </div>
      {actions && <div className="flex gap-2 max-sm:[&>*]:flex-1">{actions}</div>}
    </div>
  );
}

/**
 * The approval strip on every record: Submit (accountant / owner on a draft),
 * Approve / Reject with a reason (owner on a submitted record), or a status note.
 * The API re-checks everything; this only decides what to offer.
 */
export function WorkflowBar({ base, status, canSubmit, canReview, confirmApprove, submitBlocked, approvedNote, onDone }: Props) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api(`${base}/submit`, { method: 'POST' });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const errorBox = error && <Notice tone="error">{error}</Notice>;

  if (canReview) {
    return (
      <div className="flex flex-col gap-2">
        <Strip tone="warn" icon={<ClockIcon />} actions={<ReviewActions base={base} confirmApprove={confirmApprove} onDone={onDone} onError={setError} />}>
          {t('ownerReviewing')}
        </Strip>
        {errorBox}
      </div>
    );
  }

  if (canSubmit) {
    return (
      <div className="flex flex-col gap-2">
        <Strip
          actions={
            <Button size="lg" disabled={busy || !!submitBlocked} onClick={submit}>
              <SendIcon /> {t('submitForApproval')}
            </Button>
          }
        >
          {submitBlocked ?? t('submitHint')}
        </Strip>
        {errorBox}
      </div>
    );
  }

  if (status === 'SUBMITTED') return <Strip icon={<ClockIcon />}>{t('waitingApproval')}</Strip>;
  if (status === 'APPROVED' && approvedNote)
    return (
      <Strip tone="ok" icon={<CheckIcon />}>
        {approvedNote}
      </Strip>
    );
  return null;
}

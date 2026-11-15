import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TKey, useI18n } from '../i18n';

const STATUS: Record<string, { key: TKey; className: string }> = {
  DRAFT: { key: 'draft', className: 'bg-secondary text-foreground/75' },
  SUBMITTED: { key: 'pending', className: 'bg-warning-soft text-warning' },
  APPROVED: { key: 'approved', className: 'bg-success-soft text-success' },
  REJECTED: { key: 'rejected', className: 'bg-destructive-soft text-destructive' },
};

/** Approval status as an outlined pill on a soft fill of its colour (shadcn Badge). */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const { t } = useI18n();
  const s = STATUS[status];
  return (
    <Badge variant="secondary" className={cn('rounded-full border border-current/30 px-2.5 py-1 font-medium', s?.className, className)}>
      {s ? t(s.key) : status}
    </Badge>
  );
}

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TKey, useI18n } from '../i18n';

const STATUS: Record<string, { key: TKey; className: string }> = {
  DRAFT: { key: 'draft', className: 'bg-muted text-muted-foreground' },
  SUBMITTED: { key: 'pending', className: 'bg-warning-soft text-warning' },
  APPROVED: { key: 'approved', className: 'bg-success-soft text-success' },
  REJECTED: { key: 'rejected', className: 'bg-destructive-soft text-destructive' },
};

/** Approval status as a soft coloured pill (shadcn Badge). */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const { t } = useI18n();
  const s = STATUS[status];
  return (
    <Badge variant="secondary" className={cn('rounded-full border-transparent font-semibold', s?.className, className)}>
      {s ? t(s.key) : status}
    </Badge>
  );
}

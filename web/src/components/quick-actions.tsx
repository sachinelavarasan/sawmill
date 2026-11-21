import { Permission } from '@timbertrail/shared';
import {
  ArrowDownToLineIcon,
  ArrowRightIcon,
  ArrowUpFromLineIcon,
  BoxesIcon,
  CircleCheckIcon,
  FactoryIcon,
  FileTextIcon,
  IndianRupeeIcon,
  ReceiptIndianRupeeIcon,
  RulerIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';

interface Action {
  to: string;
  label: string;
  icon: ReactNode;
  /** a count shown on the tile (e.g. entries waiting for approval) */
  badge?: number;
}

/**
 * The things done most often, one press away.
 *  - default: the four on the mill floor, then an expense and a report for whoever may record or run them.
 *  - `simple`: the simple view's home — big picture tiles, one or two words each, for the whole day's
 *    core work (and, for the owner, approvals and money due).
 */
export function QuickActions({ simple = false, pending = 0 }: { simple?: boolean; /** entries waiting for approval (simple view) */ pending?: number }) {
  const { t } = useI18n();
  const { can } = useAuth();
  if (!can(Permission.OPERATIONS_CREATE)) return null;

  if (simple) {
    const actions: Action[] = [
      { to: '/imports/new', label: t('simpleLoadIn'), icon: <ArrowDownToLineIcon /> },
      { to: '/measurement', label: t('simpleMeasure'), icon: <RulerIcon /> },
      { to: '/production/new', label: t('simpleCut'), icon: <FactoryIcon /> },
      { to: '/exports/new', label: t('simpleLoadOut'), icon: <ArrowUpFromLineIcon /> },
      { to: '/stock', label: t('simpleStock'), icon: <BoxesIcon /> },
      ...(can(Permission.OPERATIONS_APPROVE) ? [{ to: '/approvals', label: t('simpleApprove'), icon: <CircleCheckIcon />, badge: pending }] : []),
      ...(can(Permission.CLIENTS_MANAGE) ? [{ to: '/clients', label: t('simpleDues'), icon: <IndianRupeeIcon /> }] : []),
    ];
    return (
      <div data-tour="quick-actions" className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 print:hidden">
        {actions.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="relative flex min-h-28 flex-col items-center justify-center gap-2.5 rounded-2xl bg-card p-4 text-center shadow-card hover-lift outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:min-h-32"
          >
            <span className="grid size-13 place-items-center rounded-xl bg-primary-soft text-primary [&_svg]:size-6.5 [&_svg]:stroke-[1.75]">{a.icon}</span>
            <span className="text-[0.9375rem] leading-tight font-medium sm:text-base">{a.label}</span>
            {!!a.badge && (
              <span className="absolute top-3 right-3 min-w-6 rounded-full bg-primary px-1.5 text-center text-xs leading-6 font-semibold text-primary-foreground tabular-nums">
                {a.badge > 99 ? '99+' : a.badge}
              </span>
            )}
          </Link>
        ))}
      </div>
    );
  }

  const actions: Action[] = [
    { to: '/imports/new', label: t('newImport'), icon: <ArrowDownToLineIcon /> },
    { to: '/measurement', label: t('measurement'), icon: <RulerIcon /> },
    { to: '/production/new', label: t('newProduction'), icon: <FactoryIcon /> },
    { to: '/exports/new', label: t('newExport'), icon: <ArrowUpFromLineIcon /> },
    ...(can(Permission.FINANCE_VIEW) ? [{ to: '/accounts?new=expense', label: t('recordExpense'), icon: <ReceiptIndianRupeeIcon /> }] : []),
    ...(can(Permission.REPORTS_OPERATIONAL) ? [{ to: '/reports', label: t('generateReport'), icon: <FileTextIcon /> }] : []),
  ];
  // four, five or six tiles: one row on a wide screen, rows of three on a laptop
  const cols = actions.length >= 6 ? 'lg:grid-cols-3 2xl:grid-cols-6' : actions.length === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4';
  return (
    <div data-tour="quick-actions" className={cn('stagger grid grid-cols-2 gap-3 sm:gap-5 print:hidden', cols)}>
      {actions.map((a) => (
        <Link
          key={a.to}
          to={a.to}
          className="group flex min-h-16 items-center gap-3.5 rounded-xl bg-card py-3 pr-4 pl-3.5 text-sm font-semibold shadow-card hover-lift outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary [&_svg]:size-[1.125rem]">
            {a.icon}
          </span>
          <span className="min-w-0 flex-1 leading-snug">{a.label}</span>
          <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100 max-sm:hidden" aria-hidden />
        </Link>
      ))}
    </div>
  );
}

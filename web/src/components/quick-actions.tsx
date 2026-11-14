import { Permission } from '@sawmill/shared';
import { ArrowDownToLineIcon, ArrowRightIcon, ArrowUpFromLineIcon, FactoryIcon, FileTextIcon, ReceiptIndianRupeeIcon, RulerIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';

/** The things done most often, one press away: the four on the mill floor, then an expense and a report for whoever may record or run them. */
export function QuickActions() {
  const { t } = useI18n();
  const { can } = useAuth();
  if (!can(Permission.OPERATIONS_CREATE)) return null;
  const actions = [
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
    <div className={`stagger grid grid-cols-2 gap-3 sm:gap-5 ${cols} print:hidden`}>
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

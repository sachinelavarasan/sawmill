import { Permission } from '@sawmill/shared';
import { ArrowDownToLineIcon, ArrowRightIcon, ArrowUpFromLineIcon, FactoryIcon, RulerIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';

/** Dashboard shortcuts to the four things done most often on the mill floor. */
export function QuickActions() {
  const { t } = useI18n();
  const { can } = useAuth();
  if (!can(Permission.OPERATIONS_CREATE)) return null;
  const actions = [
    { to: '/imports/new', label: t('newImport'), icon: <ArrowDownToLineIcon /> },
    { to: '/measurement', label: t('measurement'), icon: <RulerIcon /> },
    { to: '/production/new', label: t('newProduction'), icon: <FactoryIcon /> },
    { to: '/exports/new', label: t('newExport'), icon: <ArrowUpFromLineIcon /> },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 print:hidden">
      {actions.map((a) => (
        <Link
          key={a.to}
          to={a.to}
          className="group flex min-h-14 items-center gap-3 rounded-xl bg-card py-2 pr-3 pl-3 text-sm font-semibold shadow-card transition-shadow duration-200 outline-none hover:shadow-lift focus-visible:ring-[3px] focus-visible:ring-ring/50"
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

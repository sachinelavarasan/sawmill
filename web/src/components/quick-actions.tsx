import { Permission } from '@sawmill/shared';
import { ArrowDownToLineIcon, ArrowUpFromLineIcon, FactoryIcon, RulerIcon } from 'lucide-react';
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
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 print:hidden">
      {actions.map((a) => (
        <Link
          key={a.to}
          to={a.to}
          className="flex min-h-14 items-center gap-3 rounded-xl border bg-card px-4 py-2 text-sm font-semibold shadow-card transition-all duration-200 ease-out outline-none hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift active:translate-y-0 active:shadow-card focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary [&_svg]:size-[1.125rem]">{a.icon}</span>
          <span className="min-w-0 leading-snug">{a.label}</span>
        </Link>
      ))}
    </div>
  );
}

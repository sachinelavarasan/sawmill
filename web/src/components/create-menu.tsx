import { Permission } from '@sawmill/shared';
import { ArrowDownToLineIcon, ArrowUpFromLineIcon, ChevronDownIcon, FactoryIcon, FileTextIcon, type LucideIcon, PlusIcon, ReceiptIndianRupeeIcon, RulerIcon, SlidersHorizontalIcon } from 'lucide-react';
import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAuth } from '../auth';
import { type TKey, useI18n } from '../i18n';

/** Everything that can be started from anywhere, in two groups: the mill floor, then money and reports. */
const ITEMS: { to: string; label: TKey; icon: LucideIcon; permission: Permission; group: 'floor' | 'office' }[] = [
  { to: '/imports/new', label: 'newImport', icon: ArrowDownToLineIcon, permission: Permission.OPERATIONS_CREATE, group: 'floor' },
  { to: '/measurement', label: 'measurement', icon: RulerIcon, permission: Permission.OPERATIONS_CREATE, group: 'floor' },
  { to: '/production/new', label: 'newProduction', icon: FactoryIcon, permission: Permission.OPERATIONS_CREATE, group: 'floor' },
  { to: '/exports/new', label: 'newExport', icon: ArrowUpFromLineIcon, permission: Permission.OPERATIONS_CREATE, group: 'floor' },
  { to: '/stock?tab=adjustments&new=1', label: 'newAdjustment', icon: SlidersHorizontalIcon, permission: Permission.OPERATIONS_CREATE, group: 'floor' },
  { to: '/accounts?new=expense', label: 'recordExpense', icon: ReceiptIndianRupeeIcon, permission: Permission.FINANCE_VIEW, group: 'office' },
  { to: '/reports', label: 'generateReport', icon: FileTextIcon, permission: Permission.REPORTS_OPERATIONAL, group: 'office' },
];

/** "Create": the quick-create menu in the top bar. Shows only what the signed-in person may start. */
export function CreateMenu({ className }: { className?: string }) {
  const { t } = useI18n();
  const { can } = useAuth();
  const items = ITEMS.filter((i) => can(i.permission));
  if (items.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className={cn('max-sm:size-11 max-sm:px-0', className)} aria-label={t('createMenu')}>
          <PlusIcon />
          <span className="max-sm:sr-only">{t('createMenu')}</span>
          <ChevronDownIcon className="-mr-1 opacity-70 max-sm:hidden" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">{t('createMenu')}</DropdownMenuLabel>
        {items.map((i, n) => (
          <Fragment key={i.to}>
            {n > 0 && items[n - 1].group !== i.group && <DropdownMenuSeparator />}
            <DropdownMenuItem asChild className="gap-3 py-2">
              <Link to={i.to}>
                <span className="grid size-7 place-items-center rounded-md bg-muted [&_svg]:size-4" aria-hidden>
                  <i.icon />
                </span>
                {t(i.label)}
              </Link>
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

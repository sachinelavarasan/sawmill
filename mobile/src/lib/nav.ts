/**
 * Navigation map, by permission — the same rules as the web menu (web/src/nav.ts).
 * The API checks every request again; hiding an item is only presentation.
 *
 * Bottom bar: Home · Loads in · Production · Loads out · More (the daily work).
 * Everything else (approvals, stock, reports, parties, money, admin) lives under More.
 */
import { Permission, type TKey } from '@timbertrail/shared';
import type { IconName } from '../components/icon';
import type { TileTone } from '../components/ui';

export interface MenuItem {
  key: string;
  href: string;
  labelKey: TKey;
  subKey?: TKey;
  icon: IconName;
  /** accent of its tile in the More launcher */
  tone?: TileTone;
  permission?: Permission;
  /** not offered to whoever holds this permission */
  unless?: Permission;
}

export const visible = (m: MenuItem, can: (p: Permission) => boolean) => (!m.permission || can(m.permission)) && !(m.unless && can(m.unless));

/** More tab, in groups. */
export const MORE_GROUPS: { labelKey: TKey; items: MenuItem[] }[] = [
  {
    labelKey: 'operations',
    items: [
      { key: 'approvals', href: '/more/approvals', labelKey: 'approvals', subKey: 'approvalsSubtitle', icon: 'check-circle', tone: 'saffron', permission: Permission.OPERATIONS_APPROVE },
      { key: 'inventory', href: '/inventory', labelKey: 'inventory', icon: 'boxes', tone: 'info' },
      { key: 'reports', href: '/reports', labelKey: 'reports', icon: 'bar-chart-2', tone: 'good' },
    ],
  },
  {
    labelKey: 'navParties',
    items: [
      { key: 'clients', href: '/more/clients', labelKey: 'clients', subKey: 'clientsSub', icon: 'users', tone: 'navy', permission: Permission.CLIENTS_MANAGE },
      { key: 'suppliers', href: '/more/suppliers', labelKey: 'suppliers', subKey: 'suppliersSub', icon: 'truck', tone: 'warn', permission: Permission.SUPPLIERS_MANAGE },
    ],
  },
  {
    labelKey: 'accounts',
    items: [
      { key: 'accounts', href: '/more/accounts', labelKey: 'accounts', subKey: 'accountsSub', icon: 'wallet', tone: 'good', permission: Permission.FINANCE_VIEW },
      { key: 'expenses', href: '/more/expenses', labelKey: 'otherExpenses', icon: 'receipt', tone: 'warn', permission: Permission.FINANCE_VIEW },
    ],
  },
  {
    labelKey: 'navAdmin',
    items: [
      { key: 'users', href: '/more/users', labelKey: 'users', subKey: 'usersSub', icon: 'user-check', tone: 'info', permission: Permission.USERS_MANAGE },
      { key: 'audit', href: '/more/audit', labelKey: 'auditLog', subKey: 'auditSub', icon: 'shield', tone: 'navy', permission: Permission.AUDIT_VIEW },
      { key: 'settings', href: '/more/settings', labelKey: 'settings', icon: 'settings-2', tone: 'neutral' },
    ],
  },
];

/** Quick Add sheet and the dashboard's quick actions. */
export const QUICK_ADD: MenuItem[] = [
  { key: 'newImport', href: '/imports/new', labelKey: 'newImport', icon: 'download', permission: Permission.OPERATIONS_CREATE },
  { key: 'measure', href: '/more/measurement', labelKey: 'measure', icon: 'edit-3', permission: Permission.OPERATIONS_CREATE },
  { key: 'newProduction', href: '/production/new', labelKey: 'newProduction', icon: 'settings', permission: Permission.OPERATIONS_CREATE },
  { key: 'newExport', href: '/exports/new', labelKey: 'newExport', icon: 'upload', permission: Permission.OPERATIONS_CREATE },
  { key: 'newAdjustment', href: '/stock/adjustments/new', labelKey: 'newAdjustment', icon: 'sliders', permission: Permission.OPERATIONS_CREATE },
  { key: 'addExpense', href: '/expenses/form', labelKey: 'addExpense', icon: 'receipt', permission: Permission.FINANCE_VIEW },
];

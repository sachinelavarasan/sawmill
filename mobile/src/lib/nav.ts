/**
 * Navigation map, by permission — the same rules as the web menu (web/src/nav.ts).
 * The API checks every request again; hiding an item is only presentation.
 *
 * Bottom bar: Home · Loads in · Production · Loads out · More (the daily work).
 * Everything else (parties, money, admin, preferences, security) lives under More.
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

/**
 * More tab, in four clean sections:
 *  - BUSINESS (Clients, Suppliers, Accounts, Other Expenses)
 *  - ADMINISTRATION (User Management, Audit Log, Mill Settings)
 *  - PREFERENCES & SECURITY (drawn in more/index.tsx)
 *  - ACCOUNT (drawn in more/index.tsx)
 */
export const MORE_GROUPS: { labelKey: TKey; items: MenuItem[] }[] = [
  {
    labelKey: 'operations',
    items: [
      { key: 'approvals', href: '/more/approvals', labelKey: 'pendingApprovals', icon: 'check-circle', permission: Permission.OPERATIONS_APPROVE },
      { key: 'inventory', href: '/inventory', labelKey: 'stock', icon: 'boxes' },
      { key: 'reports', href: '/reports', labelKey: 'reports', icon: 'bar-chart-2' },
    ],
  },
  {
    labelKey: 'secBusinessMenu',
    items: [
      { key: 'clients', href: '/more/clients', labelKey: 'clients', icon: 'users', permission: Permission.CLIENTS_MANAGE },
      { key: 'suppliers', href: '/more/suppliers', labelKey: 'suppliers', icon: 'truck', permission: Permission.SUPPLIERS_MANAGE },
      { key: 'accounts', href: '/more/accounts', labelKey: 'accounts', icon: 'wallet', permission: Permission.FINANCE_VIEW },
      { key: 'expenses', href: '/more/expenses', labelKey: 'otherExpenses', icon: 'receipt', permission: Permission.FINANCE_VIEW },
    ],
  },
  {
    labelKey: 'navAdmin',
    items: [
      { key: 'users', href: '/more/users', labelKey: 'userManagement', icon: 'user-check', permission: Permission.USERS_MANAGE },
      { key: 'audit', href: '/more/audit', labelKey: 'auditLog', icon: 'shield', permission: Permission.AUDIT_VIEW },
      { key: 'millSettings', href: '/mill-settings', labelKey: 'millSettings', icon: 'building', permission: Permission.SETTINGS_MANAGE },
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

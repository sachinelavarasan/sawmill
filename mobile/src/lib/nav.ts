/**
 * What each person can open, by permission — the same rules as the web menu (web/src/nav.ts).
 * The API checks every request again; hiding an item is only presentation.
 */
import type { Feather } from '@expo/vector-icons';
import { Permission, type TKey } from '@sawmill/shared';

type IconName = keyof typeof Feather.glyphMap;

export interface MenuItem {
  key: string;
  href: string;
  labelKey: TKey;
  subKey?: TKey;
  icon: IconName;
  permission?: Permission;
  /** not offered to whoever holds this permission */
  unless?: Permission;
}

export const visible = (m: MenuItem, can: (p: Permission) => boolean) => (!m.permission || can(m.permission)) && !(m.unless && can(m.unless));

/** Transactions tab. */
export const TRANSACTION_ITEMS: MenuItem[] = [
  { key: 'imports', href: '/transactions/imports', labelKey: 'imports', subKey: 'importsSub', icon: 'download', permission: Permission.OPERATIONS_CREATE },
  { key: 'measurement', href: '/transactions/measurement', labelKey: 'measurement', subKey: 'measurementSub', icon: 'edit-3', permission: Permission.OPERATIONS_CREATE },
  { key: 'production', href: '/transactions/production', labelKey: 'production', subKey: 'productionSub', icon: 'settings', permission: Permission.OPERATIONS_CREATE },
  { key: 'exports', href: '/transactions/exports', labelKey: 'exports', subKey: 'exportsSub', icon: 'upload', permission: Permission.OPERATIONS_CREATE },
  { key: 'approvals', href: '/transactions/approvals', labelKey: 'approvals', subKey: 'approvalsSubtitle', icon: 'check-circle', permission: Permission.OPERATIONS_APPROVE },
];

/** More tab, in groups. */
export const MORE_GROUPS: { labelKey: TKey; items: MenuItem[] }[] = [
  {
    labelKey: 'operations',
    items: [{ key: 'stock', href: '/more/stock', labelKey: 'stock', subKey: 'stockSub', icon: 'layers', permission: Permission.OPERATIONS_CREATE }],
  },
  {
    labelKey: 'navParties',
    items: [
      { key: 'clients', href: '/more/clients', labelKey: 'clients', subKey: 'clientsSub', icon: 'users', permission: Permission.CLIENTS_MANAGE },
      { key: 'suppliers', href: '/more/suppliers', labelKey: 'suppliers', subKey: 'suppliersSub', icon: 'truck', permission: Permission.SUPPLIERS_MANAGE },
    ],
  },
  {
    labelKey: 'accounts',
    items: [
      { key: 'expenses', href: '/more/expenses', labelKey: 'otherExpenses', icon: 'credit-card', permission: Permission.FINANCE_VIEW },
      { key: 'accounts', href: '/more/accounts', labelKey: 'accounts', subKey: 'accountsSub', icon: 'pie-chart', permission: Permission.FINANCE_VIEW },
    ],
  },
  {
    labelKey: 'navAdmin',
    items: [
      { key: 'users', href: '/more/users', labelKey: 'users', subKey: 'usersSub', icon: 'user-check', permission: Permission.USERS_MANAGE },
      { key: 'audit', href: '/more/audit', labelKey: 'auditLog', subKey: 'auditSub', icon: 'file-text', permission: Permission.AUDIT_VIEW },
      { key: 'settings', href: '/more/settings', labelKey: 'settings', icon: 'sliders' },
    ],
  },
];

/** Quick Add sheet. */
export const QUICK_ADD: MenuItem[] = [
  { key: 'newImport', href: '/imports/new', labelKey: 'newImport', icon: 'download', permission: Permission.OPERATIONS_CREATE },
  { key: 'measure', href: '/transactions/measurement', labelKey: 'measurement', icon: 'edit-3', permission: Permission.OPERATIONS_CREATE },
  { key: 'newProduction', href: '/production/new', labelKey: 'newProduction', icon: 'settings', permission: Permission.OPERATIONS_CREATE },
  { key: 'newExport', href: '/exports/new', labelKey: 'newExport', icon: 'upload', permission: Permission.OPERATIONS_CREATE },
  { key: 'newAdjustment', href: '/stock/adjustments/new', labelKey: 'newAdjustment', icon: 'sliders', permission: Permission.OPERATIONS_CREATE },
  { key: 'addExpense', href: '/expenses/form', labelKey: 'addExpense', icon: 'credit-card', permission: Permission.FINANCE_VIEW },
];

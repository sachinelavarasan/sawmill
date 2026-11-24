/**
 * Navigation map, by permission — the same rules as the web menu (web/src/nav.ts).
 * The API checks every request again; hiding an item is only presentation.
 *
 * Bottom bar (components/TabBar): owner Home · Approvals · Stock · Reports; accountant Home · My work · Stock.
 * The daily lists (loads in, production, loads out) open from Home's "Entries" row and from More;
 * everything else (parties, money, admin, preferences, security) lives under More.
 *
 * Simple view (web: nav.ts): plain names (`simple*` keys), and Reports, Accounts, expenses, Users
 * and Change History are hidden from More — hidden, not removed: a link to one still opens when the
 * person may see it, because permissions decide access, not the view.
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
  /** the plain name used in the simple view */
  simpleKey?: TKey;
  /** offered in one view only */
  only?: 'simple' | 'full';
}

export const visible = (m: MenuItem, can: (p: Permission) => boolean, simple = false) =>
  (!m.permission || can(m.permission)) && !(m.unless && can(m.unless)) && !(m.only === 'simple' && !simple) && !(m.only === 'full' && simple);

/** The name to show for an item in the current view. */
export const labelOf = (m: MenuItem, simple: boolean): TKey => (simple && m.simpleKey) || m.labelKey;

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
      // the daily lists (they have no button in the bottom bar), then the rest of the daily work
      { key: 'loadsIn', href: '/loads-in', labelKey: 'imports', simpleKey: 'simpleLoadIn', icon: 'truck' },
      { key: 'runs', href: '/runs', labelKey: 'production', simpleKey: 'simpleCut', icon: 'factory' },
      { key: 'loadsOut', href: '/loads-out', labelKey: 'exports', simpleKey: 'simpleLoadOut', icon: 'truck-out' },
      { key: 'measurement', href: '/more/measurement', labelKey: 'measurement', simpleKey: 'simpleMeasure', icon: 'ruler', only: 'simple' },
      { key: 'inventory', href: '/inventory', labelKey: 'stock', simpleKey: 'simpleStock', icon: 'boxes' },
      { key: 'approvals', href: '/more/approvals', labelKey: 'pendingApprovals', simpleKey: 'simpleApprove', icon: 'check-circle', permission: Permission.OPERATIONS_APPROVE },
      { key: 'reports', href: '/reports', labelKey: 'reports', icon: 'bar-chart-2', only: 'full' },
    ],
  },
  {
    labelKey: 'secBusinessMenu',
    items: [
      { key: 'clients', href: '/more/clients', labelKey: 'clients', icon: 'users', permission: Permission.CLIENTS_MANAGE },
      { key: 'suppliers', href: '/more/suppliers', labelKey: 'suppliers', icon: 'truck', permission: Permission.SUPPLIERS_MANAGE },
      { key: 'accounts', href: '/more/accounts', labelKey: 'accounts', icon: 'wallet', permission: Permission.FINANCE_VIEW, only: 'full' },
      { key: 'expenses', href: '/more/expenses', labelKey: 'otherExpenses', icon: 'receipt', permission: Permission.FINANCE_VIEW, only: 'full' },
    ],
  },
  {
    labelKey: 'navAdmin',
    items: [
      { key: 'users', href: '/more/users', labelKey: 'userManagement', icon: 'user-check', permission: Permission.USERS_MANAGE, only: 'full' },
      { key: 'audit', href: '/more/audit', labelKey: 'auditLog', icon: 'shield', permission: Permission.AUDIT_VIEW, only: 'full' },
      { key: 'millSettings', href: '/mill-settings', labelKey: 'millSettings', icon: 'building', permission: Permission.SETTINGS_MANAGE },
    ],
  },
];

/** Quick Add sheet and the dashboard's quick actions. */
export const QUICK_ADD: MenuItem[] = [
  { key: 'newImport', href: '/imports/new', labelKey: 'newImport', icon: 'truck', permission: Permission.OPERATIONS_CREATE },
  { key: 'measure', href: '/more/measurement', labelKey: 'measure', icon: 'edit-3', permission: Permission.OPERATIONS_CREATE },
  { key: 'newProduction', href: '/production/new', labelKey: 'newProduction', icon: 'settings', permission: Permission.OPERATIONS_CREATE },
  { key: 'newExport', href: '/exports/new', labelKey: 'newExport', icon: 'truck-out', permission: Permission.OPERATIONS_CREATE },
  { key: 'newAdjustment', href: '/stock/adjustments/new', labelKey: 'newAdjustment', icon: 'sliders', permission: Permission.OPERATIONS_CREATE },
  { key: 'addExpense', href: '/expenses/form', labelKey: 'addExpense', icon: 'receipt', permission: Permission.FINANCE_VIEW },
];

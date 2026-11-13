import { Permission } from '@sawmill/shared';
import type { IconName } from './components/ui';
import type { TKey } from './i18n';

export interface NavItem {
  path: string;
  labelKey: TKey;
  icon: IconName;
  permission: Permission;
  /** Phase in which the module is delivered; undefined = available now. */
  phase?: number;
  section: 'main' | 'owner';
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', labelKey: 'dashboard', icon: 'dashboard', permission: Permission.DASHBOARD_ACCOUNTANT, section: 'main' },
  { path: '/imports', labelKey: 'imports', icon: 'imports', permission: Permission.OPERATIONS_CREATE, section: 'main' },
  { path: '/measurement', labelKey: 'measurement', icon: 'measurement', permission: Permission.OPERATIONS_CREATE, section: 'main' },
  { path: '/production', labelKey: 'production', icon: 'production', permission: Permission.OPERATIONS_CREATE, phase: 4, section: 'main' },
  { path: '/stock', labelKey: 'stock', icon: 'stock', permission: Permission.OPERATIONS_CREATE, phase: 4, section: 'main' },
  { path: '/exports', labelKey: 'exports', icon: 'exports', permission: Permission.OPERATIONS_CREATE, phase: 5, section: 'main' },
  { path: '/reports', labelKey: 'reports', icon: 'reports', permission: Permission.REPORTS_OPERATIONAL, phase: 7, section: 'main' },

  { path: '/approvals', labelKey: 'approvals', icon: 'approvals', permission: Permission.OPERATIONS_APPROVE, phase: 6, section: 'owner' },
  { path: '/clients', labelKey: 'clients', icon: 'clients', permission: Permission.CLIENTS_MANAGE, phase: 5, section: 'owner' },
  { path: '/suppliers', labelKey: 'suppliers', icon: 'suppliers', permission: Permission.SUPPLIERS_MANAGE, section: 'owner' },
  { path: '/accounts', labelKey: 'accounts', icon: 'accounts', permission: Permission.FINANCE_VIEW, phase: 7, section: 'owner' },
  { path: '/users', labelKey: 'users', icon: 'users', permission: Permission.USERS_MANAGE, section: 'owner' },
  { path: '/audit', labelKey: 'auditLog', icon: 'audit', permission: Permission.AUDIT_VIEW, section: 'owner' },
];

import { Permission } from '@sawmill/shared';
import {
  ArrowDownToLineIcon,
  ArrowUpFromLineIcon,
  CheckCheckIcon,
  ClipboardListIcon,
  FactoryIcon,
  FileTextIcon,
  HandshakeIcon,
  IndianRupeeIcon,
  LayersIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  RulerIcon,
  ScrollTextIcon,
  SettingsIcon,
  TruckIcon,
  UsersIcon,
} from 'lucide-react';
import type { TKey } from './i18n';

export interface NavItem {
  path: string;
  labelKey: TKey;
  icon: LucideIcon;
  permission: Permission;
  /** not offered to whoever holds this permission ("My Entries" means nothing to someone who sees everyone's) */
  unless?: Permission;
  group: NavGroup;
}

/** Whether a menu item is offered to someone, given what they may do. */
export const navVisible = (n: NavItem, can: (p: Permission) => boolean) => can(n.permission) && !(n.unless && can(n.unless));

/** Sidebar groups, in order. The dashboard's group has no heading. */
export type NavGroup = 'overview' | 'operations' | 'insights' | 'parties' | 'admin';
export const NAV_GROUPS: { id: NavGroup; labelKey?: TKey }[] = [
  { id: 'overview' },
  { id: 'operations', labelKey: 'operations' },
  { id: 'insights', labelKey: 'navInsights' },
  { id: 'parties', labelKey: 'navParties' },
  { id: 'admin', labelKey: 'navAdmin' },
];

export const NAV_ITEMS: NavItem[] = [
  { path: '/', labelKey: 'dashboard', icon: LayoutDashboardIcon, permission: Permission.DASHBOARD_ACCOUNTANT, group: 'overview' },
  { path: '/imports', labelKey: 'imports', icon: ArrowDownToLineIcon, permission: Permission.OPERATIONS_CREATE, group: 'operations' },
  { path: '/measurement', labelKey: 'measurement', icon: RulerIcon, permission: Permission.OPERATIONS_CREATE, group: 'operations' },
  { path: '/production', labelKey: 'production', icon: FactoryIcon, permission: Permission.OPERATIONS_CREATE, group: 'operations' },
  { path: '/stock', labelKey: 'stock', icon: LayersIcon, permission: Permission.OPERATIONS_CREATE, group: 'operations' },
  { path: '/exports', labelKey: 'exports', icon: ArrowUpFromLineIcon, permission: Permission.OPERATIONS_CREATE, group: 'operations' },
  { path: '/approvals', labelKey: 'approvals', icon: CheckCheckIcon, permission: Permission.OPERATIONS_APPROVE, group: 'operations' },
  { path: '/my-entries', labelKey: 'myEntries', icon: ClipboardListIcon, permission: Permission.OPERATIONS_CREATE, unless: Permission.OPERATIONS_VIEW_ALL, group: 'operations' },
  { path: '/reports', labelKey: 'reports', icon: FileTextIcon, permission: Permission.REPORTS_OPERATIONAL, group: 'insights' },

  { path: '/clients', labelKey: 'clients', icon: HandshakeIcon, permission: Permission.CLIENTS_MANAGE, group: 'parties' },
  { path: '/suppliers', labelKey: 'suppliers', icon: TruckIcon, permission: Permission.SUPPLIERS_MANAGE, group: 'parties' },
  { path: '/accounts', labelKey: 'accounts', icon: IndianRupeeIcon, permission: Permission.FINANCE_VIEW, group: 'insights' },
  { path: '/users', labelKey: 'users', icon: UsersIcon, permission: Permission.USERS_MANAGE, group: 'admin' },
  { path: '/audit', labelKey: 'auditLog', icon: ScrollTextIcon, permission: Permission.AUDIT_VIEW, group: 'admin' },
  { path: '/settings', labelKey: 'settings', icon: SettingsIcon, permission: Permission.SETTINGS_MANAGE, group: 'admin' },
];

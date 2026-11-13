import { Permission } from '@sawmill/shared';
import {
  ArrowDownToLineIcon,
  ArrowUpFromLineIcon,
  CheckCheckIcon,
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
  section: 'main' | 'owner';
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', labelKey: 'dashboard', icon: LayoutDashboardIcon, permission: Permission.DASHBOARD_ACCOUNTANT, section: 'main' },
  { path: '/imports', labelKey: 'imports', icon: ArrowDownToLineIcon, permission: Permission.OPERATIONS_CREATE, section: 'main' },
  { path: '/measurement', labelKey: 'measurement', icon: RulerIcon, permission: Permission.OPERATIONS_CREATE, section: 'main' },
  { path: '/production', labelKey: 'production', icon: FactoryIcon, permission: Permission.OPERATIONS_CREATE, section: 'main' },
  { path: '/stock', labelKey: 'stock', icon: LayersIcon, permission: Permission.OPERATIONS_CREATE, section: 'main' },
  { path: '/exports', labelKey: 'exports', icon: ArrowUpFromLineIcon, permission: Permission.OPERATIONS_CREATE, section: 'main' },
  { path: '/reports', labelKey: 'reports', icon: FileTextIcon, permission: Permission.REPORTS_OPERATIONAL, section: 'main' },

  { path: '/approvals', labelKey: 'approvals', icon: CheckCheckIcon, permission: Permission.OPERATIONS_APPROVE, section: 'owner' },
  { path: '/clients', labelKey: 'clients', icon: HandshakeIcon, permission: Permission.CLIENTS_MANAGE, section: 'owner' },
  { path: '/suppliers', labelKey: 'suppliers', icon: TruckIcon, permission: Permission.SUPPLIERS_MANAGE, section: 'owner' },
  { path: '/accounts', labelKey: 'accounts', icon: IndianRupeeIcon, permission: Permission.FINANCE_VIEW, section: 'owner' },
  { path: '/users', labelKey: 'users', icon: UsersIcon, permission: Permission.USERS_MANAGE, section: 'owner' },
  { path: '/audit', labelKey: 'auditLog', icon: ScrollTextIcon, permission: Permission.AUDIT_VIEW, section: 'owner' },
  { path: '/settings', labelKey: 'settings', icon: SettingsIcon, permission: Permission.SETTINGS_MANAGE, section: 'owner' },
];

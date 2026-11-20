import { Permission } from '@timbertrail/shared';
import {
  BoxesIcon,
  ChartNoAxesColumnIcon,
  CircleCheckIcon,
  ClipboardListIcon,
  DownloadIcon,
  FactoryIcon,
  HouseIcon,
  type LucideIcon,
  PencilLineIcon,
  Settings2Icon,
  ShieldIcon,
  TruckIcon,
  UploadIcon,
  UserCheckIcon,
  UsersIcon,
  WalletIcon,
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
  /**
   * Sections of the page, shown nested under the item when it is expanded: each opens the page on
   * that tab (`?tab=`). The first is the page's default tab, so it links to the bare path.
   */
  children?: { tab: string; labelKey: TKey }[];
  /** kept out of the groups: shown in the sidebar's footer, beside the profile and sign-out */
  footer?: boolean;
}

/** Whether a menu item is offered to someone, given what they may do. */
export const navVisible = (n: NavItem, can: (p: Permission) => boolean) => can(n.permission) && !(n.unless && can(n.unless));

/**
 * Sidebar groups, in order — the same map as the Android app (mobile/src/lib/nav.ts):
 * the first group is its bottom bar (Home · Inventory · Production · Reports) and has no heading;
 * the rest are the groups of its More tab (Operations · Parties · Accounts · Admin).
 */
export type NavGroup = 'main' | 'operations' | 'parties' | 'accounts' | 'admin';
export const NAV_GROUPS: { id: NavGroup; labelKey?: TKey }[] = [
  { id: 'main' },
  { id: 'operations', labelKey: 'operations' },
  { id: 'parties', labelKey: 'navParties' },
  { id: 'accounts', labelKey: 'accounts' },
  { id: 'admin', labelKey: 'navAdmin' },
];

export const NAV_ITEMS: NavItem[] = [
  // the Android bottom bar
  { path: '/', labelKey: 'home', icon: HouseIcon, permission: Permission.DASHBOARD_ACCOUNTANT, group: 'main' },
  {
    path: '/stock',
    labelKey: 'inventory',
    icon: BoxesIcon,
    permission: Permission.OPERATIONS_CREATE,
    group: 'main',
    // the Stock page's tabs (pages/Stock.tsx TABS), reachable straight from the menu
    children: [
      { tab: 'raw', labelKey: 'raw' },
      { tab: 'finished', labelKey: 'finished' },
      { tab: 'adjustments', labelKey: 'adjustments' },
      { tab: 'movements', labelKey: 'movements' },
    ],
  },
  { path: '/production', labelKey: 'production', icon: FactoryIcon, permission: Permission.OPERATIONS_CREATE, group: 'main' },
  { path: '/reports', labelKey: 'reports', icon: ChartNoAxesColumnIcon, permission: Permission.REPORTS_OPERATIONAL, group: 'main' },

  // More › Operations
  { path: '/approvals', labelKey: 'approvals', icon: CircleCheckIcon, permission: Permission.OPERATIONS_APPROVE, group: 'operations' },
  { path: '/imports', labelKey: 'imports', icon: DownloadIcon, permission: Permission.OPERATIONS_CREATE, group: 'operations' },
  { path: '/measurement', labelKey: 'measurement', icon: PencilLineIcon, permission: Permission.OPERATIONS_CREATE, group: 'operations' },
  { path: '/exports', labelKey: 'exports', icon: UploadIcon, permission: Permission.OPERATIONS_CREATE, group: 'operations' },
  { path: '/my-entries', labelKey: 'myEntries', icon: ClipboardListIcon, permission: Permission.OPERATIONS_CREATE, unless: Permission.OPERATIONS_VIEW_ALL, group: 'operations' },

  // More › Parties
  { path: '/clients', labelKey: 'clients', icon: UsersIcon, permission: Permission.CLIENTS_MANAGE, group: 'parties' },
  { path: '/suppliers', labelKey: 'suppliers', icon: TruckIcon, permission: Permission.SUPPLIERS_MANAGE, group: 'parties' },

  // More › Accounts
  { path: '/accounts', labelKey: 'accounts', icon: WalletIcon, permission: Permission.FINANCE_VIEW, group: 'accounts' },

  // More › Admin
  { path: '/users', labelKey: 'users', icon: UserCheckIcon, permission: Permission.USERS_MANAGE, group: 'admin' },
  { path: '/audit', labelKey: 'auditLog', icon: ShieldIcon, permission: Permission.AUDIT_VIEW, group: 'admin' },
  { path: '/settings', labelKey: 'settings', icon: Settings2Icon, permission: Permission.SETTINGS_MANAGE, group: 'admin', footer: true },
];

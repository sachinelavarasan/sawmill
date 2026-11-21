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
  children?: { tab: string; labelKey: TKey; /** kept in the simple view */ simple?: boolean }[];
  /**
   * Kept in the simple view (the default for everyone: only the daily core work). `order` places it
   * in that view's one flat list, in the order the work is done; `labelKey` is its shorter, plainer name there.
   */
  simple?: { order: number; labelKey?: TKey };
  /** kept out of the groups: shown in the sidebar's footer, beside the profile and sign-out */
  footer?: boolean;
}

/**
 * The menu section a page belongs to. A load opened from Measure Logs (`?from=measure`) is shown as
 * part of Measure Logs — highlighted there, and its back link and breadcrumb lead there — not Load In.
 */
export const sectionPath = (pathname: string, search: string) =>
  pathname.startsWith('/imports/') && new URLSearchParams(search).get('from') === 'measure' ? '/measurement' : pathname;

/** Whether a menu item is offered to someone, given what they may do. */
export const navVisible = (n: NavItem, can: (p: Permission) => boolean, simple = false) =>
  can(n.permission) && !(n.unless && can(n.unless)) && (!simple || !!n.simple);

/** The items someone is offered in the simple view: one flat list in the order the day's work is done, with the plain names. */
export const simpleNav = (can: (p: Permission) => boolean): NavItem[] =>
  NAV_ITEMS.filter((n) => navVisible(n, can, true))
    .sort((a, b) => a.simple!.order - b.simple!.order)
    .map((n) => ({
      ...n,
      labelKey: n.simple!.labelKey ?? n.labelKey,
      children: n.children?.filter((c) => c.simple),
    }));

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
  { path: '/', labelKey: 'home', icon: HouseIcon, permission: Permission.DASHBOARD_ACCOUNTANT, group: 'main', simple: { order: 0 } },
  {
    path: '/stock',
    labelKey: 'inventory',
    icon: BoxesIcon,
    permission: Permission.OPERATIONS_CREATE,
    group: 'main',
    simple: { order: 5, labelKey: 'simpleStock' },
    // the Stock page's tabs (pages/Stock.tsx TABS), reachable straight from the menu
    children: [
      { tab: 'raw', labelKey: 'raw', simple: true },
      { tab: 'finished', labelKey: 'finished', simple: true },
      { tab: 'adjustments', labelKey: 'adjustments' },
      { tab: 'movements', labelKey: 'movements' },
    ],
  },
  { path: '/production', labelKey: 'production', icon: FactoryIcon, permission: Permission.OPERATIONS_CREATE, group: 'main', simple: { order: 3, labelKey: 'simpleCut' } },
  { path: '/reports', labelKey: 'reports', icon: ChartNoAxesColumnIcon, permission: Permission.REPORTS_OPERATIONAL, group: 'main' },

  // More › Operations
  { path: '/approvals', labelKey: 'approvals', icon: CircleCheckIcon, permission: Permission.OPERATIONS_APPROVE, group: 'operations', simple: { order: 6, labelKey: 'simpleApprove' } },
  { path: '/imports', labelKey: 'imports', icon: DownloadIcon, permission: Permission.OPERATIONS_CREATE, group: 'operations', simple: { order: 1, labelKey: 'simpleLoadIn' } },
  { path: '/measurement', labelKey: 'measurement', icon: PencilLineIcon, permission: Permission.OPERATIONS_CREATE, group: 'operations', simple: { order: 2, labelKey: 'simpleMeasure' } },
  { path: '/exports', labelKey: 'exports', icon: UploadIcon, permission: Permission.OPERATIONS_CREATE, group: 'operations', simple: { order: 4, labelKey: 'simpleLoadOut' } },
  { path: '/my-entries', labelKey: 'myEntries', icon: ClipboardListIcon, permission: Permission.OPERATIONS_CREATE, unless: Permission.OPERATIONS_VIEW_ALL, group: 'operations' },

  // More › Parties
  { path: '/clients', labelKey: 'clients', icon: UsersIcon, permission: Permission.CLIENTS_MANAGE, group: 'parties', simple: { order: 7 } },
  { path: '/suppliers', labelKey: 'suppliers', icon: TruckIcon, permission: Permission.SUPPLIERS_MANAGE, group: 'parties', simple: { order: 8 } },

  // More › Accounts
  { path: '/accounts', labelKey: 'accounts', icon: WalletIcon, permission: Permission.FINANCE_VIEW, group: 'accounts' },

  // More › Admin
  { path: '/users', labelKey: 'users', icon: UserCheckIcon, permission: Permission.USERS_MANAGE, group: 'admin' },
  { path: '/audit', labelKey: 'auditLog', icon: ShieldIcon, permission: Permission.AUDIT_VIEW, group: 'admin' },
  // open to everyone: each person's own preferences (view, language); the mill's settings inside stay owner-only
  { path: '/settings', labelKey: 'settings', icon: Settings2Icon, permission: Permission.DASHBOARD_ACCOUNTANT, group: 'admin', footer: true, simple: { order: 99 } },
];

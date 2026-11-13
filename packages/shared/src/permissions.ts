import { Role } from './roles';

/**
 * Single source of truth for what each role may do.
 * The backend enforces these on every route; the clients only use them to
 * decide what to show.
 */
export const Permission = {
  DASHBOARD_OWNER: 'dashboard:owner',
  DASHBOARD_ACCOUNTANT: 'dashboard:accountant',
  USERS_MANAGE: 'users:manage',
  AUDIT_VIEW: 'audit:view',
  SETTINGS_MANAGE: 'settings:manage',
  OPERATIONS_CREATE: 'operations:create',
  OPERATIONS_VIEW_ALL: 'operations:view_all',
  OPERATIONS_SUBMIT: 'operations:submit',
  OPERATIONS_APPROVE: 'operations:approve',
  OPERATIONS_EDIT_APPROVED: 'operations:edit_approved',
  FINANCE_VIEW: 'finance:view',
  CLIENTS_MANAGE: 'clients:manage',
  SUPPLIERS_MANAGE: 'suppliers:manage',
  REPORTS_OPERATIONAL: 'reports:operational',
  REPORTS_FINANCIAL: 'reports:financial',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

const ALL_PERMISSIONS = Object.values(Permission) as Permission[];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [Role.OWNER]: ALL_PERMISSIONS,
  [Role.ACCOUNTANT]: [
    Permission.DASHBOARD_ACCOUNTANT,
    Permission.OPERATIONS_CREATE,
    Permission.OPERATIONS_SUBMIT,
    Permission.REPORTS_OPERATIONAL,
  ],
};

export function hasPermission(role: Role | string | undefined | null, permission: Permission): boolean {
  if (!role || !(role in ROLE_PERMISSIONS)) return false;
  return ROLE_PERMISSIONS[role as Role].includes(permission);
}

export function hasAllPermissions(role: Role | string | undefined | null, permissions: readonly Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ACCOUNTANT_EDITABLE_STATUSES, hasPermission, Permission } from '@sawmill/shared';
import type { ApprovalStatus } from '../db/schema';
import type { AuthUser } from './types';

interface ApprovableRecord {
  createdById: string;
  status: ApprovalStatus;
}

/** Can this user see the record at all? Accountants see only their own entries. */
export function canView(user: AuthUser, record: { createdById: string }): boolean {
  return hasPermission(user.role, Permission.OPERATIONS_VIEW_ALL) || record.createdById === user.id;
}

export function assertVisible<T extends { createdById: string }>(user: AuthUser, record: T | undefined): T {
  // Hidden records are reported as "not found" so their existence isn't leaked.
  if (!record || !canView(user, record)) throw new NotFoundException('Entry not found');
  return record;
}

/** Can this user change the record right now? (UI hint; the API re-checks with assertEditable) */
export function canEdit(user: AuthUser, record: ApprovableRecord): boolean {
  if (hasPermission(user.role, Permission.OPERATIONS_EDIT_APPROVED)) return true;
  return record.createdById === user.id && ACCOUNTANT_EDITABLE_STATUSES.includes(record.status);
}

/**
 * Throws unless the user may modify the record.
 * Returns the audit action to record: OWNER_EDIT when the owner changes a
 * submitted/approved record, UPDATE otherwise.
 */
export function assertEditable(user: AuthUser, record: ApprovableRecord): 'UPDATE' | 'OWNER_EDIT' {
  if (hasPermission(user.role, Permission.OPERATIONS_EDIT_APPROVED)) {
    return record.status === 'DRAFT' || record.status === 'REJECTED' ? 'UPDATE' : 'OWNER_EDIT';
  }
  if (record.createdById !== user.id) throw new ForbiddenException('You can only edit your own entries');
  if (!ACCOUNTANT_EDITABLE_STATUSES.includes(record.status)) {
    throw new ConflictException('This entry has been submitted and can no longer be edited');
  }
  return 'UPDATE';
}

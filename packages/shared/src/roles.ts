export const Role = {
  OWNER: 'OWNER',
  ACCOUNTANT: 'ACCOUNTANT',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const ApprovalStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type ApprovalStatus = (typeof ApprovalStatus)[keyof typeof ApprovalStatus];

/** Statuses in which an accountant may still edit their own record. */
export const ACCOUNTANT_EDITABLE_STATUSES: readonly ApprovalStatus[] = [
  ApprovalStatus.DRAFT,
  ApprovalStatus.REJECTED,
];

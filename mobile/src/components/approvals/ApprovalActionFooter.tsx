import { WorkflowBar } from '../workflow';

/**
 * Confirmation-gated Approve / Reject decision footer for record review screens.
 * Delegates directly to WorkflowBar so all backend approval rules and stock postings are preserved.
 */
export function ApprovalActionFooter({
  base,
  code,
  status,
  canSubmit,
  canReview,
  confirmApprove,
  submitBlocked,
  approvedNote,
  onDone,
}: {
  base: string;
  code: string;
  status: string;
  canSubmit: boolean;
  canReview: boolean;
  confirmApprove: string;
  submitBlocked?: string | null;
  approvedNote?: string;
  onDone: () => void;
}) {
  return (
    <WorkflowBar
      base={base}
      code={code}
      status={status}
      canSubmit={canSubmit}
      canReview={canReview}
      confirmApprove={confirmApprove}
      submitBlocked={submitBlocked}
      approvedNote={approvedNote}
      onDone={onDone}
    />
  );
}

import type {
  Approval,
  ApprovalActionSnapshot,
  ProposedAction,
} from "../types";

export function snapshotAction(action: ProposedAction): ApprovalActionSnapshot {
  return {
    actionId: action.id,
    actionType: action.type,
    resource: action.resource,
    ...(action.amount === undefined ? {} : { amount: action.amount }),
    ...(action.currency === undefined ? {} : { currency: action.currency }),
    ...(action.quoteId === undefined ? {} : { quoteId: action.quoteId }),
    nonce: action.nonce,
  };
}

export function approvalMatchesAction(
  approval: Approval,
  policyId: string,
  action: ProposedAction,
  now: number,
): boolean {
  if (approval.policyId !== policyId) {
    return false;
  }

  if (approval.expiresAt !== undefined && approval.expiresAt <= now) {
    return false;
  }

  const snapshot = snapshotAction(action);

  return (
    approval.action.actionId === snapshot.actionId &&
    approval.action.actionType === snapshot.actionType &&
    approval.action.resource === snapshot.resource &&
    approval.action.amount === snapshot.amount &&
    approval.action.currency === snapshot.currency &&
    approval.action.quoteId === snapshot.quoteId &&
    approval.action.nonce === snapshot.nonce
  );
}

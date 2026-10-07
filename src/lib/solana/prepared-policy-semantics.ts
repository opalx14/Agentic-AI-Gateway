/**
 * Semantic equality helper for a prepared Solana policy transaction.
 *
 * The fields that constitute "what the user reviewed" are all fields that
 * encode the Anchor instruction payload – network, program, instruction type,
 * on-chain accounts, and the three hashes that commit the budget/goal/actions.
 *
 * Mutable transport fields (transactionBase64, blockhash,
 * lastValidBlockHeight, policyIdHex) are intentionally excluded: they change
 * on every prepare call even when the semantic intent is identical.
 */

export type PreparedPolicySemantics = {
  network: string;
  programId: string;
  instruction: string;
  authority: string;
  policyPda: string;
  totalBudget: number;
  maxPerAction: number;
  autoApproveMax: number;
  expiresAt: number;
  goalHashHex: string;
  allowedActionsHashHex: string;
};

/**
 * Returns true only when every semantic field of `fresh` is identical to
 * the corresponding field in `reviewed`.  Returns false (never throws) so
 * callers can treat any falsy result as "fail closed".
 */
export function preparedPolicySemanticsMatch(
  reviewed: PreparedPolicySemantics,
  fresh: PreparedPolicySemantics,
): boolean {
  return (
    reviewed.network === fresh.network &&
    reviewed.programId === fresh.programId &&
    reviewed.instruction === fresh.instruction &&
    reviewed.authority === fresh.authority &&
    reviewed.policyPda === fresh.policyPda &&
    reviewed.totalBudget === fresh.totalBudget &&
    reviewed.maxPerAction === fresh.maxPerAction &&
    reviewed.autoApproveMax === fresh.autoApproveMax &&
    reviewed.expiresAt === fresh.expiresAt &&
    reviewed.goalHashHex === fresh.goalHashHex &&
    reviewed.allowedActionsHashHex === fresh.allowedActionsHashHex
  );
}

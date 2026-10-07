import { approvalMatchesAction } from "../approval";
import type {
  AgentIdentity,
  Approval,
  Policy,
  PolicyDecision,
  ProposedAction,
} from "../types";

export interface EvaluatePolicyInput {
  agent: AgentIdentity;
  action: ProposedAction;
  policy: Policy;
  riskScore: number;
  approval?: Approval;
  now?: number;
}

function block(rule: string, reason: string): PolicyDecision {
  return {
    decision: "BLOCK",
    reasons: [reason],
    violatedRules: [rule],
    requiresApproval: false,
  };
}

export function evaluatePolicy(input: EvaluatePolicyInput): PolicyDecision {
  const now = input.now ?? Date.now();
  const { agent, action, policy, riskScore, approval } = input;

  if (!policy.active) {
    return block("POLICY_INACTIVE", "Policy is inactive or revoked.");
  }

  if (policy.expiresAt !== undefined && policy.expiresAt <= now) {
    return block("POLICY_EXPIRED", "Policy has expired.");
  }

  if (action.expiresAt !== undefined && action.expiresAt <= now) {
    return block("ACTION_EXPIRED", "Proposed action has expired.");
  }

  if (policy.agentId !== agent.id) {
    return block("WRONG_AGENT", "Agent is not delegated by this policy.");
  }

  if (
    policy.allowedRoles.length > 0 &&
    !agent.roles.some((role) => policy.allowedRoles.includes(role))
  ) {
    return block("ROLE_NOT_ALLOWED", "Agent role is not allowed by this policy.");
  }

  if (!policy.allowedActionTypes.includes(action.type)) {
    return block(
      "ACTION_NOT_ALLOWED",
      "Action type is not allowed by this policy.",
    );
  }

  if (policy.consumedNonces.includes(action.nonce)) {
    return block("NONCE_REPLAY", "Action nonce has already been consumed.");
  }

  const amount = action.amount ?? 0;

  if (
    policy.maxPerAction !== undefined &&
    amount > policy.maxPerAction
  ) {
    return block(
      "MAX_PER_ACTION_EXCEEDED",
      "Action amount exceeds the hard per-action limit.",
    );
  }

  if (
    policy.maxTotal !== undefined &&
    policy.spentAmount + amount > policy.maxTotal
  ) {
    return block(
      "TOTAL_BUDGET_EXCEEDED",
      "Action would exceed the total policy budget.",
    );
  }

  if (riskScore >= policy.riskThresholds.blockAt) {
    return block(
      "RISK_BLOCK_THRESHOLD",
      "Action risk score reaches the hard block threshold.",
    );
  }

  const approvalRequired =
    (policy.approvalAbove !== undefined &&
      amount > policy.approvalAbove) ||
    riskScore >= policy.riskThresholds.escalateAt;

  if (approvalRequired) {
    if (!approval) {
      return {
        decision: "ESCALATE",
        reasons: ["Action requires explicit human approval."],
        violatedRules: [],
        requiresApproval: true,
      };
    }

    if (!approvalMatchesAction(approval, policy.id, action, now)) {
      return {
        decision: "ESCALATE",
        reasons: [
          "Existing approval does not match the exact current action.",
        ],
        violatedRules: ["APPROVAL_INVALIDATED"],
        requiresApproval: true,
      };
    }
  }

  return {
    decision: "ALLOW",
    reasons: ["Action is inside delegated authority."],
    violatedRules: [],
    requiresApproval: false,
  };
}

export function evaluatePolicyFailClosed(
  input: EvaluatePolicyInput,
): PolicyDecision {
  try {
    return evaluatePolicy(input);
  } catch {
    return {
      decision: "BLOCK",
      reasons: ["Policy evaluation failed closed."],
      violatedRules: ["POLICY_EVALUATION_ERROR"],
      requiresApproval: false,
    };
  }
}

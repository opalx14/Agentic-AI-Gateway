export type Decision = "ALLOW" | "BLOCK" | "ESCALATE";

export interface AgentIdentity {
  id: string;
  roles: string[];
  publicKey?: string;
}

export interface Goal {
  id: string;
  description: string;
  hash?: string;
}

export interface ProposedAction {
  id: string;
  type: string;
  resource: string;
  amount?: number;
  currency?: string;
  payload: Record<string, unknown>;
  reason: string;
  quoteId?: string;
  nonce: string;
  expiresAt?: number;
}

export interface PolicyRiskThresholds {
  escalateAt: number;
  blockAt: number;
}

export interface Policy {
  id: string;
  agentId: string;
  allowedRoles: string[];
  allowedActionTypes: string[];
  maxPerAction?: number;
  maxTotal?: number;
  spentAmount: number;
  approvalAbove?: number;
  expiresAt?: number;
  active: boolean;
  riskThresholds: PolicyRiskThresholds;
  consumedNonces: string[];
}

export interface ApprovalActionSnapshot {
  actionId: string;
  actionType: string;
  resource: string;
  amount?: number;
  currency?: string;
  quoteId?: string;
  nonce: string;
}

export interface Approval {
  id: string;
  policyId: string;
  approvedBy: string;
  approvedAt: number;
  expiresAt?: number;
  action: ApprovalActionSnapshot;
}

export interface PolicyDecision {
  decision: Decision;
  reasons: string[];
  violatedRules: string[];
  requiresApproval: boolean;
}

export interface ExecutionReceipt {
  actionId: string;
  policyId: string;
  status: "EXECUTED" | "FAILED" | "REJECTED";
  providerRef?: string;
  txSignature?: string;
  timestamp: number;
}

export type ExecutionTraceStepName =
  | "observation_received"
  | "context_built"
  | "action_proposed"
  | "schema_validated"
  | "policy_evaluated"
  | "approval_required"
  | "approval_received"
  | "execution_started"
  | "execution_completed"
  | "receipt_recorded";

export interface ExecutionTraceStep {
  name: ExecutionTraceStepName;
  status: "SUCCESS" | "PENDING" | "FAILED";
  timestamp: number;
  detail?: string;
}

export interface ExecutionTrace {
  id: string;
  scenarioId: string;
  actionId: string;
  steps: ExecutionTraceStep[];
}

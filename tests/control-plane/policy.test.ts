import { describe, expect, test } from "bun:test";

import {
  evaluatePolicy,
  evaluatePolicyFailClosed,
  snapshotAction,
  type AgentIdentity,
  type Approval,
  type Policy,
  type ProposedAction,
} from "../../src/control-plane";

const NOW = 1_800_000_000_000;

const agent: AgentIdentity = {
  id: "agent-warehouse-1",
  roles: ["WarehouseRebalancer"],
};

function makeAction(
  overrides: Partial<ProposedAction> = {},
): ProposedAction {
  return {
    id: "action-1",
    type: "inventory.transfer",
    resource: "warehouse:HCM",
    amount: 2_000,
    currency: "USD",
    payload: { quantity: 100 },
    reason: "Prevent projected stockout",
    nonce: "nonce-1",
    expiresAt: NOW + 60_000,
    ...overrides,
  };
}

function makePolicy(overrides: Partial<Policy> = {}): Policy {
  return {
    id: "policy-1",
    agentId: agent.id,
    allowedRoles: ["WarehouseRebalancer"],
    allowedActionTypes: ["inventory.transfer"],
    maxPerAction: 10_000,
    maxTotal: 50_000,
    spentAmount: 5_000,
    approvalAbove: 5_000,
    expiresAt: NOW + 60_000,
    active: true,
    riskThresholds: {
      escalateAt: 60,
      blockAt: 90,
    },
    consumedNonces: [],
    ...overrides,
  };
}

describe("deterministic policy engine", () => {
  test("allows an authorized action inside limits", () => {
    const decision = evaluatePolicy({
      agent,
      action: makeAction(),
      policy: makePolicy(),
      riskScore: 20,
      now: NOW,
    });

    expect(decision.decision).toBe("ALLOW");
    expect(decision.requiresApproval).toBe(false);
  });

  test("blocks an unauthorized action type", () => {
    const decision = evaluatePolicy({
      agent,
      action: makeAction({ type: "shipment.delete" }),
      policy: makePolicy(),
      riskScore: 20,
      now: NOW,
    });

    expect(decision.decision).toBe("BLOCK");
    expect(decision.violatedRules).toContain("ACTION_NOT_ALLOWED");
  });

  test("blocks an expired policy", () => {
    const decision = evaluatePolicy({
      agent,
      action: makeAction(),
      policy: makePolicy({ expiresAt: NOW }),
      riskScore: 20,
      now: NOW,
    });

    expect(decision.decision).toBe("BLOCK");
    expect(decision.violatedRules).toContain("POLICY_EXPIRED");
  });

  test("blocks the wrong delegated agent", () => {
    const decision = evaluatePolicy({
      agent: { ...agent, id: "agent-other" },
      action: makeAction(),
      policy: makePolicy(),
      riskScore: 20,
      now: NOW,
    });

    expect(decision.decision).toBe("BLOCK");
    expect(decision.violatedRules).toContain("WRONG_AGENT");
  });

  test("blocks a hard per-action limit violation", () => {
    const decision = evaluatePolicy({
      agent,
      action: makeAction({ amount: 10_001 }),
      policy: makePolicy(),
      riskScore: 20,
      now: NOW,
    });

    expect(decision.decision).toBe("BLOCK");
    expect(decision.violatedRules).toContain("MAX_PER_ACTION_EXCEEDED");
  });

  test("blocks a total budget violation", () => {
    const decision = evaluatePolicy({
      agent,
      action: makeAction({ amount: 6_000 }),
      policy: makePolicy({
        maxTotal: 10_000,
        spentAmount: 5_000,
      }),
      riskScore: 20,
      now: NOW,
    });

    expect(decision.decision).toBe("BLOCK");
    expect(decision.violatedRules).toContain("TOTAL_BUDGET_EXCEEDED");
  });

  test("blocks a replayed nonce", () => {
    const decision = evaluatePolicy({
      agent,
      action: makeAction(),
      policy: makePolicy({ consumedNonces: ["nonce-1"] }),
      riskScore: 20,
      now: NOW,
    });

    expect(decision.decision).toBe("BLOCK");
    expect(decision.violatedRules).toContain("NONCE_REPLAY");
  });

  test("escalates an action above the automatic approval threshold", () => {
    const decision = evaluatePolicy({
      agent,
      action: makeAction({ amount: 8_000 }),
      policy: makePolicy(),
      riskScore: 20,
      now: NOW,
    });

    expect(decision.decision).toBe("ESCALATE");
    expect(decision.requiresApproval).toBe(true);
  });

  test("allows an escalated action after exact approval", () => {
    const action = makeAction({ amount: 8_000 });
    const approval: Approval = {
      id: "approval-1",
      policyId: "policy-1",
      approvedBy: "manager-1",
      approvedAt: NOW,
      expiresAt: NOW + 30_000,
      action: snapshotAction(action),
    };

    const decision = evaluatePolicy({
      agent,
      action,
      policy: makePolicy(),
      riskScore: 20,
      approval,
      now: NOW,
    });

    expect(decision.decision).toBe("ALLOW");
  });

  test("invalidates approval when the amount changes", () => {
    const approvedAction = makeAction({ amount: 8_000 });
    const approval: Approval = {
      id: "approval-1",
      policyId: "policy-1",
      approvedBy: "manager-1",
      approvedAt: NOW,
      action: snapshotAction(approvedAction),
    };

    const changedAction = makeAction({ amount: 8_500 });

    const decision = evaluatePolicy({
      agent,
      action: changedAction,
      policy: makePolicy(),
      riskScore: 20,
      approval,
      now: NOW,
    });

    expect(decision.decision).toBe("ESCALATE");
    expect(decision.violatedRules).toContain("APPROVAL_INVALIDATED");
  });

  test("invalidates approval when the provider quote changes", () => {
    const approvedAction = makeAction({
      amount: 8_000,
      quoteId: "quote-old",
    });
    const approval: Approval = {
      id: "approval-quote",
      policyId: "policy-1",
      approvedBy: "manager-1",
      approvedAt: NOW,
      action: snapshotAction(approvedAction),
    };

    const changedAction = makeAction({
      amount: 8_000,
      quoteId: "quote-new",
    });

    const decision = evaluatePolicy({
      agent,
      action: changedAction,
      policy: makePolicy(),
      riskScore: 20,
      approval,
      now: NOW,
    });

    expect(decision.decision).toBe("ESCALATE");
    expect(decision.violatedRules).toContain("APPROVAL_INVALIDATED");
  });

  test("blocks risk at the hard threshold", () => {
    const decision = evaluatePolicy({
      agent,
      action: makeAction(),
      policy: makePolicy(),
      riskScore: 95,
      now: NOW,
    });

    expect(decision.decision).toBe("BLOCK");
    expect(decision.violatedRules).toContain("RISK_BLOCK_THRESHOLD");
  });

  test("fails closed when policy evaluation throws unexpectedly", () => {
    const invalidPolicy = {
      ...makePolicy(),
      allowedActionTypes: null,
    } as unknown as Policy;

    const decision = evaluatePolicyFailClosed({
      agent,
      action: makeAction(),
      policy: invalidPolicy,
      riskScore: 20,
      now: NOW,
    });

    expect(decision.decision).toBe("BLOCK");
    expect(decision.violatedRules).toContain("POLICY_EVALUATION_ERROR");
  });
});

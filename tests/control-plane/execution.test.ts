import { describe, expect, test } from "bun:test";

import {
  executeAuthorizedAction,
  type PolicyDecision,
  type ProposedAction,
} from "../../src/control-plane";

const action: ProposedAction = {
  id: "action-1",
  type: "inventory.transfer",
  resource: "warehouse:HCM",
  amount: 1_000,
  currency: "USD",
  payload: {},
  reason: "test",
  nonce: "nonce-1",
};

describe("execution guard", () => {
  test("does not invoke an executor for a non-ALLOW decision", async () => {
    let called = false;
    const decision: PolicyDecision = {
      decision: "ESCALATE",
      reasons: ["approval required"],
      violatedRules: [],
      requiresApproval: true,
    };

    const receipt = await executeAuthorizedAction({
      action,
      decision,
      policyId: "policy-1",
      executor: async () => {
        called = true;
        return { status: "EXECUTED" };
      },
      now: 123,
    });

    expect(called).toBe(false);
    expect(receipt.status).toBe("REJECTED");
    expect(receipt.policyId).toBe("policy-1");
  });

  test("invokes an executor only for ALLOW", async () => {
    let called = false;
    const decision: PolicyDecision = {
      decision: "ALLOW",
      reasons: ["inside delegated authority"],
      violatedRules: [],
      requiresApproval: false,
    };

    const receipt = await executeAuthorizedAction({
      action,
      decision,
      policyId: "policy-1",
      executor: async () => {
        called = true;
        return { status: "EXECUTED", providerRef: "fixture:transfer-1" };
      },
      now: 123,
    });

    expect(called).toBe(true);
    expect(receipt.status).toBe("EXECUTED");
    expect(receipt.providerRef).toBe("fixture:transfer-1");
  });

  test("records FAILED when an authorized executor throws", async () => {
    const decision: PolicyDecision = {
      decision: "ALLOW",
      reasons: ["inside delegated authority"],
      violatedRules: [],
      requiresApproval: false,
    };

    const receipt = await executeAuthorizedAction({
      action,
      decision,
      policyId: "policy-1",
      executor: async () => {
        throw new Error("provider unavailable");
      },
      now: 456,
    });

    expect(receipt.status).toBe("FAILED");
    expect(receipt.actionId).toBe(action.id);
    expect(receipt.policyId).toBe("policy-1");
    expect(receipt.timestamp).toBe(456);
  });
});

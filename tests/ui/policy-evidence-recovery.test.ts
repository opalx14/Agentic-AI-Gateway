import { createHash } from "node:crypto";

import { describe, expect, it } from "bun:test";

import {
  policyVerificationChecks,
  type PolicyDraft,
} from "@/lib/solana/agent-policy";

const authority = "FHAqJnHhY3KuSQ9HskoQUmY187BhPiGGtVEqKQSoULsF";

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function fixture() {
  const draft: PolicyDraft = {
    authority,
    agentSigner: authority,
    settlementAuthority: authority,
    policyId: "browser-mvp-policy-v1",
    totalBudget: 10000,
    maxPerAction: 5000,
    autoApproveMax: 2000,
    expiresAt: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    goal: "Bound agent actions behind deterministic authority",
    allowedActions: ["inventory.transfer", "flight.replace"],
  };

  const policy = {
    authority,
    agentSigner: authority,
    settlementAuthority: authority,
    policyIdHex: hash(draft.policyId),
    policyVersion: 1,
    totalBudget: draft.totalBudget,
    spentAmount: 0,
    reservedAmount: 0,
    maxPerAction: draft.maxPerAction,
    autoApproveMax: draft.autoApproveMax,
    expiresAt: draft.expiresAt - 3600,
    goalHashHex: hash(draft.goal),
    allowedActionsHashHex: hash([...draft.allowedActions].sort().join("\n")),
    nonce: 0,
    isActive: true,
    bump: 255,
  };

  return { draft, policy };
}

describe("policyVerificationChecks", () => {
  it("allows recovery of the same policy even when the reconnect draft has a new expiry", () => {
    const { draft, policy } = fixture();
    const checks = policyVerificationChecks(policy, draft, {
      includeExpiresAt: false,
    });

    expect(checks.expiresAt).toBeUndefined();
    expect(Object.values(checks).every(Boolean)).toBe(true);
  });

  it("checks expiry for the normal post-submit verification path", () => {
    const { draft, policy } = fixture();
    const checks = policyVerificationChecks(policy, draft);

    expect(checks.expiresAt).toBe(false);
    expect(Object.values(checks).every(Boolean)).toBe(false);
  });

  it("still fails recovery when a stable policy field differs", () => {
    const { draft, policy } = fixture();
    const checks = policyVerificationChecks(
      { ...policy, totalBudget: draft.totalBudget + 1 },
      draft,
      { includeExpiresAt: false },
    );

    expect(checks.totalBudget).toBe(false);
    expect(Object.values(checks).every(Boolean)).toBe(false);
  });
});

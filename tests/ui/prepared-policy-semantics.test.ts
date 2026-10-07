import { describe, it, expect } from "bun:test";
import {
  preparedPolicySemanticsMatch,
  type PreparedPolicySemantics,
} from "@/lib/solana/prepared-policy-semantics";

const base: PreparedPolicySemantics = {
  network: "devnet",
  programId: "5SdxXmtvwFecQ7nyCfk8WaZ57M9vkBZB955Zx6RdA8XH",
  instruction: "initialize_policy",
  authority: "FHAqJnHhY3KuSQ9HskoQUmY187BhPiGGtVEqKQSoULsF",
  policyPda: "FBxjL53RRFeH3sqn9k9eGDneX1rmZVUWcDNzEkwKcrtV",
  totalBudget: 10000,
  maxPerAction: 5000,
  autoApproveMax: 2000,
  expiresAt: 1790606065,
  goalHashHex: "1e03c34386d899adbbcf7948d2ca4d7e7119abbe7ab86c84c65047df07d8e663",
  allowedActionsHashHex:
    "e9f021981a3f49fec52548abc510f561a061a214353f8e5922e647b1b79c2394",
};

describe("preparedPolicySemanticsMatch", () => {
  it("returns true when reviewed and fresh are identical", () => {
    expect(preparedPolicySemanticsMatch(base, { ...base })).toBe(true);
  });

  it("returns true regardless of transport-only field differences (not compared)", () => {
    // These fields are NOT part of PreparedPolicySemantics – any object
    // satisfying the type is semantically identical if the semantic fields match.
    const fresh: PreparedPolicySemantics = { ...base };
    // Mutating a non-semantic field on a superset object still matches because
    // the type only exposes the semantic fields.
    expect(preparedPolicySemanticsMatch(base, fresh)).toBe(true);
  });

  it("returns false when network differs", () => {
    const fresh: PreparedPolicySemantics = { ...base, network: "mainnet-beta" };
    expect(preparedPolicySemanticsMatch(base, fresh)).toBe(false);
  });

  it("returns false when programId differs", () => {
    const fresh: PreparedPolicySemantics = {
      ...base,
      programId: "11111111111111111111111111111111",
    };
    expect(preparedPolicySemanticsMatch(base, fresh)).toBe(false);
  });

  it("returns false when instruction differs", () => {
    const fresh: PreparedPolicySemantics = {
      ...base,
      instruction: "update_policy",
    };
    expect(preparedPolicySemanticsMatch(base, fresh)).toBe(false);
  });

  it("returns false when authority (wallet) differs", () => {
    const fresh: PreparedPolicySemantics = {
      ...base,
      authority: "11111111111111111111111111111111",
    };
    expect(preparedPolicySemanticsMatch(base, fresh)).toBe(false);
  });

  it("returns false when policyPda differs", () => {
    const fresh: PreparedPolicySemantics = {
      ...base,
      policyPda: "11111111111111111111111111111111",
    };
    expect(preparedPolicySemanticsMatch(base, fresh)).toBe(false);
  });

  it("returns false when totalBudget differs", () => {
    const fresh: PreparedPolicySemantics = { ...base, totalBudget: 99999 };
    expect(preparedPolicySemanticsMatch(base, fresh)).toBe(false);
  });

  it("returns false when maxPerAction differs", () => {
    const fresh: PreparedPolicySemantics = { ...base, maxPerAction: 1 };
    expect(preparedPolicySemanticsMatch(base, fresh)).toBe(false);
  });

  it("returns false when autoApproveMax differs", () => {
    const fresh: PreparedPolicySemantics = { ...base, autoApproveMax: 9999 };
    expect(preparedPolicySemanticsMatch(base, fresh)).toBe(false);
  });

  it("returns false when expiresAt differs", () => {
    const fresh: PreparedPolicySemantics = { ...base, expiresAt: 0 };
    expect(preparedPolicySemanticsMatch(base, fresh)).toBe(false);
  });

  it("returns false when goalHashHex differs", () => {
    const fresh: PreparedPolicySemantics = {
      ...base,
      goalHashHex: "deadbeef",
    };
    expect(preparedPolicySemanticsMatch(base, fresh)).toBe(false);
  });

  it("returns false when allowedActionsHashHex differs", () => {
    const fresh: PreparedPolicySemantics = {
      ...base,
      allowedActionsHashHex: "cafebabe",
    };
    expect(preparedPolicySemanticsMatch(base, fresh)).toBe(false);
  });
});

import { describe, expect, test } from "bun:test";

import {
  snapshotAction,
  type Approval,
} from "../../src/control-plane";
import {
  createTravelAction,
  FixtureTravelProvider,
  runTravelRecovery,
  TRAVEL_OPTIONS_FIXTURE,
} from "../../src/scenarios/travel";

const NOW = 1_800_000_000_000;

function fixtureProvider(overrides?: Record<string, number>) {
  return new FixtureTravelProvider({
    options: TRAVEL_OPTIONS_FIXTURE,
    ...(overrides ? { verifiedAdditionalCosts: overrides } : {}),
  });
}

describe("Travel recovery scenario", () => {
  test("auto-allows the +15 option inside the autonomous threshold", async () => {
    const result = await runTravelRecovery({
      provider: fixtureProvider(),
      optionId: "flight-a",
      now: NOW,
    });

    expect(result.decision.decision).toBe("ALLOW");
    expect(result.receipt?.status).toBe("EXECUTED");
    expect(result.receipt?.providerRef).toBe("fixture:travel:booking-1");
    expect(result.verifiedAdditionalCost).toBe(15);
  });

  test("escalates the +45 option before provider execution", async () => {
    const result = await runTravelRecovery({
      provider: fixtureProvider(),
      optionId: "flight-b",
      now: NOW,
    });

    expect(result.decision.decision).toBe("ESCALATE");
    expect(result.receipt).toBeUndefined();
    expect(
      result.trace.steps.some((step) => step.name === "approval_required"),
    ).toBe(true);
  });

  test("executes the +45 option after exact manager approval", async () => {
    const option = TRAVEL_OPTIONS_FIXTURE.find(
      (candidate) => candidate.id === "flight-b",
    );

    if (!option) {
      throw new Error("missing fixture option");
    }

    const action = createTravelAction(option);
    const approval: Approval = {
      id: "travel-approval-1",
      policyId: "policy-travel-1",
      approvedBy: "travel-manager-1",
      approvedAt: NOW,
      expiresAt: NOW + 60_000,
      action: snapshotAction(action),
    };

    const result = await runTravelRecovery({
      provider: fixtureProvider(),
      optionId: "flight-b",
      approval,
      now: NOW,
    });

    expect(result.decision.decision).toBe("ALLOW");
    expect(result.receipt?.status).toBe("EXECUTED");
  });

  test("invalidates a 45 approval when provider verify changes price to 48", async () => {
    const option = TRAVEL_OPTIONS_FIXTURE.find(
      (candidate) => candidate.id === "flight-b",
    );

    if (!option) {
      throw new Error("missing fixture option");
    }

    const approval: Approval = {
      id: "travel-approval-price-change",
      policyId: "policy-travel-1",
      approvedBy: "travel-manager-1",
      approvedAt: NOW,
      action: snapshotAction(createTravelAction(option)),
    };

    const result = await runTravelRecovery({
      provider: fixtureProvider({ "flight-b": 48 }),
      optionId: "flight-b",
      approval,
      now: NOW,
    });

    expect(result.verifiedAdditionalCost).toBe(48);
    expect(result.decision.decision).toBe("ESCALATE");
    expect(result.decision.violatedRules).toContain(
      "APPROVAL_INVALIDATED",
    );
    expect(result.receipt).toBeUndefined();
  });
});

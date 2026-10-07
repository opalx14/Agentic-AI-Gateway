import { describe, expect, test } from "bun:test";

import {
  createLogisticsFixture,
  createLogisticsFixturePlanningProvider,
  planLogisticsAction,
  runPlannedLogisticsFixture,
} from "../../src/scenarios/logistics";

const NOW = 1_800_000_000_000;

describe("Logistics planning integration", () => {
  test("converts a validated provider candidate into a canonical proposed action", async () => {
    const fixture = createLogisticsFixture();
    const provider = createLogisticsFixturePlanningProvider(fixture);

    const action = await planLogisticsAction({
      provider,
      fixture,
      now: NOW,
    });

    expect(action.id).toBe("planned-incident-delay-1-1");
    expect(action.nonce).toBe("plan:incident-delay-1:1");
    expect(action.amount).toBe(8_000);
    expect(action.type).toBe("inventory.transfer");
  });

  test("keeps deterministic policy authoritative after planning", async () => {
    const fixture = createLogisticsFixture();
    const provider = createLogisticsFixturePlanningProvider(fixture);

    const result = await runPlannedLogisticsFixture({
      provider,
      fixture,
      now: NOW,
    });

    expect(result.decision.decision).toBe("ESCALATE");
    expect(result.receipt).toBeUndefined();
    expect(result.after.warehouses.HCM?.inventory["SKU-X"]).toBe(50);
  });
});

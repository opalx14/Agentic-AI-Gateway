import { describe, expect, test } from "bun:test";

import { buildTripComboRecommendations } from "@/scenarios/travel/agentic-combo-planning";
import { destinationByAirport } from "@/scenarios/travel/agentic-fixtures";
import { fixtureIntent } from "@/scenarios/travel/agentic-intent";
import { flightReplacementNodes } from "@/scenarios/travel/agentic-modifiers";
import { planAgenticTrip } from "@/scenarios/travel/agentic-orchestrator";

describe("whole-trip combo planning", () => {
  test("ranks a creator-event Singapore combo inside the stated budget", () => {
    const intent = fixtureIntent(
      "Plan Singapore for 3 days around a creator event. Budget $900.",
      "SGN",
    );
    const combos = buildTripComboRecommendations({
      intent,
      destination: destinationByAirport("SIN"),
      flight: {
        provider: "Atlas",
        source: "ATLAS",
        flightNumber: "SQ185",
        departureAt: "2026-11-07T09:00:00+07:00",
        arrivalAt: "2026-11-07T12:10:00+08:00",
        amountUsd: 210,
        providerRef: "atlas-sq185",
        optionCount: 2,
        options: [
          {
            id: "atlas-sq185",
            provider: "atlas",
            flightNumber: "SQ185",
            origin: "SGN",
            destination: "SIN",
            departureAt: "2026-11-07T09:00:00+07:00",
            arrivalAt: "2026-11-07T12:10:00+08:00",
            total: 210,
            additionalCost: 210,
            currency: "USD",
            expiresAt: 1_900_000_000_000,
          },
          {
            id: "atlas-vn651",
            provider: "atlas",
            flightNumber: "VN651",
            origin: "SGN",
            destination: "SIN",
            departureAt: "2026-11-07T08:30:00+07:00",
            arrivalAt: "2026-11-07T11:35:00+08:00",
            total: 165,
            additionalCost: 165,
            currency: "USD",
            expiresAt: 1_900_000_000_000,
          },
        ],
        flightRankingSource: "DEEPSEEK",
        flightRankingReasons: {},
      },
    });

    expect(combos.length).toBe(2);
    expect(combos[0]?.budgetFit).toBe(true);
    expect(combos[0]?.hotelTier).toBe("central");
    expect(combos[0]?.totalUsd).toBeLessThanOrEqual(intent.budgetUsd);
    expect(combos[0]?.source).toBe("ATLAS+DEMO");
  });

  test("flight replacement recalculates hotel budget and downstream timing", async () => {
    const plan = await planAgenticTrip({
      prompt:
        "Plan Singapore for 3 days around a creator event. Budget $900.",
      planner: "fixture",
      mode: "demo",
    });
    const oldHotel = plan.nodes.find((node) => node.kind === "STAY");
    const changed = flightReplacementNodes(plan, {
      flightNumber: "SQ999",
      departureAt: "2026-11-07T13:00:00+07:00",
      arrivalAt: "2026-11-07T16:15:00+08:00",
      amountUsd: 600,
      provider: "Atlas",
      source: "ATLAS",
      providerRef: "atlas-sq999",
    });
    const hotel = changed.find((node) => node.kind === "STAY");
    const transfer = changed.find((node) => node.kind === "TRANSFER");

    expect(hotel?.status).toBe("REPLANNED");
    expect(hotel?.consequence).toContain("hotel budget envelope");
    expect(hotel?.amountUsd).not.toBe(oldHotel?.amountUsd);
    expect(transfer?.status).toBe("REPLANNED");
  });
});

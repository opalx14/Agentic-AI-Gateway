import { describe, expect, test } from "bun:test";

import { destinationByAirport } from "@/scenarios/travel/agentic-fixtures";
import { planBudgetAwareHotel } from "@/scenarios/travel/agentic-hotel-planning";
import { fixtureIntent } from "@/scenarios/travel/agentic-intent";

describe("budget-aware hotel planning", () => {
  test("keeps the hotel inside the remaining trip budget when possible", () => {
    const intent = fixtureIntent(
      "Plan Singapore for 3 days around a creator event. Budget $900.",
      "SGN",
    );
    const hotel = planBudgetAwareHotel({
      intent,
      destination: destinationByAirport("SIN"),
      flightAmountUsd: 180,
    });

    expect(hotel.totalUsd).toBeLessThanOrEqual(hotel.hotelBudgetUsd);
    expect(hotel.tier).toBe("central");
    expect(hotel.rationale).toContain("hotel envelope");
  });

  test("prefers a value stay when the prompt explicitly asks to save", () => {
    const intent = fixtureIntent(
      "Plan Tokyo for 4 days, cheapest affordable hotel, budget $700.",
      "SGN",
    );
    const hotel = planBudgetAwareHotel({
      intent,
      destination: destinationByAirport("NRT"),
      flightAmountUsd: 310,
    });

    expect(hotel.tier).toBe("value");
  });

  test("only chooses premium when the remaining envelope can support it", () => {
    const intent = fixtureIntent(
      "Plan Bali for 5 days with a quiet premium retreat. Budget $1,500.",
      "SGN",
    );
    const hotel = planBudgetAwareHotel({
      intent,
      destination: destinationByAirport("DPS"),
      flightAmountUsd: 180,
    });

    expect(hotel.tier).toBe("premium");
    expect(hotel.totalUsd).toBeLessThanOrEqual(hotel.hotelBudgetUsd);
  });
});

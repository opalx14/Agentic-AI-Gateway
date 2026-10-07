import { planBudgetAwareHotel } from "./agentic-hotel-planning";
import { destinationCosts } from "./agentic-plan-helpers";
import type {
  DestinationVisual,
  TravelAgentIntent,
  TripComboRecommendation,
} from "./agentic-types";
import type { PlannedFlightEvidence } from "./agentic-flight-planning";

export function buildTripComboRecommendations(input: {
  intent: TravelAgentIntent;
  destination: DestinationVisual;
  flight: PlannedFlightEvidence;
}): TripComboRecommendation[] {
  const costs = destinationCosts(input.destination);
  const flightOptions =
    input.flight.options.length > 0
      ? input.flight.options.slice(0, 3).map((option) => ({
          providerRef: option.id,
          flightNumber: option.flightNumber,
          amountUsd: option.total,
        }))
      : [
          {
            providerRef: input.flight.providerRef,
            flightNumber: input.flight.flightNumber,
            amountUsd: input.flight.amountUsd,
          },
        ];

  return flightOptions
    .map((flightOption, index) => {
      const hotel = planBudgetAwareHotel({
        intent: input.intent,
        destination: input.destination,
        flightAmountUsd: flightOption.amountUsd,
      });
      const transferAmountUsd = input.intent.requestedServices.includes("TRANSFER")
        ? costs.transfer
        : 0;
      const activitiesAmountUsd = input.intent.requestedServices.includes("ACTIVITY")
        ? costs.activities
        : 0;
      const hotelAmountUsd = input.intent.requestedServices.includes("STAY")
        ? hotel.totalUsd
        : 0;
      const flightAmountUsd = input.intent.requestedServices.includes("FLIGHT")
        ? flightOption.amountUsd
        : 0;
      const totalUsd = Math.round(
        flightAmountUsd +
          hotelAmountUsd +
          transferAmountUsd +
          activitiesAmountUsd,
      );
      const remainingBudgetUsd = Math.round(
        input.intent.budgetUsd - totalUsd,
      );
      const budgetFit = remainingBudgetUsd >= 0;

      return {
        id: "combo-" + (index + 1),
        rank: index + 1,
        flightProviderRef: flightOption.providerRef,
        flightNumber: flightOption.flightNumber,
        flightAmountUsd: Math.round(flightAmountUsd),
        hotelTitle: hotel.title,
        hotelTier: hotel.tier,
        hotelAmountUsd,
        hotelBudgetUsd: hotel.hotelBudgetUsd,
        transferAmountUsd,
        activitiesAmountUsd,
        totalUsd,
        remainingBudgetUsd,
        budgetFit,
        source:
          input.flight.source === "ATLAS"
            ? ("ATLAS+DEMO" as const)
            : ("DEMO" as const),
        rationale: budgetFit
          ? "Fits the $" +
            input.intent.budgetUsd +
            " trip budget with about $" +
            remainingBudgetUsd +
            " left after the requested services."
          : "Exceeds the $" +
            input.intent.budgetUsd +
            " trip budget by about $" +
            Math.abs(remainingBudgetUsd) +
            "; keep as a visible trade-off, not an auto-pick.",
      };
    })
    .sort((a, b) => {
      if (a.budgetFit !== b.budgetFit) return a.budgetFit ? -1 : 1;
      if (a.budgetFit && b.budgetFit) return a.rank - b.rank;
      return Math.abs(a.remainingBudgetUsd) - Math.abs(b.remainingBudgetUsd);
    })
    .map((combo, index) => ({ ...combo, rank: index + 1 }));
}

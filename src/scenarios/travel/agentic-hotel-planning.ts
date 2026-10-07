import { destinationCatalog } from "./catalog-registry";
import { destinationCosts } from "./agentic-plan-helpers";
import type { DestinationVisual, TravelAgentIntent } from "./agentic-types";

export type HotelTier = "value" | "central" | "premium";

export type BudgetAwareHotelPlan = {
  tier: HotelTier;
  title: string;
  nights: number;
  totalUsd: number;
  hotelBudgetUsd: number;
  fixedTripSpendUsd: number;
  rationale: string;
};

function preferredHotelTier(goal: string): HotelTier {
  const normalized = goal.toLowerCase();

  if (
    /luxury|premium|resort|5[- ]?star|comfortable|comfort|more comfortable|thoải mái|thoai mai|cao cấp|cao cap|sang trọng|sang trong|quiet|yên tĩnh|yen tinh|retreat/.test(
      normalized,
    )
  ) {
    return "premium";
  }

  if (
    /cheap|cheapest|affordable|save|tiết kiệm|tiet kiem|giá rẻ|gia re/.test(
      normalized,
    )
  ) {
    return "value";
  }

  if (
    /central|downtown|city center|event|conference|creator|business|gần trung tâm|gan trung tam/.test(
      normalized,
    )
  ) {
    return "central";
  }

  return "central";
}

export function planBudgetAwareHotel(input: {
  intent: TravelAgentIntent;
  destination: DestinationVisual;
  flightAmountUsd: number;
}): BudgetAwareHotelPlan {
  const costs = destinationCosts(input.destination);
  const nights = Math.max(1, input.intent.days - 1);
  const activitySpendUsd = input.intent.requestedServices.includes("ACTIVITY")
    ? costs.activities
    : 0;
  const transferSpendUsd = input.intent.requestedServices.includes("TRANSFER")
    ? costs.transfer
    : 0;
  const fixedTripSpendUsd =
    Math.round(input.flightAmountUsd) + activitySpendUsd + transferSpendUsd;
  const hotelBudgetUsd = Math.max(
    0,
    Math.round(input.intent.budgetUsd - fixedTripSpendUsd),
  );

  const catalog = destinationCatalog(
    input.destination.key,
    input.destination.airportCode,
  );
  const base = costs.hotelNight * nights;
  const candidates = [
    {
      tier: "value" as const,
      title: catalog.hotels[0] ?? input.destination.city + " Value Stay",
      amount: Math.max(120, Math.round(base * 0.76)),
    },
    {
      tier: "central" as const,
      title: catalog.hotels[1] ?? input.destination.city + " Central Hotel",
      amount: Math.max(120, Math.round(base)),
    },
    {
      tier: "premium" as const,
      title: catalog.hotels[2] ?? input.destination.city + " Premium Stay",
      amount: Math.max(120, Math.round(base * 1.38)),
    },
  ];

  const preferred = preferredHotelTier(input.intent.goal);
  const affordable = candidates.filter(
    (candidate) => candidate.amount <= hotelBudgetUsd,
  );

  let selected =
    affordable.find((candidate) => candidate.tier === preferred) ??
    (preferred === "value"
      ? affordable[0]
      : affordable.at(-1)) ??
    candidates[0]!;

  if (
    preferred === "central" &&
    affordable.some((candidate) => candidate.tier === "central")
  ) {
    selected = affordable.find((candidate) => candidate.tier === "central")!;
  }

  const budgetText =
    hotelBudgetUsd >= selected.amount
      ? "$" +
        selected.amount +
        " stay keeps about $" +
        Math.max(0, hotelBudgetUsd - selected.amount) +
        " of the trip budget unallocated."
      : "Cheapest demo stay still exceeds the calculated hotel envelope by $" +
        Math.max(0, selected.amount - hotelBudgetUsd) +
        ".";

  return {
    tier: selected.tier,
    title: selected.title,
    nights,
    totalUsd: selected.amount,
    hotelBudgetUsd,
    fixedTripSpendUsd,
    rationale:
      "AI intent prefers " +
      preferred +
      "; after the requested service reserves, the hotel envelope is $" +
      hotelBudgetUsd +
      ". " +
      budgetText,
  };
}

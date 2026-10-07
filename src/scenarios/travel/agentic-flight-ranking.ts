import { z } from "zod";

import { createDeepSeekProviderFromEnv } from "@/providers/ai/deepseek";

import type { TravelAgentIntent } from "./agentic-types";
import type { TravelFlightOption } from "./types";

const rankingReasonsSchema = z.record(
  z.string(),
  z.string().min(1).max(600),
);

const rankingPayloadSchema = z
  .union([
    z.object({
      orderedOfferIds: z.array(z.string().min(1)).min(1),
      reasons: rankingReasonsSchema.default({}),
    }),
    z.object({
      rankedOfferIds: z.array(z.string().min(1)).min(1),
      notes: rankingReasonsSchema.default({}),
    }),
  ])
  .transform((value) =>
    "orderedOfferIds" in value
      ? value
      : {
          orderedOfferIds: value.rankedOfferIds,
          reasons: value.notes,
        },
  );

function deterministicRank(options: TravelFlightOption[]) {
  return options
    .slice()
    .sort((a, b) => a.total - b.total || a.arrivalAt.localeCompare(b.arrivalAt));
}

export async function rankFlightOptions(input: {
  prompt: string;
  intent: TravelAgentIntent;
  options: TravelFlightOption[];
}): Promise<{
  options: TravelFlightOption[];
  source: "DEEPSEEK" | "DETERMINISTIC";
  reasons: Record<string, string>;
}> {
  if (input.options.length <= 1) {
    return {
      options: input.options,
      source: "DETERMINISTIC",
      reasons: {},
    };
  }

  try {
    const provider = createDeepSeekProviderFromEnv();
    const result = await provider.plan({
      scenarioId: "travel-flight-offer-ranking",
      goal: input.prompt,
      context: {
        travellerIntent: {
          origin: input.intent.origin,
          destination: input.intent.destinationAirport,
          travelers: input.intent.travelers,
          budgetUsd: input.intent.budgetUsd,
          goal: input.intent.goal,
        },
        atlasOffers: input.options.map((option) => ({
          offerId: option.id,
          flightNumber: option.flightNumber,
          departureAt: option.departureAt,
          arrivalAt: option.arrivalAt,
          total: option.total,
          currency: option.currency,
          expiresAt: option.expiresAt,
          carrier: option.carrier,
          operatingCarrier: option.operatingCarrier,
          stops: option.stops,
          durationMinutes: option.durationMinutes,
          cabinClass: option.cabinClass,
          bookable: option.bookable,
          ancillarySupported: option.ancillarySupported,
          priceStatus: option.priceStatus,
        })),
        expectedPayloadShape: {
          orderedOfferIds: "all supplied offer ids, best match first",
          reasons: "object keyed by offer id with a concise ranking reason",
        },
        rules: [
          "Rank only supplied Atlas offers.",
          "Respect explicit timing, budget and travel preferences in the prompt.",
          "Never invent fares, flight numbers or offer ids.",
          "Prefer a cheaper offer only when it does not violate a stronger explicit preference.",
          "Keep the response summary under 40 words and each ranking reason under 25 words.",
        ],
      },
      allowedActionTypes: ["flight.rank"],
      allowedResources: ["atlas-offers"],
      providerOptionIds: input.options.map((option) => option.id),
    });

    const action = result.actions[0];
    const payload = rankingPayloadSchema.parse(action?.payload ?? {});
    const suppliedIds = new Set(input.options.map((option) => option.id));
    const orderedIds = payload.orderedOfferIds.filter((id) => suppliedIds.has(id));
    const missing = input.options
      .map((option) => option.id)
      .filter((id) => !orderedIds.includes(id));
    const finalOrder = [...orderedIds, ...missing];
    const byId = new Map(input.options.map((option) => [option.id, option]));

    return {
      options: finalOrder
        .map((id) => byId.get(id))
        .filter((option): option is TravelFlightOption => !!option),
      source: "DEEPSEEK",
      reasons: payload.reasons,
    };
  } catch {
    return {
      options: deterministicRank(input.options),
      source: "DETERMINISTIC",
      reasons: {},
    };
  }
}

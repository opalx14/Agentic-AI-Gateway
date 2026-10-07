import { createAtlasTravelProviderFromEnv } from "@/scenarios/travel/providers/atlas";

import { rankFlightOptions } from "./agentic-flight-ranking";
import { destinationCosts, toolCall } from "./agentic-plan-helpers";
import type {
  AgenticTripPlan,
  AgentToolCall,
  DestinationVisual,
  TravelAgentIntent,
} from "./agentic-types";
import type { TravelFlightOption } from "./types";
import { iso } from "./agentic-utils";

export interface PlannedFlightEvidence {
  provider: string;
  source: "ATLAS" | "DEMO";
  flightNumber: string;
  departureAt: string;
  arrivalAt: string;
  amountUsd: number;
  providerRef: string;
  optionCount: number;
  options: TravelFlightOption[];
  flightRankingSource: AgenticTripPlan["flightRankingSource"];
  flightRankingReasons: Record<string, string>;
  fallbackReason?: string;
}

function demoFlight(input: {
  intent: TravelAgentIntent;
  destination: DestinationVisual;
  fallbackReason?: string;
}): PlannedFlightEvidence {
  const costs = destinationCosts(input.destination);
  return {
    provider: "Atlas demo catalog",
    source: "DEMO",
    flightNumber: `AG${input.destination.airportCode}27`,
    departureAt: iso(input.intent.startDate, "02:30"),
    arrivalAt: iso(input.intent.startDate, "08:20"),
    amountUsd: costs.flight * input.intent.travelers,
    providerRef: `demo:flight:${input.destination.key}:27`,
    optionCount: 4,
    options: [],
    flightRankingSource: "DETERMINISTIC",
    flightRankingReasons: {},
    fallbackReason: input.fallbackReason,
  };
}

export function flightEvidenceToolCalls(input: {
  flight: PlannedFlightEvidence;
  intent: TravelAgentIntent;
  prompt: string;
  idSuffix?: string;
}): AgentToolCall[] {
  const suffix = input.idSuffix ?? "";
  const searchCall = toolCall({
    id: "tool-flight" + suffix,
    actor: "FLIGHT",
    tool: "flight.search",
    provider: input.flight.provider,
    operation: input.intent.origin + " → " + input.intent.destinationAirport,
    mode: input.flight.source === "ATLAS" ? "LIVE" : "DEMO",
    status: "SUCCESS",
    inputSummary:
      input.intent.startDate + " · " + input.intent.travelers + " traveler(s)",
    outputSummary:
      input.flight.source === "ATLAS"
        ? input.flight.optionCount +
          " Atlas offer(s) · ids " +
          input.flight.options
            .slice(0, 4)
            .map((option) => option.id + ":$" + option.total)
            .join(", ")
        : input.flight.optionCount +
          " demo option(s) · " +
          (input.flight.fallbackReason ?? "live inventory not requested"),
    chainBinding: "TRACE_ROOT",
  });

  if (input.flight.source !== "ATLAS") return [searchCall];

  return [
    searchCall,
    toolCall({
      id: "tool-flight-rank" + suffix,
      actor: "LIAISON",
      tool:
        input.flight.flightRankingSource === "DEEPSEEK"
          ? "deepseek.chat"
          : "flight.rank",
      provider:
        input.flight.flightRankingSource === "DEEPSEEK"
          ? "DeepSeek"
          : "Deterministic ranker",
      operation: "rank Atlas flight offers against traveller intent",
      mode:
        input.flight.flightRankingSource === "DEEPSEEK" ? "LIVE" : "DEMO",
      status: "SUCCESS",
      inputSummary:
        input.flight.options.length +
        " Atlas offers · " +
        input.prompt.slice(0, 90),
      outputSummary:
        "selected " +
        input.flight.providerRef +
        " · " +
        input.flight.flightNumber +
        " · $" +
        Math.round(input.flight.amountUsd),
      chainBinding: "TRACE_ROOT",
    }),
  ];
}

export function flightReplacementSatisfiesRequest(input: {
  prompt: string;
  currentFlight: {
    subtitle: string;
    startAt: string;
    amountUsd?: number;
  };
  flight: PlannedFlightEvidence;
}) {
  const selected = input.flight.options[0];
  if (!selected) return false;

  const normalized = input.prompt.toLowerCase();
  const currentDeparture = new Date(input.currentFlight.startAt).getTime();
  const nextDeparture = new Date(selected.departureAt).getTime();
  const currentAmount = input.currentFlight.amountUsd ?? Number.POSITIVE_INFINITY;
  const checks: boolean[] = [];

  if (/later|muộn|muon|trễ hơn|tre hon/.test(normalized)) {
    checks.push(nextDeparture > currentDeparture + 15 * 60_000);
  }
  if (/earlier|sớm|som/.test(normalized)) {
    checks.push(nextDeparture < currentDeparture - 15 * 60_000);
  }
  if (/direct|nonstop|thẳng|thang|không dừng|khong dung/.test(normalized)) {
    checks.push((selected.stops ?? 0) === 0);
  }
  if (/cheaper|rẻ hơn|re hon|lower price/.test(normalized)) {
    checks.push(selected.total < currentAmount);
  }
  if (/different|another|khác|khac/.test(normalized)) {
    checks.push(
      selected.flightNumber !== input.currentFlight.subtitle ||
        nextDeparture !== currentDeparture,
    );
  }

  if (checks.length > 0) return checks.every(Boolean);
  return (
    selected.flightNumber !== input.currentFlight.subtitle ||
    nextDeparture !== currentDeparture
  );
}

export async function planFlightEvidence(input: {
  prompt: string;
  planner: "fixture" | "deepseek";
  intent: TravelAgentIntent;
  destination: DestinationVisual;
  mode: "demo" | "live" | "live-preferred";
}): Promise<PlannedFlightEvidence> {
  if (input.mode === "demo") {
    return demoFlight(input);
  }

  let options: TravelFlightOption[];
  try {
    const provider = createAtlasTravelProviderFromEnv();
    options = await provider.searchFlights({
      origin: input.intent.origin,
      destination: input.intent.destinationAirport,
      departDate: input.intent.startDate,
      adults: input.intent.travelers,
      baselineTotal: 0,
      currency: "USD",
    });
    if (!options.length) throw new Error("atlas_live_no_inventory");
  } catch (error) {
    if (input.mode === "live") throw error;
    return demoFlight({
      ...input,
      fallbackReason:
        error instanceof Error ? error.message : "Atlas live search unavailable.",
    });
  }

  const ranking =
    input.planner === "deepseek"
      ? await rankFlightOptions({
          prompt: input.prompt,
          intent: input.intent,
          options,
        })
      : {
          options: options.slice().sort((a, b) => a.total - b.total),
          source: "DETERMINISTIC" as const,
          reasons: {},
        };
  const selected = ranking.options[0]!;

  return {
    provider: "Atlas",
    source: "ATLAS",
    flightNumber: selected.flightNumber,
    departureAt: selected.departureAt,
    arrivalAt: selected.arrivalAt,
    amountUsd: selected.total,
    providerRef: selected.id,
    optionCount: ranking.options.length,
    options: ranking.options,
    flightRankingSource: ranking.source,
    flightRankingReasons: ranking.reasons,
  };
}

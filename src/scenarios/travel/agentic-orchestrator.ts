import { buildTripComboRecommendations } from "./agentic-combo-planning";
import { flightEvidenceToolCalls, flightReplacementSatisfiesRequest, planFlightEvidence, type PlannedFlightEvidence } from "./agentic-flight-planning";
import { destinationByAirport } from "./agentic-fixtures";
import {
  deepSeekChangeIntent,
  deepSeekIntent,
  deterministicChangeIntent,
  fixtureIntent,
} from "./agentic-intent";
import { activitiesFor, destinationCosts, toolCall } from "./agentic-plan-helpers";
import { planBudgetAwareHotel } from "./agentic-hotel-planning";
import { changedNodesForIntent, flightNeedsReviewNodes, flightReplacementNodes } from "./agentic-modifiers";
import type {
  AgenticTripPlan,
  AgenticTripRequest,
  AgentToolCall,
  DestinationVisual,
  PaymentRail,
  TravelAgentIntent,
  TravelAuthority,
  TripConsequence,
  TripNode,
} from "./agentic-types";
import { addDays, addMinutes, iso, sha256Hex } from "./agentic-utils";
export { sha256Hex } from "./agentic-utils";
function paymentRails(): PaymentRail[] {
  return [
    {
      id: "provider",
      label: "Full-trip provider settlement",
      status: "NOT_ENABLED",
      detail: "Atlas flight search/verify can be live, but hotel/ride execution and full-trip settlement are not enabled.",
    },
    {
      id: "usdc",
      label: "USDC settlement",
      status: "NOT_ENABLED",
      detail:
        "Requires a verified SPL/USDC custody or escrow adapter. Authority accounting alone is not token custody.",
    },
  ];
}

function policyFor(input: {
  totalUsd: number;
  intent: TravelAgentIntent;
}): TravelAuthority {
  const authorityBase = {
    delegatedBudgetUsd: input.intent.delegatedBudgetUsd,
    autoApproveUsd: input.intent.autoApproveUsd,
    exactAmountUsd: input.totalUsd,
  };

  if (input.totalUsd > input.intent.delegatedBudgetUsd) {
    return {
      ...authorityBase,
      decision: "BLOCK",
      reason: `Trip total $${input.totalUsd} exceeds the delegated trip budget of $${input.intent.delegatedBudgetUsd}.`,
    };
  }
  if (input.totalUsd > input.intent.autoApproveUsd) {
    return {
      ...authorityBase,
      decision: "ESCALATE",
      reason: `The plan is viable, but $${input.totalUsd} exceeds the $${input.intent.autoApproveUsd} automatic spend limit.`,
    };
  }
  return {
    ...authorityBase,
    decision: "ALLOW",
    reason: `The exact $${input.totalUsd} plan is inside the delegated automatic spend limit.`,
  };
}

function buildNodes(input: {
  intent: TravelAgentIntent;
  destination: DestinationVisual;
  flight: PlannedFlightEvidence;
}): TripNode[] {
  const costs = destinationCosts(input.destination);
  const nights = Math.max(1, input.intent.days - 1);
  const transferStart = addMinutes(input.flight.arrivalAt, 25);
  const transferEnd = addMinutes(transferStart, 55);
  const hotelStart = addMinutes(transferEnd, 20);
  const activityCatalog = activitiesFor(input.destination);
  const hotelPlan = planBudgetAwareHotel({
    intent: input.intent,
    destination: input.destination,
    flightAmountUsd: input.flight.amountUsd,
  });

  const nodes: TripNode[] = [
    {
      id: "flight-out",
      kind: "FLIGHT",
      title: `${input.intent.origin} → ${input.destination.airportCode}`,
      subtitle: input.flight.flightNumber,
      startAt: input.flight.departureAt,
      endAt: input.flight.arrivalAt,
      location: input.destination.city,
      provider: input.flight.provider,
      source: input.flight.source,
      status: "PLANNED",
      amountUsd: Math.round(input.flight.amountUsd),
      providerRef: input.flight.providerRef,
      dependsOn: [],
    },
    {
      id: "airport-transfer",
      kind: "TRANSFER",
      title: "Airport → hotel",
      subtitle: "Arrival-aware ground transfer",
      startAt: transferStart,
      endAt: transferEnd,
      location: input.destination.city,
      provider: "Ground demo adapter",
      source: "DEMO",
      status: "PLANNED",
      amountUsd: costs.transfer,
      providerRef: `demo:transfer:${input.destination.key}`,
      dependsOn: ["flight-out"],
    },
    {
      id: "hotel",
      kind: "STAY",
      title: hotelPlan.title,
      subtitle: `${nights} nights · ${hotelPlan.tier} fit · flexible check-in`,
      startAt: hotelStart,
      endAt: iso(addDays(input.intent.startDate, nights), "11:00"),
      location: input.destination.city,
      provider: "Hotel demo catalog",
      source: "DEMO",
      status: "PLANNED",
      amountUsd: hotelPlan.totalUsd,
      providerRef: `demo:hotel:${input.destination.key}:${hotelPlan.tier}`,
      dependsOn: ["airport-transfer"],
    },
  ];

  activityCatalog.slice(0, Math.min(3, input.intent.days)).forEach(
    ([title, location], index) => {
      const day = addDays(input.intent.startDate, Math.min(index + 1, input.intent.days - 1));
      nodes.push({
        id: `activity-${index + 1}`,
        kind: "ACTIVITY",
        title,
        subtitle: index === 0 ? "Taste-matched first pick" : "Route-compatible stop",
        startAt: iso(day, index === 0 ? "09:30" : index === 1 ? "14:00" : "17:30"),
        endAt: iso(day, index === 0 ? "11:30" : index === 1 ? "16:00" : "19:00"),
        location,
        provider: "Places demo catalog",
        source: "DEMO",
        status: "PLANNED",
        amountUsd: Math.round(costs.activities / Math.min(3, input.intent.days)),
        providerRef: `demo:place:${input.destination.key}:${index + 1}`,
        dependsOn: index === 0 ? ["hotel"] : [`activity-${index}`],
      });
    },
  );

  nodes.push({
    id: "commitment",
    kind: "COMMITMENT",
    title: "Trip goal checkpoint",
    subtitle: "The itinerary must still leave a useful trip after any recovery.",
    startAt: iso(addDays(input.intent.startDate, 1), "20:00"),
    location: input.destination.city,
    provider: "Traveller goal",
    source: "DEMO",
    status: "PLANNED",
    dependsOn: ["hotel", "flight-out"],
  });

  const allowedKinds = new Set<TripNode["kind"]>([
    ...input.intent.requestedServices,
    "COMMITMENT",
  ]);
  const scoped = nodes.filter((node) => allowedKinds.has(node.kind));
  const scopedIds = new Set(scoped.map((node) => node.id));

  return scoped.map((node) => ({
    ...node,
    dependsOn: node.dependsOn.filter((id) => scopedIds.has(id)),
  }));
}

function buildConsequence(nodes: TripNode[]): TripConsequence {
  const affected = nodes.filter((node) => node.status === "AFFECTED");
  const dropped = nodes.filter((node) => node.status === "DROPPED");
  const commitment = nodes.find((node) => node.kind === "COMMITMENT");
  const preserved = commitment?.status !== "AFFECTED" && commitment?.status !== "DROPPED";
  const changed = nodes.filter((node) => node.status === "REPLANNED").length;

  return {
    affectedNodeIds: affected.map((node) => node.id),
    droppedNodeIds: dropped.map((node) => node.id),
    commitmentPreserved: preserved,
    summary:
      affected.length === 0 && dropped.length === 0 && changed === 0
        ? "Whole trip is internally consistent."
        : preserved
          ? `${affected.length + dropped.length + changed} downstream items changed; the trip goal is still preserved.`
          : "The current recovery still breaks the trip goal and must not execute.",
  };
}

function finalizePlan(input: {
  id: string;
  version: number;
  prompt: string;
  summary: string;
  destination: DestinationVisual;
  intent: TravelAgentIntent;
  nodes: TripNode[];
  calls: AgentToolCall[];
  planner: "fixture" | "deepseek";
  plannerModel: string;
  flightCandidates?: AgenticTripPlan["flightCandidates"];
  flightInventorySource?: AgenticTripPlan["flightInventorySource"];
  flightRankingSource?: AgenticTripPlan["flightRankingSource"];
  flightRankingReasons?: AgenticTripPlan["flightRankingReasons"];
  flightFallbackReason?: string;
  recommendedCombos?: AgenticTripPlan["recommendedCombos"];
  createdAt?: string;
}): AgenticTripPlan {
  const totalUsd = Math.round(
    input.nodes.reduce((sum, node) => sum + (node.amountUsd ?? 0), 0),
  );
  const consequence = buildConsequence(input.nodes);
  const authority = policyFor({ totalUsd, intent: input.intent });

  const policyCall = toolCall({
    id: `tool-policy-v${input.version}`,
    actor: "POLICY",
    tool: "authority.evaluate",
    provider: "Deterministic Control Plane",
    operation: "viability + spend authority",
    mode: "DEMO",
    status: authority.decision === "BLOCK" ? "FAILED" : "SUCCESS",
    inputSummary: `$${totalUsd} exact plan · auto $${input.intent.autoApproveUsd} · delegated $${input.intent.delegatedBudgetUsd}`,
    outputSummary: `${authority.decision} · ${authority.reason}`,
    chainBinding: "ACTION_HASH",
  });
  const toolCalls = [...input.calls, policyCall];
  const traceRootHex = sha256Hex(toolCalls.map((call) => call.digestHex));
  const selectedNodeIds = input.nodes
    .filter((node) => node.status !== "DROPPED")
    .map((node) => node.id);

  const actionDigestHex = sha256Hex({
    tripId: input.id,
    version: input.version,
    amountUsd: totalUsd,
    currency: "USD",
    selectedNodeIds,
    traceRootHex,
  });

  return {
    id: input.id,
    version: input.version,
    prompt: input.prompt,
    summary: input.summary,
    destination: input.destination,
    intent: input.intent,
    nodes: input.nodes,
    toolCalls,
    traceRootHex,
    actionDigestHex,
    authority,
    consequence,
    totalUsd,
    paymentRails: paymentRails(),
    recommendedCombos: input.recommendedCombos,
    flightCandidates: input.flightCandidates,
    flightInventorySource: input.flightInventorySource,
    flightRankingSource: input.flightRankingSource,
    flightRankingReasons: input.flightRankingReasons,
    flightFallbackReason: input.flightFallbackReason,
    planner: input.planner,
    plannerModel: input.plannerModel,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export async function planAgenticTrip(
  request: Pick<AgenticTripRequest, "prompt" | "planner" | "mode" | "origin">,
): Promise<AgenticTripPlan> {
  const planner = request.planner ?? "fixture";
  const mode = request.mode ?? "demo";
  let effectivePlanner = planner;
  let plannerFailure: string | null = null;
  let parsed: { intent: TravelAgentIntent; model: string };

  if (planner === "deepseek") {
    try {
      parsed = await deepSeekIntent(request.prompt);
    } catch (cause) {
      if (mode !== "live-preferred") throw cause;
      plannerFailure =
        cause instanceof Error ? cause.message : "DeepSeek planning unavailable.";
      effectivePlanner = "fixture";
      parsed = {
        intent: fixtureIntent(request.prompt, request.origin),
        model: "deterministic-trip-liaison-fallback",
      };
    }
  } else {
    parsed = {
      intent: fixtureIntent(request.prompt, request.origin),
      model: "deterministic-trip-liaison",
    };
  }

  if (request.origin) parsed.intent.origin = request.origin.toUpperCase();
  const destination = destinationByAirport(parsed.intent.destinationAirport);

  const calls: AgentToolCall[] = [];
  if (plannerFailure) {
    calls.push(
      toolCall({
        id: "tool-liaison-deepseek-attempt",
        actor: "LIAISON",
        tool: "deepseek.chat",
        provider: "DeepSeek",
        operation: "trip intent extraction",
        mode: "LIVE",
        status: "FAILED",
        inputSummary: request.prompt.slice(0, 120),
        outputSummary: "Unavailable · " + plannerFailure.slice(0, 120),
        chainBinding: "TRACE_ROOT",
      }),
    );
  }
  calls.push(
    toolCall({
      id: "tool-liaison",
      actor: "LIAISON",
      tool: effectivePlanner === "deepseek" ? "deepseek.chat" : "intent.parse",
      provider:
        effectivePlanner === "deepseek" ? "DeepSeek" : "Deterministic liaison",
      operation: "trip intent extraction",
      mode: effectivePlanner === "deepseek" ? "LIVE" : "DEMO",
      status: "SUCCESS",
      inputSummary: request.prompt.slice(0, 120),
      outputSummary: `${parsed.intent.origin} → ${destination.city} · ${parsed.intent.days} days · ${parsed.intent.travelers} traveler(s)${plannerFailure ? " · deterministic fallback" : ""}`,
      chainBinding: "TRACE_ROOT",
    }),
  );

  const flight = await planFlightEvidence({
    prompt: request.prompt,
    planner: effectivePlanner,
    intent: parsed.intent,
    destination,
    mode,
  });
  const plannedHotel = planBudgetAwareHotel({
    intent: parsed.intent,
    destination,
    flightAmountUsd: flight.amountUsd,
  });
  const recommendedCombos = buildTripComboRecommendations({
    intent: parsed.intent,
    destination,
    flight,
  });

  if (parsed.intent.requestedServices.includes("FLIGHT")) {
    calls.push(
      ...flightEvidenceToolCalls({
        flight,
        intent: parsed.intent,
        prompt: request.prompt,
      }),
    );
  }

  if (parsed.intent.requestedServices.includes("STAY")) {
    calls.push(
      toolCall({
        id: "tool-hotel",
        actor: "HOTEL",
        tool: "hotel.search",
        provider: "Hotel demo catalog",
        operation: "stay search",
        mode: "DEMO",
        status: "SUCCESS",
        inputSummary: `${destination.city} · ${Math.max(1, parsed.intent.days - 1)} nights · trip budget $${parsed.intent.budgetUsd}`,
        outputSummary: `${plannedHotel.title} · $${plannedHotel.totalUsd} · hotel envelope $${plannedHotel.hotelBudgetUsd} · ${plannedHotel.tier} fit`,
        chainBinding: "TRACE_ROOT",
      }),
    );
  }

  if (parsed.intent.requestedServices.includes("ACTIVITY")) {
    calls.push(
      toolCall({
        id: "tool-places",
        actor: "PLACES",
        tool: "places.search",
        provider: "Places demo catalog",
        operation: "activity discovery",
        mode: "DEMO",
        status: "SUCCESS",
        inputSummary: `${destination.city} · goal-aware itinerary`,
        outputSummary: "18 places checked · 3 route-compatible stops selected",
        chainBinding: "TRACE_ROOT",
      }),
    );
  }

  const nodes = buildNodes({ intent: parsed.intent, destination, flight });
  calls.push(
    toolCall({
      id: "tool-orchestrator",
      actor: "ORCHESTRATOR",
      tool: "trip.compose",
      provider: "Agentic Gateway",
      operation: "whole-trip graph",
      mode: "DEMO",
      status: "SUCCESS",
      inputSummary: `${nodes.length} candidate nodes`,
      outputSummary: parsed.intent.requestedServices.join(" + ") + " linked into one scoped trip graph with the trip goal",
      chainBinding: "TRACE_ROOT",
    }),
  );

  return finalizePlan({
    id: `trip-${destination.key}-demo`,
    version: 1,
    prompt: request.prompt,
    summary: `${destination.city} in ${parsed.intent.days} days, composed as one trip graph rather than separate booking tabs.`,
    destination,
    intent: parsed.intent,
    nodes,
    calls,
    planner: effectivePlanner,
    plannerModel: parsed.model,
    flightCandidates: flight.options,
    flightInventorySource: flight.source,
    flightRankingSource: flight.flightRankingSource,
    flightRankingReasons: flight.flightRankingReasons,
    flightFallbackReason: flight.fallbackReason,
    recommendedCombos,
  });
}

export async function modifyAgenticTrip(input: {
  currentPlan: AgenticTripPlan;
  prompt: string;
}): Promise<AgenticTripPlan> {
  const current = input.currentPlan;
  let change = deterministicChangeIntent(input.prompt);

  if (current.planner === "deepseek") {
    try {
      change = await deepSeekChangeIntent(input.prompt, current);
    } catch {
      change = deterministicChangeIntent(input.prompt);
    }
  }

  if (change.target === "SCHEDULE" && !change.newStartDate) {
    const relativeDays = /(\d+)\s*(?:day|days|ngày|ngay)/i.exec(input.prompt);
    if (relativeDays?.[1]) {
      const direction = /earlier|before|sớm hơn|som hon|trước|truoc/i.test(input.prompt)
        ? -1
        : 1;
      change = {
        ...change,
        kind: "REPLACE",
        newStartDate: addDays(
          current.intent.startDate,
          direction * Number(relativeDays[1]),
        ),
        summary:
          "Traveller requested the whole trip move " +
          Math.abs(Number(relativeDays[1])) +
          " day(s) " +
          (direction < 0 ? "earlier." : "later."),
      };
    }
  }

  const requestedBudget = /(?:budget|ngân sách|ngan sach|max(?:imum)?(?: budget)?)\s*(?:is|là|la|:|to|lên|len|up\s+to)?\s*\$?\s*([\d,]+)/i.exec(
    input.prompt,
  )?.[1];
  const nextBudgetUsd = requestedBudget
    ? Number(requestedBudget.replace(/,/g, ""))
    : current.intent.budgetUsd;
  const budgetChanged = nextBudgetUsd !== current.intent.budgetUsd;

  if (
    budgetChanged &&
    change.target === "GENERAL" &&
    /comfort|comfortable|more comfortable|thoải mái|thoai mai|premium|luxury|cao cấp|cao cap/i.test(
      input.prompt,
    )
  ) {
    change = {
      ...change,
      target: "STAY",
      kind: "PREFERENCE",
      summary:
        "Traveller changed the trip budget and requested a more comfortable stay.",
    };
  }
  const nextIntent: TravelAgentIntent = {
    ...current.intent,
    startDate:
      change.target === "SCHEDULE" && change.newStartDate
        ? change.newStartDate
        : current.intent.startDate,
    goal: current.intent.goal + " · Latest request: " + input.prompt.trim(),
    budgetUsd: nextBudgetUsd,
    delegatedBudgetUsd: Math.max(200, Math.round(nextBudgetUsd * 0.8)),
  };

  let replacementFlight: PlannedFlightEvidence | null = null;
  if (
    (change.target === "FLIGHT" && change.kind !== "DELAY") ||
    (change.target === "SCHEDULE" && !!change.newStartDate)
  ) {
    replacementFlight = await planFlightEvidence({
      prompt: input.prompt,
      planner: current.planner,
      intent: nextIntent,
      destination: current.destination,
      mode:
        change.target === "SCHEDULE" && current.planner === "fixture"
          ? "demo"
          : "live-preferred",
    });
  }

  const currentFlight = current.nodes.find((node) => node.kind === "FLIGHT");
  const currentFlightEvidence: PlannedFlightEvidence | null =
    budgetChanged && currentFlight
      ? {
          provider: currentFlight.provider,
          source: currentFlight.source === "ATLAS" ? "ATLAS" : "DEMO",
          flightNumber: currentFlight.subtitle,
          departureAt: currentFlight.startAt,
          arrivalAt: currentFlight.endAt ?? currentFlight.startAt,
          amountUsd: currentFlight.amountUsd ?? 0,
          providerRef:
            currentFlight.providerRef ??
            current.id + ":flight:v" + current.version,
          optionCount: current.flightCandidates?.length ?? 1,
          options: current.flightCandidates ?? [],
          flightRankingSource: current.flightRankingSource,
          flightRankingReasons: current.flightRankingReasons ?? {},
          fallbackReason: current.flightFallbackReason,
        }
      : null;
  const comboFlight = replacementFlight ?? currentFlightEvidence;
  const recommendedCombos = comboFlight
    ? buildTripComboRecommendations({
        intent: nextIntent,
        destination: current.destination,
        flight: comboFlight,
      })
    : current.recommendedCombos;

  const replacementSatisfied =
    replacementFlight && currentFlight
      ? change.target === "SCHEDULE"
        ? true
        : replacementFlight.source === "ATLAS"
          ? flightReplacementSatisfiesRequest({
              prompt: input.prompt,
              currentFlight,
              flight: replacementFlight,
            })
          : false
      : false;
  const noExactFlightMatch =
    replacementFlight?.source === "ATLAS" &&
    !!currentFlight &&
    !replacementSatisfied;

  const baseNodes = replacementSatisfied
    ? flightReplacementNodes(current, replacementFlight!, nextIntent)
    : noExactFlightMatch
      ? flightNeedsReviewNodes(
          current,
          "No live Atlas offer satisfies the requested flight constraints; current flight retained for review.",
        )
      : changedNodesForIntent(current, change);
  const budgetHotel =
    budgetChanged && !replacementSatisfied && currentFlight
      ? planBudgetAwareHotel({
          intent: nextIntent,
          destination: current.destination,
          flightAmountUsd: currentFlight.amountUsd ?? 0,
        })
      : null;
  const nodes = budgetHotel
    ? baseNodes.map((node) =>
        node.kind === "STAY"
          ? {
              ...node,
              title: budgetHotel.title,
              subtitle:
                budgetHotel.nights +
                " nights · " +
                budgetHotel.tier +
                " fit · flexible check-in",
              amountUsd: budgetHotel.totalUsd,
              providerRef:
                "demo:hotel:" + current.destination.key + ":" + budgetHotel.tier,
              status: "REPLANNED" as const,
              consequence:
                "Trip budget changed, so the stay was re-ranked inside the new hotel envelope.",
            }
          : node,
      )
    : baseNodes;
  const deepSeekChange = change.source === "DEEPSEEK";
  const replacementCalls = replacementFlight
    ? flightEvidenceToolCalls({
        flight: replacementFlight,
        intent: nextIntent,
        prompt: input.prompt,
        idSuffix: `-v${current.version + 1}`,
      })
    : [];
  const replacementViabilityCalls = noExactFlightMatch
    ? [
        toolCall({
          id: `tool-flight-viability-v${current.version + 1}`,
          actor: "ORCHESTRATOR",
          tool: "flight.viability",
          provider: "Agentic Gateway",
          operation: "requested flight constraint validation",
          mode: "DEMO",
          status: "SUCCESS",
          inputSummary: input.prompt.slice(0, 120),
          outputSummary: "NO_EXACT_MATCH · current flight retained; live Atlas alternatives reopened for review",
          chainBinding: "TRACE_ROOT",
        }),
      ]
    : [];

  const calls: AgentToolCall[] = [
    ...current.toolCalls.filter((call) => call.actor !== "POLICY"),
    toolCall({
      id: `tool-change-v${current.version + 1}`,
      actor: "LIAISON",
      tool: deepSeekChange ? "deepseek.chat" : "trip.change",
      provider: deepSeekChange ? "DeepSeek" : "Deterministic liaison",
      operation:
        change.target.toLowerCase() + " " + change.kind.toLowerCase() + " request",
      mode: deepSeekChange ? "LIVE" : "DEMO",
      status: "SUCCESS",
      inputSummary: input.prompt.slice(0, 120),
      outputSummary: change.summary,
      chainBinding: "TRACE_ROOT",
    }),
    ...replacementCalls,
    ...replacementViabilityCalls,
    toolCall({
      id: `tool-replan-v${current.version + 1}`,
      actor: "ORCHESTRATOR",
      tool: "trip.replan",
      provider: "Agentic Gateway",
      operation: "downstream dependency re-plan",
      mode: "DEMO",
      status: "SUCCESS",
      inputSummary: "Changed node + dependency graph + trip budget",
      outputSummary: noExactFlightMatch
        ? "NO_EXACT_MATCH · current flight retained · downstream bookings preserved but exact alternatives reopened"
        : replacementSatisfied
          ? "Replacement flight accepted · transfer re-timed · hotel budget envelope recalculated · dependent activities revalidated"
          : `${nodes.filter((node) => ["REPLANNED", "AFFECTED", "DROPPED"].includes(node.status)).length} downstream node(s) reassessed`,
      chainBinding: "TRACE_ROOT",
    }),
  ];

  return finalizePlan({
    id: current.id,
    version: current.version + 1,
    prompt: input.prompt,
    summary: noExactFlightMatch
      ? "No live Atlas offer satisfied the requested flight constraints. The current flight is retained and live alternatives are reopened for review."
      : change.summary +
        " Affected downstream nodes were re-planned against the whole-trip graph.",
    destination: current.destination,
    intent: nextIntent,
    nodes,
    calls,
    planner: current.planner,
    plannerModel: current.plannerModel,
    flightCandidates: replacementFlight?.options ?? current.flightCandidates,
    flightInventorySource:
      replacementFlight?.source ?? current.flightInventorySource,
    flightRankingSource:
      replacementFlight?.flightRankingSource ?? current.flightRankingSource,
    flightRankingReasons:
      replacementFlight?.flightRankingReasons ?? current.flightRankingReasons,
    flightFallbackReason:
      replacementFlight?.fallbackReason ?? current.flightFallbackReason,
    recommendedCombos,
    createdAt: current.createdAt,
  });
}

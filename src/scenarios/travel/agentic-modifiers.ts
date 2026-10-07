import { planBudgetAwareHotel } from "./agentic-hotel-planning";
import type {
  AgenticTripPlan,
  TravelChangeIntent,
  TripNode,
} from "./agentic-types";
import { addDays, addMinutes, iso } from "./agentic-utils";

function shiftDays(value: string, days: number) {
  return new Date(new Date(value).getTime() + days * 86_400_000).toISOString();
}

export function delayedNodes(
  plan: AgenticTripPlan,
  minutes: number,
): TripNode[] {
  const flight = plan.nodes.find((node) => node.id === "flight-out");
  if (!flight) return structuredClone(plan.nodes);
  const oldArrival = flight.endAt ?? flight.startAt;
  const newArrival = addMinutes(oldArrival, minutes);

  return plan.nodes.map((node) => {
    if (node.id === "flight-out") {
      return {
        ...node,
        endAt: newArrival,
        status: "REPLANNED" as const,
        consequence: "Arrival shifted by +" + Math.round(minutes / 60) + "h.",
      };
    }
    if (node.id === "airport-transfer") {
      const startAt = addMinutes(newArrival, 25);
      return {
        ...node,
        startAt,
        endAt: addMinutes(startAt, 55),
        status: "REPLANNED" as const,
        consequence: "Transfer automatically re-timed to the new landing.",
      };
    }
    if (node.id === "hotel") {
      return {
        ...node,
        startAt: addMinutes(newArrival, 100),
        status: "REPLANNED" as const,
        consequence: "Hotel check-in moved later; reservation remains usable.",
      };
    }
    if (
      node.kind === "ACTIVITY" &&
      new Date(node.startAt).getTime() <= new Date(newArrival).getTime()
    ) {
      return {
        ...node,
        status: "DROPPED" as const,
        consequence: "No longer reachable after the delayed arrival.",
      };
    }
    if (
      node.kind === "ACTIVITY" &&
      node.dependsOn.some((id) => id === "hotel")
    ) {
      return {
        ...node,
        status: "REPLANNED" as const,
        consequence: "Rechecked after the new arrival and hotel time.",
      };
    }
    if (node.kind === "COMMITMENT") {
      const preserved =
        new Date(newArrival).getTime() < new Date(node.startAt).getTime();
      return {
        ...node,
        status: preserved ? ("REPLANNED" as const) : ("AFFECTED" as const),
        consequence: preserved
          ? "Still reachable after downstream re-plan."
          : "New arrival breaks this trip goal.",
      };
    }
    return structuredClone(node);
  });
}

function targetedChangedNodes(
  plan: AgenticTripPlan,
  change: TravelChangeIntent,
): TripNode[] {
  const targetKind = change.target === "GENERAL" ? "ACTIVITY" : change.target;
  let targetChanged = false;

  return plan.nodes.map((node) => {
    if (!targetChanged && node.kind === targetKind) {
      targetChanged = true;
      return {
        ...node,
        subtitle: "Traveller-requested " + targetKind.toLowerCase() + " change",
        status: "REPLANNED" as const,
        consequence:
          targetKind === "FLIGHT"
            ? "Flight requirements changed; provider shortlist reopened."
            : targetKind === "STAY"
              ? "Stay requirements changed; hotel shortlist reopened."
              : targetKind === "TRANSFER"
                ? "Transfer requirements changed; local transport shortlist reopened."
                : "Itinerary stop changed; downstream timing was rechecked.",
      };
    }

    const downstreamAffected =
      (targetKind === "FLIGHT" &&
        ["TRANSFER", "STAY", "ACTIVITY"].includes(node.kind)) ||
      (targetKind === "STAY" &&
        ["TRANSFER", "ACTIVITY"].includes(node.kind)) ||
      (targetKind === "TRANSFER" && node.kind === "STAY");

    if (downstreamAffected) {
      return {
        ...node,
        status: "AFFECTED" as const,
        consequence: "Needs review after the upstream " + targetKind.toLowerCase() + " change.",
      };
    }

    if (node.kind === "COMMITMENT" && targetKind !== "ACTIVITY") {
      return {
        ...node,
        status: "REPLANNED" as const,
        consequence: "Trip goal rechecked against the requested change.",
      };
    }

    if (targetChanged && node.kind === "ACTIVITY" && targetKind === "ACTIVITY") {
      return {
        ...node,
        status: "REPLANNED" as const,
        consequence: "Timing revalidated after the previous stop changed.",
      };
    }

    return structuredClone(node);
  });
}

export function flightNeedsReviewNodes(
  plan: AgenticTripPlan,
  reason: string,
): TripNode[] {
  return plan.nodes.map((node) =>
    node.kind === "FLIGHT"
      ? {
          ...node,
          status: "AFFECTED" as const,
          consequence: reason,
        }
      : structuredClone(node),
  );
}

export function flightReplacementNodes(
  plan: AgenticTripPlan,
  flight: {
    flightNumber: string;
    departureAt: string;
    arrivalAt: string;
    amountUsd: number;
    provider: string;
    source: "ATLAS" | "DEMO" | "PROVIDER";
    providerRef: string;
  },
  intentOverride = plan.intent,
): TripNode[] {
  const newArrival = flight.arrivalAt;
  const scheduleDeltaDays = Math.round(
    (new Date(intentOverride.startDate + "T00:00:00Z").getTime() -
      new Date(plan.intent.startDate + "T00:00:00Z").getTime()) /
      86_400_000,
  );
  const hotelPlan = planBudgetAwareHotel({
    intent: intentOverride,
    destination: plan.destination,
    flightAmountUsd: flight.amountUsd,
  });

  return plan.nodes.map((node) => {
    if (node.id === "flight-out") {
      return {
        ...node,
        subtitle: flight.flightNumber,
        startAt: flight.departureAt,
        endAt: flight.arrivalAt,
        provider: flight.provider,
        source: flight.source,
        amountUsd: Math.round(flight.amountUsd),
        providerRef: flight.providerRef,
        status: "REPLANNED" as const,
        consequence: "Flight replaced from fresh provider inventory.",
      };
    }
    if (node.id === "airport-transfer") {
      const startAt = addMinutes(newArrival, 25);
      return {
        ...node,
        startAt,
        endAt: addMinutes(startAt, 55),
        status: "REPLANNED" as const,
        consequence: "Transfer re-timed to the replacement flight.",
      };
    }
    if (node.id === "hotel") {
      return {
        ...node,
        title: hotelPlan.title,
        subtitle: hotelPlan.nights + " nights · " + hotelPlan.tier + " fit · flexible check-in",
        startAt: addMinutes(newArrival, 100),
        endAt: iso(
          addDays(intentOverride.startDate, Math.max(1, intentOverride.days - 1)),
          "11:00",
        ),
        amountUsd: hotelPlan.totalUsd,
        providerRef: "demo:hotel:" + plan.destination.key + ":" + hotelPlan.tier,
        status: "REPLANNED" as const,
        consequence:
          "Flight changed, so the hotel budget envelope was recalculated to $" +
          hotelPlan.hotelBudgetUsd +
          " and the stay was re-ranked.",
      };
    }
    if (node.kind === "ACTIVITY" && scheduleDeltaDays !== 0) {
      return {
        ...node,
        startAt: shiftDays(node.startAt, scheduleDeltaDays),
        endAt: node.endAt ? shiftDays(node.endAt, scheduleDeltaDays) : undefined,
        status: "REPLANNED" as const,
        consequence: "Moved with the new trip dates and revalidated against the replacement flight.",
      };
    }
    if (node.kind === "COMMITMENT" && scheduleDeltaDays !== 0) {
      return {
        ...node,
        startAt: shiftDays(node.startAt, scheduleDeltaDays),
        endAt: node.endAt ? shiftDays(node.endAt, scheduleDeltaDays) : undefined,
        status: "REPLANNED" as const,
        consequence: "Trip goal checkpoint moved with the rescheduled trip.",
      };
    }
    if (node.kind === "ACTIVITY" && new Date(node.startAt) <= new Date(newArrival)) {
      return {
        ...node,
        status: "DROPPED" as const,
        consequence: "No longer reachable after the replacement arrival.",
      };
    }
    if (node.kind === "ACTIVITY" && node.dependsOn.includes("hotel")) {
      return {
        ...node,
        status: "REPLANNED" as const,
        consequence: "Revalidated after the replacement flight and check-in.",
      };
    }
    if (node.kind === "COMMITMENT") {
      const preserved = new Date(newArrival) < new Date(node.startAt);
      return {
        ...node,
        status: preserved ? ("REPLANNED" as const) : ("AFFECTED" as const),
        consequence: preserved
          ? "Still reachable after the replacement flight."
          : "Replacement flight breaks this trip goal.",
      };
    }
    return structuredClone(node);
  });
}

export function changedNodesForIntent(
  plan: AgenticTripPlan,
  change: TravelChangeIntent,
): TripNode[] {
  if (change.kind === "DELAY") {
    return delayedNodes(plan, change.delayMinutes ?? 360);
  }
  return targetedChangedNodes(plan, change);
}

export function freeformChangedNodes(
  plan: AgenticTripPlan,
  prompt: string,
): TripNode[] {
  let replaced = false;
  return plan.nodes.map((node) => {
    if (!replaced && node.kind === "ACTIVITY") {
      replaced = true;
      return {
        ...node,
        title: "Replanned stop · " + prompt.trim().slice(0, 52),
        subtitle: "Traveller-requested change",
        status: "REPLANNED" as const,
        consequence: "This stop changed; downstream timing was rechecked.",
        providerRef: "demo:place:replanned:v" + (plan.version + 1),
      };
    }
    if (replaced && node.kind === "ACTIVITY") {
      return {
        ...node,
        status: "REPLANNED" as const,
        consequence: "Timing revalidated after the previous stop changed.",
      };
    }
    return structuredClone(node);
  });
}

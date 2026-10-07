import { selectionsCompleteForPlan, type BookingSelections } from "@/scenarios/travel/booking-history";
import {
  buildCatalogOptions,
  liveFlightCatalogOptions,
  type TravelCatalogOption,
} from "@/scenarios/travel/catalog-registry";
import type { AgenticTripPlan } from "@/scenarios/travel/agentic-types";

import type { FinalDigest, ServiceStage } from "./travel-flow";

function rankHotelChoices(input: {
  plan: AgenticTripPlan;
  selections?: BookingSelections;
  options: TravelCatalogOption[];
}) {
  const selectedFlight =
    input.selections?.flight?.amount ??
    input.plan.nodes.find((node) => node.kind === "FLIGHT")?.amountUsd ??
    0;
  const selectedTransfer = input.plan.intent.requestedServices.includes("TRANSFER")
    ? input.selections?.transfer?.amount ??
      input.plan.nodes.find((node) => node.kind === "TRANSFER")?.amountUsd ??
      0
    : 0;
  const activities = input.plan.intent.requestedServices.includes("ACTIVITY")
    ? input.plan.nodes
        .filter((node) => node.kind === "ACTIVITY")
        .reduce((sum, node) => sum + (node.amountUsd ?? 0), 0)
    : 0;
  const hotelBudget = Math.max(
    0,
    Math.round(
      input.plan.intent.budgetUsd - selectedFlight - selectedTransfer - activities,
    ),
  );
  const goal = input.plan.intent.goal.toLowerCase();
  const preferred = /luxury|premium|resort|comfortable|comfort|thoải mái|thoai mai|quiet|yên tĩnh|yen tinh|cao cấp|cao cap/.test(goal)
    ? "premium"
    : /cheap|cheapest|affordable|save|tiết kiệm|tiet kiem|giá rẻ|gia re/.test(goal)
      ? "value"
      : "central";

  const tier = (option: TravelCatalogOption) =>
    option.id.includes("premium")
      ? "premium"
      : option.id.includes("value")
        ? "value"
        : "central";

  const ranked = input.options.slice().sort((a, b) => {
    const aFits = a.amount <= hotelBudget ? 1 : 0;
    const bFits = b.amount <= hotelBudget ? 1 : 0;
    if (aFits !== bFits) return bFits - aFits;

    const aPref = tier(a) === preferred ? 1 : 0;
    const bPref = tier(b) === preferred ? 1 : 0;
    if (aPref !== bPref) return bPref - aPref;

    if (preferred === "premium" && aFits && bFits) return b.amount - a.amount;
    return a.amount - b.amount;
  });

  return ranked.map((option, index) => {
    const fits = option.amount <= hotelBudget;
    const remaining = Math.max(0, hotelBudget - option.amount);
    const reason = fits
      ? `Fits the $${hotelBudget} hotel envelope after the requested service reserves; leaves about $${remaining}.`
      : `Over the calculated $${hotelBudget} hotel envelope by $${option.amount - hotelBudget}.`;

    return {
      ...option,
      aiRecommended: index === 0,
      budgetFit: fits,
      budgetRemainingAfter: remaining,
      rankingReason: reason,
      meta: index === 0
        ? `AI PICK · ${reason} DEMO property · availability not live`
        : `${fits ? "BUDGET FIT" : "OVER BUDGET"} · ${reason} DEMO property · availability not live`,
    };
  });
}

export async function fetchTravelCatalog(input: {
  plan: AgenticTripPlan;
  stage: ServiceStage;
  selections?: BookingSelections;
}) {
  const { plan, stage } = input;

  if (
    stage === "flight" &&
    plan.flightInventorySource === "ATLAS" &&
    plan.flightCandidates?.length
  ) {
    return {
      options: liveFlightCatalogOptions(
        plan.flightCandidates,
        plan.flightRankingReasons ?? {},
      ),
      fallback: false,
      source: "ATLAS" as const,
      fallbackReason: null,
    };
  }

  const nodeKind =
    stage === "flight" ? "FLIGHT" : stage === "hotel" ? "STAY" : "TRANSFER";
  const node = plan.nodes.find((item) => item.kind === nodeKind);
  const request = {
    stage,
    city: plan.destination.city,
    destinationKey: plan.destination.key,
    origin: plan.intent.origin,
    destinationAirport: plan.intent.destinationAirport,
    days: plan.intent.days,
    baseAmount: Math.max(1, Math.round(node?.amountUsd ?? 100)),
  };
  const fallback = buildCatalogOptions(request);

  try {
    const response = await fetch("/api/scenarios/travel/catalog", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    const payload = (await response.json()) as
      | { ok: true; source: "DEMO"; options: TravelCatalogOption[] }
      | { ok: false; error: string };
    if (!response.ok || !payload.ok) {
      throw new Error(
        "error" in payload ? payload.error : "Catalog search failed.",
      );
    }
    const options = stage === "hotel"
      ? rankHotelChoices({ plan, selections: input.selections, options: payload.options })
      : payload.options.slice().sort((a, b) => a.amount - b.amount);
    return {
      options,
      fallback: false,
      source: "DEMO" as const,
      fallbackReason: plan.flightFallbackReason ?? null,
    };
  } catch {
    return {
      options: stage === "hotel"
        ? rankHotelChoices({ plan, selections: input.selections, options: fallback })
        : fallback,
      fallback: true,
      source: "DEMO" as const,
      fallbackReason: plan.flightFallbackReason ?? "Catalog endpoint unavailable.",
    };
  }
}

export async function verifyAtlasFlightChoice(input: {
  plan: AgenticTripPlan;
  option: TravelCatalogOption;
}): Promise<{
  option: TravelCatalogOption;
  changed: boolean;
  verificationDigestHex: string;
}> {
  const offer = input.option.flightOffer;
  if (input.option.source !== "ATLAS" || !offer) {
    return {
      option: input.option,
      changed: false,
      verificationDigestHex: "",
    };
  }

  const response = await fetch("/api/scenarios/travel/flight-verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      planId: input.plan.id,
      version: input.plan.version,
      search: {
        origin: input.plan.intent.origin,
        destination: input.plan.intent.destinationAirport,
        departDate: input.plan.intent.startDate,
        adults: input.plan.intent.travelers,
        baselineTotal: 0,
        currency: offer.currency,
      },
      option: offer,
    }),
  });
  const payload = (await response.json()) as
    | {
        ok: true;
        changed: boolean;
        verified: typeof offer;
        verificationDigestHex: string;
      }
    | { ok: false; error: string };
  if (!response.ok || !payload.ok) {
    throw new Error(
      "error" in payload ? payload.error : "Atlas offer verification failed.",
    );
  }

  const verifiedOption: TravelCatalogOption = {
    ...input.option,
    amount: Math.round(payload.verified.total),
    meta: payload.changed
      ? "ATLAS LIVE · quote changed · review updated total before continuing"
      : "ATLAS LIVE · offer verified · exact provider total confirmed",
    flightOffer: payload.verified,
    verificationDigestHex: payload.verificationDigestHex,
  };

  return {
    option: verifiedOption,
    changed: payload.changed,
    verificationDigestHex: payload.verificationDigestHex,
  };
}

export async function fetchTravelAgent(body: unknown) {
  const response = await fetch("/api/scenarios/travel/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as AgenticTripPlan & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Travel agent request failed.");
  }
  return data;
}

export async function fetchFinalDigest(input: {
  plan: AgenticTripPlan;
  wallet: string;
  selections: BookingSelections;
}): Promise<FinalDigest> {
  const { plan, wallet, selections } = input;
  const { flight, hotel, transfer } = selections;
  if (!selectionsCompleteForPlan(plan, selections)) {
    throw new Error("Final booking selections are incomplete for the requested services.");
  }

  const response = await fetch("/api/scenarios/travel/finalize", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      planId: plan.id,
      version: plan.version,
      wallet,
      traceRootHex: plan.traceRootHex,
      requestedServices: plan.intent.requestedServices,
      flight: flight
        ? {
            id: flight.id,
            title: flight.title,
            amount: flight.amount,
            evidenceDigestHex: flight.verificationDigestHex,
          }
        : undefined,
      hotel: hotel
        ? { id: hotel.id, title: hotel.title, amount: hotel.amount }
        : undefined,
      transfer: transfer
        ? {
            id: transfer.id,
            title: transfer.title,
            amount: transfer.amount,
          }
        : undefined,
    }),
  });
  const payload = (await response.json()) as
    | ({ ok: true } & FinalDigest)
    | { ok: false; error: string };
  if (!response.ok || !payload.ok) {
    throw new Error(
      "error" in payload ? payload.error : "Final digest failed.",
    );
  }
  return {
    actionHashHex: payload.actionHashHex,
    payloadDigestHex: payload.payloadDigestHex,
    total: payload.total,
  };
}

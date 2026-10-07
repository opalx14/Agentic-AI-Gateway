import type { RawAtlasOffer } from "./atlas-cli/cli-types";
import {
  AtlasCaseStudyError,
  atlasAuthStatus,
  atlasBaggageCase,
  atlasSearchCase,
  atlasVerifyCase,
} from "./atlas-cli/tool";
import type {
  TravelCaseCandidate,
  TravelCaseStudy,
  TravelJourneyStep,
  TravelOutcomeContract,
} from "./case-study-types";

const BASELINE_USD = 200;
const CONTRACT: TravelOutcomeContract = {
  latestArrival: "17:00",
  minBaggageKg: 20,
  maxExtraSpendUsd: 20,
  autopilot: true,
};

function minutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function parseAtlasClock(value: string) {
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(value);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hhmm: `${match[4]}:${match[5]}`,
  };
}

function dayOffset(departure: string, arrival: string) {
  const dep = parseAtlasClock(departure);
  const arr = parseAtlasClock(arrival);
  if (!dep || !arr) return 0;
  const depDate = Date.UTC(dep.year, dep.month - 1, dep.day);
  const arrDate = Date.UTC(arr.year, arr.month - 1, arr.day);
  return Math.max(0, Math.round((arrDate - depDate) / 86_400_000));
}

function candidateOutcome(
  arrival: string,
  arrivalDayOffset: number,
  extraCostUsd: number,
): Pick<TravelCaseCandidate, "outcome" | "reasons"> {
  const arrivalMinutes = minutes(arrival) + arrivalDayOffset * 1440;
  const deadlineMinutes = minutes(CONTRACT.latestArrival);
  if (arrivalMinutes > deadlineMinutes) {
    return {
      outcome: "REJECTED",
      reasons: [`Arrives ${arrival} after ${CONTRACT.latestArrival} deadline`],
    };
  }

  if (extraCostUsd > CONTRACT.maxExtraSpendUsd) {
    return {
      outcome: "VALID_HUMAN",
      reasons: [
        `+$${extraCostUsd.toFixed(0)} exceeds $${CONTRACT.maxExtraSpendUsd} delegated authority`,
      ],
    };
  }

  return {
    outcome: "VALID_AUTO",
    reasons: [
      `Arrives before ${CONTRACT.latestArrival}`,
      `+$${extraCostUsd.toFixed(0)} is inside delegated authority`,
    ],
  };
}

function mapAtlasOffer(raw: RawAtlasOffer): TravelCaseCandidate | null {
  const first = raw.segments?.[0];
  const last = raw.segments?.[raw.segments.length - 1];
  if (!first || !last || !Number.isFinite(raw.total_price)) return null;

  const dep = parseAtlasClock(first.departure_time);
  const arr = parseAtlasClock(last.arrival_time);
  if (!dep || !arr) return null;

  const offset = dayOffset(first.departure_time, last.arrival_time);
  const extraCostUsd = raw.total_price - BASELINE_USD;
  const outcome = candidateOutcome(arr.hhmm, offset, extraCostUsd);

  return {
    id: raw.offer_id,
    source: "ATLAS_SANDBOX",
    flightNumber: first.flight_number.startsWith(first.carrier)
      ? first.flight_number
      : `${first.carrier} ${first.flight_number}`,
    carrier: first.carrier,
    departure: dep.hhmm,
    arrival: arr.hhmm,
    arrivalDayOffset: offset,
    replacementPriceUsd: raw.total_price,
    extraCostUsd,
    stops: Math.max(0, raw.segments.length - 1),
    bookable: raw.bookable,
    priceStatus: raw.price_status,
    baggage: "PENDING",
    ...outcome,
  };
}

function demoCandidates(): TravelCaseCandidate[] {
  return [
    {
      id: "demo-cheapest-late",
      source: "DEMO_FIXTURE",
      flightNumber: "VALUE-05",
      carrier: "Demo Air",
      departure: "15:40",
      arrival: "19:40",
      arrivalDayOffset: 0,
      replacementPriceUsd: 205,
      extraCostUsd: 5,
      stops: 0,
      bookable: true,
      priceStatus: "reference",
      outcome: "REJECTED",
      reasons: ["Cheapest option, but arrival 19:40 breaks the 17:00 outcome contract"],
      baggage: "PENDING",
    },
    {
      id: "demo-auto",
      source: "DEMO_FIXTURE",
      flightNumber: "FIX-A",
      carrier: "Demo Air",
      departure: "13:30",
      arrival: "16:20",
      arrivalDayOffset: 0,
      replacementPriceUsd: 215,
      extraCostUsd: 15,
      stops: 0,
      bookable: true,
      priceStatus: "verified",
      outcome: "VALID_AUTO",
      reasons: ["Arrives before 17:00", "+$15 is inside the +$20 delegated limit"],
      baggage: "VERIFIED",
    },
    {
      id: "demo-human",
      source: "DEMO_FIXTURE",
      flightNumber: "FIX-B",
      carrier: "Demo Air",
      departure: "11:40",
      arrival: "14:30",
      arrivalDayOffset: 0,
      replacementPriceUsd: 245,
      extraCostUsd: 45,
      stops: 0,
      bookable: true,
      priceStatus: "verified",
      outcome: "VALID_HUMAN",
      reasons: ["Arrives before 17:00", "+$45 exceeds the +$20 delegated limit"],
      baggage: "VERIFIED",
    },
  ];
}

function buildJourney(input: {
  source: "demo" | "live";
  selected: TravelCaseCandidate | null;
  verified: boolean;
  authRequired?: boolean;
}): TravelJourneyStep[] {
  if (input.authRequired) {
    return [
      {
        id: "observe",
        actor: "AIRLINE",
        title: "Disruption detected",
        detail: "Original arrival slips beyond the traveler outcome.",
        state: "DONE",
      },
      {
        id: "search",
        actor: "ATLAS",
        title: "Atlas authorization required",
        detail: "Live search is blocked until atlas-flight is authorized.",
        state: "BLOCKED",
      },
      {
        id: "evaluate",
        actor: "AI",
        title: "Evaluate candidates",
        detail: "Runs immediately after connected Atlas inventory is available.",
        state: "WAITING",
      },
      {
        id: "gate",
        actor: "POLICY",
        title: "Authority gate",
        detail: "Deadline, baggage and delegated spend remain deterministic.",
        state: "WAITING",
      },
    ];
  }

  return [
    {
      id: "observe",
      actor: "AIRLINE",
      title: "Disruption detected",
      detail: "6h delay breaks the arrival-before-17:00 outcome.",
      state: "DONE",
    },
    {
      id: "search",
      actor: "ATLAS",
      title: "Search alternatives",
      detail: input.source === "live" ? "Live Atlas Sandbox offers loaded." : "Deterministic Atlas-shaped fixture loaded.",
      state: "DONE",
    },
    {
      id: "evaluate",
      actor: "AI",
      title: "Evaluate outcome contract",
      detail: "Reject late options before comparing delegated spend.",
      state: "DONE",
    },
    {
      id: "verify",
      actor: "ATLAS",
      title: "Verify selected offer",
      detail: input.verified ? "Fare and provider capability re-checked." : "Verification pending.",
      state: input.verified ? "DONE" : "CURRENT",
    },
    {
      id: "gate",
      actor: "POLICY",
      title: "Apply authority boundary",
      detail:
        input.selected?.outcome === "VALID_HUMAN"
          ? "Valid recovery, but human approval is required."
          : "Valid recovery stays inside delegated authority.",
      state: input.verified ? "DONE" : "WAITING",
    },
    {
      id: "proof",
      actor: "SOLANA",
      title: "Authorize + prove",
      detail: "Exact policy/approval/nonce evidence is separated from provider execution.",
      state: "WAITING",
    },
  ];
}

export function buildDemoTravelCaseStudy(): TravelCaseStudy {
  const candidates = demoCandidates();
  const selected = candidates.find((candidate) => candidate.id === "demo-auto")!;

  return {
    mode: "demo",
    provider: {
      label: "Atlas-shaped deterministic fixture",
      status: "FIXTURE",
      detail: "Judge-safe fallback mirrors the same search → evaluate → verify → authority flow.",
    },
    disruption: {
      route: "SGN → SIN",
      originalArrival: "15:05",
      disruptedArrival: "21:05",
      delayHours: 6,
    },
    contract: CONTRACT,
    candidates,
    selectedId: selected.id,
    verify: {
      status: "DEMO_VERIFIED",
      summary: "Fare, baggage and arrival outcome are fixed and reproducible in Demo mode.",
      baggageSupported: true,
      seatSupported: true,
      priceChange: "unchanged",
    },
    authority: {
      decision: "ALLOW",
      reason: "+$15 stays inside the +$20 delegated spend limit.",
    },
    journey: buildJourney({ source: "demo", selected, verified: true }),
  };
}

export async function buildLiveTravelCaseStudy(): Promise<TravelCaseStudy> {
  const auth = await atlasAuthStatus();

  if (auth !== "READY") {
    return {
      mode: "live",
      provider: {
        label: "Atlas Flight Booking CLI",
        status: auth === "AUTH_REQUIRED" ? "AUTH_REQUIRED" : "ERROR",
        detail:
          auth === "AUTH_REQUIRED"
            ? "atlas-flight is installed but must be authorized before live search."
            : "Atlas CLI readiness could not be confirmed.",
      },
      disruption: {
        route: "SGN → SIN",
        originalArrival: "15:05",
        disruptedArrival: "21:05",
        delayHours: 6,
      },
      contract: CONTRACT,
      candidates: [],
      selectedId: null,
      verify: {
        status: "NOT_RUN",
        summary: "No provider verification was attempted.",
      },
      authority: {
        decision: "BLOCK",
        reason: "Fail closed: no live provider evidence without Atlas authorization.",
      },
      journey: buildJourney({
        source: "live",
        selected: null,
        verified: false,
        authRequired: auth === "AUTH_REQUIRED",
      }),
    };
  }

  try {
    const search = await atlasSearchCase({
      origin: "SGN",
      destination: "SIN",
      depart: "2026-11-06",
      adults: 1,
    });

    const candidates = search.offers
      .map(mapAtlasOffer)
      .filter((candidate): candidate is TravelCaseCandidate => candidate !== null)
      .sort((a, b) => a.extraCostUsd - b.extraCostUsd);

    const selected =
      candidates.find((candidate) => candidate.outcome === "VALID_AUTO") ??
      candidates.find((candidate) => candidate.outcome === "VALID_HUMAN") ??
      null;

    if (!selected) {
      return {
        mode: "live",
        provider: {
          label: "Atlas Sandbox",
          status: "READY",
          detail: `Search completed with ${search.offerCount} offers, but no option satisfies the hard arrival outcome.`,
        },
        disruption: {
          route: "SGN → SIN",
          originalArrival: "15:05",
          disruptedArrival: "21:05",
          delayHours: 6,
        },
        contract: CONTRACT,
        candidates,
        selectedId: null,
        verify: { status: "NOT_RUN", summary: "No policy-valid candidate to verify." },
        authority: { decision: "BLOCK", reason: "No live candidate preserves the arrival outcome." },
        journey: buildJourney({ source: "live", selected: null, verified: false }),
      };
    }

    const verification = await atlasVerifyCase(selected.id);
    let baggage = selected.baggage;
    if (verification.baggageSupported === false) {
      baggage = "UNAVAILABLE";
    } else if (verification.bookingId && verification.baggageSupported) {
      try {
        const options = await atlasBaggageCase(verification.bookingId);
        baggage = options.some((option) => option.weight_kg >= CONTRACT.minBaggageKg)
          ? "VERIFIED"
          : "UNAVAILABLE";
      } catch {
        baggage = "PENDING";
      }
    }

    const selectedWithVerification = { ...selected, baggage };
    const updated = candidates.map((candidate) =>
      candidate.id === selected.id ? selectedWithVerification : candidate,
    );
    const decision =
      baggage === "UNAVAILABLE"
        ? "BLOCK"
        : selected.outcome === "VALID_HUMAN"
          ? "ESCALATE"
          : "ALLOW";

    return {
      mode: "live",
      provider: {
        label: "Atlas Sandbox",
        status: "READY",
        detail: `Search ${search.searchId ?? "complete"} · ${search.offerCount} offers · ${updated.length} normalized candidates.`,
      },
      disruption: {
        route: "SGN → SIN",
        originalArrival: "15:05",
        disruptedArrival: "21:05",
        delayHours: 6,
      },
      contract: CONTRACT,
      candidates: updated,
      selectedId: selected.id,
      verify: {
        status: "ATLAS_VERIFIED",
        summary:
          verification.priceChange === "increased"
            ? "Atlas reports a fare increase; a new exact approval is required."
            : "Atlas offer verified before authority evaluation.",
        ...(verification.bookingId ? { bookingId: verification.bookingId } : {}),
        ...(verification.baggageSupported === undefined
          ? {}
          : { baggageSupported: verification.baggageSupported }),
        ...(verification.seatSupported === undefined
          ? {}
          : { seatSupported: verification.seatSupported }),
        priceChange: verification.priceChange,
      },
      authority: {
        decision,
        reason:
          baggage === "UNAVAILABLE"
            ? `Blocked: Atlas could not satisfy the ${CONTRACT.minBaggageKg}kg baggage contract.`
            : verification.priceChange === "increased"
              ? "Escalate: provider price changed after selection."
              : selected.outcome === "VALID_HUMAN"
                ? `Escalate: +$${selected.extraCostUsd.toFixed(0)} exceeds delegated spend.`
                : "Allow: hard outcome preserved and delegated spend remains valid.",
      },
      journey: buildJourney({ source: "live", selected, verified: true }),
    };
  } catch (error) {
    return {
      mode: "live",
      provider: {
        label: "Atlas Sandbox",
        status: "ERROR",
        detail:
          error instanceof AtlasCaseStudyError
            ? `Atlas returned ${error.code}.`
            : "Atlas live case study failed closed.",
      },
      disruption: {
        route: "SGN → SIN",
        originalArrival: "15:05",
        disruptedArrival: "21:05",
        delayHours: 6,
      },
      contract: CONTRACT,
      candidates: [],
      selectedId: null,
      verify: { status: "FAILED", summary: "Live provider verification is unavailable." },
      authority: { decision: "BLOCK", reason: "Fail closed without verified provider evidence." },
      journey: buildJourney({ source: "live", selected: null, verified: false }),
    };
  }
}

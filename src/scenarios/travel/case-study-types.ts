export interface TravelOutcomeContract {
  latestArrival: string;
  minBaggageKg: number;
  maxExtraSpendUsd: number;
  autopilot: boolean;
}

export interface TravelCaseCandidate {
  id: string;
  source: "ATLAS_SANDBOX" | "DEMO_FIXTURE";
  flightNumber: string;
  carrier: string;
  departure: string;
  arrival: string;
  arrivalDayOffset: number;
  replacementPriceUsd: number;
  extraCostUsd: number;
  stops: number;
  bookable: boolean;
  priceStatus: string;
  outcome: "REJECTED" | "VALID_AUTO" | "VALID_HUMAN";
  reasons: string[];
  baggage: "VERIFIED" | "PENDING" | "UNAVAILABLE";
}

export interface TravelJourneyStep {
  id: string;
  actor: "AIRLINE" | "AI" | "ATLAS" | "POLICY" | "HUMAN" | "SOLANA" | "PROVIDER";
  title: string;
  detail: string;
  state: "DONE" | "CURRENT" | "WAITING" | "BLOCKED";
}

export interface TravelCaseStudy {
  mode: "demo" | "live";
  provider: {
    label: string;
    status: "FIXTURE" | "READY" | "AUTH_REQUIRED" | "ERROR";
    detail: string;
  };
  disruption: {
    route: string;
    originalArrival: string;
    disruptedArrival: string;
    delayHours: number;
  };
  contract: TravelOutcomeContract;
  candidates: TravelCaseCandidate[];
  selectedId: string | null;
  verify: {
    status: "DEMO_VERIFIED" | "ATLAS_VERIFIED" | "NOT_RUN" | "FAILED";
    summary: string;
    bookingId?: string;
    baggageSupported?: boolean;
    seatSupported?: boolean;
    priceChange?: "unchanged" | "decreased" | "increased";
  };
  authority: {
    decision: "ALLOW" | "ESCALATE" | "BLOCK";
    reason: string;
  };
  journey: TravelJourneyStep[];
}

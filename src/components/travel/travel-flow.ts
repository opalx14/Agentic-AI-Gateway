import type { WalletAuthorityState } from "@/components/PhantomWalletControl";
import type {
  BookingSelections,
  TravelBookingRecord,
} from "@/scenarios/travel/booking-history";
import type { TravelCatalogOption } from "@/scenarios/travel/catalog-registry";
import type { AgenticTripPlan } from "@/scenarios/travel/agentic-types";

export type BookingStage =
  | "flight"
  | "hotel"
  | "transfer"
  | "final"
  | "complete";
export type ServiceStage = Exclude<BookingStage, "final" | "complete">;

export type FinalDigest = {
  actionHashHex: string;
  payloadDigestHex: string;
  total: number;
};

export type OnchainResult = {
  transactionSignature: string;
  slot: number | null;
  explorerUrl: string;
  policyPda: string;
  approvalPda: string;
  authorizationPda: string;
  nonce: number;
  policyState: "EXISTING" | "BOOTSTRAPPED" | "REFRESHED";
  verified: true;
};

export type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  start(): void;
  onresult: (event: {
    results: ArrayLike<{ 0: { transcript: string } }>;
  }) => void;
};

export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export const STEP_ORDER = ["flight", "hotel", "transfer", "final"] as const;

export const STEP_LABELS: Record<(typeof STEP_ORDER)[number], string> = {
  flight: "Flight",
  hotel: "Hotel",
  transfer: "Airport ride",
  final: "Final review",
};

export const DEMO_PROMPTS = [
  {
    label: "Tokyo · 4 days",
    prompt:
      "Plan me a 4-day Tokyo trip starting 2026-11-07. I like local food, culture and walkable neighborhoods. Budget $1,200.",
  },
  {
    label: "Singapore · creator event",
    prompt: "Plan Singapore for 3 days starting 2026-11-07 around a creator event. Budget $900.",
  },
  {
    label: "Bali · quiet stay",
    prompt: "Plan Bali for 5 days starting 2026-11-07 with a quiet hotel and local food. Budget $1,000.",
  },
] as const;

export const SEARCH_STORIES: Record<
  ServiceStage,
  Array<{ message: string; duration: number }>
> = {
  flight: [
    { message: "Reading route, budget and trip constraints…", duration: 850 },
    { message: "Matching departure and arrival airports…", duration: 1_050 },
    { message: "Comparing airline timing and sample fares…", duration: 1_250 },
    { message: "Ranking the shortlist for your trip…", duration: 1_050 },
  ],
  hotel: [
    { message: "Reading the selected arrival window…", duration: 800 },
    { message: "Scanning destination-local hotel areas…", duration: 1_000 },
    { message: "Checking stay fit against the trip graph…", duration: 1_100 },
    { message: "Ranking the hotel shortlist…", duration: 900 },
  ],
  transfer: [
    { message: "Reading airport and arrival timing…", duration: 750 },
    { message: "Matching destination-local transport…", duration: 950 },
    { message: "Checking transfer timing against the draft…", duration: 950 },
    { message: "Preparing the final ride shortlist…", duration: 750 },
  ],
};

export const AGENT_STORY = [
  { message: "Understanding your trip request…", duration: 750 },
  { message: "Building the trip graph and dependencies…", duration: 950 },
  { message: "Checking budget and destination constraints…", duration: 900 },
  { message: "Preparing the first provider search…", duration: 700 },
] as const;

export const SELECTION_HANDOFF_MS = 1_150;

export function subscribeSpeechSupport() {
  return () => {};
}

export function getSpeechSupportSnapshot() {
  return (
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
  );
}

export function getServerSpeechSupportSnapshot() {
  return false;
}

export function short(value: string, head = 10, tail = 7) {
  if (value.length <= head + tail + 1) return value;
  return value.slice(0, head) + "…" + value.slice(-tail);
}

export function nextStageForPlan(
  plan: AgenticTripPlan,
  stage: ServiceStage,
): "flight" | "hotel" | "transfer" | "final" {
  const ordered: ServiceStage[] = ["flight", "hotel", "transfer"];
  const required = ordered.filter((item) => {
    if (item === "flight") return plan.intent.requestedServices.includes("FLIGHT");
    if (item === "hotel") return plan.intent.requestedServices.includes("STAY");
    return plan.intent.requestedServices.includes("TRANSFER");
  });
  const currentIndex = required.indexOf(stage);
  return required[currentIndex + 1] ?? "final";
}

export function stageTitle(stage: BookingStage) {
  if (stage === "flight") return "Choose one flight";
  if (stage === "hotel") return "Choose one hotel";
  if (stage === "transfer") return "Choose your airport ride";
  if (stage === "final") return "Review the exact trip";
  return "Final AI action verified";
}

export function stageCopy(stage: BookingStage) {
  if (stage === "flight") {
    return "AI searched and ranked demo flight inventory off-chain. Your selection updates the local booking draft only.";
  }
  if (stage === "hotel") {
    return "Flight is in the draft. Review one destination-local hotel; this still does not write to Solana.";
  }
  if (stage === "transfer") {
    return "Choose a destination-local airport ride. The draft remains off-chain until the final review.";
  }
  if (stage === "final") {
    return "Review the exact flight, hotel, ride, amount and wallet authority before the only on-chain verification step.";
  }
  return "The exact final AI action was signed and read back from Solana.";
}

export function inferChangeStage(prompt: string): ServiceStage {
  if (/hotel|stay|room|phòng|khách sạn|khach san/i.test(prompt)) {
    return "hotel";
  }
  if (
    /ride|transfer|taxi|car|train|airport transport|xe|đưa đón|dua don/i.test(
      prompt,
    )
  ) {
    return "transfer";
  }
  return "flight";
}

export function replanStage(plan: AgenticTripPlan): BookingStage {
  const flight = plan.nodes.find((node) => node.kind === "FLIGHT");
  if (flight && ["REPLANNED", "AFFECTED"].includes(flight.status)) {
    return "flight";
  }

  const stay = plan.nodes.find((node) => node.kind === "STAY");
  if (stay && stay.status === "REPLANNED") {
    return "hotel";
  }

  const transfer = plan.nodes.find((node) => node.kind === "TRANSFER");
  if (transfer && transfer.status === "REPLANNED") {
    return "transfer";
  }

  return "final";
}

export function bookingStage(record: TravelBookingRecord): BookingStage {
  if (record.verificationStatus === "VERIFIED" || record.lifecycleStatus === "DEMO_COMPLETE") return "complete";
  const required = record.plan.intent.requestedServices;
  if (required.includes("FLIGHT") && !record.selectedFlight) return "flight";
  if (
    required.includes("STAY") &&
    (!record.selectedHotel || record.needsReview.includes("hotel"))
  ) {
    return "hotel";
  }
  if (
    required.includes("TRANSFER") &&
    (!record.selectedTransfer || record.needsReview.includes("transfer"))
  ) {
    return "transfer";
  }
  return "final";
}

export type TravelFlowSnapshot = {
  prompt: string;
  requests: string[];
  clarificationQuestion: string;
  plan: AgenticTripPlan | null;
  stage: BookingStage;
  searching: boolean;
  searchStatus: string;
  agentStatus: string;
  choices: TravelCatalogOption[];
  selections: BookingSelections;
  notice: string;
  busy: boolean;
  error: string;
  finalDigest: FinalDigest | null;
  bookings: TravelBookingRecord[];
  activeBooking: TravelBookingRecord | null;
  historyOpen: boolean;
  walletAuthority: WalletAuthorityState;
  walletConnected: boolean;
  speechSupported: boolean;
  total: number;
  activeStepIndex: number;
};

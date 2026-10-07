import type { AgenticTripPlan } from "./agentic-types";
import type { TravelCatalogOption } from "./catalog-registry";

export const PENDING_BOOKING_TTL_MS = 60 * 60 * 1000;

export type BookingLifecycleStatus =
  | "PENDING"
  | "READY_TO_VERIFY"
  | "ONCHAIN_VERIFIED"
  | "DEMO_COMPLETE"
  | "PAYMENT_CONFIRMED"
  | "SUPERSEDED";

export type BookingVerificationStatus = "UNVERIFIED" | "VERIFIED";
export type BookingPaymentStatus =
  | "NOT_STARTED"
  | "NOT_ENABLED"
  | "PENDING"
  | "CONFIRMED"
  | "FAILED";

export type BookingSelections = {
  flight?: TravelCatalogOption;
  hotel?: TravelCatalogOption;
  transfer?: TravelCatalogOption;
};

export type TravelBookingRecord = {
  id: string;
  bookingReference?: string;
  tripId: string;
  version: number;
  previousVersionId?: string;
  title: string;
  destination: string;
  origin: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  status: BookingLifecycleStatus;
  lifecycleStatus: BookingLifecycleStatus;
  walletAddress: string | null;
  walletProvider?: "email" | "phantom" | "demo" | null;
  prompt: string;
  selectedFlight?: TravelCatalogOption;
  selectedHotel?: TravelCatalogOption;
  selectedTransfer?: TravelCatalogOption;
  needsReview: Array<"hotel" | "transfer">;
  total: number;
  currency: "USD";
  paymentStatus: BookingPaymentStatus;
  finalActionDigest?: string;
  finalTx?: string;
  finalExplorerUrl?: string;
  finalSlot?: number | null;
  policyPda?: string;
  approvalPda?: string;
  authorizationPda?: string;
  nonce?: number;
  policyState?: "EXISTING" | "BOOTSTRAPPED" | "REFRESHED";
  network?: "Solana Devnet";
  verificationStatus: BookingVerificationStatus;
  plan: AgenticTripPlan;
};

export const BOOKING_HISTORY_KEY = "agentic-ai-gateway:travel-bookings:v3";

export function bookingHistoryKey(walletAddress: string) {
  return `${BOOKING_HISTORY_KEY}:${walletAddress}`;
}

export function hasConnectedTravelWallet(input: { address: string | null; status: string }) {
  return !!input.address && (input.status === "connected" || input.status === "verified");
}

export function bookingId(tripId: string, version: number) {
  return tripId + ":v" + version;
}

function destinationCode(record: Pick<TravelBookingRecord, "plan">) {
  const city = record.plan.destination.city.toUpperCase().replace(/[^A-Z]/g, "");
  return (city.slice(0, 3) || "TRP").padEnd(3, "X");
}

function referenceSuffix(record: Pick<TravelBookingRecord, "tripId" | "version" | "finalActionDigest">) {
  const source = `${record.tripId}:${record.version}:${record.finalActionDigest ?? ""}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, "0").slice(0, 6);
}

export function createBookingReference(record: Pick<TravelBookingRecord, "tripId" | "version" | "finalActionDigest" | "plan">) {
  return `AAG-${destinationCode(record)}-${referenceSuffix(record)}`;
}

export function createDemoBookingReference(record: Pick<TravelBookingRecord, "tripId" | "version" | "finalActionDigest" | "plan">) {
  return `DEMO-${destinationCode(record)}-${referenceSuffix(record)}`;
}

export function selectionsFromRecord(record: TravelBookingRecord): BookingSelections {
  return {
    flight: record.selectedFlight,
    hotel: record.selectedHotel,
    transfer: record.selectedTransfer,
  };
}

export function bookingTotal(selections: BookingSelections) {
  return (
    (selections.flight?.amount ?? 0) +
    (selections.hotel?.amount ?? 0) +
    (selections.transfer?.amount ?? 0)
  );
}

export function selectionsCompleteForPlan(
  plan: AgenticTripPlan,
  selections: BookingSelections,
) {
  const required = plan.intent.requestedServices;
  return (
    (!required.includes("FLIGHT") || !!selections.flight) &&
    (!required.includes("STAY") || !!selections.hotel) &&
    (!required.includes("TRANSFER") || !!selections.transfer)
  );
}

export function createBookingRecord(input: {
  plan: AgenticTripPlan;
  prompt: string;
  origin: string;
  walletAddress: string | null;
  walletProvider?: "email" | "phantom" | "demo" | null;
  selections?: BookingSelections;
  previousVersionId?: string;
  needsReview?: Array<"hotel" | "transfer">;
  createdAt?: string;
}): TravelBookingRecord {
  const now = input.createdAt ?? new Date().toISOString();
  const selections = input.selections ?? {};
  const total = bookingTotal(selections);
  const complete = selectionsCompleteForPlan(input.plan, selections);
  const lifecycleStatus: BookingLifecycleStatus = complete ? "READY_TO_VERIFY" : "PENDING";

  return {
    id: bookingId(input.plan.id, input.plan.version),
    tripId: input.plan.id,
    version: input.plan.version,
    previousVersionId: input.previousVersionId,
    title: input.plan.destination.city + " trip",
    destination: input.plan.destination.city + ", " + input.plan.destination.country,
    origin: input.origin,
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(new Date(now).getTime() + PENDING_BOOKING_TTL_MS).toISOString(),
    status: lifecycleStatus,
    lifecycleStatus,
    walletAddress: input.walletAddress,
    walletProvider: input.walletProvider ?? null,
    prompt: input.prompt,
    selectedFlight: selections.flight,
    selectedHotel: selections.hotel,
    selectedTransfer: selections.transfer,
    needsReview: input.needsReview ?? [],
    total,
    currency: "USD",
    paymentStatus: "NOT_STARTED",
    verificationStatus: "UNVERIFIED",
    plan: input.plan,
  };
}

export function updateBookingSelections(
  record: TravelBookingRecord,
  selections: BookingSelections,
  needsReview: Array<"hotel" | "transfer"> = record.needsReview,
): TravelBookingRecord {
  const complete = selectionsCompleteForPlan(record.plan, selections);
  const lifecycleStatus: BookingLifecycleStatus =
    complete && needsReview.length === 0 ? "READY_TO_VERIFY" : "PENDING";
  return {
    ...record,
    selectedFlight: selections.flight,
    selectedHotel: selections.hotel,
    selectedTransfer: selections.transfer,
    needsReview,
    total: bookingTotal(selections),
    status: lifecycleStatus,
    lifecycleStatus,
    paymentStatus: record.paymentStatus === "NOT_ENABLED" ? "NOT_ENABLED" : "NOT_STARTED",
    updatedAt: new Date().toISOString(),
  };
}

export function markBookingVerified(
  record: TravelBookingRecord,
  input: {
    digest: string;
    tx: string;
    explorerUrl: string;
    slot: number | null;
    policyPda: string;
    approvalPda: string;
    authorizationPda: string;
    nonce: number;
    policyState: "EXISTING" | "BOOTSTRAPPED" | "REFRESHED";
  },
): TravelBookingRecord {
  const verified: TravelBookingRecord = {
    ...record,
    status: "ONCHAIN_VERIFIED",
    lifecycleStatus: "ONCHAIN_VERIFIED",
    verificationStatus: "VERIFIED",
    paymentStatus: "NOT_ENABLED",
    finalActionDigest: input.digest,
    finalTx: input.tx,
    finalExplorerUrl: input.explorerUrl,
    finalSlot: input.slot,
    policyPda: input.policyPda,
    approvalPda: input.approvalPda,
    authorizationPda: input.authorizationPda,
    nonce: input.nonce,
    policyState: input.policyState,
    network: "Solana Devnet",
    expiresAt: undefined,
    updatedAt: new Date().toISOString(),
  };
  return {
    ...verified,
    bookingReference: record.bookingReference ?? createBookingReference(verified),
  };
}

export function markBookingDemoComplete(
  record: TravelBookingRecord,
  digest: string,
): TravelBookingRecord {
  const completed: TravelBookingRecord = {
    ...record,
    status: "DEMO_COMPLETE",
    lifecycleStatus: "DEMO_COMPLETE",
    verificationStatus: "UNVERIFIED",
    paymentStatus: "NOT_ENABLED",
    finalActionDigest: digest,
    expiresAt: undefined,
    updatedAt: new Date().toISOString(),
  };

  return {
    ...completed,
    bookingReference:
      record.bookingReference ?? createDemoBookingReference(completed),
  };
}

export function supersedeBooking(record: TravelBookingRecord): TravelBookingRecord {
  return {
    ...record,
    status: "SUPERSEDED",
    lifecycleStatus: "SUPERSEDED",
    updatedAt: new Date().toISOString(),
  };
}

export function isExpiredPendingBooking(record: TravelBookingRecord, now = Date.now()) {
  if (record.verificationStatus === "VERIFIED") return false;
  if (record.lifecycleStatus !== "PENDING" && record.lifecycleStatus !== "READY_TO_VERIFY") return false;
  if (!record.expiresAt) return false;
  return now > new Date(record.expiresAt).getTime();
}

export function cleanupExpiredPendingBookings(records: TravelBookingRecord[], now = Date.now()) {
  return records.filter((record) => !isExpiredPendingBooking(record, now));
}

export function upsertBooking(
  records: TravelBookingRecord[],
  record: TravelBookingRecord,
): TravelBookingRecord[] {
  const next = records.filter((item) => item.id !== record.id);
  return [record, ...next].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function readBookings(
  storage: Pick<Storage, "getItem" | "setItem">,
  walletAddress: string | null,
): TravelBookingRecord[] {
  if (!walletAddress) return [];
  try {
    const key = bookingHistoryKey(walletAddress);
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const scoped = cleanupExpiredPendingBookings(
      (parsed as TravelBookingRecord[]).filter((record) => record.walletAddress === walletAddress),
    );
    if (scoped.length !== parsed.length) {
      storage.setItem(key, JSON.stringify(scoped));
    }
    return scoped;
  } catch {
    return [];
  }
}

export function writeBookings(
  storage: Pick<Storage, "setItem">,
  walletAddress: string | null,
  records: TravelBookingRecord[],
) {
  if (!walletAddress) return;
  const scoped = cleanupExpiredPendingBookings(
    records.filter((record) => record.walletAddress === walletAddress),
  );
  storage.setItem(bookingHistoryKey(walletAddress), JSON.stringify(scoped));
}

export function removeBookingFromWallet(
  storage: Pick<Storage, "getItem" | "setItem">,
  walletAddress: string | null,
  bookingIdToRemove: string,
) {
  if (!walletAddress) return;
  const next = readBookings(storage, walletAddress).filter(
    (record) => record.id !== bookingIdToRemove,
  );
  writeBookings(storage, walletAddress, next);
}

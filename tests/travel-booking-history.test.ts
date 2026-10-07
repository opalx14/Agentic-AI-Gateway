import { describe, expect, test } from "bun:test";

import {
  cleanupExpiredPendingBookings,
  createBookingRecord,
  createBookingReference,
  hasConnectedTravelWallet,
  markBookingDemoComplete,
  markBookingVerified,
  readBookings,
  supersedeBooking,
  updateBookingSelections,
  upsertBooking,
  writeBookings,
} from "@/scenarios/travel/booking-history";
import { planAgenticTrip } from "@/scenarios/travel/agentic-orchestrator";
import { buildCatalogOptions } from "@/scenarios/travel/catalog-registry";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

async function fixture() {
  const plan = await planAgenticTrip({
    prompt: "Tokyo 4 days budget $1200",
    planner: "fixture",
    mode: "demo",
    origin: "SGN",
  });
  const common = {
    destinationKey: "tokyo",
    city: "Tokyo",
    origin: "SGN",
    destinationAirport: "NRT",
    days: 4,
  };
  const flight = buildCatalogOptions({ stage: "flight", ...common, baseAmount: 310 })[0]!;
  const hotel = buildCatalogOptions({ stage: "hotel", ...common, baseAmount: 315 })[0]!;
  const transfer = buildCatalogOptions({ stage: "transfer", ...common, baseAmount: 28 })[0]!;
  return { plan, flight, hotel, transfer };
}

function verify(record: ReturnType<typeof createBookingRecord>) {
  return markBookingVerified(record, {
    digest: "a".repeat(64),
    tx: "tx-old",
    explorerUrl: "https://explorer.solana.com/tx/tx-old?cluster=devnet",
    slot: 123,
    policyPda: "policy-pda",
    approvalPda: "approval",
    authorizationPda: "authorization",
    nonce: 7,
    policyState: "EXISTING",
  });
}

describe("travel booking history", () => {
  test("detects connected wallet authority without gating trip drafting", () => {
    expect(hasConnectedTravelWallet({ address: null, status: "disconnected" })).toBe(false);
    expect(hasConnectedTravelWallet({ address: "wallet", status: "disconnected" })).toBe(false);
    expect(hasConnectedTravelWallet({ address: "wallet", status: "connected" })).toBe(true);
    expect(hasConnectedTravelWallet({ address: "wallet", status: "verified" })).toBe(true);
  });

  test("saves verified receipt evidence and truthful payment state", async () => {
    const { plan, flight, hotel, transfer } = await fixture();
    const draft = createBookingRecord({
      plan,
      prompt: plan.prompt,
      origin: "SGN",
      walletAddress: "wallet",
      walletProvider: "demo",
    });
    const ready = updateBookingSelections(draft, { flight, hotel, transfer });
    expect(ready.status).toBe("READY_TO_VERIFY");

    const verified = verify(ready);
    expect(verified.status).toBe("ONCHAIN_VERIFIED");
    expect(verified.verificationStatus).toBe("VERIFIED");
    expect(verified.paymentStatus).toBe("NOT_ENABLED");
    expect(verified.bookingReference).toMatch(/^AAG-TOK-[A-F0-9]{6}$/);
    expect(verified.policyPda).toBe("policy-pda");
    expect(verified.approvalPda).toBe("approval");
    expect(verified.authorizationPda).toBe("authorization");
    expect(verified.finalExplorerUrl).toContain("cluster=devnet");

    const storage = memoryStorage();
    writeBookings(storage, "wallet", [verified]);
    const loaded = readBookings(storage as unknown as Storage, "wallet");
    expect(loaded[0]?.bookingReference).toBe(verified.bookingReference);
    expect(loaded[0]?.selectedFlight?.id).toBe(flight.id);
    expect(loaded[0]?.finalSlot).toBe(123);
  });

  test("completes Demo Wallet locally without claiming on-chain verification", async () => {
    const { plan, flight, hotel, transfer } = await fixture();
    const draft = createBookingRecord({
      plan,
      prompt: plan.prompt,
      origin: "SGN",
      walletAddress: "demo-wallet",
      walletProvider: "demo",
    });
    const ready = updateBookingSelections(draft, { flight, hotel, transfer });
    const completed = markBookingDemoComplete(ready, "d".repeat(64));

    expect(completed.lifecycleStatus).toBe("DEMO_COMPLETE");
    expect(completed.verificationStatus).toBe("UNVERIFIED");
    expect(completed.paymentStatus).toBe("NOT_ENABLED");
    expect(completed.finalTx).toBeUndefined();
    expect(completed.approvalPda).toBeUndefined();
    expect(completed.bookingReference).toMatch(/^DEMO-TOK-[A-F0-9]{6}$/);
    expect(completed.expiresAt).toBeUndefined();
  });

  test("cleans expired pending drafts but never verified or superseded verified history", async () => {
    const { plan } = await fixture();
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const recent = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const expired = createBookingRecord({ plan, prompt: plan.prompt, origin: "SGN", walletAddress: "wallet", createdAt: old });
    const active = createBookingRecord({ ...{ plan, prompt: plan.prompt, origin: "SGN", walletAddress: "wallet" }, createdAt: recent });
    const verified = verify(expired);
    const superseded = supersedeBooking(verified);

    expect(cleanupExpiredPendingBookings([expired])).toHaveLength(0);
    expect(cleanupExpiredPendingBookings([active])).toHaveLength(1);
    expect(cleanupExpiredPendingBookings([verified])).toHaveLength(1);
    expect(cleanupExpiredPendingBookings([superseded])).toHaveLength(1);
  });

  test("booking reference is stable and distinct for confirmed bookings", async () => {
    const { plan } = await fixture();
    const a = createBookingRecord({ plan, prompt: plan.prompt, origin: "SGN", walletAddress: "wallet" });
    const b = { ...a, tripId: a.tripId + "-other", id: a.id + "-other" };
    const refA1 = createBookingReference({ ...a, finalActionDigest: "a".repeat(64) });
    const refA2 = createBookingReference({ ...a, finalActionDigest: "a".repeat(64) });
    const refB = createBookingReference({ ...b, finalActionDigest: "b".repeat(64) });
    expect(refA1).toBe(refA2);
    expect(refA1).not.toBe(refB);
  });

  test("keeps permanent booking history isolated by wallet authority", async () => {
    const { plan } = await fixture();
    const storage = memoryStorage();
    const walletA = createBookingRecord({
      plan,
      prompt: plan.prompt,
      origin: "SGN",
      walletAddress: "wallet-a",
      walletProvider: "phantom",
    });
    const walletB = {
      ...walletA,
      id: walletA.id + ":wallet-b",
      walletAddress: "wallet-b",
      walletProvider: "email" as const,
    };

    writeBookings(storage, "wallet-a", [walletA]);
    writeBookings(storage, "wallet-b", [walletB]);

    expect(readBookings(storage as unknown as Storage, "wallet-a").map((item) => item.walletAddress)).toEqual(["wallet-a"]);
    expect(readBookings(storage as unknown as Storage, "wallet-b").map((item) => item.walletAddress)).toEqual(["wallet-b"]);
    expect(readBookings(storage as unknown as Storage, null)).toEqual([]);

    const merged = upsertBooking([walletA], walletA);
    expect(merged).toHaveLength(1);
  });
});

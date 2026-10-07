import { describe, expect, test } from "bun:test";

import { parseCliOutput } from "../../src/scenarios/travel/atlas-cli/cli-parser";
import { buildDemoTravelCaseStudy } from "../../src/scenarios/travel/case-study";

describe("Travel case study", () => {
  test("shows why cheapest can be rejected before spend authority is considered", () => {
    const study = buildDemoTravelCaseStudy();
    const cheapest = study.candidates.find((candidate) => candidate.id === "demo-cheapest-late");
    const autonomous = study.candidates.find((candidate) => candidate.id === "demo-auto");
    const human = study.candidates.find((candidate) => candidate.id === "demo-human");

    expect(cheapest?.extraCostUsd).toBe(5);
    expect(cheapest?.outcome).toBe("REJECTED");
    expect(cheapest?.reasons[0]).toContain("17:00");

    expect(autonomous?.outcome).toBe("VALID_AUTO");
    expect(study.selectedId).toBe("demo-auto");
    expect(study.authority.decision).toBe("ALLOW");

    expect(human?.outcome).toBe("VALID_HUMAN");
  });

  test("exposes an explicit observe-search-evaluate-verify-policy-proof journey", () => {
    const study = buildDemoTravelCaseStudy();

    expect(study.journey.map((step) => step.actor)).toEqual([
      "AIRLINE",
      "ATLAS",
      "AI",
      "ATLAS",
      "POLICY",
      "SOLANA",
    ]);
    expect(study.verify.status).toBe("DEMO_VERIFIED");
  });
});

describe("official atlas-flight CLI parser", () => {
  test("parses the normalized FLIGHT_SEARCHED envelope and preserves opaque offer ids", () => {
    const parsed = parseCliOutput(
      JSON.stringify({
        schema_version: "1",
        status: "ok",
        code: "FLIGHT_SEARCHED",
        data: {
          search_id: "search_opaque_1",
          offer_count: 1,
          offers: [
            {
              offer_id: "offer_opaque_1",
              currency: "USD",
              total_price: 215,
              segments: [
                {
                  departure_airport: "SGN",
                  arrival_airport: "SIN",
                  departure_time: "202611061330",
                  arrival_time: "202611061620",
                  carrier: "TR",
                  flight_number: "301",
                },
              ],
              bookable: true,
              price_status: "current",
            },
          ],
        },
      }),
    );

    expect(parsed.kind).toBe("SEARCH_OK");
    if (parsed.kind !== "SEARCH_OK") throw new Error("expected SEARCH_OK");
    expect(parsed.searchId).toBe("search_opaque_1");
    expect(parsed.offers[0]?.offer_id).toBe("offer_opaque_1");
    expect(parsed.offers[0]?.segments[0]?.departure_time).toBe("202611061330");
  });

  test("treats provider price increase as an explicit verification checkpoint", () => {
    const parsed = parseCliOutput(
      JSON.stringify({
        schema_version: "1",
        status: "action_required",
        code: "PRICE_CONFIRMATION_REQUIRED",
        data: {
          booking_id: "book_opaque_1",
          previous_price: 245,
          current_price: 248,
          currency: "USD",
          baggage_supported: true,
          seat_supported: true,
        },
      }),
    );

    expect(parsed.kind).toBe("VERIFY_OK");
    if (parsed.kind !== "VERIFY_OK") throw new Error("expected VERIFY_OK");
    expect(parsed.priceChange).toBe("increased");
    expect(parsed.currentPrice).toBe(248);
    expect(parsed.bookingId).toBe("book_opaque_1");
  });

  test("does not parse human-readable messages for control flow", () => {
    const parsed = parseCliOutput(
      JSON.stringify({
        schema_version: "1",
        status: "error",
        code: "AUTHORIZATION_REQUIRED",
        message: "This message can change without breaking the adapter.",
        data: {},
      }),
    );

    expect(parsed).toEqual({
      kind: "FAILURE",
      code: "AUTHORIZATION_REQUIRED",
    });
  });
});

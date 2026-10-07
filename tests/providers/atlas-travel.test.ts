import { describe, expect, test } from "bun:test";

import {
  AtlasTravelProvider,
  TRAVEL_SEARCH_FIXTURE,
  type AtlasCommandRunner,
} from "../../src/scenarios/travel";

class StubAtlasRunner implements AtlasCommandRunner {
  readonly calls: Array<{ args: string[]; stdin?: string }> = [];

  constructor(private readonly responses: string[]) {}

  async run(args: string[], stdin?: string): Promise<string> {
    this.calls.push({
      args,
      ...(stdin === undefined ? {} : { stdin }),
    });

    const response = this.responses.shift();

    if (!response) {
      throw new Error("No stub Atlas response configured.");
    }

    return response;
  }
}

function envelope(data: unknown) {
  return JSON.stringify({
    schema_version: "1",
    status: "ok",
    code: "OK",
    message: "",
    retryable: false,
    request_id: "atlas-test-1",
    data,
    details: null,
  });
}

describe("AtlasTravelProvider", () => {
  test("maps atlas-flight search envelope into provider-neutral options", async () => {
    const runner = new StubAtlasRunner([
      envelope({
        search_id: "search-1",
        currency: "USD",
        offers: [
          {
            offer_id: "atlas-offer-1",
            flight_no: "AT101",
            origin: "SGN",
            destination: "SIN",
            departIso: "2026-11-06T13:30:00+07:00",
            arriveIso: "2026-11-06T16:20:00+08:00",
            price: { base: 205, currency: "USD" },
            bags: { checked_fee: 10 },
          },
        ],
      }),
    ]);
    const provider = new AtlasTravelProvider({
      commandRunner: runner,
    });

    const options = await provider.searchFlights(TRAVEL_SEARCH_FIXTURE);

    expect(options).toHaveLength(1);
    expect(options[0]?.id).toBe("atlas-offer-1");
    expect(options[0]?.total).toBe(215);
    expect(options[0]?.additionalCost).toBe(15);
    expect(runner.calls[0]?.args).toEqual([
      "search",
      "--origin",
      "SGN",
      "--destination",
      "SIN",
      "--depart",
      "2026-11-06",
      "--adults",
      "1",
    ]);
  });

  test("maps production FLIGHT_SEARCHED offers into provider-neutral options", async () => {
    const runner = new StubAtlasRunner([
      JSON.stringify({
        schema_version: "1",
        status: "success",
        code: "FLIGHT_SEARCHED",
        message: "Flight search completed",
        retryable: false,
        request_id: "live-search-1",
        data: {
          search_id: "srch-live-1",
          offer_count: 1,
          offers: [
            {
              offer_id: "off-live-1",
              currency: "USD",
              total_price: 292.8,
              transaction_fee_total: 0,
              passenger_prices: [],
              segments: [
                {
                  departure_airport: "HAN",
                  arrival_airport: "ICN",
                  departure_time: "202611070140",
                  arrival_time: "202611070805",
                  carrier: "7C",
                  operating_carrier: null,
                  flight_number: "7C2202",
                  duration_minutes: 265,
                  cabin_class: 1,
                  direction: "outbound",
                },
              ],
              ancillary_supported: ["baggage", "seat"],
              bookable: true,
              price_status: "current",
              refresh_time: "2026-09-28T18:03:11Z",
              expire_time: "2026-09-28T18:34:11Z",
            },
          ],
        },
        details: {},
      }),
    ]);
    const provider = new AtlasTravelProvider({ commandRunner: runner });

    const options = await provider.searchFlights({
      ...TRAVEL_SEARCH_FIXTURE,
      origin: "HAN",
      destination: "ICN",
      departDate: "2026-11-07",
      adults: 2,
      baselineTotal: 0,
    });

    expect(options).toHaveLength(1);
    expect(options[0]?.id).toBe("off-live-1");
    expect(options[0]?.flightNumber).toBe("7C2202");
    expect(options[0]?.total).toBe(292.8);
    expect(options[0]?.carrier).toBe("7C");
    expect(options[0]?.stops).toBe(0);
    expect(options[0]?.durationMinutes).toBe(265);
    expect(options[0]?.departureAt).toBe("2026-11-07T01:40:00+07:00");
    expect(options[0]?.arrivalAt).toBe("2026-11-07T08:05:00+09:00");
  });

  test("surfaces Atlas authorization-required responses cleanly", async () => {
    const runner = new StubAtlasRunner([
      JSON.stringify({
        schema_version: "1",
        status: "action_required",
        code: "AUTHORIZATION_REQUIRED",
        message: "Authorization required",
        retryable: false,
        request_id: null,
        data: { authenticated: false },
        details: {},
      }),
    ]);
    const provider = new AtlasTravelProvider({ commandRunner: runner });

    await expect(
      provider.searchFlights(TRAVEL_SEARCH_FIXTURE),
    ).rejects.toThrow(
      "Atlas search failed: AUTHORIZATION_REQUIRED Authorization required",
    );
  });

  test("uses offer verify to produce the exact current additional cost", async () => {
    const runner = new StubAtlasRunner([
      envelope({
        booking_id: "atlas-booking-1",
        verified_total_with_bag: 248,
      }),
    ]);
    const provider = new AtlasTravelProvider({
      commandRunner: runner,
    });

    const option = {
      id: "atlas-offer-1",
      provider: "atlas" as const,
      flightNumber: "AT101",
      origin: "SGN",
      destination: "SIN",
      departureAt: "2026-11-06T13:30:00+07:00",
      arrivalAt: "2026-11-06T16:20:00+08:00",
      total: 245,
      additionalCost: 45,
      currency: "USD",
      expiresAt: 1_900_000_000_000,
    };

    const verified = await provider.verifyFlight({
      search: TRAVEL_SEARCH_FIXTURE,
      option,
    });

    expect(verified.total).toBe(248);
    expect(verified.additionalCost).toBe(48);
    expect(runner.calls[0]?.args).toEqual([
      "offer",
      "verify",
      "--offer-id",
      "atlas-offer-1",
    ]);
  });

  test("maps production OFFER_VERIFIED current_price", async () => {
    const runner = new StubAtlasRunner([
      JSON.stringify({
        schema_version: "1",
        status: "success",
        code: "OFFER_VERIFIED",
        message: "Offer verified",
        retryable: false,
        request_id: "verify-live-1",
        data: {
          booking_id: "book-live-1",
          previous_price: 292.8,
          current_price: 292.8,
          currency: "USD",
          price_change: "unchanged",
          requirements: { required_fields: ["name"] },
          travelers: [],
          segments: [],
          baggage_supported: true,
          seat_supported: true,
        },
        details: {},
      }),
    ]);
    const provider = new AtlasTravelProvider({ commandRunner: runner });
    const option = {
      id: "off-live-1",
      provider: "atlas" as const,
      flightNumber: "7C2202",
      origin: "HAN",
      destination: "ICN",
      departureAt: "2026-11-07T01:40:00+07:00",
      arrivalAt: "2026-11-07T08:05:00+09:00",
      total: 292.8,
      additionalCost: 292.8,
      currency: "USD",
      expiresAt: 1_900_000_000_000,
    };

    const verified = await provider.verifyFlight({
      search: {
        ...TRAVEL_SEARCH_FIXTURE,
        origin: "HAN",
        destination: "ICN",
        departDate: "2026-11-07",
        adults: 2,
        baselineTotal: 0,
      },
      option,
    });

    expect(verified.total).toBe(292.8);
    expect(verified.currency).toBe("USD");
    expect(runner.calls[0]?.args).toEqual([
      "offer",
      "verify",
      "--offer-id",
      "off-live-1",
    ]);
  });

  test("fails closed on order creation unless sandbox booking is explicitly enabled", async () => {
    const provider = new AtlasTravelProvider({
      commandRunner: new StubAtlasRunner([]),
    });
    const option = {
      id: "atlas-offer-1",
      provider: "atlas" as const,
      flightNumber: "AT101",
      origin: "SGN",
      destination: "SIN",
      departureAt: "2026-11-06T13:30:00+07:00",
      arrivalAt: "2026-11-06T16:20:00+08:00",
      total: 215,
      additionalCost: 15,
      currency: "USD",
      expiresAt: 1_900_000_000_000,
    };

    await expect(
      provider.createBooking({
        search: TRAVEL_SEARCH_FIXTURE,
        option,
      }),
    ).rejects.toThrow("Atlas sandbox booking is disabled");
  });
});

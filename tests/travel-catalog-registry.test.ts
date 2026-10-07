import { describe, expect, test } from "bun:test";

import {
  AIRPORTS,
  buildCatalogOptions,
  destinationCatalog,
  inferVietnamOrigin,
  liveFlightCatalogOptions,
} from "@/scenarios/travel/catalog-registry";

describe("travel country/provider registry", () => {
  test("maps the required international airports", () => {
    expect(AIRPORTS.SGN?.city).toBe("Ho Chi Minh City");
    expect(AIRPORTS.HAN?.city).toBe("Hanoi");
    expect(AIRPORTS.NRT?.country).toBe("Japan");
    expect(AIRPORTS.HND?.country).toBe("Japan");
    expect(AIRPORTS.SIN?.name).toContain("Changi");
    expect(AIRPORTS.DPS?.country).toBe("Indonesia");
  });

  test("Tokyo exposes NRT/HND with destination-local airlines", () => {
    const catalog = destinationCatalog("tokyo");
    expect(catalog.airports).toEqual(["NRT", "HND"]);

    const options = buildCatalogOptions({
      stage: "flight",
      destinationKey: "tokyo",
      city: "Tokyo",
      origin: "SGN",
      destinationAirport: "NRT",
      days: 4,
      baseAmount: 310,
    });

    expect(options.map((item) => item.amount)).toEqual(
      options.map((item) => item.amount).slice().sort((a, b) => a - b),
    );
    expect(options.some((item) => item.title === "ANA")).toBe(true);
    expect(options.some((item) => item.title === "Japan Airlines")).toBe(true);
    expect(options.every((item) => item.meta.includes("DEMO CATALOG"))).toBe(true);
    expect(options.every((item) => !!item.imageUrl)).toBe(true);
    expect(options.every((item) => ["NRT", "HND"].includes(item.airport?.code ?? ""))).toBe(true);
  });

  test("maps ranked Atlas offers into live UI choices without inventing inventory", () => {
    const options = liveFlightCatalogOptions(
      [
        {
          id: "atlas-offer-9",
          provider: "atlas",
          flightNumber: "KE682",
          origin: "HAN",
          destination: "ICN",
          departureAt: "2026-11-07T08:20:00+07:00",
          arrivalAt: "2026-11-07T14:25:00+09:00",
          total: 284,
          additionalCost: 284,
          currency: "USD",
          expiresAt: 1_900_000_000_000,
        },
      ],
      { "atlas-offer-9": "Morning full-service timing matches the request." },
    );

    expect(options).toHaveLength(1);
    expect(options[0]?.id).toBe("atlas-offer-9");
    expect(options[0]?.title).toBe("KE682");
    expect(options[0]?.source).toBe("ATLAS");
    expect(options[0]?.provider).toBe("atlas");
    expect(options[0]?.meta).toContain("ATLAS LIVE");
    expect(options[0]?.meta).toContain("Morning full-service");
    expect(options[0]?.flightOffer?.id).toBe("atlas-offer-9");
  });

  test("Japan transport does not fall back to Vietnam-only labels", () => {
    const options = buildCatalogOptions({
      stage: "transfer",
      destinationKey: "tokyo",
      city: "Tokyo",
      origin: "SGN",
      destinationAirport: "NRT",
      days: 4,
      baseAmount: 28,
    });

    expect(options.some((item) => /Tokyo|Japan|Narita|Haneda/i.test(item.title + " " + item.subtitle))).toBe(true);
    expect(options.some((item) => /Vietnam|Sài Gòn|Ho Chi Minh/i.test(item.title + " " + item.subtitle))).toBe(false);
  });

  test("Singapore maps to SIN and Bali maps to DPS", () => {
    expect(destinationCatalog("singapore").airports).toEqual(["SIN"]);
    expect(destinationCatalog("bali").airports).toEqual(["DPS"]);
  });

  test("Vietnam locale/timezone suggests SGN/HAN without claiming precise city", () => {
    const context = inferVietnamOrigin({
      timeZone: "Asia/Ho_Chi_Minh",
      language: "vi-VN",
    });

    expect(context.country).toBe("Vietnam");
    expect(context.selectedAirport).toBe("SGN");
    expect(context.airportOptions.map((item) => item.code)).toEqual(["SGN", "HAN"]);
    expect(context.confidence).toBe("country");
  });
});

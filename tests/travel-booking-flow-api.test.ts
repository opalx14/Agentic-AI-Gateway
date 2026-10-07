import { describe, expect, test } from "bun:test";

import { POST as catalogPost } from "@/app/api/scenarios/travel/catalog/route";
import { POST as selectionPost } from "@/app/api/scenarios/travel/selection/route";

describe("staged travel booking APIs", () => {
  test("flight catalog returns cheapest-to-premium demo options", async () => {
    const response = await catalogPost(new Request("http://local/api/scenarios/travel/catalog", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        stage: "flight",
        city: "Tokyo",
        destinationKey: "tokyo",
        origin: "SGN",
        destinationAirport: "NRT",
        days: 4,
        baseAmount: 310,
      }),
    }));
    expect(response.status).toBe(200);
    const body = await response.json() as {
      ok: true;
      source: string;
      options: Array<{
        amount: number;
        title: string;
        meta: string;
        imageUrl: string;
        airport?: { code: string; name: string };
      }>;
    };
    expect(body.ok).toBe(true);
    expect(body.source).toBe("DEMO");
    expect(body.options.map((item) => item.amount)).toEqual([268, 310, 396]);
    expect(body.options.map((item) => item.title)).toEqual([
      "Vietnam Airlines",
      "ANA",
      "Japan Airlines",
    ]);
    expect(body.options.every((item) => item.meta.includes("DEMO CATALOG"))).toBe(true);
    expect(body.options.every((item) => item.imageUrl.length > 0)).toBe(true);
    expect(body.options.some((item) => item.airport?.code === "NRT")).toBe(true);
    expect(body.options.some((item) => item.airport?.code === "HND")).toBe(true);
  });

  test("selection digest is deterministic and stage-bound", async () => {
    const payload = {
      planId: "trip-tokyo-demo",
      version: 1,
      stage: "flight" as const,
      optionId: "flight-balanced",
      label: "Vietnam Airlines",
      amount: 310,
    };
    const one = await selectionPost(new Request("http://local/api/scenarios/travel/selection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }));
    const two = await selectionPost(new Request("http://local/api/scenarios/travel/selection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }));
    const hotel = await selectionPost(new Request("http://local/api/scenarios/travel/selection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, stage: "hotel", optionId: "hotel-central" }),
    }));

    const a = await one.json() as { actionHashHex: string };
    const b = await two.json() as { actionHashHex: string };
    const c = await hotel.json() as { actionHashHex: string };
    expect(a.actionHashHex).toMatch(/^[a-f0-9]{64}$/);
    expect(a.actionHashHex).toBe(b.actionHashHex);
    expect(c.actionHashHex).not.toBe(a.actionHashHex);
  });
});

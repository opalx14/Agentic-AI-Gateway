import { z } from "zod";

import { buildCatalogOptions } from "@/scenarios/travel/catalog-registry";

const schema = z.object({
  stage: z.enum(["flight", "transfer", "hotel"]),
  city: z.string().min(1).max(120),
  destinationKey: z.string().min(1).max(80),
  origin: z.string().length(3),
  destinationAirport: z.string().length(3),
  days: z.number().int().min(1).max(14),
  baseAmount: z.number().int().positive().safe(),
}).strict();

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const options = buildCatalogOptions(input);

    return Response.json({
      ok: true,
      source: "DEMO",
      disclaimer: "DEMO CATALOG · sample fares/properties · availability not live",
      options,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "travel_catalog_failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

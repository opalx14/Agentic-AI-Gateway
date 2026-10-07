import { z } from "zod";

import { sha256Hex } from "@/scenarios/travel/agentic-orchestrator";
import { createAtlasTravelProviderFromEnv } from "@/scenarios/travel/providers/atlas";

const searchSchema = z.object({
  origin: z.string().length(3),
  destination: z.string().length(3),
  departDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.number().int().min(1).max(8),
  baselineTotal: z.number().finite().nonnegative(),
  currency: z.string().min(3).max(8),
}).strict();

const optionSchema = z.object({
  id: z.string().min(1).max(200),
  provider: z.literal("atlas"),
  flightNumber: z.string().min(1).max(40),
  origin: z.string().length(3),
  destination: z.string().length(3),
  departureAt: z.string().min(1),
  arrivalAt: z.string().min(1),
  total: z.number().finite().nonnegative(),
  additionalCost: z.number().finite().nonnegative(),
  currency: z.string().min(3).max(8),
  expiresAt: z.number().int().positive(),
  carrier: z.string().optional(),
  operatingCarrier: z.string().nullable().optional(),
  segmentCount: z.number().int().positive().optional(),
  stops: z.number().int().nonnegative().optional(),
  durationMinutes: z.number().int().nonnegative().optional(),
  cabinClass: z.number().int().nonnegative().optional(),
  bookable: z.boolean().optional(),
  ancillarySupported: z.array(z.string()).optional(),
  priceStatus: z.string().optional(),
}).strict();

const schema = z.object({
  planId: z.string().min(1).max(160),
  version: z.number().int().positive(),
  search: searchSchema,
  option: optionSchema,
}).strict();

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const provider = createAtlasTravelProviderFromEnv();
    const verified = await provider.verifyFlight({
      search: body.search,
      option: body.option,
    });
    const changed =
      verified.total !== body.option.total ||
      verified.currency.toUpperCase() !== body.option.currency.toUpperCase();

    const verificationDigestHex = sha256Hex({
      scenario: "whole-trip-agent-booking",
      tool: "atlas.offer.verify",
      planId: body.planId,
      version: body.version,
      offerId: verified.id,
      flightNumber: verified.flightNumber,
      origin: verified.origin,
      destination: verified.destination,
      departureAt: verified.departureAt,
      arrivalAt: verified.arrivalAt,
      total: verified.total,
      currency: verified.currency.toUpperCase(),
    });

    return Response.json({
      ok: true,
      changed,
      verified,
      verificationDigestHex,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "atlas_offer_verify_failed";
    const status =
      /AUTHORIZATION_REQUIRED|Authorization required|Atlas|atlas/i.test(message)
        ? 503
        : 400;
    return Response.json({ ok: false, error: message }, { status });
  }
}

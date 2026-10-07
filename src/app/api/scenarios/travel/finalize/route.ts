import { z } from "zod";

import { sha256Hex } from "@/scenarios/travel/agentic-orchestrator";

const selectedSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  amount: z.number().int().positive().safe(),
  evidenceDigestHex: z.string().length(64).optional(),
}).strict();

const schema = z.object({
  planId: z.string().min(1).max(120),
  version: z.number().int().positive(),
  wallet: z.string().min(20).max(80),
  traceRootHex: z.string().length(64),
  requestedServices: z.array(z.enum(["FLIGHT", "STAY", "TRANSFER", "ACTIVITY"])).min(1),
  flight: selectedSchema.optional(),
  hotel: selectedSchema.optional(),
  transfer: selectedSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.requestedServices.includes("FLIGHT") && !value.flight) {
    context.addIssue({ code: "custom", message: "flight_selection_required", path: ["flight"] });
  }
  if (value.requestedServices.includes("STAY") && !value.hotel) {
    context.addIssue({ code: "custom", message: "hotel_selection_required", path: ["hotel"] });
  }
  if (value.requestedServices.includes("TRANSFER") && !value.transfer) {
    context.addIssue({ code: "custom", message: "transfer_selection_required", path: ["transfer"] });
  }
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const total =
      (body.flight?.amount ?? 0) +
      (body.hotel?.amount ?? 0) +
      (body.transfer?.amount ?? 0);

    const canonical = {
      scenario: "whole-trip-agent-booking",
      planId: body.planId,
      version: body.version,
      wallet: body.wallet,
      traceRootHex: body.traceRootHex,
      requestedServices: body.requestedServices,
      selected: {
        flight: body.flight,
        hotel: body.hotel,
        transfer: body.transfer,
      },
      total,
      currency: "USD",
    };

    return Response.json({
      ok: true,
      actionHashHex: sha256Hex(canonical),
      payloadDigestHex: sha256Hex({ ...canonical, type: "final-booking-payload" }),
      total,
      canonical,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "final_booking_digest_failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

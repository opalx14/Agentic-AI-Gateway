import { z } from "zod";

import { sha256Hex } from "@/scenarios/travel/agentic-orchestrator";

const schema = z.object({
  planId: z.string().min(1).max(120),
  version: z.number().int().positive(),
  stage: z.enum(["flight", "transfer", "hotel", "payment"]),
  optionId: z.string().min(1).max(120),
  label: z.string().min(1).max(200),
  amount: z.number().int().positive().safe(),
}).strict();

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const actionHashHex = sha256Hex({
      scenario: "whole-trip-agent-booking",
      planId: body.planId,
      version: body.version,
      stage: body.stage,
      optionId: body.optionId,
      label: body.label,
      amount: body.amount,
      currency: "USD",
    });

    return Response.json({
      ok: true,
      actionHashHex,
      canonical: {
        ...body,
        currency: "USD",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "selection_digest_failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

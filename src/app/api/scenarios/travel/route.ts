import { z } from "zod";

import { buildTravelDemoResponse } from "@/scenarios/travel";

const requestSchema = z
  .object({
    optionId: z.enum(["flight-a", "flight-b"]).default("flight-a"),
    approved: z.boolean().optional(),
    priceChange: z.boolean().optional(),
  })
  .strict();

export async function POST(request: Request) {
  let decoded: unknown;

  try {
    decoded = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(decoded);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid Travel demo request." },
      { status: 400 },
    );
  }

  return Response.json(
    await buildTravelDemoResponse({
      optionId: parsed.data.optionId,
      ...(parsed.data.approved === undefined
        ? {}
        : { approved: parsed.data.approved }),
      ...(parsed.data.priceChange === undefined
        ? {}
        : { priceChange: parsed.data.priceChange }),
    }),
  );
}

import { z } from "zod";

import { buildLogisticsDemoResponse } from "@/scenarios/logistics";

const requestSchema = z
  .object({
    approved: z.boolean().optional(),
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
      { error: "Invalid Logistics demo request." },
      { status: 400 },
    );
  }

  return Response.json(
    await buildLogisticsDemoResponse({
      ...(parsed.data.approved === undefined
        ? {}
        : { approved: parsed.data.approved }),
    }),
  );
}

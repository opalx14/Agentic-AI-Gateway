import { z } from "zod";

import { prepareSettlementTransaction } from "@/lib/solana/agent-policy";

const schema = z.object({
  wallet: z.string().min(32),
  policyPda: z.string().min(32),
  items: z.array(
    z.object({
      authorizationPda: z.string().min(32),
      providerRef: z.string().min(1).max(240),
    }).strict(),
  ).min(1).max(8),
}).strict();

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const prepared = await prepareSettlementTransaction(body);
    return Response.json({ ok: true, prepared });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "prepare_settlement_failed";
    const status = /rpc|timeout/i.test(message) ? 503 : 400;
    return Response.json({ ok: false, error: message }, { status });
  }
}

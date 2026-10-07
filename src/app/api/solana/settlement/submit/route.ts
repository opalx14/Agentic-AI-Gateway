import { z } from "zod";

import { submitSettlementTransaction } from "@/lib/solana/agent-policy";

const itemSchema = z.object({
  authorizationPda: z.string().min(32),
  providerRefHashHex: z.string().regex(/^[a-f0-9]{64}$/i),
}).strict();

const preparedSchema = z.object({
  network: z.literal("devnet"),
  programId: z.string(),
  instruction: z.literal("settle_action"),
  wallet: z.string().min(32),
  policyPda: z.string().min(32),
  items: z.array(itemSchema).min(1).max(8),
  blockhash: z.string().min(32),
  lastValidBlockHeight: z.number().int().positive().safe(),
}).strict();

const schema = z.object({
  prepared: preparedSchema,
  signedTransactionBase64: z.string().min(100),
}).strict();

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const result = await submitSettlementTransaction(body);
    return Response.json({ ok: true, result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "submit_settlement_failed";
    const status = /rpc|timeout/i.test(message) ? 503 : 400;
    return Response.json({ ok: false, error: message }, { status });
  }
}

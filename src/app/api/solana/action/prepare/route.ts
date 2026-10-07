import { z } from "zod";
import { prepareActionApprovalTransaction } from "@/lib/solana/agent-policy";

const schema = z.object({
  wallet: z.string().min(32),
  policyPda: z.string().min(32).optional(),
  actionHashHex: z.string().regex(/^[a-f0-9]{64}$/i),
  amount: z.number().int().positive().safe(),
}).strict();

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const prepared = await prepareActionApprovalTransaction(body);
    return Response.json({ ok: true, prepared });
  } catch (error) {
    const message = error instanceof Error ? error.message : "prepare_action_transaction_failed";
    const status = /not_deployed|rpc|timeout/i.test(message) ? 503 : 400;
    return Response.json({ ok: false, error: message }, { status });
  }
}

import { z } from "zod";

import { submitInitializePolicyTransaction } from "@/lib/solana/agent-policy";

const draftSchema = z.object({
  authority: z.string().min(32),
  agentSigner: z.string().min(32),
  settlementAuthority: z.string().min(32),
  policyId: z.string().min(1).max(200),
  totalBudget: z.number().int().positive().safe(),
  maxPerAction: z.number().int().positive().safe(),
  autoApproveMax: z.number().int().nonnegative().safe(),
  expiresAt: z.number().int().positive().safe(),
  goal: z.string().min(1).max(500),
  allowedActions: z.array(z.string().min(1).max(100)).min(1).max(20),
});

const schema = z.object({
  draft: draftSchema,
  signedTransactionBase64: z.string().min(100),
  blockhash: z.string().min(32),
  lastValidBlockHeight: z.number().int().positive().safe(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const result = await submitInitializePolicyTransaction(body);
    return Response.json({ ok: true, result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "submit_policy_transaction_failed";
    const status =
      message === "agent_policy_program_not_deployed_on_devnet" ? 503 : 400;
    return Response.json({ ok: false, error: message }, { status });
  }
}

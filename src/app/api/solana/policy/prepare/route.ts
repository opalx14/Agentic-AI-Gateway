import { z } from "zod";

import {
  prepareInitializePolicyTransaction,
  recoverExistingPolicyEvidence,
} from "@/lib/solana/agent-policy";

const schema = z.object({
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

export async function POST(request: Request) {
  let body: z.infer<typeof schema>;

  try {
    body = schema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "prepare_policy_transaction_failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }

  try {
    const prepared = await prepareInitializePolicyTransaction(body);
    return Response.json({ ok: true, prepared });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "prepare_policy_transaction_failed";

    if (message === "policy_pda_already_exists") {
      try {
        const existing = await recoverExistingPolicyEvidence(body);
        return Response.json({ ok: true, existing });
      } catch (recoveryError) {
        const recoveryMessage =
          recoveryError instanceof Error
            ? recoveryError.message
            : "recover_policy_evidence_failed";
        return Response.json(
          { ok: false, error: recoveryMessage },
          { status: 400 },
        );
      }
    }

    const status =
      message === "agent_policy_program_not_deployed_on_devnet" ? 503 : 400;
    return Response.json({ ok: false, error: message }, { status });
  }
}

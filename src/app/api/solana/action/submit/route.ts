import { z } from "zod";
import { submitActionApprovalTransaction } from "@/lib/solana/agent-policy";

const policyRefreshSchema = z.object({
  totalBudget: z.number().int().positive().safe(),
  maxPerAction: z.number().int().positive().safe(),
  autoApproveMax: z.number().int().nonnegative().safe(),
  expiresAt: z.number().int().positive().safe(),
  settlementAuthority: z.string().min(32),
  goalHashHex: z.string().regex(/^[a-f0-9]{64}$/i),
  allowedActionsHashHex: z.string().regex(/^[a-f0-9]{64}$/i),
}).strict();

const policyBootstrapSchema = z.object({
  authority: z.string().min(32),
  policyId: z.string().min(1),
  agentSigner: z.string().min(32),
  settlementAuthority: z.string().min(32),
  totalBudget: z.number().int().positive().safe(),
  maxPerAction: z.number().int().positive().safe(),
  autoApproveMax: z.number().int().nonnegative().safe(),
  expiresAt: z.number().int().positive().safe(),
  goal: z.string().min(1),
  allowedActions: z.array(z.string().min(1)).min(1),
  policyPda: z.string().min(32),
}).strict();

const preparedSchema = z.object({
  network: z.literal("devnet"),
  programId: z.string(),
  instructions: z.union([
    z.tuple([z.literal("approve_high_risk_action"), z.literal("authorize_approved_action")]),
    z.tuple([
      z.literal("update_policy"),
      z.literal("approve_high_risk_action"),
      z.literal("authorize_approved_action"),
    ]),
    z.tuple([
      z.literal("initialize_policy"),
      z.literal("approve_high_risk_action"),
      z.literal("authorize_approved_action"),
    ]),
  ]),
  wallet: z.string().min(32),
  policyPda: z.string().min(32),
  approvalPda: z.string().min(32),
  authorizationPda: z.string().min(32),
  actionHashHex: z.string().regex(/^[a-f0-9]{64}$/i),
  amount: z.number().int().positive().safe(),
  nonce: z.number().int().nonnegative().safe(),
  approvalExpiresAt: z.number().int().positive().safe(),
  policyRefresh: policyRefreshSchema.nullable().optional(),
  policyBootstrap: policyBootstrapSchema.nullable().optional(),
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
    const result = await submitActionApprovalTransaction(body);
    return Response.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "submit_action_transaction_failed";
    const status = /rpc|timeout/i.test(message) ? 503 : 400;
    return Response.json({ ok: false, error: message }, { status });
  }
}

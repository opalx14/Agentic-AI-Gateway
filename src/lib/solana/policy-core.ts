import { createHash } from "node:crypto";

import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

export const AGENT_POLICY_PROGRAM_ID =
  "5SdxXmtvwFecQ7nyCfk8WaZ57M9vkBZB955Zx6RdA8XH";
export const SOLANA_DEVNET_RPC =
  process.env.SOLANA_DEVNET_RPC_URL ?? "https://api.devnet.solana.com";
export const SOLANA_DEVNET_READ_RPC =
  process.env.SOLANA_DEVNET_READ_RPC_URL ?? SOLANA_DEVNET_RPC;
export const SOLANA_DEVNET_BLOCKHASH_RPC =
  process.env.SOLANA_DEVNET_BLOCKHASH_RPC_URL ?? SOLANA_DEVNET_READ_RPC;
export const SOLANA_DEVNET_SEND_RPC =
  process.env.SOLANA_DEVNET_SEND_RPC_URL ?? SOLANA_DEVNET_RPC;
export const SOLANA_DEVNET_CONFIRM_RPC =
  process.env.SOLANA_DEVNET_CONFIRM_RPC_URL ?? SOLANA_DEVNET_READ_RPC;

export const PROGRAM_ID = new PublicKey(AGENT_POLICY_PROGRAM_ID);
const POLICY_SEED = Buffer.from("policy", "utf8");

export function discriminator(namespace: "global" | "account", name: string) {
  return createHash("sha256")
    .update(`${namespace}:${name}`)
    .digest()
    .subarray(0, 8);
}

export function u64(value: bigint) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(value);
  return buffer;
}

export function i64(value: bigint) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64LE(value);
  return buffer;
}

export function hash32(value: string) {
  return createHash("sha256").update(value).digest();
}

export type PolicyDraft = {
  authority: string;
  policyId: string;
  agentSigner: string;
  settlementAuthority: string;
  totalBudget: number;
  maxPerAction: number;
  autoApproveMax: number;
  expiresAt: number;
  goal: string;
  allowedActions: string[];
};

export type PreparedPolicyTransaction = {
  network: "devnet";
  programId: string;
  instruction: "initialize_policy";
  authority: string;
  policyPda: string;
  policyIdHex: string;
  totalBudget: number;
  maxPerAction: number;
  autoApproveMax: number;
  expiresAt: number;
  goalHashHex: string;
  allowedActionsHashHex: string;
  transactionBase64: string;
  blockhash: string;
  lastValidBlockHeight: number;
};

export type PolicyEvidenceResult = {
  network: "devnet";
  programId: string;
  instruction: "initialize_policy";
  transactionSignature: string;
  slot: number | null;
  policyPda: string;
  explorerUrl: string;
  accountExplorerUrl: string;
  verified: true;
  recovered?: boolean;
  checks: Record<string, boolean>;
  policy: ReturnType<typeof decodeAgentPolicyAccount>;
};

function normalizeDraft(input: PolicyDraft) {
  const authority = new PublicKey(input.authority);
  const agentSigner = new PublicKey(input.agentSigner);
  const settlementAuthority = new PublicKey(input.settlementAuthority);

  if (!Number.isSafeInteger(input.totalBudget) || input.totalBudget <= 0) {
    throw new Error("invalid_total_budget");
  }
  if (
    !Number.isSafeInteger(input.maxPerAction) ||
    input.maxPerAction <= 0 ||
    input.maxPerAction > input.totalBudget
  ) {
    throw new Error("invalid_max_per_action");
  }
  if (
    !Number.isSafeInteger(input.autoApproveMax) ||
    input.autoApproveMax < 0 ||
    input.autoApproveMax > input.maxPerAction
  ) {
    throw new Error("invalid_auto_approve_max");
  }
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(input.expiresAt) || input.expiresAt <= now + 60) {
    throw new Error("invalid_policy_expiry");
  }

  const policyId = hash32(input.policyId);
  const goalHash = hash32(input.goal);
  const allowedActionsHash = hash32(
    [...input.allowedActions].sort().join("\n"),
  );
  const [policyPda] = PublicKey.findProgramAddressSync(
    [POLICY_SEED, authority.toBuffer(), policyId],
    PROGRAM_ID,
  );

  return {
    authority,
    agentSigner,
    settlementAuthority,
    policyId,
    goalHash,
    allowedActionsHash,
    policyPda,
  };
}

export function buildInitializeInstruction(input: PolicyDraft) {
  const normalized = normalizeDraft(input);
  const data = Buffer.concat([
    discriminator("global", "initialize_policy"),
    normalized.policyId,
    normalized.agentSigner.toBuffer(),
    normalized.settlementAuthority.toBuffer(),
    u64(BigInt(input.totalBudget)),
    u64(BigInt(input.maxPerAction)),
    u64(BigInt(input.autoApproveMax)),
    i64(BigInt(input.expiresAt)),
    normalized.goalHash,
    normalized.allowedActionsHash,
  ]);

  return {
    ...normalized,
    instruction: new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        {
          pubkey: normalized.authority,
          isSigner: true,
          isWritable: true,
        },
        {
          pubkey: normalized.policyPda,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: SystemProgram.programId,
          isSigner: false,
          isWritable: false,
        },
      ],
      data,
    }),
  };
}

export async function assertProgramDeployedOnDevnet(
  connection = new Connection(SOLANA_DEVNET_RPC, "confirmed"),
) {
  const account = await connection.getAccountInfo(PROGRAM_ID, "confirmed");
  if (!account?.executable) {
    throw new Error("agent_policy_program_not_deployed_on_devnet");
  }
  return true;
}

export async function prepareInitializePolicyTransaction(
  draft: PolicyDraft,
): Promise<PreparedPolicyTransaction> {
  const readConnection = new Connection(SOLANA_DEVNET_READ_RPC, "confirmed");
  const blockhashConnection = new Connection(
    SOLANA_DEVNET_BLOCKHASH_RPC,
    "confirmed",
  );
  await assertProgramDeployedOnDevnet(readConnection);

  const built = buildInitializeInstruction(draft);
  const existing = await readConnection.getAccountInfo(
    built.policyPda,
    "confirmed",
  );
  if (existing) {
    throw new Error("policy_pda_already_exists");
  }

  const latest = await blockhashConnection.getLatestBlockhash("confirmed");
  const transaction = new Transaction({
    feePayer: built.authority,
    recentBlockhash: latest.blockhash,
  }).add(built.instruction);

  return {
    network: "devnet",
    programId: AGENT_POLICY_PROGRAM_ID,
    instruction: "initialize_policy",
    authority: built.authority.toBase58(),
    policyPda: built.policyPda.toBase58(),
    policyIdHex: built.policyId.toString("hex"),
    totalBudget: draft.totalBudget,
    maxPerAction: draft.maxPerAction,
    autoApproveMax: draft.autoApproveMax,
    expiresAt: draft.expiresAt,
    goalHashHex: built.goalHash.toString("hex"),
    allowedActionsHashHex: built.allowedActionsHash.toString("hex"),
    transactionBase64: transaction
      .serialize({ requireAllSignatures: false, verifySignatures: false })
      .toString("base64"),
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  };
}

export function assertSignedInitializeTransaction(input: {
  transaction: Transaction;
  draft: PolicyDraft;
}) {
  const built = buildInitializeInstruction(input.draft);
  const tx = input.transaction;

  if (!tx.feePayer?.equals(built.authority)) {
    throw new Error("transaction_fee_payer_mismatch");
  }
  const businessInstructions = tx.instructions.filter((instruction) =>
    instruction.programId.equals(PROGRAM_ID),
  );
  if (businessInstructions.length !== 1) {
    throw new Error("transaction_instruction_count_invalid");
  }
  const unsupportedInstructions = tx.instructions.filter(
    (instruction) =>
      !instruction.programId.equals(PROGRAM_ID) &&
      !instruction.programId.equals(ComputeBudgetProgram.programId),
  );
  if (unsupportedInstructions.length > 0) {
    throw new Error("transaction_contains_unsupported_instruction");
  }

  const actual = businessInstructions[0]!;
  const expected = built.instruction;
  if (!actual.programId.equals(expected.programId)) {
    throw new Error("transaction_program_mismatch");
  }
  if (!Buffer.from(actual.data).equals(Buffer.from(expected.data))) {
    throw new Error("transaction_instruction_data_mismatch");
  }
  if (actual.keys.length !== expected.keys.length) {
    throw new Error("transaction_accounts_mismatch");
  }
  for (let index = 0; index < expected.keys.length; index += 1) {
    const actualKey = actual.keys[index]!;
    const expectedKey = expected.keys[index]!;
    if (
      !actualKey.pubkey.equals(expectedKey.pubkey) ||
      actualKey.isSigner !== expectedKey.isSigner ||
      actualKey.isWritable !== expectedKey.isWritable
    ) {
      throw new Error("transaction_accounts_mismatch");
    }
  }
  if (!tx.verifySignatures()) {
    throw new Error("transaction_signature_invalid");
  }
  return built;
}

export function readPublicKey(data: Buffer, offset: number) {
  return new PublicKey(data.subarray(offset, offset + 32)).toBase58();
}

export function readU64(data: Buffer, offset: number) {
  return Number(data.readBigUInt64LE(offset));
}

export function readI64(data: Buffer, offset: number) {
  return Number(data.readBigInt64LE(offset));
}

export function decodeAgentPolicyAccount(data: Buffer) {
  const expected = discriminator("account", "AgentPolicy");
  if (data.length < 266 || !data.subarray(0, 8).equals(expected)) {
    throw new Error("invalid_agent_policy_account");
  }

  let offset = 8;
  const authority = readPublicKey(data, offset);
  offset += 32;
  const agentSigner = readPublicKey(data, offset);
  offset += 32;
  const settlementAuthority = readPublicKey(data, offset);
  offset += 32;
  const policyIdHex = data.subarray(offset, offset + 32).toString("hex");
  offset += 32;
  const policyVersion = readU64(data, offset);
  offset += 8;
  const totalBudget = readU64(data, offset);
  offset += 8;
  const spentAmount = readU64(data, offset);
  offset += 8;
  const reservedAmount = readU64(data, offset);
  offset += 8;
  const maxPerAction = readU64(data, offset);
  offset += 8;
  const autoApproveMax = readU64(data, offset);
  offset += 8;
  const expiresAt = readI64(data, offset);
  offset += 8;
  const goalHashHex = data.subarray(offset, offset + 32).toString("hex");
  offset += 32;
  const allowedActionsHashHex = data
    .subarray(offset, offset + 32)
    .toString("hex");
  offset += 32;
  const nonce = readU64(data, offset);
  offset += 8;
  const isActive = data[offset] === 1;
  offset += 1;
  const bump = data[offset] ?? 0;

  return {
    authority,
    agentSigner,
    settlementAuthority,
    policyIdHex,
    policyVersion,
    totalBudget,
    spentAmount,
    reservedAmount,
    maxPerAction,
    autoApproveMax,
    expiresAt,
    goalHashHex,
    allowedActionsHashHex,
    nonce,
    isActive,
    bump,
  };
}

export function policyVerificationChecks(
  policy: ReturnType<typeof decodeAgentPolicyAccount>,
  draft: PolicyDraft,
  options: { includeExpiresAt?: boolean } = {},
): Record<string, boolean> {
  const expected = normalizeDraft(draft);
  const checks: Record<string, boolean> = {
    authority: policy.authority === expected.authority.toBase58(),
    agentSigner: policy.agentSigner === expected.agentSigner.toBase58(),
    settlementAuthority:
      policy.settlementAuthority === expected.settlementAuthority.toBase58(),
    policyId: policy.policyIdHex === expected.policyId.toString("hex"),
    totalBudget: policy.totalBudget === draft.totalBudget,
    maxPerAction: policy.maxPerAction === draft.maxPerAction,
    autoApproveMax: policy.autoApproveMax === draft.autoApproveMax,
    goalHash: policy.goalHashHex === expected.goalHash.toString("hex"),
    allowedActionsHash:
      policy.allowedActionsHashHex === expected.allowedActionsHash.toString("hex"),
    active: policy.isActive,
  };

  if (options.includeExpiresAt !== false) {
    checks.expiresAt = policy.expiresAt === draft.expiresAt;
  }

  return checks;
}


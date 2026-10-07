import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import {
  AGENT_POLICY_PROGRAM_ID,
  PROGRAM_ID,
  SOLANA_DEVNET_BLOCKHASH_RPC,
  buildInitializeInstruction,
  decodeAgentPolicyAccount,
  discriminator,
  i64,
  readI64,
  readPublicKey,
  readU64,
  u64,
  type PolicyDraft,
} from "./policy-core";
import {
  broadcastRawTransaction,
  readAccountData,
  readSignatureStatus,
  uniqueDevnetRpcEndpoints,
} from "./rpc";

const APPROVAL_SEED = Buffer.from("approval", "utf8");
const AUTHORIZATION_SEED = Buffer.from("authorization", "utf8");

export function bytes32FromHex(value: string) {
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error("invalid_action_hash");
  }
  return Buffer.from(value, "hex");
}

export type ActionApprovalDraft = {
  wallet: string;
  policyPda?: string;
  actionHashHex: string;
  amount: number;
};

export type PolicyBootstrap = PolicyDraft & {
  policyPda: string;
};

export type PolicyRefresh = {
  totalBudget: number;
  maxPerAction: number;
  autoApproveMax: number;
  expiresAt: number;
  settlementAuthority: string;
  goalHashHex: string;
  allowedActionsHashHex: string;
};

export type PreparedActionApprovalTransaction = {
  network: "devnet";
  programId: string;
  instructions:
    | ["approve_high_risk_action", "authorize_approved_action"]
    | ["update_policy", "approve_high_risk_action", "authorize_approved_action"]
    | ["initialize_policy", "approve_high_risk_action", "authorize_approved_action"];
  wallet: string;
  policyPda: string;
  approvalPda: string;
  authorizationPda: string;
  actionHashHex: string;
  amount: number;
  nonce: number;
  approvalExpiresAt: number;
  policyRefresh?: PolicyRefresh | null;
  policyBootstrap?: PolicyBootstrap | null;
  transactionBase64: string;
  blockhash: string;
  lastValidBlockHeight: number;
};

function deriveActionPdas(policyPda: PublicKey, actionHash: Buffer, nonce: number) {
  const nonceBuffer = u64(BigInt(nonce));
  const [approvalPda] = PublicKey.findProgramAddressSync(
    [APPROVAL_SEED, policyPda.toBuffer(), actionHash, nonceBuffer],
    PROGRAM_ID,
  );
  const [authorizationPda] = PublicKey.findProgramAddressSync(
    [AUTHORIZATION_SEED, policyPda.toBuffer(), nonceBuffer],
    PROGRAM_ID,
  );
  return { approvalPda, authorizationPda };
}

export function buildActionApprovalInstructions(input: {
  wallet: string;
  policyPda: string;
  actionHashHex: string;
  amount: number;
  nonce: number;
  approvalExpiresAt: number;
}) {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    throw new Error("invalid_action_amount");
  }
  if (!Number.isSafeInteger(input.nonce) || input.nonce < 0) {
    throw new Error("invalid_action_nonce");
  }
  const wallet = new PublicKey(input.wallet);
  const policyPda = new PublicKey(input.policyPda);
  const actionHash = bytes32FromHex(input.actionHashHex);
  const { approvalPda, authorizationPda } = deriveActionPdas(
    policyPda,
    actionHash,
    input.nonce,
  );

  const approveData = Buffer.concat([
    discriminator("global", "approve_high_risk_action"),
    actionHash,
    u64(BigInt(input.amount)),
    u64(BigInt(input.nonce)),
    i64(BigInt(input.approvalExpiresAt)),
  ]);
  const authorizeData = Buffer.concat([
    discriminator("global", "authorize_approved_action"),
    actionHash,
    u64(BigInt(input.amount)),
    u64(BigInt(input.nonce)),
  ]);

  const approve = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: wallet, isSigner: true, isWritable: true },
      { pubkey: policyPda, isSigner: false, isWritable: false },
      { pubkey: approvalPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: approveData,
  });
  const authorize = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: wallet, isSigner: true, isWritable: true },
      { pubkey: policyPda, isSigner: false, isWritable: true },
      { pubkey: approvalPda, isSigner: false, isWritable: true },
      { pubkey: authorizationPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: authorizeData,
  });

  return { wallet, policyPda, approvalPda, authorizationPda, approve, authorize };
}

export function buildPolicyBootstrapInstruction(input: PolicyBootstrap) {
  const built = buildInitializeInstruction(input);
  if (built.policyPda.toBase58() !== input.policyPda) {
    throw new Error("policy_bootstrap_pda_mismatch");
  }
  return built.instruction;
}

export function buildPolicyRefreshInstruction(input: {
  wallet: string;
  policyPda: string;
  refresh: PolicyRefresh;
}) {
  const wallet = new PublicKey(input.wallet);
  const policyPda = new PublicKey(input.policyPda);
  const refresh = input.refresh;

  if (
    !Number.isSafeInteger(refresh.expiresAt) ||
    !Number.isSafeInteger(refresh.totalBudget) ||
    !Number.isSafeInteger(refresh.maxPerAction) ||
    !Number.isSafeInteger(refresh.autoApproveMax)
  ) {
    throw new Error("invalid_policy_refresh");
  }

  const data = Buffer.concat([
    discriminator("global", "update_policy"),
    u64(BigInt(refresh.totalBudget)),
    u64(BigInt(refresh.maxPerAction)),
    u64(BigInt(refresh.autoApproveMax)),
    i64(BigInt(refresh.expiresAt)),
    new PublicKey(refresh.settlementAuthority).toBuffer(),
    bytes32FromHex(refresh.goalHashHex),
    bytes32FromHex(refresh.allowedActionsHashHex),
  ]);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: policyPda, isSigner: false, isWritable: true },
      { pubkey: wallet, isSigner: true, isWritable: false },
    ],
    data,
  });
}

function buildTravelPolicyBootstrap(
  wallet: string,
  amount: number,
  now: number,
): PolicyBootstrap {
  const maxPerAction = Math.max(5_000, Math.ceil(amount / 1_000) * 1_000);
  const totalBudget = Math.max(10_000, maxPerAction * 2);
  const expiresAt =
    (Math.floor(now / (24 * 60 * 60)) + 31) * 24 * 60 * 60;
  const draft: PolicyDraft = {
    authority: wallet,
    policyId: "travel-final-action-v1",
    agentSigner: wallet,
    settlementAuthority: wallet,
    totalBudget,
    maxPerAction,
    autoApproveMax: 0,
    expiresAt,
    goal: "Verify exact final AI travel booking actions.",
    allowedActions: ["verify_final_travel_action"],
  };
  const built = buildInitializeInstruction(draft);
  return {
    ...draft,
    policyPda: built.policyPda.toBase58(),
  };
}

export async function prepareActionApprovalTransaction(
  draft: ActionApprovalDraft,
): Promise<PreparedActionApprovalTransaction> {
  const endpoints = uniqueDevnetRpcEndpoints();
  if (endpoints.length === 0) throw new Error("no_devnet_rpc_endpoints_configured");

  const now = Math.floor(Date.now() / 1000);
  const bootstrapCandidate = draft.policyPda
    ? null
    : buildTravelPolicyBootstrap(draft.wallet, draft.amount, now);
  const policyPdaText = draft.policyPda ?? bootstrapCandidate!.policyPda;
  const policyPda = new PublicKey(policyPdaText);
  const accountBuffer = await readAccountData(policyPda, endpoints);

  const policyBootstrap: PolicyBootstrap | null =
    !accountBuffer && bootstrapCandidate ? bootstrapCandidate : null;
  const policy = accountBuffer ? decodeAgentPolicyAccount(accountBuffer) : null;

  if (!policy && !policyBootstrap) throw new Error("policy_pda_not_found");
  if (policy && policy.authority !== draft.wallet) {
    throw new Error("policy_authority_wallet_mismatch");
  }
  if (policy && policy.agentSigner !== draft.wallet) {
    throw new Error("delegated_agent_signer_required");
  }
  if (policy && !policy.isActive) throw new Error("policy_inactive");

  const maxPerAction = policy?.maxPerAction ?? policyBootstrap!.maxPerAction;
  const remainingBudget = policy
    ? policy.totalBudget - policy.spentAmount - policy.reservedAmount
    : policyBootstrap!.totalBudget;
  if (draft.amount > maxPerAction) throw new Error("max_per_action_exceeded");
  if (draft.amount > remainingBudget) throw new Error("remaining_budget_exceeded");

  const shouldRefreshPolicy =
    Boolean(policy) && policy!.expiresAt <= now + 15 * 60;
  const stableRefreshExpiry =
    (Math.floor(now / (24 * 60 * 60)) + 8) * 24 * 60 * 60;
  const policyRefresh: PolicyRefresh | null = shouldRefreshPolicy
    ? {
        totalBudget: policy!.totalBudget,
        maxPerAction: policy!.maxPerAction,
        autoApproveMax: policy!.autoApproveMax,
        expiresAt: stableRefreshExpiry,
        settlementAuthority: policy!.settlementAuthority,
        goalHashHex: policy!.goalHashHex,
        allowedActionsHashHex: policy!.allowedActionsHashHex,
      }
    : null;
  const effectivePolicyExpiry =
    policyBootstrap?.expiresAt ?? policyRefresh?.expiresAt ?? policy!.expiresAt;
  const approvalExpiresAt = Math.min(now + 10 * 60, effectivePolicyExpiry);
  if (approvalExpiresAt <= now + 30) throw new Error("policy_expiry_too_close");

  const built = buildActionApprovalInstructions({
    wallet: draft.wallet,
    policyPda: policyPdaText,
    actionHashHex: draft.actionHashHex,
    amount: draft.amount,
    nonce: policy?.nonce ?? 0,
    approvalExpiresAt,
  });
  const bootstrapInstruction = policyBootstrap
    ? buildPolicyBootstrapInstruction(policyBootstrap)
    : null;
  const refreshInstruction = policyRefresh
    ? buildPolicyRefreshInstruction({
        wallet: draft.wallet,
        policyPda: policyPdaText,
        refresh: policyRefresh,
      })
    : null;

  const blockhashConnection = new Connection(
    SOLANA_DEVNET_BLOCKHASH_RPC,
    "confirmed",
  );
  const latest = await blockhashConnection.getLatestBlockhash("confirmed");
  const transaction = new Transaction({
    feePayer: built.wallet,
    recentBlockhash: latest.blockhash,
  });
  if (bootstrapInstruction) transaction.add(bootstrapInstruction);
  if (refreshInstruction) transaction.add(refreshInstruction);
  transaction.add(built.approve, built.authorize);

  return {
    network: "devnet",
    programId: AGENT_POLICY_PROGRAM_ID,
    instructions: bootstrapInstruction
      ? ["initialize_policy", "approve_high_risk_action", "authorize_approved_action"]
      : refreshInstruction
        ? ["update_policy", "approve_high_risk_action", "authorize_approved_action"]
        : ["approve_high_risk_action", "authorize_approved_action"],
    wallet: built.wallet.toBase58(),
    policyPda: built.policyPda.toBase58(),
    approvalPda: built.approvalPda.toBase58(),
    authorizationPda: built.authorizationPda.toBase58(),
    actionHashHex: draft.actionHashHex.toLowerCase(),
    amount: draft.amount,
    nonce: policy?.nonce ?? 0,
    approvalExpiresAt,
    policyRefresh,
    policyBootstrap,
    transactionBase64: transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    }).toString("base64"),
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  };
}

export function assertSignedActionApprovalTransaction(input: {
  transaction: Transaction;
  prepared: Omit<PreparedActionApprovalTransaction, "transactionBase64">;
}) {
  const built = buildActionApprovalInstructions({
    wallet: input.prepared.wallet,
    policyPda: input.prepared.policyPda,
    actionHashHex: input.prepared.actionHashHex,
    amount: input.prepared.amount,
    nonce: input.prepared.nonce,
    approvalExpiresAt: input.prepared.approvalExpiresAt,
  });
  const business = input.transaction.instructions.filter((ix) => ix.programId.equals(PROGRAM_ID));
  const expectedBootstrap = input.prepared.policyBootstrap
    ? buildPolicyBootstrapInstruction(input.prepared.policyBootstrap)
    : null;
  const expectedRefresh = input.prepared.policyRefresh
    ? buildPolicyRefreshInstruction({
        wallet: input.prepared.wallet,
        policyPda: input.prepared.policyPda,
        refresh: input.prepared.policyRefresh,
      })
    : null;
  const expected = [
    ...(expectedBootstrap ? [expectedBootstrap] : []),
    ...(expectedRefresh ? [expectedRefresh] : []),
    built.approve,
    built.authorize,
  ];
  if (business.length !== expected.length) throw new Error("transaction_instruction_count_invalid");
  const unsupported = input.transaction.instructions.filter(
    (ix) => !ix.programId.equals(PROGRAM_ID) && !ix.programId.equals(ComputeBudgetProgram.programId),
  );
  if (unsupported.length) throw new Error("transaction_contains_unsupported_instruction");

  for (let i = 0; i < expected.length; i += 1) {
    const actual = business[i]!;
    const wanted = expected[i]!;
    if (!Buffer.from(actual.data).equals(Buffer.from(wanted.data))) {
      throw new Error("transaction_instruction_data_mismatch");
    }
    if (actual.keys.length !== wanted.keys.length) throw new Error("transaction_accounts_mismatch");
    for (let j = 0; j < wanted.keys.length; j += 1) {
      const a = actual.keys[j]!;
      const w = wanted.keys[j]!;
      const missingRequiredWritable = w.isWritable && !a.isWritable;
      if (!a.pubkey.equals(w.pubkey) || a.isSigner !== w.isSigner || missingRequiredWritable) {
        throw new Error("transaction_accounts_mismatch");
      }
    }
  }
  if (!input.transaction.feePayer?.equals(built.wallet)) throw new Error("transaction_fee_payer_mismatch");
  if (!input.transaction.verifySignatures()) throw new Error("transaction_signature_invalid");
  return built;
}

export function decodeActionApprovalAccount(data: Buffer) {
  const expected = discriminator("account", "ActionApproval");
  if (data.length < 130 || !data.subarray(0, 8).equals(expected)) throw new Error("invalid_action_approval_account");
  let offset = 8;
  const policy = readPublicKey(data, offset); offset += 32;
  const approvedBy = readPublicKey(data, offset); offset += 32;
  const actionHashHex = data.subarray(offset, offset + 32).toString("hex"); offset += 32;
  const amount = readU64(data, offset); offset += 8;
  const nonce = readU64(data, offset); offset += 8;
  const expiresAt = readI64(data, offset); offset += 8;
  const used = data[offset] === 1; offset += 1;
  const bump = data[offset] ?? 0;
  return { policy, approvedBy, actionHashHex, amount, nonce, expiresAt, used, bump };
}

export function decodeActionAuthorizationAccount(data: Buffer) {
  const expected = discriminator("account", "ActionAuthorization");
  if (data.length < 170 || !data.subarray(0, 8).equals(expected)) throw new Error("invalid_action_authorization_account");
  let offset = 8;
  const policy = readPublicKey(data, offset); offset += 32;
  const agentSigner = readPublicKey(data, offset); offset += 32;
  const actionHashHex = data.subarray(offset, offset + 32).toString("hex"); offset += 32;
  const amount = readU64(data, offset); offset += 8;
  const nonce = readU64(data, offset); offset += 8;
  const authorizedAt = readI64(data, offset); offset += 8;
  const settledAt = readI64(data, offset); offset += 8;
  const providerRefHashHex = data.subarray(offset, offset + 32).toString("hex"); offset += 32;
  const statusByte = data[offset] ?? 255; offset += 1;
  const bump = data[offset] ?? 0;
  const status = statusByte === 0 ? "RESERVED" : statusByte === 1 ? "SETTLED_SUCCESS" : statusByte === 2 ? "SETTLED_FAILED" : "UNKNOWN";
  return { policy, agentSigner, actionHashHex, amount, nonce, authorizedAt, settledAt, providerRefHashHex, status, bump };
}

export async function submitActionApprovalTransaction(input: {
  prepared: Omit<PreparedActionApprovalTransaction, "transactionBase64">;
  signedTransactionBase64: string;
}) {
  const transaction = Transaction.from(Buffer.from(input.signedTransactionBase64, "base64"));
  const built = assertSignedActionApprovalTransaction({ transaction, prepared: input.prepared });
  if (transaction.recentBlockhash !== input.prepared.blockhash) throw new Error("transaction_blockhash_mismatch");

  const raw = transaction.serialize({ requireAllSignatures: true, verifySignatures: true });
  const endpoints = uniqueDevnetRpcEndpoints();
  const transactionSignature = await broadcastRawTransaction(Buffer.from(raw).toString("base64"), endpoints);

  for (let iteration = 0; iteration < 8; iteration += 1) {
    const [approvalData, authorizationData, status] = await Promise.all([
      readAccountData(built.approvalPda, endpoints, iteration),
      readAccountData(built.authorizationPda, endpoints, iteration),
      readSignatureStatus(transactionSignature, endpoints, iteration),
    ]);

    if (status?.err) {
      throw new Error("transaction_failed_onchain");
    }
    if (approvalData && authorizationData) {
      const approval = decodeActionApprovalAccount(approvalData);
      const authorization = decodeActionAuthorizationAccount(authorizationData);
      const exact =
        approval.policy === input.prepared.policyPda &&
        approval.approvedBy === input.prepared.wallet &&
        approval.actionHashHex === input.prepared.actionHashHex &&
        approval.amount === input.prepared.amount &&
        approval.nonce === input.prepared.nonce &&
        approval.used === true &&
        authorization.policy === input.prepared.policyPda &&
        authorization.agentSigner === input.prepared.wallet &&
        authorization.actionHashHex === input.prepared.actionHashHex &&
        authorization.amount === input.prepared.amount &&
        authorization.nonce === input.prepared.nonce &&
        authorization.status === "RESERVED";
      if (!exact) throw new Error("action_pda_verification_failed");
      return {
        network: "devnet" as const,
        transactionSignature,
        slot: status?.slot ?? null,
        explorerUrl: `https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`,
        approvalPda: built.approvalPda.toBase58(),
        authorizationPda: built.authorizationPda.toBase58(),
        approval,
        authorization,
        verified: true as const,
      };
    }
    if (iteration < 7) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }
  throw new Error("transaction_confirmation_timeout");
}



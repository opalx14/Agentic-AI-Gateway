import { Connection, Transaction } from "@solana/web3.js";

import {
  AGENT_POLICY_PROGRAM_ID,
  SOLANA_DEVNET_READ_RPC,
  assertProgramDeployedOnDevnet,
  assertSignedInitializeTransaction,
  buildInitializeInstruction,
  decodeAgentPolicyAccount,
  policyVerificationChecks,
  type PolicyDraft,
  type PolicyEvidenceResult,
} from "./policy-core";
import {
  broadcastRawTransaction,
  readAccountData,
  readSignatureStatus,
  readSignaturesForAddress,
  uniqueDevnetRpcEndpoints,
} from "./rpc";

export async function recoverExistingPolicyEvidence(
  draft: PolicyDraft,
): Promise<PolicyEvidenceResult> {
  const built = buildInitializeInstruction(draft);
  const endpoints = uniqueDevnetRpcEndpoints();
  if (endpoints.length === 0) {
    throw new Error("no_devnet_rpc_endpoints_configured");
  }

  const accountBuffer = await readAccountData(built.policyPda, endpoints);
  if (!accountBuffer) {
    throw new Error("policy_pda_not_found");
  }

  const policy = decodeAgentPolicyAccount(accountBuffer);
  const checks = policyVerificationChecks(policy, draft, {
    includeExpiresAt: false,
  });
  if (!Object.values(checks).every(Boolean)) {
    throw new Error("policy_pda_verification_failed");
  }

  const signatures = await readSignaturesForAddress(
    built.policyPda,
    endpoints,
  );
  const successful = signatures.filter((item) => item.err == null);
  const creationEvidence = successful.at(-1);
  if (!creationEvidence) {
    throw new Error("policy_evidence_signature_not_found");
  }

  return {
    network: "devnet",
    programId: AGENT_POLICY_PROGRAM_ID,
    instruction: "initialize_policy",
    transactionSignature: creationEvidence.signature,
    slot: creationEvidence.slot,
    policyPda: built.policyPda.toBase58(),
    explorerUrl: `https://explorer.solana.com/tx/${creationEvidence.signature}?cluster=devnet`,
    accountExplorerUrl: `https://explorer.solana.com/address/${built.policyPda.toBase58()}?cluster=devnet`,
    verified: true,
    recovered: true,
    checks,
    policy,
  };
}

export async function submitInitializePolicyTransaction(input: {
  draft: PolicyDraft;
  signedTransactionBase64: string;
  blockhash: string;
  lastValidBlockHeight: number;
}) {
  const readConnection = new Connection(SOLANA_DEVNET_READ_RPC, "confirmed");
  await assertProgramDeployedOnDevnet(readConnection);

  const transaction = Transaction.from(
    Buffer.from(input.signedTransactionBase64, "base64"),
  );
  const built = assertSignedInitializeTransaction({
    transaction,
    draft: input.draft,
  });

  if (transaction.recentBlockhash !== input.blockhash) {
    throw new Error("transaction_blockhash_mismatch");
  }

  const rawBytes = transaction.serialize({
    requireAllSignatures: true,
    verifySignatures: true,
  });
  const rawTxBase64 = Buffer.from(rawBytes).toString("base64");

  const endpoints = uniqueDevnetRpcEndpoints();
  if (endpoints.length === 0) {
    throw new Error("no_devnet_rpc_endpoints_configured");
  }

  const transactionSignature = await broadcastRawTransaction(
    rawTxBase64,
    endpoints,
  );

  let capturedSlot: number | null = null;
  let verifiedPolicy: ReturnType<typeof decodeAgentPolicyAccount> | null = null;
  let verifiedChecks: Record<string, boolean> | null = null;

  for (let iteration = 0; iteration < 10; iteration++) {
    // 1. read policy PDA account via readAccountData rotating endpoint
    const accountBuffer = await readAccountData(
      built.policyPda,
      endpoints,
      iteration,
    );

    if (accountBuffer) {
      const policy = decodeAgentPolicyAccount(accountBuffer);
      const checks = policyVerificationChecks(policy, input.draft);

      const verified = Object.values(checks).every(Boolean);
      if (!verified) {
        throw new Error("policy_pda_verification_failed");
      }

      verifiedPolicy = policy;
      verifiedChecks = checks;
      break;
    }

    // 2. read signature status sparsely
    const status = await readSignatureStatus(
      transactionSignature,
      endpoints,
      iteration,
    );
    if (status?.err) {
      throw new Error("transaction_confirmation_failed");
    }
    if (typeof status?.slot === "number") {
      capturedSlot = status.slot;
    }

    // 3. every 3rd iteration rebroadcast the SAME raw signed transaction
    if (iteration > 0 && iteration % 3 === 0) {
      await broadcastRawTransaction(rawTxBase64, endpoints).catch(() => {
        // swallow rebroadcast failure because initial broadcast may still land
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 2500));
  }

  if (!verifiedPolicy || !verifiedChecks) {
    throw new Error("transaction_confirmation_timeout");
  }

  return {
    network: "devnet" as const,
    programId: AGENT_POLICY_PROGRAM_ID,
    instruction: "initialize_policy" as const,
    transactionSignature,
    slot: capturedSlot,
    policyPda: built.policyPda.toBase58(),
    explorerUrl: `https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`,
    accountExplorerUrl: `https://explorer.solana.com/address/${built.policyPda.toBase58()}?cluster=devnet`,
    verified: true,
    checks: verifiedChecks,
    policy: verifiedPolicy,
  };
}




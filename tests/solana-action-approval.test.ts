import { createHash } from "node:crypto";

import { describe, expect, test } from "bun:test";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";

import {
  AGENT_POLICY_PROGRAM_ID,
  assertSignedActionApprovalTransaction,
  buildActionApprovalInstructions,
  buildPolicyBootstrapInstruction,
  buildPolicyRefreshInstruction,
} from "@/lib/solana/agent-policy";

describe("combined action approval transaction semantics", () => {
  test("binds exact action hash, amount, nonce and account order", () => {
    const signer = Keypair.generate();
    const policy = Keypair.generate().publicKey;
    const actionHashHex = "11".repeat(32);
    const built = buildActionApprovalInstructions({
      wallet: signer.publicKey.toBase58(),
      policyPda: policy.toBase58(),
      actionHashHex,
      amount: 731,
      nonce: 4,
      approvalExpiresAt: 2_000_000_000,
    });

    expect(built.approve.programId.toBase58()).toBe(AGENT_POLICY_PROGRAM_ID);
    expect(built.authorize.programId.toBase58()).toBe(AGENT_POLICY_PROGRAM_ID);
    expect(built.approve.keys[0]?.pubkey.toBase58()).toBe(signer.publicKey.toBase58());
    expect(built.approve.keys[1]?.pubkey.toBase58()).toBe(policy.toBase58());
    expect(built.authorize.keys[2]?.pubkey.toBase58()).toBe(built.approvalPda.toBase58());
    expect(built.authorize.keys[3]?.pubkey.toBase58()).toBe(built.authorizationPda.toBase58());
  });

  test("accepts one signature that refreshes an expiring policy before approval", () => {
    const signer = Keypair.generate();
    const policy = Keypair.generate().publicKey;
    const actionHashHex = "33".repeat(32);
    const refresh = {
      totalBudget: 10_000,
      maxPerAction: 5_000,
      autoApproveMax: 2_000,
      expiresAt: 2_000_100_000,
      settlementAuthority: signer.publicKey.toBase58(),
      goalHashHex: "44".repeat(32),
      allowedActionsHashHex: "55".repeat(32),
    };
    const built = buildActionApprovalInstructions({
      wallet: signer.publicKey.toBase58(),
      policyPda: policy.toBase58(),
      actionHashHex,
      amount: 529,
      nonce: 8,
      approvalExpiresAt: 2_000_000_000,
    });
    const update = buildPolicyRefreshInstruction({
      wallet: signer.publicKey.toBase58(),
      policyPda: policy.toBase58(),
      refresh,
    });
    const prepared = {
      network: "devnet" as const,
      programId: AGENT_POLICY_PROGRAM_ID,
      instructions: [
        "update_policy",
        "approve_high_risk_action",
        "authorize_approved_action",
      ] as [
        "update_policy",
        "approve_high_risk_action",
        "authorize_approved_action",
      ],
      wallet: signer.publicKey.toBase58(),
      policyPda: policy.toBase58(),
      approvalPda: built.approvalPda.toBase58(),
      authorizationPda: built.authorizationPda.toBase58(),
      actionHashHex,
      amount: 529,
      nonce: 8,
      approvalExpiresAt: 2_000_000_000,
      policyRefresh: refresh,
      blockhash: PublicKey.default.toBase58(),
      lastValidBlockHeight: 1,
    };
    const tx = new Transaction({
      feePayer: signer.publicKey,
      recentBlockhash: prepared.blockhash,
    }).add(update, built.approve, built.authorize);
    tx.sign(signer);

    expect(() =>
      assertSignedActionApprovalTransaction({ transaction: tx, prepared }),
    ).not.toThrow();
  });

  test("accepts one signature that bootstraps a wallet-scoped policy before approval", () => {
    const signer = Keypair.generate();
    const programId = new PublicKey(AGENT_POLICY_PROGRAM_ID);
    const policyId = "travel-final-action-v1";
    const policyIdHash = createHash("sha256").update(policyId).digest();
    const [policy] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("policy", "utf8"),
        signer.publicKey.toBuffer(),
        policyIdHash,
      ],
      programId,
    );
    const bootstrap = {
      authority: signer.publicKey.toBase58(),
      policyId,
      agentSigner: signer.publicKey.toBase58(),
      settlementAuthority: signer.publicKey.toBase58(),
      totalBudget: 10_000,
      maxPerAction: 5_000,
      autoApproveMax: 0,
      expiresAt: 2_000_100_000,
      goal: "Verify exact final AI travel booking actions.",
      allowedActions: ["verify_final_travel_action"],
      policyPda: policy.toBase58(),
    };
    const built = buildActionApprovalInstructions({
      wallet: signer.publicKey.toBase58(),
      policyPda: policy.toBase58(),
      actionHashHex: "66".repeat(32),
      amount: 529,
      nonce: 0,
      approvalExpiresAt: 2_000_000_000,
    });
    const initialize = buildPolicyBootstrapInstruction(bootstrap);
    const prepared = {
      network: "devnet" as const,
      programId: AGENT_POLICY_PROGRAM_ID,
      instructions: [
        "initialize_policy",
        "approve_high_risk_action",
        "authorize_approved_action",
      ] as [
        "initialize_policy",
        "approve_high_risk_action",
        "authorize_approved_action",
      ],
      wallet: signer.publicKey.toBase58(),
      policyPda: policy.toBase58(),
      approvalPda: built.approvalPda.toBase58(),
      authorizationPda: built.authorizationPda.toBase58(),
      actionHashHex: "66".repeat(32),
      amount: 529,
      nonce: 0,
      approvalExpiresAt: 2_000_000_000,
      policyBootstrap: bootstrap,
      blockhash: PublicKey.default.toBase58(),
      lastValidBlockHeight: 1,
    };
    const tx = new Transaction({
      feePayer: signer.publicKey,
      recentBlockhash: prepared.blockhash,
    }).add(initialize, built.approve, built.authorize);
    tx.sign(signer);

    expect(() =>
      assertSignedActionApprovalTransaction({ transaction: tx, prepared }),
    ).not.toThrow();
  });

  test("rejects a mutated signed instruction", () => {
    const signer = Keypair.generate();
    const policy = Keypair.generate().publicKey;
    const actionHashHex = "22".repeat(32);
    const prepared = {
      network: "devnet" as const,
      programId: AGENT_POLICY_PROGRAM_ID,
      instructions: ["approve_high_risk_action", "authorize_approved_action"] as ["approve_high_risk_action", "authorize_approved_action"],
      wallet: signer.publicKey.toBase58(),
      policyPda: policy.toBase58(),
      approvalPda: "",
      authorizationPda: "",
      actionHashHex,
      amount: 731,
      nonce: 0,
      approvalExpiresAt: 2_000_000_000,
      blockhash: PublicKey.default.toBase58(),
      lastValidBlockHeight: 1,
    };
    const built = buildActionApprovalInstructions({
      wallet: prepared.wallet,
      policyPda: prepared.policyPda,
      actionHashHex: prepared.actionHashHex,
      amount: prepared.amount,
      nonce: prepared.nonce,
      approvalExpiresAt: prepared.approvalExpiresAt,
    });
    prepared.approvalPda = built.approvalPda.toBase58();
    prepared.authorizationPda = built.authorizationPda.toBase58();

    const tx = new Transaction({
      feePayer: signer.publicKey,
      recentBlockhash: prepared.blockhash,
    }).add(built.approve, built.authorize);
    tx.sign(signer);

    expect(() => assertSignedActionApprovalTransaction({ transaction: tx, prepared })).not.toThrow();

    const mutated = Transaction.from(tx.serialize());
    mutated.instructions[1]!.data = Buffer.from(mutated.instructions[1]!.data);
    mutated.instructions[1]!.data[8] ^= 0xff;
    mutated.sign(signer);

    expect(() =>
      assertSignedActionApprovalTransaction({ transaction: mutated, prepared }),
    ).toThrow("transaction_instruction_data_mismatch");
  });
});

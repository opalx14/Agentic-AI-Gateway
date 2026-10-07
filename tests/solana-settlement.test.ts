import { describe, expect, test } from "bun:test";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";

import {
  AGENT_POLICY_PROGRAM_ID,
  assertSignedSettlementTransaction,
  buildSettleInstruction,
} from "@/lib/solana/agent-policy";

describe("settlement transaction semantics", () => {
  test("accepts exact settle_action instructions and rejects mutation", () => {
    const signer = Keypair.generate();
    const policy = Keypair.generate().publicKey;
    const authA = Keypair.generate().publicKey;
    const authB = Keypair.generate().publicKey;
    const itemA = {
      authorizationPda: authA.toBase58(),
      providerRefHashHex: "11".repeat(32),
    };
    const itemB = {
      authorizationPda: authB.toBase58(),
      providerRefHashHex: "22".repeat(32),
    };
    const prepared = {
      network: "devnet" as const,
      programId: AGENT_POLICY_PROGRAM_ID,
      instruction: "settle_action" as const,
      wallet: signer.publicKey.toBase58(),
      policyPda: policy.toBase58(),
      items: [itemA, itemB],
      blockhash: PublicKey.default.toBase58(),
      lastValidBlockHeight: 1,
    };

    const tx = new Transaction({
      feePayer: signer.publicKey,
      recentBlockhash: prepared.blockhash,
    }).add(
      buildSettleInstruction({
        wallet: prepared.wallet,
        policyPda: prepared.policyPda,
        authorizationPda: itemA.authorizationPda,
        providerRefHashHex: itemA.providerRefHashHex,
      }),
      buildSettleInstruction({
        wallet: prepared.wallet,
        policyPda: prepared.policyPda,
        authorizationPda: itemB.authorizationPda,
        providerRefHashHex: itemB.providerRefHashHex,
      }),
    );
    tx.sign(signer);

    expect(() =>
      assertSignedSettlementTransaction({ transaction: tx, prepared }),
    ).not.toThrow();

    const mutated = Transaction.from(tx.serialize());
    mutated.instructions[0]!.data = Buffer.from(mutated.instructions[0]!.data);
    mutated.instructions[0]!.data[9] ^= 0xff;
    mutated.sign(signer);

    expect(() =>
      assertSignedSettlementTransaction({ transaction: mutated, prepared }),
    ).toThrow("transaction_instruction_data_mismatch");
  });
});

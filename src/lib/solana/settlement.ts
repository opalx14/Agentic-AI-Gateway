import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import {
  AGENT_POLICY_PROGRAM_ID,
  PROGRAM_ID,
  SOLANA_DEVNET_BLOCKHASH_RPC,
  decodeAgentPolicyAccount,
  discriminator,
  hash32,
} from "./policy-core";
import { bytes32FromHex, decodeActionAuthorizationAccount } from "./action-approval";
import {
  broadcastRawTransaction,
  readAccountData,
  readSignatureStatus,
  uniqueDevnetRpcEndpoints,
} from "./rpc";

export type SettlementItemDraft = {
  authorizationPda: string;
  providerRef: string;
};

export type PreparedSettlementTransaction = {
  network: "devnet";
  programId: string;
  instruction: "settle_action";
  wallet: string;
  policyPda: string;
  items: Array<{
    authorizationPda: string;
    providerRefHashHex: string;
  }>;
  transactionBase64: string;
  blockhash: string;
  lastValidBlockHeight: number;
};

export function buildSettleInstruction(input: {
  wallet: string;
  policyPda: string;
  authorizationPda: string;
  providerRefHashHex: string;
}) {
  const wallet = new PublicKey(input.wallet);
  const policyPda = new PublicKey(input.policyPda);
  const authorizationPda = new PublicKey(input.authorizationPda);
  const providerRefHash = bytes32FromHex(input.providerRefHashHex);
  const data = Buffer.concat([
    discriminator("global", "settle_action"),
    Buffer.from([1]),
    providerRefHash,
  ]);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: policyPda, isSigner: false, isWritable: true },
      { pubkey: authorizationPda, isSigner: false, isWritable: true },
      { pubkey: wallet, isSigner: true, isWritable: false },
    ],
    data,
  });
}

export async function prepareSettlementTransaction(input: {
  wallet: string;
  policyPda: string;
  items: SettlementItemDraft[];
}): Promise<PreparedSettlementTransaction> {
  if (input.items.length === 0 || input.items.length > 8) {
    throw new Error("invalid_settlement_items");
  }

  const endpoints = uniqueDevnetRpcEndpoints();
  if (endpoints.length === 0) {
    throw new Error("no_devnet_rpc_endpoints_configured");
  }

  const policyData = await readAccountData(input.policyPda, endpoints);
  if (!policyData) {
    throw new Error("policy_pda_not_found");
  }
  const policy = decodeAgentPolicyAccount(policyData);
  if (policy.settlementAuthority !== input.wallet) {
    throw new Error("settlement_authority_wallet_mismatch");
  }

  const preparedItems: PreparedSettlementTransaction["items"] = [];
  const instructions: TransactionInstruction[] = [];

  for (const item of input.items) {
    const authorizationData = await readAccountData(
      item.authorizationPda,
      endpoints,
    );
    if (!authorizationData) {
      throw new Error("authorization_pda_not_found");
    }
    const authorization = decodeActionAuthorizationAccount(authorizationData);
    if (authorization.policy !== input.policyPda) {
      throw new Error("authorization_policy_mismatch");
    }
    if (authorization.status !== "RESERVED") {
      throw new Error("authorization_not_reserved");
    }

    const providerRefHashHex = hash32(item.providerRef).toString("hex");
    preparedItems.push({
      authorizationPda: item.authorizationPda,
      providerRefHashHex,
    });
    instructions.push(
      buildSettleInstruction({
        wallet: input.wallet,
        policyPda: input.policyPda,
        authorizationPda: item.authorizationPda,
        providerRefHashHex,
      }),
    );
  }

  const blockhashConnection = new Connection(
    SOLANA_DEVNET_BLOCKHASH_RPC,
    "confirmed",
  );
  const latest = await blockhashConnection.getLatestBlockhash("confirmed");
  const transaction = new Transaction({
    feePayer: new PublicKey(input.wallet),
    recentBlockhash: latest.blockhash,
  });
  for (const instruction of instructions) {
    transaction.add(instruction);
  }

  return {
    network: "devnet",
    programId: AGENT_POLICY_PROGRAM_ID,
    instruction: "settle_action",
    wallet: input.wallet,
    policyPda: input.policyPda,
    items: preparedItems,
    transactionBase64: transaction
      .serialize({ requireAllSignatures: false, verifySignatures: false })
      .toString("base64"),
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  };
}

export function assertSignedSettlementTransaction(input: {
  transaction: Transaction;
  prepared: Omit<PreparedSettlementTransaction, "transactionBase64">;
}) {
  const business = input.transaction.instructions.filter((instruction) =>
    instruction.programId.equals(PROGRAM_ID),
  );
  if (business.length !== input.prepared.items.length) {
    throw new Error("transaction_instruction_count_invalid");
  }
  const unsupported = input.transaction.instructions.filter(
    (instruction) =>
      !instruction.programId.equals(PROGRAM_ID) &&
      !instruction.programId.equals(ComputeBudgetProgram.programId),
  );
  if (unsupported.length > 0) {
    throw new Error("transaction_contains_unsupported_instruction");
  }

  for (let index = 0; index < input.prepared.items.length; index += 1) {
    const item = input.prepared.items[index]!;
    const expected = buildSettleInstruction({
      wallet: input.prepared.wallet,
      policyPda: input.prepared.policyPda,
      authorizationPda: item.authorizationPda,
      providerRefHashHex: item.providerRefHashHex,
    });
    const actual = business[index]!;

    if (!Buffer.from(actual.data).equals(Buffer.from(expected.data))) {
      throw new Error("transaction_instruction_data_mismatch");
    }
    if (actual.keys.length !== expected.keys.length) {
      throw new Error("transaction_accounts_mismatch");
    }
    for (let keyIndex = 0; keyIndex < expected.keys.length; keyIndex += 1) {
      const actualKey = actual.keys[keyIndex]!;
      const expectedKey = expected.keys[keyIndex]!;
      const missingRequiredWritable =
        expectedKey.isWritable && !actualKey.isWritable;
      if (
        !actualKey.pubkey.equals(expectedKey.pubkey) ||
        actualKey.isSigner !== expectedKey.isSigner ||
        missingRequiredWritable
      ) {
        throw new Error("transaction_accounts_mismatch");
      }
    }
  }

  if (
    !input.transaction.feePayer?.equals(new PublicKey(input.prepared.wallet))
  ) {
    throw new Error("transaction_fee_payer_mismatch");
  }
  if (!input.transaction.verifySignatures()) {
    throw new Error("transaction_signature_invalid");
  }
}

export async function submitSettlementTransaction(input: {
  prepared: Omit<PreparedSettlementTransaction, "transactionBase64">;
  signedTransactionBase64: string;
}) {
  const transaction = Transaction.from(
    Buffer.from(input.signedTransactionBase64, "base64"),
  );
  assertSignedSettlementTransaction({
    transaction,
    prepared: input.prepared,
  });
  if (transaction.recentBlockhash !== input.prepared.blockhash) {
    throw new Error("transaction_blockhash_mismatch");
  }

  const raw = transaction.serialize({
    requireAllSignatures: true,
    verifySignatures: true,
  });
  const endpoints = uniqueDevnetRpcEndpoints();
  const transactionSignature = await broadcastRawTransaction(
    Buffer.from(raw).toString("base64"),
    endpoints,
  );

  for (let iteration = 0; iteration < 10; iteration += 1) {
    const settled = [];
    for (const item of input.prepared.items) {
      const data = await readAccountData(
        item.authorizationPda,
        endpoints,
        iteration,
      );
      if (!data) {
        settled.push(false);
        continue;
      }
      const authorization = decodeActionAuthorizationAccount(data);
      settled.push(
        authorization.policy === input.prepared.policyPda &&
          authorization.status === "SETTLED_SUCCESS" &&
          authorization.providerRefHashHex === item.providerRefHashHex,
      );
    }

    if (settled.every(Boolean)) {
      const status = await readSignatureStatus(
        transactionSignature,
        endpoints,
        iteration,
      );
      return {
        network: "devnet" as const,
        transactionSignature,
        slot: status?.slot ?? null,
        explorerUrl:
          "https://explorer.solana.com/tx/" +
          transactionSignature +
          "?cluster=devnet",
        verified: true as const,
        settledAuthorizationPdas: input.prepared.items.map(
          (item) => item.authorizationPda,
        ),
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 2500));
  }

  throw new Error("transaction_confirmation_timeout");
}

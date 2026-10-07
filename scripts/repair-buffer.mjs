import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

const LOADER = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
const METADATA_LEN = 37;
const CHUNK_SIZE = 900;
const SEND_DELAY_MS = Number(process.env.BUFFER_REPAIR_DELAY_MS ?? 900);
const MAX_WRITES = Number(process.env.BUFFER_REPAIR_MAX_WRITES ?? 60);

const bufferAddress = process.env.AGENT_POLICY_BUFFER;
if (!bufferAddress) throw new Error("AGENT_POLICY_BUFFER is required.");

const readRpc =
  process.env.SOLANA_READ_RPC_URL ??
  "https://api.uniblock.dev/uni/v1/json-rpc?chainId=solana-devnet";
const sendRpc =
  process.env.SOLANA_SEND_RPC_URL ?? "https://api.devnet.solana.com";
const blockhashRpc =
  process.env.SOLANA_BLOCKHASH_RPC_URL ??
  "https://solana-devnet.gateway.tatum.io";

const payerPath =
  process.env.SOLANA_DEPLOY_KEYPAIR ??
  path.join(os.homedir(), ".config/solana/id.json");
const artifactPath =
  process.env.AGENT_POLICY_ARTIFACT ??
  path.join("solana", "target", "deploy", "agent_policy.so");

const payer = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(payerPath, "utf8"))),
);
const artifact = fs.readFileSync(artifactPath);
const buffer = new PublicKey(bufferAddress);

const readConnection = new Connection(readRpc, "confirmed");
const sendConnection = new Connection(sendRpc, "confirmed");
const blockhashConnection = new Connection(blockhashRpc, "confirmed");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function mismatchedChunks(accountData) {
  if (accountData.length !== METADATA_LEN + artifact.length) {
    throw new Error(
      `Unexpected buffer length ${accountData.length}; expected ${METADATA_LEN + artifact.length}.`,
    );
  }
  const programData = accountData.subarray(METADATA_LEN);
  const chunks = [];
  for (let offset = 0; offset < artifact.length; offset += CHUNK_SIZE) {
    const expected = artifact.subarray(offset, Math.min(offset + CHUNK_SIZE, artifact.length));
    const actual = programData.subarray(offset, offset + expected.length);
    if (!actual.equals(expected)) chunks.push({ offset, bytes: expected });
  }
  return chunks;
}

function writeInstruction(offset, bytes) {
  const data = Buffer.alloc(16 + bytes.length);
  data.writeUInt32LE(1, 0); // UpgradeableLoaderInstruction::Write
  data.writeUInt32LE(offset, 4);
  data.writeBigUInt64LE(BigInt(bytes.length), 8);
  bytes.copy(data, 16);
  return new TransactionInstruction({
    programId: LOADER,
    keys: [
      { pubkey: buffer, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: false },
    ],
    data,
  });
}

const info = await readConnection.getAccountInfo(buffer, "confirmed");
if (!info) throw new Error("Deployment buffer is missing.");
if (!info.owner.equals(LOADER)) throw new Error("Buffer owner mismatch.");

const mismatches = mismatchedChunks(Buffer.from(info.data));
console.log(
  JSON.stringify({
    phase: "scan",
    mismatchedChunks: mismatches.length,
    totalChunks: Math.ceil(artifact.length / CHUNK_SIZE),
  }),
);

if (mismatches.length === 0) {
  console.log(
    JSON.stringify({
      phase: "verified",
      buffer: buffer.toBase58(),
      artifactLength: artifact.length,
      exactMatch: true,
    }),
  );
  process.exit(0);
}

const targets = mismatches.slice(0, MAX_WRITES);
const latest = await blockhashConnection.getLatestBlockhash("confirmed");
let sent = 0;
let sendErrors = 0;

for (const { offset, bytes } of targets) {
    const transaction = new Transaction({
      feePayer: payer.publicKey,
      recentBlockhash: latest.blockhash,
    }).add(writeInstruction(offset, bytes));
    transaction.sign(payer);

    try {
      await sendConnection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: true,
        maxRetries: 0,
      });
      sent += 1;
    } catch (error) {
      sendErrors += 1;
      console.error(
        JSON.stringify({
          phase: "send_error",
          offset,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }

  await sleep(SEND_DELAY_MS);
}

console.log(JSON.stringify({ phase: "sent", attempted: targets.length, sent, sendErrors }));
await sleep(2000);

const finalInfo = await readConnection.getAccountInfo(buffer, "confirmed");
if (!finalInfo) throw new Error("Deployment buffer disappeared.");
const remaining = mismatchedChunks(Buffer.from(finalInfo.data));
console.log(
  JSON.stringify({
    phase: remaining.length === 0 ? "verified" : "progress",
    remainingMismatchedChunks: remaining.length,
    exactMatch: remaining.length === 0,
  }),
);

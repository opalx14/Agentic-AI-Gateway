import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import bs58 from "bs58";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

const UPGRADEABLE_LOADER = new PublicKey(
  "BPFLoaderUpgradeab1e11111111111111111111111",
);

const sendRpcUrl =
  process.env.SOLANA_SEND_RPC_URL ??
  process.env.SOLANA_DEPLOY_RPC_URL ??
  "https://api.devnet.solana.com";
const blockhashRpcUrl =
  process.env.SOLANA_BLOCKHASH_RPC_URL ??
  "https://solana-devnet.gateway.tatum.io";
const confirmRpcUrl =
  process.env.SOLANA_CONFIRM_RPC_URL ?? blockhashRpcUrl;

const bufferAddress = process.env.AGENT_POLICY_BUFFER;
if (!bufferAddress) {
  throw new Error("AGENT_POLICY_BUFFER is required.");
}

const payerPath =
  process.env.SOLANA_DEPLOY_KEYPAIR ??
  path.join(os.homedir(), ".config/solana/id.json");
const programKeypairPath =
  process.env.AGENT_POLICY_PROGRAM_KEYPAIR ??
  path.join("solana", "target", "deploy", "agent_policy-keypair.json");
const artifactPath =
  process.env.AGENT_POLICY_ARTIFACT ??
  path.join("solana", "target", "deploy", "agent_policy.so");

function readKeypair(filePath) {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(filePath, "utf8"))),
  );
}

const payer = readKeypair(payerPath);
const program = readKeypair(programKeypairPath);
const buffer = new PublicKey(bufferAddress);
const artifactLength = fs.statSync(artifactPath).size;

const blockhashConnection = new Connection(blockhashRpcUrl, "confirmed");
const sendConnection = new Connection(sendRpcUrl, "confirmed");
const confirmConnection = new Connection(confirmRpcUrl, "confirmed");

const programLamports = Number(process.env.AGENT_POLICY_PROGRAM_LAMPORTS ?? 833120);

const [programData] = PublicKey.findProgramAddressSync(
  [program.publicKey.toBuffer()],
  UPGRADEABLE_LOADER,
);

const deployData = Buffer.alloc(12);
deployData.writeUInt32LE(2, 0); // UpgradeableLoaderInstruction::DeployWithMaxDataLen
deployData.writeBigUInt64LE(BigInt(artifactLength), 4);

const deployInstruction = new TransactionInstruction({
  programId: UPGRADEABLE_LOADER,
  keys: [
    { pubkey: payer.publicKey, isSigner: true, isWritable: true },
    { pubkey: programData, isSigner: false, isWritable: true },
    { pubkey: program.publicKey, isSigner: false, isWritable: true },
    { pubkey: buffer, isSigner: false, isWritable: true },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: payer.publicKey, isSigner: true, isWritable: false },
  ],
  data: deployData,
});

const latest = await blockhashConnection.getLatestBlockhash("confirmed");
const transaction = new Transaction({
  feePayer: payer.publicKey,
  recentBlockhash: latest.blockhash,
}).add(
  SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: program.publicKey,
    lamports: programLamports,
    space: 36,
    programId: UPGRADEABLE_LOADER,
  }),
  deployInstruction,
);
transaction.sign(payer, program);

const signatureBytes = transaction.signature;
if (!signatureBytes) {
  throw new Error("Deployment transaction was not signed.");
}
const localSignature = bs58.encode(signatureBytes);

console.log(
  JSON.stringify({
    phase: "signed",
    network: "devnet",
    programId: program.publicKey.toBase58(),
    programData: programData.toBase58(),
    buffer: buffer.toBase58(),
    artifactLength,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
    localSignature,
  }),
);

const rpcSignature = await sendConnection.sendRawTransaction(
  transaction.serialize(),
  {
    skipPreflight: true,
    maxRetries: 5,
  },
);

if (rpcSignature !== localSignature) {
  throw new Error("RPC returned a signature different from the locally signed transaction.");
}

const confirmation = await confirmConnection.confirmTransaction(
  {
    signature: localSignature,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  },
  "confirmed",
);
if (confirmation.value.err) {
  throw new Error(
    `Deployment transaction failed: ${JSON.stringify(confirmation.value.err)}`,
  );
}

console.log(
  JSON.stringify(
    {
      phase: "confirmed",
      network: "devnet",
      programId: program.publicKey.toBase58(),
      programData: programData.toBase58(),
      buffer: buffer.toBase58(),
      artifactLength,
      signature: localSignature,
    },
    null,
    2,
  ),
);

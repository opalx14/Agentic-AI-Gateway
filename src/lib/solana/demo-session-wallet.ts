"use client";

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
  clusterApiUrl,
} from "@solana/web3.js";

export const DEMO_WALLET_SESSION_KEY =
  "agentic-ai-gateway:demo-devnet-wallet:v1";
export const DEMO_WALLET_CHANGE_EVENT =
  "agentic-ai-gateway:demo-wallet-change";
export const DEMO_WALLET_TARGET_LAMPORTS = Math.round(
  0.03 * LAMPORTS_PER_SOL,
);
export const DEMO_WALLET_AIRDROP_LAMPORTS = Math.round(
  0.08 * LAMPORTS_PER_SOL,
);

type SessionStorageLike = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

function sessionStorageOrNull(): SessionStorageLike | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

function notifyDemoWalletChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DEMO_WALLET_CHANGE_EVENT));
}

function parseSecretKey(value: string) {
  const parsed = JSON.parse(value);
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 64 ||
    parsed.some(
      (item) =>
        !Number.isInteger(item) ||
        item < 0 ||
        item > 255,
    )
  ) {
    throw new Error("demo_wallet_secret_invalid");
  }
  return Uint8Array.from(parsed);
}

export function readDemoSessionWallet(
  storage: SessionStorageLike | null = sessionStorageOrNull(),
): Keypair | null {
  if (!storage) return null;
  const stored = storage.getItem(DEMO_WALLET_SESSION_KEY);
  if (!stored) return null;

  try {
    return Keypair.fromSecretKey(parseSecretKey(stored));
  } catch {
    storage.removeItem(DEMO_WALLET_SESSION_KEY);
    return null;
  }
}

export function createDemoSessionWallet(
  storage: SessionStorageLike | null = sessionStorageOrNull(),
) {
  if (!storage) {
    throw new Error("demo_wallet_browser_session_required");
  }

  const existing = readDemoSessionWallet(storage);
  if (existing) return existing;

  const wallet = Keypair.generate();
  storage.setItem(
    DEMO_WALLET_SESSION_KEY,
    JSON.stringify(Array.from(wallet.secretKey)),
  );
  notifyDemoWalletChange();
  return wallet;
}

export function clearDemoSessionWallet(
  storage: SessionStorageLike | null = sessionStorageOrNull(),
) {
  storage?.removeItem(DEMO_WALLET_SESSION_KEY);
  notifyDemoWalletChange();
}

export async function demoWalletBalance(wallet: Keypair) {
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  return connection.getBalance(wallet.publicKey, "confirmed");
}

export async function ensureDemoSessionWalletFunded(wallet: Keypair) {
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  const current = await connection.getBalance(wallet.publicKey, "confirmed");

  if (current >= DEMO_WALLET_TARGET_LAMPORTS) {
    return {
      balanceLamports: current,
      airdropped: false,
    };
  }

  const signature = await connection.requestAirdrop(
    wallet.publicKey,
    DEMO_WALLET_AIRDROP_LAMPORTS,
  );
  const latest = await connection.getLatestBlockhash("confirmed");
  await connection.confirmTransaction(
    {
      signature,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    },
    "confirmed",
  );

  const balanceLamports = await connection.getBalance(
    wallet.publicKey,
    "confirmed",
  );

  if (balanceLamports < DEMO_WALLET_TARGET_LAMPORTS) {
    throw new Error("demo_wallet_funding_not_confirmed");
  }

  return {
    balanceLamports,
    airdropped: true,
  };
}

export function signWithDemoSessionWallet(transaction: Transaction) {
  const wallet = readDemoSessionWallet();
  if (!wallet) {
    throw new Error("demo_wallet_session_missing");
  }
  if (
    transaction.feePayer &&
    !transaction.feePayer.equals(wallet.publicKey)
  ) {
    throw new Error("demo_wallet_fee_payer_mismatch");
  }

  transaction.partialSign(wallet);

  if (!transaction.verifySignatures()) {
    throw new Error("demo_wallet_signature_invalid");
  }

  return transaction;
}

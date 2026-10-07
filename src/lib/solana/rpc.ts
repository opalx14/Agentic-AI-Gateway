import { PublicKey } from "@solana/web3.js";

import {
  SOLANA_DEVNET_CONFIRM_RPC,
  SOLANA_DEVNET_READ_RPC,
  SOLANA_DEVNET_SEND_RPC,
} from "./policy-core";

export const SOLANA_DEVNET_FALLBACK_RPC_URLS =
  process.env.SOLANA_DEVNET_FALLBACK_RPC_URLS ?? "";

type JsonRpcEnvelope<T> = {
  jsonrpc: "2.0";
  id: string | number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

export async function jsonRpc<T>(
  endpoint: string,
  method: string,
  params: unknown[],
  timeoutMs = 4000,
): Promise<T> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "agentic-gw",
      method,
      params,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`rpc_http_error_${response.status}`);
  }

  const payload = (await response.json()) as JsonRpcEnvelope<T>;
  if (payload.error) {
    throw new Error(payload.error.message || `rpc_error_${payload.error.code}`);
  }
  return payload.result as T;
}

export function uniqueDevnetRpcEndpoints(): string[] {
  const fallbacks = (process.env.SOLANA_DEVNET_FALLBACK_RPC_URLS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const candidates = [
    SOLANA_DEVNET_SEND_RPC,
    SOLANA_DEVNET_CONFIRM_RPC,
    SOLANA_DEVNET_READ_RPC,
    ...fallbacks,
  ];

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      unique.push(trimmed);
    }
  }
  return unique;
}

export async function broadcastRawTransaction(
  rawBase64: string,
  endpoints: string[],
): Promise<string> {
  const results = await Promise.allSettled(
    endpoints.map((endpoint) =>
      jsonRpc<string>(endpoint, "sendTransaction", [
        rawBase64,
        { encoding: "base64", skipPreflight: true, maxRetries: 0 },
      ]),
    ),
  );

  for (const res of results) {
    if (
      res.status === "fulfilled" &&
      typeof res.value === "string" &&
      res.value.length > 0
    ) {
      return res.value;
    }
  }

  throw new Error("transaction_broadcast_failed");
}

type AccountInfoRpcValue = {
  data: [string, string];
  executable: boolean;
  lamports: number;
  owner: string;
  rentEpoch: number;
} | null;

export async function readAccountData(
  pubkey: string | PublicKey,
  endpoints: string[],
  preferredIndex = 0,
): Promise<Buffer | null> {
  if (endpoints.length === 0) return null;
  const address = typeof pubkey === "string" ? pubkey : pubkey.toBase58();
  const ordered = endpoints.map(
    (_, index) => endpoints[(preferredIndex + index) % endpoints.length],
  );

  const results = await Promise.allSettled(
    ordered.map((endpoint) =>
      jsonRpc<{
        context?: { slot?: number };
        value: AccountInfoRpcValue;
      } | null>(
        endpoint,
        "getAccountInfo",
        [address, { encoding: "base64", commitment: "confirmed" }],
        2500,
      ),
    ),
  );

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const res = result.value;
    if (
      res?.value &&
      Array.isArray(res.value.data) &&
      typeof res.value.data[0] === "string"
    ) {
      return Buffer.from(res.value.data[0], "base64");
    }
  }

  return null;
}

export type SignatureStatusItem = {
  slot: number;
  confirmations: number | null;
  err: unknown | null;
  confirmationStatus: "processed" | "confirmed" | "finalized" | null;
};

export async function readSignatureStatus(
  signature: string,
  endpoints: string[],
  preferredIndex = 0,
): Promise<SignatureStatusItem | null> {
  if (endpoints.length === 0) return null;
  const ordered = endpoints.map(
    (_, index) => endpoints[(preferredIndex + index) % endpoints.length],
  );

  const results = await Promise.allSettled(
    ordered.map((endpoint) =>
      jsonRpc<{
        context?: { slot?: number };
        value: Array<SignatureStatusItem | null>;
      }>(
        endpoint,
        "getSignatureStatuses",
        [[signature], { searchTransactionHistory: true }],
        2500,
      ),
    ),
  );

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const status = result.value?.value?.[0];
    if (status) return status;
  }

  return null;
}

type SignatureForAddressItem = {
  signature: string;
  slot: number;
  err: unknown | null;
  memo: string | null;
  blockTime: number | null;
  confirmationStatus: "processed" | "confirmed" | "finalized" | null;
};

export async function readSignaturesForAddress(
  address: string | PublicKey,
  endpoints: string[],
  preferredIndex = 0,
): Promise<SignatureForAddressItem[]> {
  if (endpoints.length === 0) return [];
  const pubkey = typeof address === "string" ? address : address.toBase58();

  for (let i = 0; i < endpoints.length; i++) {
    const idx = (preferredIndex + i) % endpoints.length;
    const endpoint = endpoints[idx];
    try {
      const result = await jsonRpc<SignatureForAddressItem[]>(
        endpoint,
        "getSignaturesForAddress",
        [pubkey, { limit: 100, commitment: "confirmed" }],
      );
      if (Array.isArray(result)) {
        return result;
      }
    } catch {
      continue;
    }
  }

  return [];
}


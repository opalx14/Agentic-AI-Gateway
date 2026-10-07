import { describe, expect, test } from "bun:test";

import {
  clearDemoSessionWallet,
  createDemoSessionWallet,
  readDemoSessionWallet,
} from "@/lib/solana/demo-session-wallet";

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
    removeItem(key: string) {
      data.delete(key);
    },
  };
}

describe("temporary Devnet demo wallet", () => {
  test("creates and restores one session-scoped Solana keypair", () => {
    const storage = fakeStorage();
    const first = createDemoSessionWallet(storage);
    const restored = readDemoSessionWallet(storage);

    expect(restored).not.toBeNull();
    expect(restored?.publicKey.toBase58()).toBe(first.publicKey.toBase58());
  });

  test("does not rotate the keypair inside the same browser session", () => {
    const storage = fakeStorage();
    const first = createDemoSessionWallet(storage);
    const second = createDemoSessionWallet(storage);

    expect(second.publicKey.toBase58()).toBe(first.publicKey.toBase58());
  });

  test("deletes the temporary wallet when the session wallet is reset", () => {
    const storage = fakeStorage();
    createDemoSessionWallet(storage);
    clearDemoSessionWallet(storage);

    expect(readDemoSessionWallet(storage)).toBeNull();
  });
});

import { describe, expect, test } from "bun:test";

import { buildWalletVerificationMessage } from "@/components/PhantomWalletControl";

describe("Phantom signer verification message", () => {
  test("states the no-transaction and no-funds boundary explicitly", () => {
    const message = buildWalletVerificationMessage({
      address: "Wallet111111111111111111111111111111111",
      origin: "http://localhost:3000",
      nonce: "nonce-1",
      time: "2026-09-26T16:40:39.477Z",
    });

    expect(message).toContain("Network action: none.");
    expect(message).toContain("Transaction: none.");
    expect(message).toContain("Funds: none.");
  });

  test("binds the proof to wallet, origin, nonce and time", () => {
    const message = buildWalletVerificationMessage({
      address: "Wallet222222222222222222222222222222222",
      origin: "http://localhost:3000",
      nonce: "nonce-2",
      time: "2026-09-26T16:41:00.000Z",
    });

    expect(message).toContain(
      "Wallet: Wallet222222222222222222222222222222222",
    );
    expect(message).toContain("Origin: http://localhost:3000");
    expect(message).toContain("Nonce: nonce-2");
    expect(message).toContain("Time: 2026-09-26T16:41:00.000Z");
  });
});

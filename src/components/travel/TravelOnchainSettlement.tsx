"use client";

import { Buffer } from "buffer";
import { Transaction } from "@solana/web3.js";
import { useState } from "react";

type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toString(): string } | null;
  connect(): Promise<{ publicKey: { toString(): string } }>;
  signTransaction(transaction: Transaction): Promise<Transaction>;
};

type Prepared = {
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

type Result = {
  transactionSignature: string;
  slot: number | null;
  explorerUrl: string;
  verified: true;
  settledAuthorizationPdas: string[];
};

const POLICY_PDA = "FBxjL53RRFeH3sqn9k9eGDneX1rmZVUWcDNzEkwKcrtV";

function phantom(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const typed = window as Window & {
    phantom?: { solana?: PhantomProvider };
    solana?: PhantomProvider;
  };
  const candidate = typed.phantom?.solana ?? typed.solana ?? null;
  return candidate?.isPhantom ? candidate : null;
}

function semanticsMatch(a: Prepared, b: Prepared) {
  return (
    a.wallet === b.wallet &&
    a.policyPda === b.policyPda &&
    a.items.length === b.items.length &&
    a.items.every(
      (item, index) =>
        item.authorizationPda === b.items[index]?.authorizationPda &&
        item.providerRefHashHex === b.items[index]?.providerRefHashHex,
    )
  );
}

export function TravelOnchainSettlement(props: {
  items: Array<{ authorizationPda: string; providerRef: string }>;
  total: number;
  onConfirmed?: (result: Result) => void;
}) {
  const [wallet, setWallet] = useState("");
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function prepare() {
    const provider = phantom();
    if (!provider) {
      setError("Phantom not detected.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const connected = provider.publicKey;
      if (!connected) {
        throw new Error("Connect Phantom before settling the trip.");
      }
      const walletAddress = connected.toString();
      setWallet(walletAddress);

      const response = await fetch("/api/solana/settlement/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet: walletAddress,
          policyPda: POLICY_PDA,
          items: props.items,
        }),
      });
      const payload = (await response.json()) as
        | { ok: true; prepared: Prepared }
        | { ok: false; error: string };

      if (!response.ok || !payload.ok) {
        throw new Error("error" in payload ? payload.error : "Settlement prepare failed.");
      }
      setPrepared(payload.prepared);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Settlement prepare failed.");
      setPrepared(null);
    } finally {
      setBusy(false);
    }
  }

  async function signAndSubmit() {
    if (!prepared) return;
    const provider = phantom();
    if (!provider) {
      setError("Phantom not detected.");
      return;
    }
    if (provider.publicKey?.toString() !== wallet) {
      setPrepared(null);
      setError("Connected wallet changed. Review settlement again.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const refreshResponse = await fetch("/api/solana/settlement/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet,
          policyPda: prepared.policyPda,
          items: props.items,
        }),
      });
      const refreshPayload = (await refreshResponse.json()) as
        | { ok: true; prepared: Prepared }
        | { ok: false; error: string };

      if (!refreshResponse.ok || !refreshPayload.ok) {
        throw new Error("error" in refreshPayload ? refreshPayload.error : "Settlement refresh failed.");
      }

      const fresh = refreshPayload.prepared;
      if (!semanticsMatch(prepared, fresh)) {
        setPrepared(null);
        throw new Error("review_changed_before_signing");
      }

      const transaction = Transaction.from(
        Buffer.from(fresh.transactionBase64, "base64"),
      );
      const signed = await provider.signTransaction(transaction);
      const signedTransactionBase64 = Buffer.from(
        signed.serialize({
          requireAllSignatures: true,
          verifySignatures: true,
        }),
      ).toString("base64");

      const preparedForSubmit = {
        network: fresh.network,
        programId: fresh.programId,
        instruction: fresh.instruction,
        wallet: fresh.wallet,
        policyPda: fresh.policyPda,
        items: fresh.items,
        blockhash: fresh.blockhash,
        lastValidBlockHeight: fresh.lastValidBlockHeight,
      };

      const response = await fetch("/api/solana/settlement/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prepared: preparedForSubmit,
          signedTransactionBase64,
        }),
      });
      const payload = (await response.json()) as
        | { ok: true; result: Result }
        | { ok: false; error: string };

      if (!response.ok || !payload.ok) {
        throw new Error("error" in payload ? payload.error : "Settlement submit failed.");
      }

      setPrepared(fresh);
      setResult(payload.result);
      props.onConfirmed?.(payload.result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Settlement failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="travel-onchain">
      {!prepared && !result ? (
        <button type="button" className="landing-primary" onClick={() => void prepare()} disabled={busy}>
          {busy ? "Checking reservations…" : "Verify wallet & settle $" + props.total}
        </button>
      ) : null}

      {prepared && !result ? (
        <div className="travel-onchain-review">
          <span className="travel-agent-kicker">FINAL PROVIDER SETTLEMENT · DEVNET</span>
          <p className="travel-muted">
            One Phantom signature settles {prepared.items.length} already-reserved service authorizations.
            No new spend is reserved.
          </p>
          <dl>
            <div><dt>Total</dt><dd>{"$" + props.total}</dd></div>
            <div><dt>Services</dt><dd>{prepared.items.length}</dd></div>
            <div><dt>Instruction</dt><dd>settle_action × {prepared.items.length}</dd></div>
          </dl>
          <button type="button" className="landing-primary" onClick={() => void signAndSubmit()} disabled={busy}>
            {busy ? "Opening Phantom…" : "Sign provider settlement"}
          </button>
        </div>
      ) : null}

      {result ? (
        <div className="travel-onchain-result">
          <strong>SETTLED · AUTHORIZATION PDAs VERIFIED</strong>
          <p className="travel-muted">
            The reserved amounts were settled on the AgentPolicy program and read back before this state appeared.
          </p>
          <dl>
            <div>
              <dt>Transaction</dt>
              <dd>{result.transactionSignature.slice(0, 12)}…{result.transactionSignature.slice(-8)}</dd>
            </div>
            <div>
              <dt>Settled actions</dt>
              <dd>{result.settledAuthorizationPdas.length}</dd>
            </div>
          </dl>
          <a href={result.explorerUrl} target="_blank" rel="noreferrer">
            View Devnet settlement ↗
          </a>
        </div>
      ) : null}

      {error ? <div className="travel-error">{error}</div> : null}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Buffer } from "buffer";
import { Transaction } from "@solana/web3.js";
import { preparedPolicySemanticsMatch } from "@/lib/solana/prepared-policy-semantics";

type TransactionPhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toString(): string } | null;
  connect(): Promise<{ publicKey: { toString(): string } }>;
  signTransaction(transaction: Transaction): Promise<Transaction>;
};

type Prepared = {
  network: "devnet";
  programId: string;
  instruction: "initialize_policy";
  authority: string;
  policyPda: string;
  policyIdHex: string;
  totalBudget: number;
  maxPerAction: number;
  autoApproveMax: number;
  expiresAt: number;
  goalHashHex: string;
  allowedActionsHashHex: string;
  transactionBase64: string;
  blockhash: string;
  lastValidBlockHeight: number;
};

type Result = {
  network: "devnet";
  programId: string;
  instruction: "initialize_policy";
  transactionSignature: string;
  slot: number | null;
  policyPda: string;
  explorerUrl: string;
  accountExplorerUrl: string;
  verified: boolean;
  recovered?: boolean;
};

function provider(): TransactionPhantomProvider | null {
  if (typeof window === "undefined") return null;
  const typedWindow = window as Window & {
    phantom?: { solana?: TransactionPhantomProvider };
    solana?: TransactionPhantomProvider;
  };
  const candidate = typedWindow.phantom?.solana ?? typedWindow.solana ?? null;
  return candidate?.isPhantom ? candidate : null;
}

function short(value: string) {
  return value.length > 20 ? value.slice(0, 9) + "…" + value.slice(-9) : value;
}

export function OnchainPolicyControl() {
  const [wallet, setWallet] = useState("");
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [busy, setBusy] = useState<"connect" | "prepare" | "refresh" | "sign" | null>(null);
  const [error, setError] = useState("");

  const draft = useMemo(() => {
    if (!wallet || !expiresAt) return null;
    return {
      authority: wallet,
      agentSigner: wallet,
      settlementAuthority: wallet,
      policyId: "browser-mvp-policy-v1",
      totalBudget: 10000,
      maxPerAction: 5000,
      autoApproveMax: 2000,
      expiresAt,
      goal: "Bound agent actions behind deterministic authority",
      allowedActions: ["inventory.transfer", "flight.replace"],
    };
  }, [expiresAt, wallet]);

  async function connect() {
    const phantom = provider();
    if (!phantom) {
      setError("Phantom not detected in this browser.");
      return;
    }
    setBusy("connect");
    setError("");
    try {
      const connected = await phantom.connect();
      setWallet(connected.publicKey.toString());
      setExpiresAt(Math.floor(Date.now() / 1000) + 60 * 60 * 24);
      setPrepared(null);
      setResult(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Phantom connection was rejected.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function prepare() {
    if (!draft) return;
    setBusy("prepare");
    setError("");
    setPrepared(null);
    setResult(null);
    try {
      const response = await fetch("/api/solana/policy/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = (await response.json()) as
        | { ok: true; prepared: Prepared }
        | { ok: true; existing: Result }
        | { ok: false; error: string };
      if (!response.ok || !payload.ok) {
        throw new Error(
          "error" in payload ? payload.error : "Transaction preparation failed.",
        );
      }
      if ("existing" in payload) {
        setResult(payload.existing);
        return;
      }
      setPrepared(payload.prepared);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Transaction preparation failed.";
      setError(
        message === "agent_policy_program_not_deployed_on_devnet"
          ? "Devnet blocker: AgentPolicy program is not deployed at the configured program ID yet. No transaction was requested from Phantom."
          : message,
      );
    } finally {
      setBusy(null);
    }
  }

  async function signAndSubmit() {
    if (!draft || !prepared) return;
    const phantom = provider();
    if (!phantom) {
      setError("Phantom not detected in this browser.");
      return;
    }
    if (phantom.publicKey?.toString() !== draft.authority) {
      setError("Connected Phantom wallet changed. Prepare the transaction again.");
      setPrepared(null);
      return;
    }

    // ── Step 1: Refresh blockhash ────────────────────────────────────────────
    // We never sign the previously-prepared transaction directly because its
    // blockhash may already be expired (Solana blocks are ~400 ms; a
    // blockhash is only valid for ~150 blocks ≈ 60 s).  Re-prepare now to
    // get a current blockhash while keeping the reviewed semantics.
    setError("");
    setBusy("refresh");
    let fresh: typeof prepared;
    try {
      const refreshResponse = await fetch("/api/solana/policy/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const refreshPayload = (await refreshResponse.json()) as
        | { ok: true; prepared: typeof prepared }
        | { ok: true; existing: Result }
        | { ok: false; error: string };
      if (!refreshResponse.ok || !refreshPayload.ok) {
        const msg =
          "error" in refreshPayload
            ? refreshPayload.error
            : "Blockhash refresh failed.";
        throw new Error(msg);
      }
      if ("existing" in refreshPayload) {
        setPrepared(null);
        setResult(refreshPayload.existing);
        setBusy(null);
        return;
      }
      fresh = refreshPayload.prepared;
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Blockhash refresh failed.",
      );
      setBusy(null);
      return;
    }

    // ── Step 2: Fail-closed semantic check ───────────────────────────────────
    // Before opening Phantom we verify that every field the user reviewed is
    // identical in the fresh response.  Any drift means the backend changed
    // something between Prepare and Sign – that must never silently proceed.
    if (!preparedPolicySemanticsMatch(prepared, fresh)) {
      setError(
        "review_changed_before_signing: The transaction semantics changed between Prepare and Sign. Please click Prepare policy transaction again to review the updated details.",
      );
      setPrepared(null);
      setBusy(null);
      return;
    }

    // Promote the fresh payload so submit uses the current blockhash.
    setPrepared(fresh);

    // ── Step 3: Phantom sign + submit ────────────────────────────────────────
    setBusy("sign");
    try {
      const transaction = Transaction.from(
        Buffer.from(fresh.transactionBase64, "base64"),
      );
      const signed = await phantom.signTransaction(transaction);
      const signedTransactionBase64 = Buffer.from(
        signed.serialize({
          requireAllSignatures: true,
          verifySignatures: true,
        }),
      ).toString("base64");

      const response = await fetch("/api/solana/policy/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft,
          signedTransactionBase64,
          blockhash: fresh.blockhash,
          lastValidBlockHeight: fresh.lastValidBlockHeight,
        }),
      });
      const payload = (await response.json()) as
        | { ok: true; result: Result }
        | { ok: false; error: string };
      if (!response.ok || !payload.ok) {
        throw new Error(
          "error" in payload ? payload.error : "Transaction submission failed.",
        );
      }
      setResult(payload.result);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Transaction signing failed.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="onchain-control" aria-labelledby="onchain-title">
      <div className="onchain-head">
        <div>
          <p className="operator-eyebrow">REAL SMART-CONTRACT TRANSACTION</p>
          <h2 id="onchain-title">Initialize AgentPolicy on Solana Devnet</h2>
          <p>
            This path is different from signer verification. Phantom will only
            open a transaction request after the program, wallet and exact
            instruction have been validated.
          </p>
        </div>
        <span className="onchain-network">DEVNET ONLY</span>
      </div>

      {!wallet ? (
        <button
          type="button"
          className="landing-primary onchain-button"
          disabled={busy !== null}
          onClick={() => void connect()}
        >
          {busy === "connect" ? "Connecting…" : "Connect Phantom"}
        </button>
      ) : (
        <>
          <div className="onchain-wallet-row">
            <span>Authority wallet</span>
            <code title={wallet}>{short(wallet)}</code>
          </div>

          {!prepared && !result ? (
            <button
              type="button"
              className="landing-primary onchain-button"
              disabled={busy !== null}
              onClick={() => void prepare()}
            >
              {busy === "prepare" ? "Checking Devnet…" : "Prepare policy transaction"}
            </button>
          ) : null}
        </>
      )}

      {prepared && draft && !result ? (
        <div className="onchain-review">
          <div className="onchain-review-title">
            <div>
              <span>TRANSACTION REVIEW</span>
              <strong>Phantom will sign this exact instruction</strong>
            </div>
            <b>NOT A MESSAGE</b>
          </div>
          <dl>
            <div><dt>Network</dt><dd>Solana Devnet</dd></div>
            <div><dt>Program</dt><dd><code>{short(prepared.programId)}</code></dd></div>
            <div><dt>Instruction</dt><dd>initialize_policy</dd></div>
            <div><dt>Policy PDA</dt><dd><code>{short(prepared.policyPda)}</code></dd></div>
            <div><dt>Total budget</dt><dd>{draft.totalBudget.toLocaleString()}</dd></div>
            <div><dt>Max / action</dt><dd>{draft.maxPerAction.toLocaleString()}</dd></div>
            <div><dt>Auto authority</dt><dd>{draft.autoApproveMax.toLocaleString()}</dd></div>
            <div><dt>Expiry</dt><dd>{new Date(draft.expiresAt * 1000).toLocaleString()}</dd></div>
          </dl>
          <div className="onchain-warning">
            Phantom will request a real Devnet transaction. This can spend
            Devnet SOL for fees and account rent. It never targets mainnet.
          </div>
          <button
            type="button"
            className="landing-primary onchain-button"
            disabled={busy !== null}
            onClick={() => void signAndSubmit()}
          >
            {busy === "refresh"
              ? "Refreshing Devnet blockhash…"
              : busy === "sign"
                ? "Waiting for Phantom / confirmation…"
                : "Sign Devnet transaction"}
          </button>
        </div>
      ) : null}

      {result ? (
        <div className="onchain-result">
          <span>CONFIRMED + PDA VERIFIED</span>
          <h3>
            {result.recovered
              ? "Existing AgentPolicy verified on Devnet."
              : "AgentPolicy exists on Devnet."}
          </h3>
          <dl>
            <div><dt>Transaction</dt><dd><code>{short(result.transactionSignature)}</code></dd></div>
            <div><dt>Policy PDA</dt><dd><code>{short(result.policyPda)}</code></dd></div>
            <div><dt>Slot</dt><dd>{result.slot ?? "confirmed"}</dd></div>
          </dl>
          <div className="onchain-result-links">
            <a href={result.explorerUrl} target="_blank" rel="noreferrer">Open transaction ↗</a>
            <a href={result.accountExplorerUrl} target="_blank" rel="noreferrer">Open policy PDA ↗</a>
          </div>
        </div>
      ) : null}

      {error ? <div className="onchain-error" role="alert">{error}</div> : null}
    </section>
  );
}

"use client";

import { Buffer } from "buffer";
import { Transaction } from "@solana/web3.js";
import { useState } from "react";

import { useEmbeddedEmailWallet } from "@/components/wallet/EmbeddedEmailWalletProvider";
import {
  DEMO_WALLET_TARGET_LAMPORTS,
  ensureDemoSessionWalletFunded,
  readDemoSessionWallet,
  signWithDemoSessionWallet,
} from "@/lib/solana/demo-session-wallet";
import { short } from "./travel-flow";

type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toString(): string } | null;
  connect(): Promise<{ publicKey: { toString(): string } }>;
  signTransaction(transaction: Transaction): Promise<Transaction>;
};

type PolicyRefresh = {
  totalBudget: number;
  maxPerAction: number;
  autoApproveMax: number;
  expiresAt: number;
  settlementAuthority: string;
  goalHashHex: string;
  allowedActionsHashHex: string;
};

type PolicyBootstrap = {
  authority: string;
  policyId: string;
  agentSigner: string;
  settlementAuthority: string;
  totalBudget: number;
  maxPerAction: number;
  autoApproveMax: number;
  expiresAt: number;
  goal: string;
  allowedActions: string[];
  policyPda: string;
};

type Prepared = {
  network: "devnet";
  programId: string;
  instructions:
    | ["approve_high_risk_action", "authorize_approved_action"]
    | ["update_policy", "approve_high_risk_action", "authorize_approved_action"]
    | ["initialize_policy", "approve_high_risk_action", "authorize_approved_action"];
  wallet: string;
  policyPda: string;
  approvalPda: string;
  authorizationPda: string;
  actionHashHex: string;
  amount: number;
  nonce: number;
  approvalExpiresAt: number;
  policyRefresh?: PolicyRefresh | null;
  policyBootstrap?: PolicyBootstrap | null;
  transactionBase64: string;
  blockhash: string;
  lastValidBlockHeight: number;
};

export type TravelOnchainConfirmedResult = {
  transactionSignature: string;
  slot: number | null;
  explorerUrl: string;
  policyPda: string;
  approvalPda: string;
  authorizationPda: string;
  nonce: number;
  policyState: "EXISTING" | "BOOTSTRAPPED" | "REFRESHED";
  verified: true;
};

type SubmitResult = {
  transactionSignature: string;
  slot: number | null;
  explorerUrl: string;
  approvalPda: string;
  authorizationPda: string;
  verified: true;
};

type Phase = "WAITING" | "PREPARED" | "SIGNING" | "SUBMITTED" | "VERIFIED" | "FAILED";

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
    a.actionHashHex === b.actionHashHex &&
    a.amount === b.amount &&
    a.nonce === b.nonce &&
    a.approvalPda === b.approvalPda &&
    a.authorizationPda === b.authorizationPda &&
    JSON.stringify(a.policyRefresh ?? null) === JSON.stringify(b.policyRefresh ?? null) &&
    JSON.stringify(a.policyBootstrap ?? null) === JSON.stringify(b.policyBootstrap ?? null)
  );
}

function friendlyApprovalError(message: string) {
  if (message === "policy_expiry_too_close") return "The current policy is expiring. Refresh the review and try again.";
  if (message === "remaining_budget_exceeded") return "This action is above the remaining delegated budget.";
  if (message === "max_per_action_exceeded") return "This trip total exceeds the policy limit for one action.";
  if (message === "delegated_agent_signer_required") return "This wallet is not the delegated signer for the active policy.";
  if (message === "review_changed_before_signing") return "The exact action changed before signing. Review it again.";
  if (message === "demo_wallet_funding_timeout") return "Demo wallet funding timed out. The public Devnet faucet is busy; retry this action in a moment.";
  if (message === "demo_wallet_funding_failed") return "Demo wallet needs test SOL before it can pay Devnet transaction fees. Retry this action to request test SOL again.";
  if (message === "transaction_failed_onchain") return "Solana Devnet rejected this transaction. The demo wallet may still need test SOL; retry after funding.";
  if (message === "transaction_confirmation_timeout") return "Devnet confirmation took too long. No verified receipt was recorded. Retry the final action.";
  return message;
}

function walletLabel(provider: "phantom" | "email" | "demo") {
  return provider === "email" ? "Email wallet" : provider === "demo" ? "Demo wallet" : "Phantom";
}

function policyState(prepared: Prepared) {
  return prepared.policyBootstrap ? "BOOTSTRAPPED" as const : prepared.policyRefresh ? "REFRESHED" as const : "EXISTING" as const;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError: string,
): Promise<T> {
  let timeoutId = 0;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(timeoutError)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function Timeline({
  phase,
  prepared,
  result,
  provider,
  error,
}: {
  phase: Phase;
  prepared: Prepared | null;
  result: SubmitResult | null;
  provider: "phantom" | "email" | "demo";
  error: string;
}) {
  const preparedDone = !!prepared;
  const verified = phase === "VERIFIED" && !!result?.verified;
  const transactionState = verified ? "VERIFIED" : phase === "SUBMITTED" ? "SUBMITTED" : phase === "SIGNING" ? "SIGNING" : "WAITING";
  const failed = phase === "FAILED";

  const rows = [
    { label: "Final booking digest locked", value: prepared ? short(prepared.actionHashHex, 12, 8) : "Waiting for prepare", status: preparedDone ? "PREPARED" : "WAITING" },
    { label: "Wallet authority verified", value: prepared ? walletLabel(provider) + " · " + short(prepared.wallet, 8, 6) : "Waiting", status: preparedDone ? "PREPARED" : "WAITING" },
    { label: "Policy checked", value: prepared ? short(prepared.policyPda, 8, 6) + " · " + policyState(prepared) : "Waiting", status: preparedDone ? "PREPARED" : "WAITING" },
    { label: "ActionApproval created", value: prepared ? short(prepared.approvalPda, 8, 6) : "Waiting", status: verified ? "VERIFIED" : transactionState },
    { label: "ActionAuthorization created", value: prepared ? short(prepared.authorizationPda, 8, 6) : "Waiting", status: verified ? "VERIFIED" : transactionState },
    { label: "Transaction confirmed on Solana Devnet", value: result ? short(result.transactionSignature, 10, 8) : phase === "SUBMITTED" ? "Broadcast submitted" : "Waiting", status: transactionState },
    { label: "PDA readback verified", value: verified ? "CONFIRMED · PDA VERIFIED" : failed ? error || "Verification failed" : "Waiting for verified: true", status: verified ? "VERIFIED" : failed ? "FAILED" : "WAITING" },
  ];

  return (
    <div className="travel-verification-timeline" data-test="blockchain-verification-timeline">
      {rows.map((row, index) => (
        <div className={"travel-verification-step is-" + row.status.toLowerCase()} key={row.label}>
          <i>{row.status === "VERIFIED" ? "✓" : row.status === "FAILED" ? "!" : index + 1}</i>
          <div>
            <span>{row.label}</span>
            <code>{row.value}</code>
            <small>{row.status}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TravelOnchainApproval(props: {
  actionHashHex: string;
  amount: number;
  walletAddress: string | null;
  walletProvider: "phantom" | "email" | "demo";
  label?: string;
  onConfirmed?: (result: TravelOnchainConfirmedResult) => void;
}) {
  const emailWallet = useEmbeddedEmailWallet();
  const [wallet, setWallet] = useState("");
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [phase, setPhase] = useState<Phase>("WAITING");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function prepare() {
    setBusy(true);
    setError("");
    setResult(null);
    setPhase("WAITING");
    try {
      let walletAddress = props.walletAddress;
      if (props.walletProvider === "phantom") {
        const provider = phantom();
        const connected = provider?.publicKey;
        if (!connected) throw new Error("Connect Phantom before reviewing a booking action.");
        walletAddress = connected.toString();
      } else if (props.walletProvider === "email") {
        if (!emailWallet.walletAddress || emailWallet.status !== "ready") {
          throw new Error("Verify your email wallet before reviewing this action.");
        }
        walletAddress = emailWallet.walletAddress;
      } else {
        const demoWallet = readDemoSessionWallet();
        if (!demoWallet) throw new Error("Create a temporary Devnet demo wallet first.");
        walletAddress = demoWallet.publicKey.toBase58();
      }
      if (!walletAddress) throw new Error("Wallet not connected.");

      setWallet(walletAddress);
      const response = await fetch("/api/solana/action/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: walletAddress, actionHashHex: props.actionHashHex, amount: props.amount }),
      });
      const payload = await response.json() as
        | { ok: true; prepared: Prepared }
        | { ok: false; error: string };
      if (!response.ok || !payload.ok) throw new Error("error" in payload ? payload.error : "Prepare failed.");
      setPrepared(payload.prepared);
      setPhase("PREPARED");
    } catch (cause) {
      setPrepared(null);
      setPhase("FAILED");
      setError(friendlyApprovalError(cause instanceof Error ? cause.message : "Prepare failed."));
    } finally {
      setBusy(false);
    }
  }

  async function sign() {
    if (!prepared) return;
    if (props.walletProvider === "phantom") {
      const provider = phantom();
      if (!provider) return void setError("Phantom not detected.");
      if (provider.publicKey?.toString() !== wallet) {
        setPrepared(null);
        setPhase("FAILED");
        setError("Connected wallet changed. Review the exact action again.");
        return;
      }
    } else if (props.walletProvider === "email") {
      if (emailWallet.walletAddress !== wallet || emailWallet.status !== "ready") {
        setPrepared(null);
        setPhase("FAILED");
        setError("Email wallet changed. Verify the exact action again.");
        return;
      }
    } else {
      const demoWallet = readDemoSessionWallet();
      if (!demoWallet || demoWallet.publicKey.toBase58() !== wallet) {
        setPrepared(null);
        setPhase("FAILED");
        setError("Demo wallet changed. Review the exact action again.");
        return;
      }
    }

    setBusy(true);
    setError("");
    setPhase("SIGNING");
    try {
      if (props.walletProvider === "demo") {
        const demoWallet = readDemoSessionWallet();
        if (!demoWallet) throw new Error("Demo wallet changed. Review the exact action again.");

        const funded = await withTimeout(
          ensureDemoSessionWalletFunded(demoWallet),
          12000,
          "demo_wallet_funding_timeout",
        );
        if (funded.balanceLamports < DEMO_WALLET_TARGET_LAMPORTS) {
          throw new Error("demo_wallet_funding_failed");
        }
      }

      const refreshResponse = await fetch("/api/solana/action/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet,
          ...(prepared.policyBootstrap ? {} : { policyPda: prepared.policyPda }),
          actionHashHex: prepared.actionHashHex,
          amount: prepared.amount,
        }),
      });
      const refreshPayload = await refreshResponse.json() as
        | { ok: true; prepared: Prepared }
        | { ok: false; error: string };
      if (!refreshResponse.ok || !refreshPayload.ok) {
        throw new Error("error" in refreshPayload ? refreshPayload.error : "Refresh failed.");
      }
      const fresh = refreshPayload.prepared;
      if (!semanticsMatch(prepared, fresh)) {
        setPrepared(null);
        throw new Error("review_changed_before_signing");
      }

      const transaction = Transaction.from(Buffer.from(fresh.transactionBase64, "base64"));
      const signed = props.walletProvider === "email"
        ? await emailWallet.signTransaction(transaction)
        : props.walletProvider === "demo"
          ? signWithDemoSessionWallet(transaction)
          : await phantom()!.signTransaction(transaction);
      const signedTransactionBase64 = Buffer.from(
        signed.serialize({ requireAllSignatures: true, verifySignatures: true }),
      ).toString("base64");

      const preparedForSubmit = {
        network: fresh.network,
        programId: fresh.programId,
        instructions: fresh.instructions,
        wallet: fresh.wallet,
        policyPda: fresh.policyPda,
        approvalPda: fresh.approvalPda,
        authorizationPda: fresh.authorizationPda,
        actionHashHex: fresh.actionHashHex,
        amount: fresh.amount,
        nonce: fresh.nonce,
        approvalExpiresAt: fresh.approvalExpiresAt,
        policyRefresh: fresh.policyRefresh ?? null,
        policyBootstrap: fresh.policyBootstrap ?? null,
        blockhash: fresh.blockhash,
        lastValidBlockHeight: fresh.lastValidBlockHeight,
      };
      setPrepared(fresh);
      setPhase("SUBMITTED");
      const response = await fetch("/api/solana/action/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prepared: preparedForSubmit, signedTransactionBase64 }),
      });
      const payload = await response.json() as
        | { ok: true; result: SubmitResult }
        | { ok: false; error: string };
      if (!response.ok || !payload.ok) throw new Error("error" in payload ? payload.error : "Submit failed.");
      if (payload.result.verified !== true) throw new Error("pda_readback_not_verified");

      setResult(payload.result);
      setPhase("VERIFIED");
      props.onConfirmed?.({
        ...payload.result,
        policyPda: fresh.policyPda,
        nonce: fresh.nonce,
        policyState: policyState(fresh),
      });
    } catch (cause) {
      setPhase("FAILED");
      setError(friendlyApprovalError(cause instanceof Error ? cause.message : "Approval failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="travel-onchain">
      <Timeline phase={phase} prepared={prepared} result={result} provider={props.walletProvider} error={error} />

      {!prepared && !result ? (
        <button type="button" className="landing-primary" data-tour="travel-final-verify-action" onClick={() => void prepare()} disabled={busy}>
          {busy ? "Checking policy…" : props.label ?? "Review exact $" + props.amount + " action"}
        </button>
      ) : null}

      {prepared && !result ? (
        <div className="travel-onchain-review">
          <span className="travel-agent-kicker">ON-CHAIN REVIEW · DEVNET</span>
          <p className="travel-muted">
            One {walletLabel(props.walletProvider)} signature will
            {prepared.policyBootstrap ? " create your wallet-scoped travel policy, then" : prepared.policyRefresh ? " refresh the expiring policy, then" : ""}
            {" "}create the exact ActionApproval and ActionAuthorization for nonce {prepared.nonce}.
          </p>
          <dl>
            <div><dt>Exact amount</dt><dd>{"$" + prepared.amount}</dd></div>
            <div><dt>Action</dt><dd>{short(prepared.actionHashHex, 12, 8)}</dd></div>
            <div><dt>Policy</dt><dd>{short(prepared.policyPda, 10, 6)}</dd></div>
          </dl>
          <button type="button" className="landing-primary" data-tour="travel-final-verify-action" onClick={() => void sign()} disabled={busy}>
            {busy ? phase === "SUBMITTED" ? "Verifying PDA readback…" : "Signing exact action…" : props.walletProvider === "phantom" ? "Approve exact action in Phantom" : "Approve exact action"}
          </button>
        </div>
      ) : null}

      {result ? (
        <div className="travel-onchain-result">
          <strong>CONFIRMED · PDA VERIFIED</strong>
          <p className="travel-muted">Approval and authorization were read back from Solana before this state was shown.</p>
          <dl>
            <div><dt>Transaction</dt><dd>{short(result.transactionSignature, 12, 8)}</dd></div>
            <div><dt>Slot</dt><dd>{result.slot ?? "confirmed"}</dd></div>
            <div><dt>Approval PDA</dt><dd>{short(result.approvalPda, 10, 6)}</dd></div>
            <div><dt>Authorization PDA</dt><dd>{short(result.authorizationPda, 10, 6)}</dd></div>
          </dl>
          {result.explorerUrl ? <a href={result.explorerUrl} target="_blank" rel="noreferrer">View Devnet transaction ↗</a> : null}
        </div>
      ) : null}
      {error ? <div className="travel-error">{error}</div> : null}
    </div>
  );
}

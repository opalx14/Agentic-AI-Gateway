"use client";

import Link from "next/link";

import { shortWalletAddress, type WalletAuthorityState } from "@/components/PhantomWalletControl";

import type { DemoEvidenceItem, DemoScenarioState, OperatorWorkspaceData } from "./demo-model";
import { money } from "./operator-workspace-utils";

export function ReviewActionSheet({
  state,
  busy,
  error,
  walletAuthority,
  onClose,
  onConfirm,
}: {
  state: DemoScenarioState;
  busy: boolean;
  error: string | null;
  walletAuthority: WalletAuthorityState;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <div className="ned-sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="ned-review-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="ned-sheet-handle" />

        <header>
          <div>
            <p className="ned-kicker">REVIEW</p>
            <h2 id="review-title">Approve this exact action?</h2>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close">
            ×
          </button>
        </header>

        <div className="ned-review-amount">
          <span>Exact authority impact</span>
          <strong>{money(state.amount, state.currency)}</strong>
        </div>

        <div className="ned-review-list">
          <div>
            <span>Action</span>
            <strong>{state.actionTitle}</strong>
          </div>
          <div>
            <span>Scenario</span>
            <strong>{state.scenario}</strong>
          </div>
          <div>
            <span>Binding</span>
            <strong>Action + amount + quote + nonce</strong>
          </div>
          <div>
            <span>Human authority</span>
            <strong>
              {walletAuthority.status === "verified" && walletAuthority.address
                ? `${shortWalletAddress(walletAuthority.address)} · signer verified`
                : walletAuthority.address
                  ? `${shortWalletAddress(walletAuthority.address)} · wallet connected`
                  : "Demo reviewer identity · wallet optional"}
            </strong>
          </div>
        </div>

        <div
          className={
            walletAuthority.status === "verified"
              ? "ned-wallet-proof ned-wallet-proof-good"
              : "ned-wallet-proof"
          }
          data-test="approval-wallet-proof"
        >
          <strong>
            {walletAuthority.status === "verified"
              ? "Phantom signer evidence confirmed"
              : "Human approval evidence"}
          </strong>
          <span>
            {walletAuthority.status === "verified"
              ? `Message signature only · no transaction · ${walletAuthority.signatureBytes ?? 0} signature bytes`
              : walletAuthority.address
                ? "Wallet is connected, but the signer message has not been verified in this session."
                : "The fixture approval remains available without a wallet; connect Phantom to add signer evidence."}
          </span>
        </div>

        <div className="ned-review-warning">
          If the provider changes the amount, quote or action details, this
          consent becomes invalid and cannot be silently reused.
        </div>

        <div className="ned-review-runtime-note">
          <strong>What this button does</strong>
          <span>
            It executes the deterministic fixture provider after exact consent.
            It does not create another wallet transaction. The confirmed Devnet
            AgentPolicy and Explorer proof are shown separately in Evidence.
          </span>
        </div>

        {error ? (
          <div className="ned-review-error" data-test="approval-error" role="alert">
            <strong>Execution stopped</strong>
            <span>{error}</span>
          </div>
        ) : null}

        <button
          data-test="approval-consent"
          type="button"
          className="ned-confirm-cta"
          disabled={busy}
          aria-busy={busy}
          onClick={() => void onConfirm()}
        >
          {busy
            ? "Authorizing & executing…"
            : `Approve exact action & run demo · ${money(state.amount, state.currency)}`}
        </button>

        <button
          type="button"
          className="ned-cancel-cta"
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </button>
      </section>
    </div>
  );
}

export function SafetyDrawer({
  data,
  onClose,
}: {
  data: OperatorWorkspaceData;
  onClose: () => void;
}) {
  const cases = [
    {
      label: "Hard policy block",
      title: data.logistics.blocked.title,
      status: data.logistics.blocked.decision,
      copy: data.logistics.blocked.decisionReason,
    },
    {
      label: "Provider failure",
      title: data.logistics.providerFailed.title,
      status: data.logistics.providerFailed.receiptStatus ?? "FAILED",
      copy: data.logistics.providerFailed.decisionReason,
    },
    {
      label: "Approval invalidation",
      title: data.travel.priceChanged.title,
      status: data.travel.priceChanged.decision,
      copy: data.travel.priceChanged.decisionReason,
    },
  ];

  return (
    <div className="ned-drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside className="ned-drawer" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <p className="ned-kicker">SAFETY CASES</p>
            <h2>What happens when things go wrong?</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">×</button>
        </header>

        <p className="ned-drawer-intro">
          These are secondary failure states. They are not separate products;
          they prove the Control Plane fails closed.
        </p>

        <div className="ned-safety-list">
          {cases.map((item) => (
            <article key={item.label}>
              <div>
                <span>{item.label}</span>
                <strong>{item.status}</strong>
              </div>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </aside>
    </div>
  );
}

export function EvidenceDrawer({
  items,
  walletAuthority,
  onClose,
}: {
  items: DemoEvidenceItem[];
  walletAuthority: WalletAuthorityState;
  onClose: () => void;
}) {
  return (
    <div className="ned-drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="ned-drawer"
        aria-label="Evidence and receipts"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="ned-kicker">EVIDENCE</p>
            <h2>Receipts & authority proof</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">×</button>
        </header>

        <p className="ned-drawer-intro">
          Runtime truth only. Devnet signatures appear only after real confirmed
          transactions exist.
        </p>

        <div className="ned-evidence-list">
          <article data-test="wallet-evidence">
            <div className="ned-evidence-head">
              <span>Phantom signer</span>
              <strong>
                {walletAuthority.status === "verified"
                  ? "verified"
                  : walletAuthority.address
                    ? "connected"
                    : walletAuthority.status}
              </strong>
            </div>
            <h3>Human authority identity</h3>
            <code>
              {walletAuthority.address
                ? walletAuthority.address
                : "No connected wallet in this browser session"}
            </code>
            <p>
              {walletAuthority.status === "verified"
                ? `Message signature confirmed (${walletAuthority.signatureBytes ?? 0} bytes). This is signer evidence only; no transaction or funds were requested.`
                : "Optional wallet proof. Deterministic policy and the fixture approval path remain independent of wallet availability."}
            </p>
          </article>

          {items.map((item) => (
            <article key={item.id}>
              <div className="ned-evidence-head">
                <span>{item.source}</span>
                <strong>{item.status.replace("-", " ")}</strong>
              </div>
              <h3>{item.label}</h3>
              <code>{item.value}</code>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>

        <div className="ned-integrity-note">
          <strong>Integrity ≠ truth.</strong>
          <span>
            On-chain state proves authority transitions, not the truthfulness of
            external real-world facts.
          </span>
        </div>

        <Link href="/evidence" className="ned-evidence-route-link">
          Open the full proof lifecycle →
        </Link>
      </aside>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";

import {
  PhantomWalletControl,
  shortWalletAddress,
  type WalletAuthorityState,
} from "@/components/PhantomWalletControl";
import { DemoDevnetWalletControl } from "@/components/wallet/DemoDevnetWalletControl";
import { EmbeddedEmailWalletControl } from "@/components/wallet/EmbeddedEmailWalletControl";
import { useEmbeddedEmailWallet } from "@/components/wallet/EmbeddedEmailWalletProvider";

const EMPTY_PHANTOM: WalletAuthorityState = {
  provider: "phantom",
  status: "disconnected",
  address: null,
  signatureBytes: null,
};

const EMPTY_EMAIL: WalletAuthorityState = {
  provider: "email",
  status: "disconnected",
  address: null,
  signatureBytes: null,
};

const EMPTY_DEMO: WalletAuthorityState = {
  provider: "demo",
  status: "disconnected",
  address: null,
  signatureBytes: null,
};

function connected(state: WalletAuthorityState) {
  return (
    !!state.address &&
    (state.status === "connected" || state.status === "verified")
  );
}

export function TravelWalletControl({
  onAuthorityChange,
  compact = true,
}: {
  onAuthorityChange?: (state: WalletAuthorityState) => void;
  compact?: boolean;
}) {
  const emailWallet = useEmbeddedEmailWallet();
  const [chooserOpen, setChooserOpen] = useState(false);
  const [emailState, setEmailState] =
    useState<WalletAuthorityState>(EMPTY_EMAIL);
  const [demoState, setDemoState] =
    useState<WalletAuthorityState>(EMPTY_DEMO);
  const [phantomState, setPhantomState] =
    useState<WalletAuthorityState>(EMPTY_PHANTOM);
  const [activeProvider, setActiveProvider] =
    useState<WalletAuthorityState["provider"] | null>(null);

  const effectiveEmailState = useMemo<WalletAuthorityState>(
    () =>
      emailWallet.status === "ready" && emailWallet.walletAddress
        ? {
            provider: "email",
            status: "connected",
            address: emailWallet.walletAddress,
            signatureBytes: null,
          }
        : emailState,
    [emailState, emailWallet.status, emailWallet.walletAddress],
  );

  const active = useMemo(() => {
    const selected =
      activeProvider === "email"
        ? effectiveEmailState
        : activeProvider === "demo"
          ? demoState
          : activeProvider === "phantom"
            ? phantomState
            : null;
    if (selected && connected(selected)) return selected;
    if (connected(effectiveEmailState)) return effectiveEmailState;
    if (connected(demoState)) return demoState;
    if (connected(phantomState)) return phantomState;
    return null;
  }, [activeProvider, demoState, effectiveEmailState, phantomState]);

  const activeLabel =
    active?.provider === "email"
      ? "Email wallet"
      : active?.provider === "demo"
        ? "Demo wallet"
        : active?.provider === "phantom"
          ? "Phantom"
          : "Choose wallet";

  function acceptEmail(next: WalletAuthorityState) {
    setEmailState(next);
    if (connected(next)) setActiveProvider("email");
    else if (activeProvider === "email") setActiveProvider(null);
    onAuthorityChange?.(next);
    if (connected(next)) setChooserOpen(false);
  }

  function acceptDemo(next: WalletAuthorityState) {
    setDemoState(next);
    if (connected(next)) setActiveProvider("demo");
    else if (activeProvider === "demo") setActiveProvider(null);
    onAuthorityChange?.(next);
    if (connected(next)) setChooserOpen(false);
  }

  function acceptPhantom(next: WalletAuthorityState) {
    setPhantomState(next);
    if (connected(next)) setActiveProvider("phantom");
    else if (activeProvider === "phantom") setActiveProvider(null);
    onAuthorityChange?.(next);
    if (connected(next)) setChooserOpen(false);
  }

  return (
    <div className="travel-wallet-chooser" data-test="travel-wallet-options">
      <button
        type="button"
        className="travel-wallet-chooser-trigger"
        data-tour="travel-wallet-choice"
        onClick={() => setChooserOpen(true)}
      >
        <span>{active ? "CONNECTED" : "WALLET"}</span>
        <strong>
          {active?.address
            ? activeLabel + " · " + shortWalletAddress(active.address)
            : "Email, Phantom, or quick demo wallet"}
        </strong>
        <small>
          {active
            ? `${activeLabel} · Solana Devnet`
            : "Email creates or restores an embedded Solana wallet; no browser extension required"}
        </small>
      </button>

      {chooserOpen ? (
        <div
          className="travel-wallet-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setChooserOpen(false);
          }}
        >
          <section
            className="travel-wallet-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Choose wallet"
          >
            <header>
              <div>
                <span>FINAL VERIFICATION</span>
                <h3>Choose how you want to sign</h3>
                <p>
                  Email creates or recovers an embedded Solana wallet. Phantom
                  stays available if you prefer your external wallet.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChooserOpen(false)}
                aria-label="Close wallet chooser"
              >
                ×
              </button>
            </header>

            <div className="travel-wallet-modal-options">
              <article className="is-primary">
                <div>
                  <span>RECOMMENDED · MOBILE FRIENDLY</span>
                  <strong>Continue with email</strong>
                  <small>
                    Creates or restores your embedded Solana wallet. No browser
                    extension required. Email → OTP → Solana Devnet wallet.
                  </small>
                </div>
                {emailWallet.configured ? (
                  <EmbeddedEmailWalletControl
                    compact={compact}
                    onAuthorityChange={acceptEmail}
                  />
                ) : (
                  <div className="travel-wallet-unconfigured">
                    <button type="button" className="wallet-connect" disabled>
                      Continue with email
                    </button>
                    <small>
                      Email OTP is wired to Dynamic but this environment still
                      needs NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID.
                    </small>
                  </div>
                )}
              </article>

              <article>
                <div>
                  <span>EXTERNAL WALLET</span>
                  <strong>Connect Phantom</strong>
                  <small>
                    Use your existing Phantom wallet. Approve only the final
                    reviewed action on Solana Devnet.
                  </small>
                </div>
                <PhantomWalletControl
                  compact={compact}
                  autoConnectTrusted={false}
                  connectLabel="Connect Phantom"
                  onAuthorityChange={acceptPhantom}
                />
              </article>

              <article className="is-demo">
                <div>
                  <span>QUICK DEMO · HACKATHON ONLY</span>
                  <strong>Quick demo wallet</strong>
                  <small>
                    Temporary Solana Devnet wallet. Browser session only.
                    Demo/hackathon use only — not production custody and not a
                    real travel payment account.
                  </small>
                </div>
                <DemoDevnetWalletControl
                  compact={compact}
                  onAuthorityChange={acceptDemo}
                />
              </article>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

import {
  shortWalletAddress,
  type WalletAuthorityState,
} from "@/components/PhantomWalletControl";
import {
  clearDemoSessionWallet,
  createDemoSessionWallet,
  demoWalletBalance,
  ensureDemoSessionWalletFunded,
  readDemoSessionWallet,
} from "@/lib/solana/demo-session-wallet";

function sol(lamports: number) {
  return (lamports / 1_000_000_000).toFixed(3);
}

export function DemoDevnetWalletControl({
  onAuthorityChange,
  compact = false,
  showCompactMenu = true,
}: {
  onAuthorityChange?: (state: WalletAuthorityState) => void;
  compact?: boolean;
  showCompactMenu?: boolean;
}) {
  const [address, setAddress] = useState(() =>
    readDemoSessionWallet()?.publicKey.toBase58() ?? "",
  );
  const [balanceLamports, setBalanceLamports] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!address) return;
    const wallet = readDemoSessionWallet();
    if (!wallet || wallet.publicKey.toBase58() !== address) return;

    onAuthorityChange?.({
      provider: "demo",
      status: "connected",
      address,
      signatureBytes: null,
    });

    void demoWalletBalance(wallet)
      .then(setBalanceLamports)
      .catch(() => setBalanceLamports(null));
  }, [address, onAuthorityChange]);

  async function create() {
    setBusy(true);
    setError("");
    try {
      const wallet = createDemoSessionWallet();
      const walletAddress = wallet.publicKey.toBase58();
      setAddress(walletAddress);
      onAuthorityChange?.({
        provider: "demo",
        status: "connected",
        address: walletAddress,
        signatureBytes: null,
      });

      try {
        const funded = await ensureDemoSessionWalletFunded(wallet);
        setBalanceLamports(funded.balanceLamports);
      } catch {
        const current = await demoWalletBalance(wallet).catch(() => 0);
        setBalanceLamports(current);
        setError(
          "Demo wallet created, but the public Devnet faucet is rate-limited. Retry funding or use Phantom/email wallet.",
        );
      }
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Unable to create a Devnet demo wallet.";
      setError(message);
      onAuthorityChange?.({
        provider: "demo",
        status: "error",
        address: null,
        signatureBytes: null,
      });
    } finally {
      setBusy(false);
    }
  }

  async function retryFunding() {
    const wallet = readDemoSessionWallet();
    if (!wallet) return;
    setBusy(true);
    setError("");
    try {
      const funded = await ensureDemoSessionWalletFunded(wallet);
      setBalanceLamports(funded.balanceLamports);
    } catch {
      setError(
        "The public Solana Devnet faucet is rate-limited right now. You can retry or use another wallet option.",
      );
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    clearDemoSessionWallet();
    setAddress("");
    setBalanceLamports(null);
    setError("");
    setOpen(false);
    onAuthorityChange?.({
      provider: "demo",
      status: "disconnected",
      address: null,
      signatureBytes: null,
    });
  }

  if (!address) {
    return (
      <div
        className={
          compact
            ? "wallet-control wallet-control-compact demo-wallet-control"
            : "wallet-control demo-wallet-control"
        }
        data-test="demo-wallet-control"
      >
        <button
          type="button"
          className="wallet-connect"
          onClick={() => void create()}
          disabled={busy}
          title="Creates a temporary Solana Devnet wallet in this browser session only"
        >
          {busy ? "Creating…" : "Create demo Devnet wallet"}
        </button>
        {error ? (
          <small className="wallet-error" role="alert">
            {error}
          </small>
        ) : null}
      </div>
    );
  }

  const compactContent = (
    <>
      <span className="demo-wallet-trigger-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <rect x="4" y="6" width="16" height="12" rx="3" />
          <path d="M15.5 10.5H20v3h-4.5a1.5 1.5 0 0 1 0-3Z" />
        </svg>
      </span>
      <span className="demo-wallet-trigger-copy">
        <small>{showCompactMenu ? "Demo wallet" : "Demo wallet · connected"}</small>
        <strong>{shortWalletAddress(address)}</strong>
      </span>
      {showCompactMenu ? (
        <span className="demo-wallet-trigger-chevron" aria-hidden="true">
          ›
        </span>
      ) : null}
    </>
  );

  return (
    <div
      className={
        compact
          ? "wallet-control wallet-control-compact wallet-connected-compact demo-wallet-control"
          : "wallet-control wallet-connected demo-wallet-control"
      }
      data-test="demo-wallet-control"
    >
      {compact && !showCompactMenu ? (
        <div
          className="wallet-compact-trigger demo-wallet-trigger is-static"
          aria-label={"Demo wallet connected " + shortWalletAddress(address)}
        >
          {compactContent}
        </div>
      ) : (
        <button
          type="button"
          className={
            compact
              ? "wallet-compact-trigger demo-wallet-trigger"
              : "wallet-connect"
          }
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          {compact ? compactContent : (
            <>
              <i aria-hidden="true" />
              <span>Demo wallet</span>
              <strong>{shortWalletAddress(address)}</strong>
            </>
          )}
        </button>
      )}

      {showCompactMenu && open ? (
        <div className="wallet-compact-menu demo-wallet-menu">
          <div>
            <span>TEMPORARY · SOLANA DEVNET</span>
            <strong>{shortWalletAddress(address)}</strong>
            <small>
              {balanceLamports === null
                ? "Checking test SOL…"
                : sol(balanceLamports) + " SOL · browser session only"}
            </small>
          </div>
          <button
            type="button"
            className="wallet-verify"
            onClick={() => void retryFunding()}
            disabled={busy}
          >
            {busy ? "Funding…" : "Get test SOL"}
          </button>
          <button
            type="button"
            className="wallet-disconnect"
            onClick={reset}
          >
            Delete demo wallet
          </button>
          {error ? (
            <small className="wallet-error" role="alert">
              {error}
            </small>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

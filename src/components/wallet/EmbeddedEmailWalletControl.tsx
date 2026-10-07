"use client";

import { FormEvent, useEffect, useState } from "react";

import {
  shortWalletAddress,
  type WalletAuthorityState,
} from "@/components/PhantomWalletControl";
import { useEmbeddedEmailWallet } from "@/components/wallet/EmbeddedEmailWalletProvider";

export function EmbeddedEmailWalletControl({
  onAuthorityChange,
  compact = false,
}: {
  onAuthorityChange?: (state: WalletAuthorityState) => void;
  compact?: boolean;
}) {
  const wallet = useEmbeddedEmailWallet();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (wallet.status === "ready" && wallet.walletAddress) {
      onAuthorityChange?.({
        provider: "email",
        status: "connected",
        address: wallet.walletAddress,
        signatureBytes: null,
      });
    }
  }, [onAuthorityChange, wallet.status, wallet.walletAddress]);

  if (!wallet.configured) {
    return null;
  }

  async function requestOtp(event: FormEvent) {
    event.preventDefault();
    setLocalError("");
    try {
      await wallet.sendOtp(email);
      setOpen(true);
    } catch (cause) {
      setLocalError(
        cause instanceof Error ? cause.message : "Unable to send email code.",
      );
    }
  }

  async function verifyOtp(event: FormEvent) {
    event.preventDefault();
    setLocalError("");
    try {
      await wallet.verifyOtp(otp);
    } catch (cause) {
      setLocalError(
        cause instanceof Error ? cause.message : "Email verification failed.",
      );
    }
  }

  async function disconnect() {
    await wallet.logout();
    setOpen(false);
    setOtp("");
    onAuthorityChange?.({
      provider: "email",
      status: "disconnected",
      address: null,
      signatureBytes: null,
    });
  }

  if (wallet.status === "ready" && wallet.walletAddress) {
    return (
      <div
        className={
          compact
            ? "wallet-control wallet-control-compact wallet-connected-compact email-wallet-control"
            : "wallet-control wallet-connected email-wallet-control"
        }
        data-test="email-wallet-control"
      >
        <button
          type="button"
          className={compact ? "wallet-compact-trigger" : "wallet-connect"}
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          <i aria-hidden="true" />
          <span>Email wallet</span>
          <strong>{shortWalletAddress(wallet.walletAddress)}</strong>
        </button>

        {open ? (
          <div className="wallet-compact-menu email-wallet-menu">
            <div>
              <span>EMBEDDED · SOLANA DEVNET</span>
              <strong>{wallet.email || "Email verified"}</strong>
              <small>No wallet extension or seed phrase required.</small>
            </div>
            <button
              type="button"
              className="wallet-disconnect"
              onClick={() => void disconnect()}
            >
              Sign out
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  const otpSent = wallet.status === "otp-sent";
  const busy =
    wallet.status === "initializing" || wallet.status === "setting-up";

  return (
    <div
      className={
        compact
          ? "wallet-control wallet-control-compact email-wallet-control"
          : "wallet-control email-wallet-control"
      }
      data-test="email-wallet-control"
    >
      {!open ? (
        <button
          type="button"
          className="wallet-connect"
          onClick={() => setOpen(true)}
          disabled={busy}
        >
          {busy ? "Creating wallet…" : "Continue with email"}
        </button>
      ) : otpSent ? (
        <form className="email-wallet-form" onSubmit={verifyOtp}>
          <label>
            <span>Code sent to {wallet.email}</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              placeholder="Enter OTP"
              aria-label="Email verification code"
            />
          </label>
          <button
            type="submit"
            className="wallet-connect"
            disabled={!otp.trim() || busy}
          >
            {busy ? "Creating wallet…" : "Verify & create wallet"}
          </button>
        </form>
      ) : (
        <form className="email-wallet-form" onSubmit={requestOtp}>
          <label>
            <span>Any email works — Gmail is not required</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              aria-label="Email for embedded wallet"
            />
          </label>
          <button
            type="submit"
            className="wallet-connect"
            disabled={!email.includes("@") || busy}
          >
            Send code
          </button>
        </form>
      )}

      {localError || wallet.error ? (
        <small className="wallet-error" role="alert">
          {localError || wallet.error}
        </small>
      ) : null}
    </div>
  );
}

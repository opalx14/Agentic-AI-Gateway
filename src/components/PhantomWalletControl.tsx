"use client";

import { useEffect, useMemo, useState } from "react";

type PhantomPublicKey = {
  toString(): string;
};

type PhantomSignMessageResult = {
  signature: Uint8Array;
  publicKey?: PhantomPublicKey;
};

type PhantomProvider = {
  isPhantom?: boolean;
  isConnected?: boolean;
  publicKey?: PhantomPublicKey | null;
  connect(options?: { onlyIfTrusted?: boolean }): Promise<{
    publicKey: PhantomPublicKey;
  }>;
  disconnect?(): Promise<void>;
  signMessage(
    message: Uint8Array,
    display?: "utf8" | "hex",
  ): Promise<PhantomSignMessageResult>;
  on?(
    event: "connect" | "disconnect" | "accountChanged",
    handler: (publicKey?: PhantomPublicKey | null) => void,
  ): void;
  off?(
    event: "connect" | "disconnect" | "accountChanged",
    handler: (publicKey?: PhantomPublicKey | null) => void,
  ): void;
};

declare global {
  interface Window {
    phantom?: {
      solana?: PhantomProvider;
    };
    solana?: PhantomProvider;
  }
}

type Status =
  | "detecting"
  | "missing"
  | "disconnected"
  | "connecting"
  | "connected"
  | "signing"
  | "verified"
  | "error";

export type WalletAuthorityState = {
  provider: "phantom" | "email" | "demo";
  status: "missing" | "disconnected" | "connected" | "verified" | "error";
  address: string | null;
  signatureBytes: number | null;
};

function getProvider(): PhantomProvider | null {
  if (typeof window === "undefined") return null;

  const provider = window.phantom?.solana ?? window.solana ?? null;
  return provider?.isPhantom ? provider : null;
}

export function shortWalletAddress(address: string) {
  if (address.length <= 12) return address;
  return address.slice(0, 5) + "…" + address.slice(-5);
}

export function buildWalletVerificationMessage(input: {
  address: string;
  origin: string;
  nonce: string;
  time: string;
}) {
  return [
    "Agentic AI Gateway — local demo wallet verification",
    "",
    "Purpose: confirm the connected human authority signer.",
    "Network action: none.",
    "Transaction: none.",
    "Funds: none.",
    "",
    `Wallet: ${input.address}`,
    `Origin: ${input.origin}`,
    `Nonce: ${input.nonce}`,
    `Time: ${input.time}`,
  ].join("\n");
}

function verificationMessage(address: string) {
  return buildWalletVerificationMessage({
    address,
    origin: window.location.origin,
    nonce: crypto.randomUUID(),
    time: new Date().toISOString(),
  });
}

export function PhantomWalletControl({
  onAuthorityChange,
  compact = false,
  autoConnectTrusted = true,
  connectLabel,
}: {
  onAuthorityChange?: (state: WalletAuthorityState) => void;
  compact?: boolean;
  autoConnectTrusted?: boolean;
  connectLabel?: string;
}) {
  const [status, setStatus] = useState<Status>("detecting");
  const [menuOpen, setMenuOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [signatureBytes, setSignatureBytes] = useState<number | null>(null);
  const [error, setError] = useState("");

  function publish(next: WalletAuthorityState) {
    onAuthorityChange?.(next);
  }

  useEffect(() => {
    const provider = getProvider();

    const publishConnected = (publicKey?: PhantomPublicKey | null) => {
      const key = publicKey ?? provider?.publicKey ?? null;
      if (!key) return;
      const publicKeyText = key.toString();
      setAddress(publicKeyText);
      setStatus("connected");
      onAuthorityChange?.({
        provider: "phantom",
        status: "connected",
        address: publicKeyText,
        signatureBytes: null,
      });
    };

    const publishDisconnected = () => {
      setAddress("");
      setSignatureBytes(null);
      setStatus(provider ? "disconnected" : "missing");
      onAuthorityChange?.({
        provider: "phantom",
        status: provider ? "disconnected" : "missing",
        address: null,
        signatureBytes: null,
      });
    };

    provider?.on?.("connect", publishConnected);
    provider?.on?.("accountChanged", publishConnected);
    provider?.on?.("disconnect", publishDisconnected);

    const timer = window.setTimeout(() => {
      if (!provider) {
        publishDisconnected();
        return;
      }

      if (!autoConnectTrusted) {
        setStatus("disconnected");
        return;
      }

      if (provider.publicKey) {
        publishConnected(provider.publicKey);
        return;
      }

      provider
        .connect({ onlyIfTrusted: true })
        .then(({ publicKey }) => publishConnected(publicKey))
        .catch(() => publishDisconnected());
    }, 0);

    return () => {
      window.clearTimeout(timer);
      provider?.off?.("connect", publishConnected);
      provider?.off?.("accountChanged", publishConnected);
      provider?.off?.("disconnect", publishDisconnected);
    };
  }, [autoConnectTrusted, onAuthorityChange]);

  const label = useMemo(() => {
    if (status === "missing") return compact ? "Install Phantom" : "Phantom not found";
    if (status === "connecting") return "Connecting…";
    if (status === "signing") return "Waiting for signature…";
    if (address) return shortWalletAddress(address);
    return connectLabel ?? (compact ? "Connect wallet" : "Connect Phantom");
  }, [address, compact, connectLabel, status]);

  async function connect() {
    const provider = getProvider();

    if (!provider) {
      setStatus("missing");
      publish({
        provider: "phantom",
        status: "missing",
        address: null,
        signatureBytes: null,
      });
      return;
    }

    setStatus("connecting");
    setError("");

    try {
      const result = await provider.connect();
      const publicKey = result.publicKey.toString();
      setAddress(publicKey);
      setSignatureBytes(null);
      setStatus("connected");
      publish({
        provider: "phantom",
        status: "connected",
        address: publicKey,
        signatureBytes: null,
      });
    } catch (connectError) {
      const message =
        connectError instanceof Error
          ? connectError.message
          : "Phantom connection was not approved.";
      setError(message);
      setStatus("error");
      publish({
        provider: "phantom",
        status: "error",
        address: null,
        signatureBytes: null,
      });
    }
  }

  async function verifySigner() {
    const provider = getProvider();

    if (!provider || !address) {
      const nextStatus = provider ? "disconnected" : "missing";
      setStatus(nextStatus);
      publish({
        provider: "phantom",
        status: nextStatus,
        address: null,
        signatureBytes: null,
      });
      return;
    }

    setStatus("signing");
    setError("");

    try {
      const encoded = new TextEncoder().encode(verificationMessage(address));
      const signed = await provider.signMessage(encoded, "utf8");
      const signer = signed.publicKey?.toString() ?? provider.publicKey?.toString();

      if (signer && signer !== address) {
        throw new Error("Phantom returned a signature for a different wallet.");
      }

      if (!signed.signature?.length) {
        throw new Error("Phantom did not return a message signature.");
      }

      setSignatureBytes(signed.signature.length);
      setStatus("verified");
      publish({
        provider: "phantom",
        status: "verified",
        address,
        signatureBytes: signed.signature.length,
      });
    } catch (signError) {
      const message =
        signError instanceof Error
          ? signError.message
          : "Message signature was not approved.";
      setError(message);
      setStatus("error");
      publish({
        provider: "phantom",
        status: "error",
        address,
        signatureBytes: null,
      });
    }
  }

  async function disconnect() {
    const provider = getProvider();

    try {
      await provider?.disconnect?.();
    } finally {
      setAddress("");
      setSignatureBytes(null);
      setError("");
      setStatus(provider ? "disconnected" : "missing");
      publish({
        provider: "phantom",
        status: provider ? "disconnected" : "missing",
        address: null,
        signatureBytes: null,
      });
    }
  }

  if (status === "missing") {
    return compact ? (
      <div className="wallet-control wallet-control-compact" data-test="wallet-control">
        <a
          className="wallet-connect wallet-compact-trigger phantom-install-link"
          href="https://chromewebstore.google.com/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa"
          target="_blank"
          rel="noreferrer"
          aria-label="Install Phantom from Chrome Web Store"
        >
          <span>Install Phantom</span>
          <b aria-hidden="true">↗</b>
        </a>
      </div>
    ) : (
      <div className="wallet-control wallet-control-missing" data-test="wallet-control">
        <span>PHANTOM</span>
        <strong>Not detected</strong>
      </div>
    );
  }

  if (!address) {
    return (
      <div className={compact ? "wallet-control wallet-control-compact" : "wallet-control"} data-test="wallet-control">
        <button
          type="button"
          className="wallet-connect"
          onClick={() => void connect()}
          disabled={status === "connecting"}
        >
          {label}
        </button>
        {error ? <small role="alert">{error}</small> : null}
      </div>
    );
  }

  if (compact) {
    return (
      <div
        className="wallet-control wallet-control-compact wallet-connected-compact"
        data-test="wallet-control"
      >
        <button
          type="button"
          className="wallet-compact-trigger"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label="Open wallet menu"
        >
          <i aria-hidden="true" />
          <span>Wallet</span>
          <strong title={address}>{label}</strong>
        </button>

        {menuOpen ? (
          <div className="wallet-compact-menu">
            <div>
              <span>PHANTOM · HUMAN AUTHORITY</span>
              <strong>{label}</strong>
              <small>
                {status === "verified"
                  ? "Signer verified"
                  : "Connected · no transaction requested"}
              </small>
            </div>
            <button
              type="button"
              className="wallet-verify"
              onClick={() => void verifySigner()}
              disabled={status === "signing"}
            >
              {status === "signing"
                ? "Waiting for signature…"
                : status === "verified"
                  ? "Verify again"
                  : "Verify signer"}
            </button>
            <button
              type="button"
              className="wallet-disconnect"
              onClick={() => {
                setMenuOpen(false);
                void disconnect();
              }}
            >
              Disconnect
            </button>
            {error ? <small className="wallet-error" role="alert">{error}</small> : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="wallet-control wallet-connected" data-test="wallet-control">
      <div className="wallet-address">
        <span>PHANTOM</span>
        <strong title={address}>{label}</strong>
        <small>
          {status === "verified"
            ? `Signer confirmed · ${signatureBytes ?? 0} signature bytes`
            : "Connected · no transaction requested"}
        </small>
      </div>

      <div className="wallet-actions">
        <button
          type="button"
          className="wallet-verify"
          onClick={() => void verifySigner()}
          disabled={status === "signing"}
        >
          {status === "signing"
            ? "Sign in Phantom…"
            : status === "verified"
              ? "Verify again"
              : "Verify signer"}
        </button>
        <button type="button" className="wallet-disconnect" onClick={() => void disconnect()}>
          Disconnect
        </button>
      </div>

      {error ? <small className="wallet-error" role="alert">{error}</small> : null}
    </div>
  );
}

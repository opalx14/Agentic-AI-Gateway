"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  PhantomWalletControl,
  shortWalletAddress,
  type WalletAuthorityState,
} from "@/components/PhantomWalletControl";
import { DemoDevnetWalletControl } from "@/components/wallet/DemoDevnetWalletControl";
import {
  clearDemoSessionWallet,
  DEMO_WALLET_CHANGE_EVENT,
  readDemoSessionWallet,
} from "@/lib/solana/demo-session-wallet";

const EMPTY_PHANTOM: WalletAuthorityState = {
  provider: "phantom",
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

function sameState(a: WalletAuthorityState, b: WalletAuthorityState) {
  return (
    a.provider === b.provider &&
    a.status === b.status &&
    a.address === b.address &&
    a.signatureBytes === b.signatureBytes
  );
}

function WalletGlyph({
  kind,
}: {
  kind: "phantom" | "demo" | "wallet";
}) {
  if (kind === "phantom") {
    return (
      <span className="header-wallet-glyph is-phantom" aria-hidden="true">
        <svg viewBox="0 0 32 32">
          <path d="M8.2 22.4c1.5-7.9 4.5-13.1 10.2-13.1 4.2 0 7.1 2.9 7.1 6.6 0 5.5-4.7 10-10.8 10-2.8 0-5-.8-6.5-2.2Z" />
          <path d="M13 17.2c.9 0 1.5-.7 1.5-1.5 0-.9-.6-1.5-1.5-1.5s-1.5.6-1.5 1.5c0 .8.6 1.5 1.5 1.5Zm6.3 0c.9 0 1.5-.7 1.5-1.5 0-.9-.6-1.5-1.5-1.5s-1.5.6-1.5 1.5c0 .8.6 1.5 1.5 1.5Z" />
        </svg>
      </span>
    );
  }

  if (kind === "demo") {
    return (
      <span className="header-wallet-glyph is-demo" aria-hidden="true">
        <svg viewBox="0 0 32 32">
          <rect x="5.5" y="8" width="21" height="16" rx="4.5" />
          <path d="M9.5 12.5h13M10 18l3-2.5L16 18l3-2.5 3 2.5" />
          <circle cx="23" cy="11" r="2.2" />
        </svg>
      </span>
    );
  }

  return (
    <span className="header-wallet-glyph is-wallet" aria-hidden="true">
      <svg viewBox="0 0 32 32">
        <rect x="5.5" y="8" width="21" height="16" rx="5" />
        <path d="M21 13.5h5.5v5H21a2.5 2.5 0 0 1 0-5Z" />
      </svg>
    </span>
  );
}

export function HeaderWalletChooser() {
  const [chooserOpen, setChooserOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [phantomState, setPhantomState] =
    useState<WalletAuthorityState>(EMPTY_PHANTOM);
  const [demoState, setDemoState] =
    useState<WalletAuthorityState>(EMPTY_DEMO);
  const [activeProvider, setActiveProvider] =
    useState<"phantom" | "demo" | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const syncDemoSession = useCallback(() => {
    const wallet = readDemoSessionWallet();
    if (!wallet) {
      setDemoState(EMPTY_DEMO);
      setActiveProvider((current) => (current === "demo" ? null : current));
      return;
    }

    const next: WalletAuthorityState = {
      provider: "demo",
      status: "connected",
      address: wallet.publicKey.toBase58(),
      signatureBytes: null,
    };
    setDemoState((current) => (sameState(current, next) ? current : next));
    setActiveProvider((current) => current ?? "demo");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(syncDemoSession, 0);
    window.addEventListener(DEMO_WALLET_CHANGE_EVENT, syncDemoSession);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(DEMO_WALLET_CHANGE_EVENT, syncDemoSession);
    };
  }, [syncDemoSession]);

  useEffect(() => {
    const provider = window.phantom?.solana ?? window.solana ?? null;

    const syncConnectedPhantom = (
      publicKey?: { toString(): string } | null,
    ) => {
      const key = publicKey ?? provider?.publicKey ?? null;
      if (!key) return;

      const next: WalletAuthorityState = {
        provider: "phantom",
        status: "connected",
        address: key.toString(),
        signatureBytes: null,
      };
      setPhantomState((current) =>
        sameState(current, next) ? current : next,
      );
      setActiveProvider("phantom");
      setChooserOpen(false);
    };

    const syncDisconnectedPhantom = () => {
      setPhantomState(EMPTY_PHANTOM);
      const demoWallet = readDemoSessionWallet();
      setActiveProvider(demoWallet ? "demo" : null);
    };

    const timer = window.setTimeout(() => {
      if (provider?.publicKey) {
        syncConnectedPhantom(provider.publicKey);
      }
    }, 0);

    const syncPhantomAccount = (
      publicKey?: { toString(): string } | null,
    ) => {
      if (!publicKey) {
        syncDisconnectedPhantom();
        return;
      }
      syncConnectedPhantom(publicKey);
    };

    provider?.on?.("connect", syncConnectedPhantom);
    provider?.on?.("accountChanged", syncPhantomAccount);
    provider?.on?.("disconnect", syncDisconnectedPhantom);

    return () => {
      window.clearTimeout(timer);
      provider?.off?.("connect", syncConnectedPhantom);
      provider?.off?.("accountChanged", syncPhantomAccount);
      provider?.off?.("disconnect", syncDisconnectedPhantom);
    };
  }, []);

  useEffect(() => {
    if (!chooserOpen) return;

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setChooserOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [chooserOpen]);

  useEffect(() => {
    if (!accountOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [accountOpen]);

  const acceptPhantom = useCallback((next: WalletAuthorityState) => {
    setPhantomState((current) => (sameState(current, next) ? current : next));
    setActiveProvider((current) => {
      if (connected(next)) return "phantom";
      return current === "phantom" ? null : current;
    });
    if (connected(next)) setChooserOpen(false);
  }, []);

  const acceptDemo = useCallback((next: WalletAuthorityState) => {
    setDemoState((current) => (sameState(current, next) ? current : next));
    setActiveProvider((current) => {
      if (connected(next)) return "demo";
      return current === "demo" ? null : current;
    });
    if (connected(next)) setChooserOpen(false);
  }, []);

  const active = useMemo(() => {
    if (activeProvider === "demo" && connected(demoState)) return demoState;
    if (activeProvider === "phantom" && connected(phantomState)) {
      return phantomState;
    }
    if (connected(demoState)) return demoState;
    if (connected(phantomState)) return phantomState;
    return null;
  }, [activeProvider, demoState, phantomState]);

  const providerLabel =
    active?.provider === "demo"
      ? "Demo"
      : active?.provider === "phantom"
        ? "Phantom"
        : "Wallet";

  function openWalletControl() {
    if (active) {
      setAccountOpen((current) => !current);
      setChooserOpen(false);
      return;
    }
    setAccountOpen(false);
    setChooserOpen(true);
  }

  function disconnectDemo() {
    clearDemoSessionWallet();
    setDemoState(EMPTY_DEMO);
    setActiveProvider((current) => (current === "demo" ? null : current));
    setAccountOpen(false);
  }

  async function disconnectPhantom() {
    const provider = window.phantom?.solana ?? window.solana ?? null;
    try {
      await provider?.disconnect?.();
    } finally {
      setPhantomState(EMPTY_PHANTOM);
      setActiveProvider((current) =>
        current === "phantom" ? null : current,
      );
      setAccountOpen(false);
    }
  }

  const chooserDialog =
    chooserOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            className="header-wallet-dialog-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setChooserOpen(false);
            }}
          >
            <section
              className="header-wallet-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Choose wallet"
            >
              <header>
                <div className="header-wallet-dialog-title">
                  <div>
                    <span>WALLET</span>
                    <h3>Choose wallet</h3>
                    <p>Phantom or a temporary Devnet demo wallet.</p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close wallet chooser"
                  onClick={() => setChooserOpen(false)}
                >
                  ×
                </button>
              </header>

              <div className="header-wallet-options">
                <article>
                  <div className="header-wallet-option-head">
                    <WalletGlyph kind="phantom" />
                    <div>
                      <span>EXTERNAL WALLET</span>
                      <strong>Phantom</strong>
                      <small>
                        Use your existing Phantom wallet on Solana Devnet.
                      </small>
                    </div>
                  </div>
                  <PhantomWalletControl
                    compact
                    autoConnectTrusted
                    connectLabel="Connect Phantom"
                    onAuthorityChange={acceptPhantom}
                  />
                </article>

                <article className="is-demo">
                  <div className="header-wallet-option-head">
                    <WalletGlyph kind="demo" />
                    <div>
                      <span>QUICK DEMO</span>
                      <strong>Demo Wallet</strong>
                      <small>
                        Temporary browser-session wallet for Solana Devnet demo use.
                      </small>
                    </div>
                  </div>
                  <DemoDevnetWalletControl
                    compact
                    showCompactMenu={false}
                    onAuthorityChange={acceptDemo}
                  />
                </article>
              </div>
            </section>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className="header-wallet-chooser" ref={rootRef}>
        <button
          className="wallet-compact-trigger header-wallet-trigger"
          aria-label={
            active
              ? "Open connected wallet account"
              : "Open wallet menu"
          }
          type="button"
          aria-haspopup={active ? "menu" : "dialog"}
          aria-expanded={active ? accountOpen : chooserOpen}
          onClick={openWalletControl}
        >
          <WalletGlyph
            kind={
              active?.provider === "phantom"
                ? "phantom"
                : active?.provider === "demo"
                  ? "demo"
                  : "wallet"
            }
          />
          <span>{providerLabel}</span>
          <strong>
            {active?.address
              ? shortWalletAddress(active.address)
              : "Choose wallet"}
          </strong>
        </button>

        {active && accountOpen ? (
          <div
            className="header-wallet-account-menu"
            role="menu"
            aria-label="Connected wallet account"
          >
            <div className="header-wallet-account-summary">
              <WalletGlyph kind={active.provider === "phantom" ? "phantom" : "demo"} />
              <div>
                <span>
                  {active.provider === "phantom"
                    ? "PHANTOM · SOLANA DEVNET"
                    : "DEMO WALLET · LOCAL DEMO"}
                </span>
                <strong>{shortWalletAddress(active.address ?? "")}</strong>
                <small>
                  {active.provider === "phantom"
                    ? "Connected external wallet"
                    : "Temporary browser-session wallet"}
                </small>
              </div>
            </div>
            <button
              type="button"
              className="header-wallet-disconnect"
              role="menuitem"
              onClick={() => {
                if (active.provider === "phantom") {
                  void disconnectPhantom();
                } else {
                  disconnectDemo();
                }
              }}
            >
              {active.provider === "phantom"
                ? "Disconnect Phantom"
                : "Disconnect demo wallet"}
            </button>
          </div>
        ) : null}
      </div>
      {chooserDialog}
    </>
  );
}

"use client";

import {
  getNetworksData,
  initializeClient,
  logout as dynamicLogout,
  sendEmailOTP,
  switchActiveNetwork,
  verifyOTP,
  type DynamicClient,
} from "@dynamic-labs-sdk/client";
import {
  createWaasWalletAccounts,
  getChainsMissingWaasWalletAccounts,
} from "@dynamic-labs-sdk/client/waas";
import {
  DynamicProvider,
  useGetWalletAccounts,
  useInitStatus,
  useUser,
} from "@dynamic-labs-sdk/react-hooks";
import {
  isSolanaWalletAccount,
  signTransaction as dynamicSignTransaction,
  type SolanaWalletAccount,
} from "@dynamic-labs-sdk/solana";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Transaction, VersionedTransaction } from "@solana/web3.js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { dynamicWalletClient } from "@/lib/wallet/dynamic-client";

type EmailWalletStatus =
  | "unconfigured"
  | "initializing"
  | "signed-out"
  | "otp-sent"
  | "setting-up"
  | "ready"
  | "error";

type OtpVerification = Awaited<ReturnType<typeof sendEmailOTP>>;

export type EmailWalletContextValue = {
  status: EmailWalletStatus;
  configured: boolean;
  email: string;
  walletAddress: string | null;
  error: string | null;
  sendOtp(email: string): Promise<void>;
  verifyOtp(code: string): Promise<void>;
  logout(): Promise<void>;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
};

const EmailWalletContext = createContext<EmailWalletContextValue | null>(null);
const queryClient = new QueryClient();

let walletCreation: Promise<void> | null = null;

function ensureSolanaWallet(client: DynamicClient) {
  if (!getChainsMissingWaasWalletAccounts(client).includes("SOL")) {
    return Promise.resolve();
  }
  walletCreation ??= createWaasWalletAccounts(
    { chains: ["SOL"] },
    client,
  ).finally(() => {
    walletCreation = null;
  });
  return walletCreation;
}

async function switchWalletToDevnet(
  client: DynamicClient,
  wallet: SolanaWalletAccount,
) {
  const devnet = getNetworksData(client).find(
    (network) =>
      network.chain === "SOL" &&
      (network.cluster === "devnet" || /devnet/i.test(network.displayName)),
  );
  if (!devnet) {
    throw new Error(
      "Solana Devnet is not enabled in the Dynamic environment.",
    );
  }
  await switchActiveNetwork(
    { networkId: devnet.networkId, walletAccount: wallet },
    client,
  );
}

export function EmbeddedEmailWalletProvider({
  children,
}: {
  children: ReactNode;
}) {
  if (!dynamicWalletClient) {
    return (
      <EmailWalletContext.Provider
        value={{
          status: "unconfigured",
          configured: false,
          email: "",
          walletAddress: null,
          error: null,
          sendOtp: async () => {
            throw new Error("Email wallet is not configured.");
          },
          verifyOtp: async () => {
            throw new Error("Email wallet is not configured.");
          },
          logout: async () => {},
          signTransaction: async () => {
            throw new Error("Email wallet is not configured.");
          },
        }}
      >
        {children}
      </EmailWalletContext.Provider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <DynamicProvider client={dynamicWalletClient}>
        <ConfiguredEmailWalletProvider client={dynamicWalletClient}>
          {children}
        </ConfiguredEmailWalletProvider>
      </DynamicProvider>
    </QueryClientProvider>
  );
}

function ConfiguredEmailWalletProvider({
  client,
  children,
}: {
  client: DynamicClient;
  children: ReactNode;
}) {
  const { data: initStatus } = useInitStatus();
  const { data: user } = useUser();
  const { data: walletAccounts = [] } = useGetWalletAccounts();
  const wallet =
    walletAccounts.find(isSolanaWalletAccount) ?? null;

  const [otpVerification, setOtpVerification] =
    useState<OtpVerification | null>(null);
  const [email, setEmail] = useState("");
  const [working, setWorking] = useState<
    "otp" | "verify" | "wallet" | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initStatus !== "uninitialized") return;
    initializeClient(client).catch((cause) => {
      setError(
        cause instanceof Error
          ? cause.message
          : "Email wallet initialization failed.",
      );
    });
  }, [client, initStatus]);

  useEffect(() => {
    if (!user || initStatus !== "finished") return;
    if (!wallet) {
      ensureSolanaWallet(client).catch((cause) => {
        setError(
          cause instanceof Error
            ? cause.message
            : "Embedded Solana wallet creation failed.",
        );
      });
      return;
    }

    void switchWalletToDevnet(client, wallet).catch((cause) => {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to switch embedded wallet to Solana Devnet.",
      );
    });
  }, [client, initStatus, user, wallet]);

  const sendOtp = useCallback(
    async (target: string) => {
      const normalized = target.trim().toLowerCase();
      if (!normalized || !normalized.includes("@")) {
        throw new Error("Enter a valid email address.");
      }
      setWorking("otp");
      setError(null);
      try {
        const verification = await sendEmailOTP(
          { email: normalized },
          client,
        );
        setEmail(normalized);
        setOtpVerification(verification);
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : "Unable to send email OTP.";
        setError(message);
        throw cause;
      } finally {
        setWorking(null);
      }
    },
    [client],
  );

  const verifyOtpCode = useCallback(
    async (code: string) => {
      if (!otpVerification) {
        throw new Error("Request an email code first.");
      }
      const token = code.trim();
      if (!token) {
        throw new Error("Enter the OTP from your email.");
      }

      setWorking("verify");
      setError(null);
      try {
        await verifyOTP(
          {
            otpVerification,
            verificationToken: token,
          },
          client,
        );
        setWorking("wallet");
        await ensureSolanaWallet(client);
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : "Email OTP verification failed.";
        setError(message);
        throw cause;
      } finally {
        setWorking(null);
      }
    },
    [client, otpVerification],
  );

  const logout = useCallback(async () => {
    await dynamicLogout(client);
    setOtpVerification(null);
    setEmail("");
    setError(null);
  }, [client]);

  const signTransaction = useCallback(
    async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
      if (!wallet) {
        throw new Error("Embedded email wallet is not ready.");
      }
      await switchWalletToDevnet(client, wallet);
      const { signedTransaction } = await dynamicSignTransaction(
        { transaction: tx, walletAccount: wallet },
        client,
      );
      return signedTransaction as T;
    },
    [client, wallet],
  );

  let status: EmailWalletStatus;
  if (error) status = "error";
  else if (initStatus !== "finished") status = "initializing";
  else if (!user) status = otpVerification ? "otp-sent" : "signed-out";
  else if (!wallet || working === "wallet") status = "setting-up";
  else status = "ready";

  const value = useMemo<EmailWalletContextValue>(
    () => ({
      status,
      configured: true,
      email: email || user?.email || "",
      walletAddress: wallet?.address ?? null,
      error,
      sendOtp,
      verifyOtp: verifyOtpCode,
      logout,
      signTransaction,
    }),
    [
      email,
      error,
      logout,
      sendOtp,
      signTransaction,
      status,
      user?.email,
      verifyOtpCode,
      wallet?.address,
    ],
  );

  return (
    <EmailWalletContext.Provider value={value}>
      {children}
    </EmailWalletContext.Provider>
  );
}

export function useEmbeddedEmailWallet() {
  const value = useContext(EmailWalletContext);
  if (!value) {
    throw new Error(
      "useEmbeddedEmailWallet must be used inside EmbeddedEmailWalletProvider.",
    );
  }
  return value;
}

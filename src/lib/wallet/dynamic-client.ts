import { createDynamicClient, type DynamicClient } from "@dynamic-labs-sdk/client";
import { addWaasSolanaExtension } from "@dynamic-labs-sdk/solana/waas";

export const DYNAMIC_ENVIRONMENT_ID =
  process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID?.trim() ?? "";

export const dynamicWalletClient: DynamicClient | null =
  DYNAMIC_ENVIRONMENT_ID.length > 0
    ? createDynamicClient({
        autoInitialize: false,
        environmentId: DYNAMIC_ENVIRONMENT_ID,
        metadata: {
          name: "Agentic AI Gateway",
        },
      })
    : null;

if (dynamicWalletClient) {
  addWaasSolanaExtension(dynamicWalletClient);
}

import { snapshotAction, type Approval } from "@/control-plane";

import { TRAVEL_OPTIONS_FIXTURE } from "./fixtures";
import { createTravelAction } from "./policy";
import { FixtureTravelProvider } from "./providers";
import { runTravelRecovery } from "./scenario";

export const TRAVEL_DEMO_NOW = 1_800_000_000_000;

export async function buildTravelDemoResponse(input: {
  optionId?: "flight-a" | "flight-b";
  approved?: boolean;
  priceChange?: boolean;
} = {}) {
  const optionId = input.optionId ?? "flight-a";
  const initialOption = TRAVEL_OPTIONS_FIXTURE.find(
    (option) => option.id === optionId,
  );

  if (!initialOption) {
    throw new Error(`Unknown travel option: ${optionId}`);
  }

  const provider = new FixtureTravelProvider({
    options: TRAVEL_OPTIONS_FIXTURE,
    ...(input.priceChange && optionId === "flight-b"
      ? { verifiedAdditionalCosts: { "flight-b": 48 } }
      : {}),
  });

  const approval: Approval | undefined = input.approved
    ? {
        id: "demo-travel-approval",
        policyId: "policy-travel-1",
        approvedBy: "travel-manager-demo",
        approvedAt: TRAVEL_DEMO_NOW,
        expiresAt: TRAVEL_DEMO_NOW + 60_000,
        action: snapshotAction(createTravelAction(initialOption)),
      }
    : undefined;

  const result = await runTravelRecovery({
    provider,
    optionId,
    ...(approval ? { approval } : {}),
    now: TRAVEL_DEMO_NOW,
  });

  return {
    result,
    initialOption,
    verifiedPriceChanged:
      result.verifiedAdditionalCost !== initialOption.additionalCost,
  };
}

export type TravelDemoResponse = Awaited<
  ReturnType<typeof buildTravelDemoResponse>
>;

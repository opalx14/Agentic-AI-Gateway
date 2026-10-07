import { snapshotAction, type Approval } from "@/control-plane";

import { createLogisticsFixture } from "./fixtures";
import { runLogisticsFixture } from "./scenario";

export const LOGISTICS_DEMO_NOW = 1_800_000_000_000;

export async function buildLogisticsDemoResponse(input: {
  approved?: boolean;
} = {}) {
  const fixture = createLogisticsFixture();

  const approval: Approval | undefined = input.approved
    ? {
        id: "demo-logistics-approval",
        policyId: fixture.authorityPolicy.id,
        approvedBy: "manager-demo",
        approvedAt: LOGISTICS_DEMO_NOW,
        expiresAt: LOGISTICS_DEMO_NOW + 60_000,
        action: snapshotAction(fixture.proposedAction),
      }
    : undefined;

  const result = await runLogisticsFixture({
    fixture,
    ...(approval ? { approval } : {}),
    now: LOGISTICS_DEMO_NOW,
  });

  return {
    result,
    proposal: {
      type: fixture.proposedAction.type,
      amount: fixture.proposedAction.amount,
      currency: fixture.proposedAction.currency,
      reason: fixture.proposedAction.reason,
      quantity: fixture.proposedAction.payload.quantity,
      fromWarehouseId: fixture.proposedAction.payload.fromWarehouseId,
      toWarehouseId: fixture.proposedAction.payload.toWarehouseId,
    },
    policy: {
      maxTransferQuantity: fixture.domainPolicy.maxTransferQuantity,
      autoApprovalValue: fixture.authorityPolicy.approvalAbove,
      hardPerActionValue: fixture.authorityPolicy.maxPerAction,
    },
  };
}

export type LogisticsDemoResponse = Awaited<
  ReturnType<typeof buildLogisticsDemoResponse>
>;

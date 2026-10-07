import { describe, expect, test } from "bun:test";

import { buildOperatorWorkspaceData } from "../../src/app/demo-data";

describe("operator workspace demo states", () => {
  test("exposes the Logistics escalation and exact-approval execution states", async () => {
    const data = await buildOperatorWorkspaceData();

    expect(data.logistics.pending.decision).toBe("ESCALATE");
    expect(data.logistics.pending.executed).toBe(false);

    expect(data.logistics.approved.decision).toBe("ALLOW");
    expect(data.logistics.approved.approvalRequired).toBe(true);
    expect(data.logistics.approved.approved).toBe(true);
    expect(
      data.logistics.approved.policyChecks.find(
        (check) => check.label === "Automatic value limit",
      )?.state,
    ).toBe("escalate");
    expect(data.logistics.approved.receiptStatus).toBe("EXECUTED");
    expect(data.logistics.approved.receiptRef).toBe(
      "fixture:wms:transfer-bd-hcm-250",
    );
    expect(
      data.logistics.approved.graphNodes.find((node) => node.id === "sla")?.tone,
    ).toBe("healthy");
    expect(
      data.logistics.approved.graphNodes.find((node) => node.id === "inventory")
        ?.title,
    ).toBe("300 units");
  });

  test("exposes policy BLOCK without a provider mutation", async () => {
    const data = await buildOperatorWorkspaceData();

    expect(data.logistics.blocked.decision).toBe("BLOCK");
    expect(data.logistics.blocked.executed).toBe(false);
    expect(
      data.logistics.blocked.policyChecks.some(
        (check) => check.label === "Quantity" && check.state === "fail",
      ),
    ).toBe(true);
    expect(
      data.logistics.blocked.graphNodes.find((node) => node.id === "fulfillment")
        ?.title,
    ).toBe("Protected by policy");
  });

  test("keeps provider failure distinct from authority success", async () => {
    const data = await buildOperatorWorkspaceData();

    expect(data.logistics.providerFailed.decision).toBe("ALLOW");
    expect(data.logistics.providerFailed.executed).toBe(false);
    expect(data.logistics.providerFailed.receiptStatus).toBe("FAILED");
    expect(data.logistics.providerFailed.metrics).toContainEqual({
      label: "Mutation",
      value: "NONE",
      tone: "good",
    });
  });

  test("exposes bounded Travel autonomy, escalation and quote invalidation", async () => {
    const data = await buildOperatorWorkspaceData();

    expect(data.travel.optionA.decision).toBe("ALLOW");
    expect(data.travel.optionA.approvalRequired).toBe(false);
    expect(data.travel.optionA.receiptStatus).toBe("EXECUTED");

    expect(data.travel.optionB.decision).toBe("ESCALATE");
    expect(data.travel.optionB.approvalRequired).toBe(true);
    expect(data.travel.optionB.executed).toBe(false);

    expect(data.travel.optionBApproved.decision).toBe("ALLOW");
    expect(data.travel.optionBApproved.approvalRequired).toBe(true);
    expect(data.travel.optionBApproved.approved).toBe(true);
    expect(
      data.travel.optionBApproved.policyChecks.find(
        (check) => check.label === "Automatic threshold",
      )?.state,
    ).toBe("escalate");
    expect(data.travel.optionBApproved.receiptStatus).toBe("EXECUTED");
    expect(
      data.travel.optionBApproved.graphNodes.find(
        (node) => node.id === "conference",
      )?.tone,
    ).toBe("healthy");

    expect(data.travel.priceChanged.decision).toBe("ESCALATE");
    expect(data.travel.priceChanged.approvalRequired).toBe(true);
    expect(data.travel.priceChanged.amount).toBe(48);
    expect(data.travel.priceChanged.executed).toBe(false);
  });

  test("exposes the confirmed Devnet initialize_policy evidence", async () => {
    const data = await buildOperatorWorkspaceData();
    const devnet = data.evidence.find((item) => item.source === "devnet");

    expect(devnet?.status).toBe("confirmed");
    expect(devnet?.value).toBe("4YDM1jeqh…wdW1QiYGr");
    expect(devnet?.detail).toContain("slot 504826447");
  });
});

import { describe, expect, test } from "bun:test";

import { snapshotAction, type Approval } from "../../src/control-plane";
import {
  collectAffectedNodes,
  createLogisticsFixture,
  logisticsDependencyGraph,
  runLogisticsFixture,
} from "../../src/scenarios/logistics";

const NOW = 1_800_000_000_000;

describe("Logistics fixture scenario", () => {
  test("escalates the default high-value transfer without mutating inventory", async () => {
    const result = await runLogisticsFixture({ now: NOW });

    expect(result.decision.decision).toBe("ESCALATE");
    expect(result.receipt).toBeUndefined();
    expect(result.after.warehouses.HCM?.inventory["SKU-X"]).toBe(50);
    expect(result.after.warehouses.BINH_DUONG?.inventory["SKU-X"]).toBe(700);
    expect(
      result.trace.steps.some((step) => step.name === "approval_required"),
    ).toBe(true);
  });

  test("executes after exact manager approval and prevents projected stockout", async () => {
    const fixture = createLogisticsFixture();
    const approval: Approval = {
      id: "approval-logistics-1",
      policyId: fixture.authorityPolicy.id,
      approvedBy: "manager-1",
      approvedAt: NOW,
      expiresAt: NOW + 60_000,
      action: snapshotAction(fixture.proposedAction),
    };

    const result = await runLogisticsFixture({
      fixture,
      approval,
      now: NOW,
    });

    expect(result.decision.decision).toBe("ALLOW");
    expect(result.receipt?.status).toBe("EXECUTED");
    expect(result.after.warehouses.HCM?.inventory["SKU-X"]).toBe(300);
    expect(result.after.warehouses.BINH_DUONG?.inventory["SKU-X"]).toBe(450);
    expect(result.metrics.stockoutPrevented).toBe(true);
    expect(result.metrics.slaPreserved).toBe(true);
    expect(result.metrics.transferredUnits).toBe(250);
  });

  test("blocks a transfer that would exceed receiving capacity", async () => {
    const fixture = createLogisticsFixture();

    fixture.state.warehouses.HCM!.inventory["SKU-B"] = 700;

    const result = await runLogisticsFixture({
      fixture,
      now: NOW,
    });

    expect(result.decision.decision).toBe("BLOCK");
    expect(result.decision.violatedRules).toContain(
      "RECEIVING_CAPACITY_EXCEEDED",
    );
    expect(result.receipt).toBeUndefined();
  });

  test("blocks a cold-chain SKU without cold-chain transport", async () => {
    const fixture = createLogisticsFixture();

    fixture.proposedAction = {
      ...fixture.proposedAction,
      id: "transfer-cold-1",
      amount: 1_800,
      nonce: "logistics-cold-1",
      payload: {
        fromWarehouseId: "BINH_DUONG",
        toWarehouseId: "HCM",
        skuId: "SKU-B",
        quantity: 100,
        coldChain: false,
      },
    };

    const result = await runLogisticsFixture({
      fixture,
      now: NOW,
    });

    expect(result.decision.decision).toBe("BLOCK");
    expect(result.decision.violatedRules).toContain("COLD_CHAIN_REQUIRED");
  });

  test("blocks a transfer above the deterministic quantity limit", async () => {
    const fixture = createLogisticsFixture();

    fixture.proposedAction = {
      ...fixture.proposedAction,
      amount: 9_632,
      payload: {
        ...fixture.proposedAction.payload,
        quantity: 301,
      },
    };

    const result = await runLogisticsFixture({
      fixture,
      now: NOW,
    });

    expect(result.decision.decision).toBe("BLOCK");
    expect(result.decision.violatedRules).toContain(
      "TRANSFER_QUANTITY_EXCEEDED",
    );
  });

  test("records FAILED when an authorized provider execution throws", async () => {
    const fixture = createLogisticsFixture();
    const approval: Approval = {
      id: "approval-logistics-provider-fail",
      policyId: fixture.authorityPolicy.id,
      approvedBy: "manager-1",
      approvedAt: NOW,
      expiresAt: NOW + 60_000,
      action: snapshotAction(fixture.proposedAction),
    };

    const result = await runLogisticsFixture({
      fixture,
      approval,
      now: NOW,
      provider: {
        getState: () => structuredClone(fixture.state),
        execute: async () => {
          throw new Error("simulated WMS outage");
        },
      },
    });

    expect(result.decision.decision).toBe("ALLOW");
    expect(result.receipt?.status).toBe("FAILED");
    expect(result.after.warehouses.HCM?.inventory["SKU-X"]).toBe(50);
    expect(
      result.trace.steps.some(
        (step) =>
          step.name === "execution_completed" && step.status === "FAILED",
      ),
    ).toBe(true);
  });

  test("shows the inbound-delay blast radius through customer SLA", () => {
    const affected = collectAffectedNodes(
      logisticsDependencyGraph,
      "inbound_shipment",
    );

    expect(affected).toEqual([
      "warehouse_inventory",
      "fulfillment",
      "customer_sla",
    ]);
  });
});

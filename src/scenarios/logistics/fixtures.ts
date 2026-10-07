import type {
  LogisticsScenarioFixture,
  LogisticsState,
} from "./types";

export function createLogisticsState(): LogisticsState {
  return {
    warehouses: {
      HCM: {
        id: "HCM",
        name: "Ho Chi Minh City",
        capacityUnits: 1_000,
        inventory: {
          "SKU-X": 50,
          "SKU-B": 100,
        },
      },
      BINH_DUONG: {
        id: "BINH_DUONG",
        name: "Binh Duong",
        capacityUnits: 2_000,
        inventory: {
          "SKU-X": 700,
          "SKU-B": 200,
        },
      },
      DONG_NAI: {
        id: "DONG_NAI",
        name: "Dong Nai",
        capacityUnits: 1_500,
        inventory: {
          "SKU-X": 150,
          "SKU-B": 250,
        },
      },
    },
    skus: {
      "SKU-X": {
        id: "SKU-X",
        category: "NORMAL",
        unitValue: 32,
      },
      "SKU-B": {
        id: "SKU-B",
        category: "COLD",
        unitValue: 18,
      },
    },
    incident: {
      id: "incident-delay-1",
      type: "INBOUND_DELAY",
      inboundDelayHours: 12,
      affectedWarehouseId: "HCM",
      affectedSkuId: "SKU-X",
      customerSlaHours: 6,
      projectedDemandBeforeInbound: 200,
    },
  };
}

export function createLogisticsFixture(): LogisticsScenarioFixture {
  const state = createLogisticsState();

  return {
    state,
    authorityPolicy: {
      id: "policy-logistics-1",
      agentId: "agent-warehouse-1",
      allowedRoles: ["WarehouseRebalancer"],
      allowedActionTypes: ["inventory.transfer"],
      maxPerAction: 10_000,
      maxTotal: 30_000,
      spentAmount: 0,
      approvalAbove: 5_000,
      active: true,
      expiresAt: 1_900_000_000_000,
      riskThresholds: {
        escalateAt: 70,
        blockAt: 95,
      },
      consumedNonces: [],
    },
    domainPolicy: {
      maxTransferQuantity: 300,
      maxReceivingCapacityRatio: 0.9,
      requireColdChainFor: ["COLD"],
    },
    proposedAction: {
      id: "transfer-bd-hcm-250",
      type: "inventory.transfer",
      resource: "warehouse:HCM",
      amount: 8_000,
      currency: "USD",
      payload: {
        fromWarehouseId: "BINH_DUONG",
        toWarehouseId: "HCM",
        skuId: "SKU-X",
        quantity: 250,
        coldChain: false,
      },
      reason:
        "Rebalance inventory before delayed inbound shipment causes an HCM stockout.",
      nonce: "logistics-demo-1",
      expiresAt: 1_900_000_000_000,
    },
  };
}

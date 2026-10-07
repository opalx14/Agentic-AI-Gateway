import {
  evaluatePolicyFailClosed,
  type AgentIdentity,
  type Approval,
  type PolicyDecision,
  type ProposedAction,
} from "@/control-plane";

import type {
  InventoryTransferPayload,
  LogisticsDomainPolicy,
  LogisticsState,
} from "./types";

function block(rule: string, reason: string): PolicyDecision {
  return {
    decision: "BLOCK",
    reasons: [reason],
    violatedRules: [rule],
    requiresApproval: false,
  };
}

export function readTransferPayload(
  action: ProposedAction,
): InventoryTransferPayload | null {
  const payload = action.payload;

  if (
    typeof payload.fromWarehouseId !== "string" ||
    typeof payload.toWarehouseId !== "string" ||
    typeof payload.skuId !== "string" ||
    typeof payload.quantity !== "number" ||
    !Number.isFinite(payload.quantity) ||
    payload.quantity <= 0 ||
    typeof payload.coldChain !== "boolean"
  ) {
    return null;
  }

  return {
    fromWarehouseId: payload.fromWarehouseId,
    toWarehouseId: payload.toWarehouseId,
    skuId: payload.skuId,
    quantity: payload.quantity,
    coldChain: payload.coldChain,
  };
}

function warehouseLoad(state: LogisticsState, warehouseId: string): number {
  const warehouse = state.warehouses[warehouseId];

  if (!warehouse) {
    return 0;
  }

  return Object.values(warehouse.inventory).reduce(
    (total, quantity) => total + quantity,
    0,
  );
}

export function evaluateLogisticsConstraints(input: {
  action: ProposedAction;
  state: LogisticsState;
  domainPolicy: LogisticsDomainPolicy;
}): PolicyDecision | null {
  const { action, state, domainPolicy } = input;
  const payload = readTransferPayload(action);

  if (!payload) {
    return block(
      "INVALID_TRANSFER_PAYLOAD",
      "Inventory transfer payload is invalid.",
    );
  }

  if (payload.fromWarehouseId === payload.toWarehouseId) {
    return block(
      "SAME_WAREHOUSE_TRANSFER",
      "Source and destination warehouses must differ.",
    );
  }

  const source = state.warehouses[payload.fromWarehouseId];
  const destination = state.warehouses[payload.toWarehouseId];
  const sku = state.skus[payload.skuId];

  if (!source || !destination || !sku) {
    return block(
      "UNKNOWN_LOGISTICS_RESOURCE",
      "Transfer references an unknown warehouse or SKU.",
    );
  }

  if (payload.quantity > domainPolicy.maxTransferQuantity) {
    return block(
      "TRANSFER_QUANTITY_EXCEEDED",
      "Transfer quantity exceeds the deterministic per-action limit.",
    );
  }

  const sourceQuantity = source.inventory[payload.skuId] ?? 0;

  if (sourceQuantity < payload.quantity) {
    return block(
      "INSUFFICIENT_SOURCE_INVENTORY",
      "Source warehouse does not have enough inventory.",
    );
  }

  const receivingLoad = warehouseLoad(state, destination.id) + payload.quantity;
  const receivingRatio = receivingLoad / destination.capacityUnits;

  if (receivingRatio > domainPolicy.maxReceivingCapacityRatio) {
    return block(
      "RECEIVING_CAPACITY_EXCEEDED",
      "Transfer would exceed receiving warehouse capacity policy.",
    );
  }

  if (
    domainPolicy.requireColdChainFor.includes(sku.category) &&
    !payload.coldChain
  ) {
    return block(
      "COLD_CHAIN_REQUIRED",
      "Cold-chain transport is required for this SKU category.",
    );
  }

  const expectedAmount = sku.unitValue * payload.quantity;

  if (action.amount !== expectedAmount) {
    return block(
      "ACTION_AMOUNT_MISMATCH",
      "Action amount does not match deterministic SKU value × quantity.",
    );
  }

  return null;
}

export function authorizeLogisticsAction(input: {
  agent: AgentIdentity;
  action: ProposedAction;
  authorityPolicy: Parameters<typeof evaluatePolicyFailClosed>[0]["policy"];
  domainPolicy: LogisticsDomainPolicy;
  state: LogisticsState;
  riskScore: number;
  approval?: Approval;
  now?: number;
}): PolicyDecision {
  const domainDecision = evaluateLogisticsConstraints({
    action: input.action,
    state: input.state,
    domainPolicy: input.domainPolicy,
  });

  if (domainDecision) {
    return domainDecision;
  }

  return evaluatePolicyFailClosed({
    agent: input.agent,
    action: input.action,
    policy: input.authorityPolicy,
    riskScore: input.riskScore,
    ...(input.approval ? { approval: input.approval } : {}),
    ...(input.now === undefined ? {} : { now: input.now }),
  });
}

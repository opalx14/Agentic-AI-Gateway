import { readTransferPayload } from "./policy";
import type {
  LogisticsMetrics,
  LogisticsState,
} from "./types";
import type { ProposedAction } from "@/control-plane";

export function calculateLogisticsMetrics(input: {
  before: LogisticsState;
  after: LogisticsState;
  action: ProposedAction;
}): LogisticsMetrics {
  const payload = readTransferPayload(input.action);

  if (!payload) {
    return {
      stockoutPrevented: false,
      slaPreserved: false,
      transferredUnits: 0,
    };
  }

  const incident = input.after.incident;
  const beforeQuantity =
    input.before.warehouses[incident.affectedWarehouseId]?.inventory[
      incident.affectedSkuId
    ] ?? 0;
  const afterQuantity =
    input.after.warehouses[incident.affectedWarehouseId]?.inventory[
      incident.affectedSkuId
    ] ?? 0;

  const wasProjectedStockout =
    beforeQuantity < incident.projectedDemandBeforeInbound;
  const stockoutPrevented =
    wasProjectedStockout &&
    afterQuantity >= incident.projectedDemandBeforeInbound;

  return {
    stockoutPrevented,
    slaPreserved: stockoutPrevented,
    transferredUnits: Math.max(0, afterQuantity - beforeQuantity),
  };
}

import type { Policy, ProposedAction } from "@/control-plane";

export type SkuCategory = "NORMAL" | "COLD" | "EXPIRING";

export interface LogisticsSku {
  id: string;
  category: SkuCategory;
  unitValue: number;
}

export interface Warehouse {
  id: string;
  name: string;
  capacityUnits: number;
  inventory: Record<string, number>;
}

export interface LogisticsIncident {
  id: string;
  type: "INBOUND_DELAY" | "DEMAND_SPIKE" | "CAPACITY_PRESSURE";
  inboundDelayHours?: number;
  affectedWarehouseId: string;
  affectedSkuId: string;
  customerSlaHours: number;
  projectedDemandBeforeInbound: number;
}

export interface LogisticsState {
  warehouses: Record<string, Warehouse>;
  skus: Record<string, LogisticsSku>;
  incident: LogisticsIncident;
}

export interface InventoryTransferPayload {
  fromWarehouseId: string;
  toWarehouseId: string;
  skuId: string;
  quantity: number;
  coldChain: boolean;
}

export interface LogisticsDomainPolicy {
  maxTransferQuantity: number;
  maxReceivingCapacityRatio: number;
  requireColdChainFor: SkuCategory[];
}

export interface LogisticsScenarioFixture {
  state: LogisticsState;
  authorityPolicy: Policy;
  domainPolicy: LogisticsDomainPolicy;
  proposedAction: ProposedAction;
}

export interface LogisticsMetrics {
  stockoutPrevented: boolean;
  slaPreserved: boolean;
  transferredUnits: number;
}

export interface DependencyGraph {
  edges: Record<string, string[]>;
}

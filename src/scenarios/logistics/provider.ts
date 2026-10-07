import type {
  ActionExecutor,
  ProposedAction,
} from "@/control-plane";

import { readTransferPayload } from "./policy";
import type { LogisticsState } from "./types";

export interface WarehouseProvider {
  getState(): LogisticsState;
  execute: ActionExecutor;
}

export class FixtureWarehouseProvider implements WarehouseProvider {
  private state: LogisticsState;

  constructor(initialState: LogisticsState) {
    this.state = structuredClone(initialState);
  }

  getState(): LogisticsState {
    return structuredClone(this.state);
  }

  readonly execute: ActionExecutor = async (action: ProposedAction) => {
    if (action.type !== "inventory.transfer") {
      throw new Error("Unsupported warehouse action.");
    }

    const payload = readTransferPayload(action);

    if (!payload) {
      throw new Error("Invalid transfer payload.");
    }

    const source = this.state.warehouses[payload.fromWarehouseId];
    const destination = this.state.warehouses[payload.toWarehouseId];

    if (!source || !destination) {
      throw new Error("Unknown warehouse.");
    }

    const sourceQuantity = source.inventory[payload.skuId] ?? 0;

    if (sourceQuantity < payload.quantity) {
      throw new Error("Insufficient source inventory.");
    }

    source.inventory[payload.skuId] = sourceQuantity - payload.quantity;
    destination.inventory[payload.skuId] =
      (destination.inventory[payload.skuId] ?? 0) + payload.quantity;

    return {
      status: "EXECUTED",
      providerRef: `fixture:wms:${action.id}`,
    };
  };
}

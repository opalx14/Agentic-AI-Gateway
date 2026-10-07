import type {
  AgentIdentity,
  Policy,
  ProposedAction,
} from "@/control-plane";

import type { TravelFlightOption } from "./types";

export const TRAVEL_AGENT: AgentIdentity = {
  id: "agent-travel-recovery-1",
  roles: ["TravelRecoveryAgent"],
};

export function createTravelPolicy(): Policy {
  return {
    id: "policy-travel-1",
    agentId: TRAVEL_AGENT.id,
    allowedRoles: ["TravelRecoveryAgent"],
    allowedActionTypes: ["flight.replace"],
    maxPerAction: 100,
    maxTotal: 100,
    spentAmount: 0,
    approvalAbove: 20,
    expiresAt: 1_900_000_000_000,
    active: true,
    riskThresholds: {
      escalateAt: 80,
      blockAt: 95,
    },
    consumedNonces: [],
  };
}

export function createTravelAction(
  option: TravelFlightOption,
): ProposedAction {
  return {
    id: `travel-recovery-${option.id}`,
    type: "flight.replace",
    resource: "trip:SGN-SIN",
    amount: option.additionalCost,
    currency: option.currency,
    payload: {
      optionId: option.id,
      flightNumber: option.flightNumber,
      arrivalAt: option.arrivalAt,
      provider: option.provider,
      verifiedTotal: option.total,
    },
    reason:
      "Replace the disrupted flight with a verified option that preserves the arrival goal.",
    quoteId: option.id,
    expiresAt: option.expiresAt,
    nonce: `travel:${option.id}:1`,
  };
}

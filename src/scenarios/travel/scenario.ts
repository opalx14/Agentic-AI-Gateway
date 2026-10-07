import {
  appendTraceStep,
  createExecutionTrace,
  evaluatePolicyFailClosed,
  executeAuthorizedAction,
  type Approval,
  type ExecutionReceipt,
  type ExecutionTrace,
  type PolicyDecision,
} from "@/control-plane";

import { TRAVEL_SEARCH_FIXTURE } from "./fixtures";
import {
  createTravelAction,
  createTravelPolicy,
  TRAVEL_AGENT,
} from "./policy";
import type {
  FlightSearchInput,
  TravelPassenger,
  TravelProvider,
} from "./types";

export interface TravelRecoveryResult {
  decision: PolicyDecision;
  receipt?: ExecutionReceipt;
  trace: ExecutionTrace;
  selectedOptionId: string;
  verifiedAdditionalCost: number;
  arrivalAt: string;
}

export async function runTravelRecovery(input: {
  provider: TravelProvider;
  optionId: string;
  search?: FlightSearchInput;
  approval?: Approval;
  passengers?: TravelPassenger[];
  riskScore?: number;
  now?: number;
}): Promise<TravelRecoveryResult> {
  const now = input.now ?? 1_800_000_000_000;
  const search = input.search ?? TRAVEL_SEARCH_FIXTURE;
  const policy = createTravelPolicy();

  let trace = createExecutionTrace({
    id: `trace-travel-${input.optionId}`,
    scenarioId: "travel",
    actionId: `travel-recovery-${input.optionId}`,
  });

  trace = appendTraceStep(trace, {
    name: "observation_received",
    status: "SUCCESS",
    timestamp: now,
    detail: "FLIGHT_DELAY",
  });
  trace = appendTraceStep(trace, {
    name: "context_built",
    status: "SUCCESS",
    timestamp: now,
    detail: "Arrival deadline, emergency budget and replacement options loaded.",
  });

  const options = await input.provider.searchFlights(search);
  const selected = options.find((option) => option.id === input.optionId);

  if (!selected) {
    throw new Error(`Travel option not found: ${input.optionId}`);
  }

  const verified = await input.provider.verifyFlight({
    search,
    option: selected,
  });
  const action = createTravelAction(verified);

  trace = appendTraceStep(trace, {
    name: "action_proposed",
    status: "SUCCESS",
    timestamp: now,
    detail: `${verified.id} +${verified.additionalCost} ${verified.currency}`,
  });
  trace = appendTraceStep(trace, {
    name: "schema_validated",
    status: "SUCCESS",
    timestamp: now,
  });

  const decision = evaluatePolicyFailClosed({
    agent: TRAVEL_AGENT,
    action,
    policy,
    riskScore: input.riskScore ?? 30,
    ...(input.approval ? { approval: input.approval } : {}),
    now,
  });

  trace = appendTraceStep(trace, {
    name: "policy_evaluated",
    status: "SUCCESS",
    timestamp: now,
    detail: decision.decision,
  });

  if (decision.decision === "ESCALATE") {
    trace = appendTraceStep(trace, {
      name: "approval_required",
      status: "PENDING",
      timestamp: now,
    });
  }

  if (decision.decision !== "ALLOW") {
    return {
      decision,
      trace,
      selectedOptionId: verified.id,
      verifiedAdditionalCost: verified.additionalCost,
      arrivalAt: verified.arrivalAt,
    };
  }

  if (input.approval) {
    trace = appendTraceStep(trace, {
      name: "approval_received",
      status: "SUCCESS",
      timestamp: now,
      detail: input.approval.approvedBy,
    });
  }

  trace = appendTraceStep(trace, {
    name: "execution_started",
    status: "SUCCESS",
    timestamp: now,
  });

  const receipt = await executeAuthorizedAction({
    action,
    decision,
    policyId: policy.id,
    now,
    executor: async () => {
      const booking = await input.provider.createBooking({
        search,
        option: verified,
        ...(input.passengers ? { passengers: input.passengers } : {}),
      });

      return {
        status: "EXECUTED",
        providerRef: booking.bookingRef,
      };
    },
  });

  trace = appendTraceStep(trace, {
    name: "execution_completed",
    status: receipt.status === "EXECUTED" ? "SUCCESS" : "FAILED",
    timestamp: now,
    detail: receipt.status,
  });
  trace = appendTraceStep(trace, {
    name: "receipt_recorded",
    status: "SUCCESS",
    timestamp: now,
    detail: receipt.providerRef,
  });

  return {
    decision,
    receipt,
    trace,
    selectedOptionId: verified.id,
    verifiedAdditionalCost: verified.additionalCost,
    arrivalAt: verified.arrivalAt,
  };
}

import {
  appendTraceStep,
  createExecutionTrace,
  executeAuthorizedAction,
  type AgentIdentity,
  type Approval,
  type ExecutionReceipt,
  type ExecutionTrace,
  type PolicyDecision,
} from "@/control-plane";

import { createLogisticsFixture } from "./fixtures";
import { calculateLogisticsMetrics } from "./metrics";
import { authorizeLogisticsAction } from "./policy";
import { FixtureWarehouseProvider, type WarehouseProvider } from "./provider";
import type {
  LogisticsMetrics,
  LogisticsScenarioFixture,
  LogisticsState,
} from "./types";

const LOGISTICS_AGENT: AgentIdentity = {
  id: "agent-warehouse-1",
  roles: ["WarehouseRebalancer"],
};

export interface LogisticsScenarioResult {
  decision: PolicyDecision;
  receipt?: ExecutionReceipt;
  trace: ExecutionTrace;
  before: LogisticsState;
  after: LogisticsState;
  metrics: LogisticsMetrics;
}

export async function runLogisticsFixture(input: {
  fixture?: LogisticsScenarioFixture;
  provider?: WarehouseProvider;
  approval?: Approval;
  riskScore?: number;
  now?: number;
} = {}): Promise<LogisticsScenarioResult> {
  const fixture = input.fixture ?? createLogisticsFixture();
  const now = input.now ?? 1_800_000_000_000;
  const provider = input.provider ?? new FixtureWarehouseProvider(fixture.state);
  const before = provider.getState();

  let trace = createExecutionTrace({
    id: "trace-logistics-1",
    scenarioId: "logistics",
    actionId: fixture.proposedAction.id,
  });

  trace = appendTraceStep(trace, {
    name: "observation_received",
    status: "SUCCESS",
    timestamp: now,
    detail: fixture.state.incident.type,
  });

  trace = appendTraceStep(trace, {
    name: "context_built",
    status: "SUCCESS",
    timestamp: now,
    detail: "Warehouse inventory, inbound delay and SLA context loaded.",
  });

  trace = appendTraceStep(trace, {
    name: "action_proposed",
    status: "SUCCESS",
    timestamp: now,
    detail: fixture.proposedAction.type,
  });

  trace = appendTraceStep(trace, {
    name: "schema_validated",
    status: "SUCCESS",
    timestamp: now,
  });

  const decision = authorizeLogisticsAction({
    agent: LOGISTICS_AGENT,
    action: fixture.proposedAction,
    authorityPolicy: fixture.authorityPolicy,
    domainPolicy: fixture.domainPolicy,
    state: before,
    riskScore: input.riskScore ?? 45,
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
    const after = provider.getState();

    return {
      decision,
      trace,
      before,
      after,
      metrics: calculateLogisticsMetrics({
        before,
        after,
        action: fixture.proposedAction,
      }),
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
    action: fixture.proposedAction,
    decision,
    policyId: fixture.authorityPolicy.id,
    executor: provider.execute,
    now,
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

  const after = provider.getState();

  return {
    decision,
    receipt,
    trace,
    before,
    after,
    metrics: calculateLogisticsMetrics({
      before,
      after,
      action: fixture.proposedAction,
    }),
  };
}

import type {
  ExecutionReceipt,
  PolicyDecision,
  ProposedAction,
} from "../types";

export type ActionExecutor = (
  action: ProposedAction,
) => Promise<Omit<ExecutionReceipt, "actionId" | "policyId" | "timestamp">>;

export async function executeAuthorizedAction(input: {
  action: ProposedAction;
  decision: PolicyDecision;
  policyId: string;
  executor: ActionExecutor;
  now?: number;
}): Promise<ExecutionReceipt> {
  if (input.decision.decision !== "ALLOW") {
    return {
      actionId: input.action.id,
      policyId: input.policyId,
      status: "REJECTED",
      timestamp: input.now ?? Date.now(),
    };
  }

  try {
    const result = await input.executor(input.action);

    return {
      ...result,
      actionId: input.action.id,
      policyId: input.policyId,
      timestamp: input.now ?? Date.now(),
    };
  } catch {
    return {
      actionId: input.action.id,
      policyId: input.policyId,
      status: "FAILED",
      timestamp: input.now ?? Date.now(),
    };
  }
}

export {
  appendTraceStep,
  createExecutionTrace,
  hasTraceStep,
} from "./trace";

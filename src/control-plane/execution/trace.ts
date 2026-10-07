import type {
  ExecutionTrace,
  ExecutionTraceStep,
  ExecutionTraceStepName,
} from "../types";

export function createExecutionTrace(input: {
  id: string;
  scenarioId: string;
  actionId: string;
}): ExecutionTrace {
  return {
    id: input.id,
    scenarioId: input.scenarioId,
    actionId: input.actionId,
    steps: [],
  };
}

export function appendTraceStep(
  trace: ExecutionTrace,
  step: Omit<ExecutionTraceStep, "timestamp"> & { timestamp?: number },
): ExecutionTrace {
  return {
    ...trace,
    steps: [
      ...trace.steps,
      {
        ...step,
        timestamp: step.timestamp ?? Date.now(),
      },
    ],
  };
}

export function hasTraceStep(
  trace: ExecutionTrace,
  name: ExecutionTraceStepName,
): boolean {
  return trace.steps.some((step) => step.name === name);
}

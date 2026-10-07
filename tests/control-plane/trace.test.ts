import { describe, expect, test } from "bun:test";

import {
  appendTraceStep,
  createExecutionTrace,
  hasTraceStep,
} from "../../src/control-plane";

describe("execution trace", () => {
  test("records immutable judge-visible pipeline steps", () => {
    const trace = createExecutionTrace({
      id: "trace-1",
      scenarioId: "logistics",
      actionId: "action-1",
    });

    const updated = appendTraceStep(trace, {
      name: "policy_evaluated",
      status: "SUCCESS",
      timestamp: 123,
    });

    expect(trace.steps).toHaveLength(0);
    expect(updated.steps).toHaveLength(1);
    expect(hasTraceStep(updated, "policy_evaluated")).toBe(true);
  });
});

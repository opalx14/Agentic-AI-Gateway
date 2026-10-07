import { describe, expect, test } from "bun:test";

import {
  DeepSeekProvider,
  FallbackPlanningProvider,
  FixturePlanningProvider,
  PlanningValidationError,
  validatePlanningResult,
  type PlanningInput,
  type PlanningProvider,
  type PlanningResult,
} from "../../src/providers/ai";

const planningInput: PlanningInput = {
  scenarioId: "travel",
  goal: "Arrive before 17:00",
  context: {},
  allowedActionTypes: ["flight.replace"],
  allowedResources: ["trip:sgn-sin"],
  providerOptionIds: ["flight-a"],
};

const validResult: PlanningResult = {
  summary: "Use the lowest-cost viable recovery option.",
  actions: [
    {
      type: "flight.replace",
      resource: "trip:sgn-sin",
      amount: 15,
      currency: "USD",
      payload: { optionId: "flight-a" },
      reason: "Preserves arrival goal.",
      quoteId: "flight-a",
    },
  ],
};

describe("planning result validation", () => {
  test("accepts a bounded structured result", () => {
    expect(validatePlanningResult(planningInput, validResult)).toEqual(validResult);
  });

  test("rejects malformed model output", () => {
    expect(() =>
      validatePlanningResult(planningInput, {
        summary: "missing actions",
      }),
    ).toThrow(PlanningValidationError);
  });

  test("rejects a hallucinated action type", () => {
    expect(() =>
      validatePlanningResult(planningInput, {
        ...validResult,
        actions: [{ ...validResult.actions[0], type: "wallet.drain" }],
      }),
    ).toThrow(/Action type is not allowed/);
  });

  test("rejects an unknown resource", () => {
    expect(() =>
      validatePlanningResult(planningInput, {
        ...validResult,
        actions: [{ ...validResult.actions[0], resource: "trip:unknown" }],
      }),
    ).toThrow(/Resource is not allowed/);
  });

  test("rejects a provider option that was not observed", () => {
    expect(() =>
      validatePlanningResult(planningInput, {
        ...validResult,
        actions: [{ ...validResult.actions[0], quoteId: "flight-invented" }],
      }),
    ).toThrow(/Provider option is not present/);
  });
});

describe("DeepSeek planning provider", () => {
  test("requests JSON output and validates the returned plan", async () => {
    let requestBody: Record<string, unknown> | undefined;

    const fetchImpl = (async (
      _input: string | URL | Request,
      init?: RequestInit,
    ) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;

      return new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: "stop",
              message: { content: JSON.stringify(validResult) },
            },
          ],
        }),
        { status: 200 },
      );
    });

    const provider = new DeepSeekProvider({
      apiKey: "test-key",
      model: "deepseek-flash",
      fetchImpl,
      maxRetries: 0,
    });

    const result = await provider.plan(planningInput);

    expect(result).toEqual(validResult);
    expect(requestBody?.response_format).toEqual({ type: "json_object" });
  });

  test("rejects invalid JSON from the model", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: "stop",
              message: { content: "not-json" },
            },
          ],
        }),
        { status: 200 },
      ));

    const provider = new DeepSeekProvider({
      apiKey: "test-key",
      model: "deepseek-flash",
      fetchImpl,
      maxRetries: 0,
    });

    await expect(provider.plan(planningInput)).rejects.toThrow(
      "DeepSeek returned invalid JSON.",
    );
  });

  test("fails on timeout instead of returning an executable plan", async () => {
    const fetchImpl = ((
      _input: string | URL | Request,
      init?: RequestInit,
    ) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new Error("request aborted"));
        });
      }));

    const provider = new DeepSeekProvider({
      apiKey: "test-key",
      model: "deepseek-flash",
      fetchImpl,
      timeoutMs: 5,
      maxRetries: 0,
    });

    await expect(provider.plan(planningInput)).rejects.toThrow("request aborted");
  });

  test("uses a deterministic fallback when the primary provider fails", async () => {
    const failingProvider: PlanningProvider = {
      async plan() {
        throw new Error("primary unavailable");
      },
    };

    const provider = new FallbackPlanningProvider(
      failingProvider,
      new FixturePlanningProvider(validResult),
    );

    await expect(provider.plan(planningInput)).resolves.toEqual(validResult);
  });
});

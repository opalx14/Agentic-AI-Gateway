import { z } from "zod";

import type {
  PlanningInput,
  PlanningResult,
} from "./types";

export const planningActionCandidateSchema = z.object({
  type: z.string().min(1),
  resource: z.string().min(1),
  amount: z.number().finite().nonnegative().optional(),
  currency: z.string().min(1).optional(),
  payload: z.record(z.string(), z.unknown()),
  reason: z.string().min(1),
  quoteId: z.string().min(1).optional(),
  expiresAt: z.number().int().positive().optional(),
});

export const planningResultSchema = z.object({
  summary: z.string().min(1),
  actions: z.array(planningActionCandidateSchema).min(1).max(5),
});

export class PlanningValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanningValidationError";
  }
}

export function validatePlanningResult(
  input: PlanningInput,
  value: unknown,
): PlanningResult {
  const parsed = planningResultSchema.safeParse(value);

  if (!parsed.success) {
    throw new PlanningValidationError(
      `Planning result failed schema validation: ${parsed.error.message}`,
    );
  }

  for (const action of parsed.data.actions) {
    if (!input.allowedActionTypes.includes(action.type)) {
      throw new PlanningValidationError(
        `Action type is not allowed by planning context: ${action.type}`,
      );
    }

    if (
      input.allowedResources &&
      !input.allowedResources.includes(action.resource)
    ) {
      throw new PlanningValidationError(
        `Resource is not allowed by planning context: ${action.resource}`,
      );
    }

    if (
      action.quoteId &&
      (!input.providerOptionIds ||
        !input.providerOptionIds.includes(action.quoteId))
    ) {
      throw new PlanningValidationError(
        `Provider option is not present in planning context: ${action.quoteId}`,
      );
    }
  }

  return parsed.data;
}

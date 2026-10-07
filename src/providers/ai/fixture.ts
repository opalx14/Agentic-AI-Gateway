import { validatePlanningResult } from "./schema";
import type {
  PlanningInput,
  PlanningProvider,
  PlanningResult,
} from "./types";

export class FixturePlanningProvider implements PlanningProvider {
  constructor(private readonly fixture: PlanningResult) {}

  async plan(input: PlanningInput): Promise<PlanningResult> {
    return validatePlanningResult(input, structuredClone(this.fixture));
  }
}

export class FallbackPlanningProvider implements PlanningProvider {
  constructor(
    private readonly primary: PlanningProvider,
    private readonly fallback: PlanningProvider,
  ) {}

  async plan(input: PlanningInput): Promise<PlanningResult> {
    try {
      return await this.primary.plan(input);
    } catch {
      return this.fallback.plan(input);
    }
  }
}

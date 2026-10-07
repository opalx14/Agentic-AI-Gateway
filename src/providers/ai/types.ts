export interface PlanningInput {
  scenarioId: string;
  goal: string;
  context: Record<string, unknown>;
  allowedActionTypes: string[];
  allowedResources?: string[];
  providerOptionIds?: string[];
}

export interface PlanningActionCandidate {
  type: string;
  resource: string;
  amount?: number;
  currency?: string;
  payload: Record<string, unknown>;
  reason: string;
  quoteId?: string;
  expiresAt?: number;
}

export interface PlanningResult {
  summary: string;
  actions: PlanningActionCandidate[];
}

export interface PlanningProvider {
  plan(input: PlanningInput): Promise<PlanningResult>;
}

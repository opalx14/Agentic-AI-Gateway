import type { ProposedAction } from "@/control-plane";
import {
  FixturePlanningProvider,
  type PlanningInput,
  type PlanningProvider,
  type PlanningResult,
} from "@/providers/ai";

import { createLogisticsFixture } from "./fixtures";
import { runLogisticsFixture } from "./scenario";
import type { LogisticsScenarioFixture } from "./types";

export function createLogisticsPlanningInput(
  fixture: LogisticsScenarioFixture,
): PlanningInput {
  return {
    scenarioId: "logistics",
    goal:
      "Preserve customer SLA while avoiding an HCM stockout before the delayed inbound shipment arrives.",
    context: {
      incident: fixture.state.incident,
      warehouses: fixture.state.warehouses,
      skus: fixture.state.skus,
      domainPolicy: fixture.domainPolicy,
    },
    allowedActionTypes: fixture.authorityPolicy.allowedActionTypes,
    allowedResources: ["warehouse:HCM", "warehouse:BINH_DUONG", "warehouse:DONG_NAI"],
  };
}

export function createLogisticsFixturePlanningProvider(
  fixture: LogisticsScenarioFixture = createLogisticsFixture(),
): FixturePlanningProvider {
  const action = fixture.proposedAction;
  const result: PlanningResult = {
    summary:
      "Move excess SKU-X inventory from Binh Duong to HCM before the delayed inbound shipment causes a stockout.",
    actions: [
      {
        type: action.type,
        resource: action.resource,
        ...(action.amount === undefined ? {} : { amount: action.amount }),
        ...(action.currency === undefined ? {} : { currency: action.currency }),
        payload: structuredClone(action.payload),
        reason: action.reason,
        ...(action.expiresAt === undefined ? {} : { expiresAt: action.expiresAt }),
      },
    ],
  };

  return new FixturePlanningProvider(result);
}

export async function planLogisticsAction(input: {
  provider: PlanningProvider;
  fixture?: LogisticsScenarioFixture;
  now?: number;
}): Promise<ProposedAction> {
  const fixture = input.fixture ?? createLogisticsFixture();
  const now = input.now ?? Date.now();
  const planningResult = await input.provider.plan(
    createLogisticsPlanningInput(fixture),
  );
  const candidate = planningResult.actions[0];

  if (!candidate) {
    throw new Error("Planning provider returned no action candidate.");
  }

  return {
    id: `planned-${fixture.state.incident.id}-1`,
    type: candidate.type,
    resource: candidate.resource,
    ...(candidate.amount === undefined ? {} : { amount: candidate.amount }),
    ...(candidate.currency === undefined ? {} : { currency: candidate.currency }),
    payload: structuredClone(candidate.payload),
    reason: candidate.reason,
    nonce: `plan:${fixture.state.incident.id}:1`,
    expiresAt: candidate.expiresAt ?? now + 5 * 60_000,
  };
}

export async function runPlannedLogisticsFixture(input: {
  provider: PlanningProvider;
  fixture?: LogisticsScenarioFixture;
  now?: number;
}) {
  const fixture = input.fixture ?? createLogisticsFixture();
  const proposedAction = await planLogisticsAction({
    provider: input.provider,
    fixture,
    ...(input.now === undefined ? {} : { now: input.now }),
  });

  return runLogisticsFixture({
    fixture: {
      ...fixture,
      proposedAction,
    },
    ...(input.now === undefined ? {} : { now: input.now }),
  });
}

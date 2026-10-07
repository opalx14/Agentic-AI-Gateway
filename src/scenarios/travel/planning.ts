import {
  FixturePlanningProvider,
  createDeepSeekProviderFromEnv,
  type PlanningInput,
  type PlanningProvider,
  type PlanningResult,
} from "@/providers/ai";

import type { TravelCaseStudy } from "./case-study-types";

export const TRAVEL_PLAN_ACTION_TYPE = "flight.replace";
export const TRAVEL_PLAN_RESOURCE = "trip:SGN-SIN";

export function createTravelPlanningInput(caseStudy: TravelCaseStudy): PlanningInput {
  return {
    scenarioId: "creator-travel-recovery",
    goal:
      "Protect the sponsored student/creator trip outcome. Choose a provider option that arrives before the deadline, preserves the baggage requirement, and minimizes additional sponsor spend. You may propose an option but you do not authorize or execute it.",
    context: {
      disruption: caseStudy.disruption,
      outcomeContract: caseStudy.contract,
      candidates: caseStudy.candidates.map((candidate) => ({
        id: candidate.id,
        flightNumber: candidate.flightNumber,
        departure: candidate.departure,
        arrival: candidate.arrival,
        extraCostUsd: candidate.extraCostUsd,
        baggage: candidate.baggage,
        outcome: candidate.outcome,
        reasons: candidate.reasons,
      })),
      providerEvidence: {
        status: caseStudy.provider.status,
        verify: caseStudy.verify,
      },
    },
    allowedActionTypes: [TRAVEL_PLAN_ACTION_TYPE],
    allowedResources: [TRAVEL_PLAN_RESOURCE],
    providerOptionIds: caseStudy.candidates.map((candidate) => candidate.id),
  };
}

export function createTravelFixturePlanningProvider(
  caseStudy: TravelCaseStudy,
): FixturePlanningProvider {
  const selected =
    caseStudy.candidates.find((candidate) => candidate.id === caseStudy.selectedId) ??
    caseStudy.candidates.find((candidate) => candidate.outcome === "VALID_AUTO") ??
    caseStudy.candidates.find((candidate) => candidate.outcome === "VALID_HUMAN");

  if (!selected) {
    throw new Error("No travel candidate is available for fixture planning.");
  }

  const result: PlanningResult = {
    summary:
      selected.outcome === "VALID_AUTO"
        ? `Select ${selected.flightNumber}: it preserves the arrival outcome and stays inside delegated sponsor spend.`
        : `Select ${selected.flightNumber}: it preserves the arrival outcome, but deterministic policy must escalate sponsor spend.`,
    actions: [
      {
        type: TRAVEL_PLAN_ACTION_TYPE,
        resource: TRAVEL_PLAN_RESOURCE,
        amount: Math.max(0, selected.extraCostUsd),
        currency: "USD",
        quoteId: selected.id,
        payload: {
          flightNumber: selected.flightNumber,
          departure: selected.departure,
          arrival: selected.arrival,
          baggage: selected.baggage,
        },
        reason: selected.reasons.join("; "),
      },
    ],
  };

  return new FixturePlanningProvider(result);
}

export async function planTravelRecovery(input: {
  caseStudy: TravelCaseStudy;
  provider: PlanningProvider;
}) {
  return input.provider.plan(createTravelPlanningInput(input.caseStudy));
}

export async function runTravelFixturePlanner(caseStudy: TravelCaseStudy) {
  return planTravelRecovery({
    caseStudy,
    provider: createTravelFixturePlanningProvider(caseStudy),
  });
}

export async function runTravelDeepSeekPlanner(caseStudy: TravelCaseStudy) {
  return planTravelRecovery({
    caseStudy,
    provider: createDeepSeekProviderFromEnv(),
  });
}

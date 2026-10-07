import { snapshotAction, type Approval } from "@/control-plane";
import {
  createLogisticsFixture,
  runLogisticsFixture,
} from "@/scenarios/logistics";
import {
  createTravelAction,
  createTravelPolicy,
  FixtureTravelProvider,
  runTravelRecovery,
  TRAVEL_OPTIONS_FIXTURE,
} from "@/scenarios/travel";
import { buildDemoTravelCaseStudy } from "@/scenarios/travel/case-study";

import type {
  DemoEvidenceItem,
  DemoPolicyCheck,
  DemoScenarioState,
  OperatorWorkspaceData,
} from "./demo-model";
import { logisticsChecks, logisticsGraphFor, travelGraphFor } from "./demo-graphs";

const NOW = 1_800_000_000_000;

function traceOf(
  steps: Array<{
    name: string;
    status: "SUCCESS" | "PENDING" | "FAILED";
    detail?: string;
  }>,
) {
  return steps.map((step) => ({
    name: step.name,
    status: step.status,
    ...(step.detail ? { detail: step.detail } : {}),
  }));
}

function logisticsState(
  result: Awaited<ReturnType<typeof runLogisticsFixture>>,
  approved: boolean,
): DemoScenarioState {
  const fixture = createLogisticsFixture();
  const executed = result.receipt?.status === "EXECUTED";

  return {
    id: "logistics",
    scenario: "Logistics",
    mode: "fixture",
    title: "Warehouse disruption recovery",
    subtitle: "HCM inventory will stock out before the delayed inbound shipment arrives.",
    incidentLabel: "INBOUND DELAY · 12H",
    goalLabel: "Preserve fulfillment SLA",
    decision: result.decision.decision,
    decisionReason:
      result.decision.decision === "ESCALATE"
        ? "The transfer is operationally valid but exceeds the autonomous value threshold."
        : "Exact manager approval matches the current action, amount and nonce.",
    amount: fixture.proposedAction.amount ?? 0,
    currency: fixture.proposedAction.currency ?? "USD",
    approvalRequired: result.decision.decision !== "BLOCK",
    approved,
    executed,
    ...(result.receipt ? { receiptStatus: result.receipt.status } : {}),
    ...(result.receipt?.providerRef
      ? { receiptRef: result.receipt.providerRef }
      : {}),
    actionTitle: "Transfer 250 units · Binh Duong → HCM",
    actionReason: fixture.proposedAction.reason,
    policyChecks: logisticsChecks(approved),
    graphNodes: logisticsGraphFor({
      executed,
      providerFailed: result.receipt?.status === "FAILED",
    }),
    trace: traceOf(result.trace.steps),
    metrics: [
      {
        label: "HCM SKU-X",
        value: String(result.after.warehouses.HCM?.inventory["SKU-X"] ?? 0),
        tone: executed ? "good" : "watch",
      },
      {
        label: "Stockout prevented",
        value: executed ? "YES" : "PENDING",
        tone: executed ? "good" : "watch",
      },
      {
        label: "SLA preserved",
        value: executed ? "YES" : "PENDING",
        tone: executed ? "good" : "watch",
      },
      {
        label: "Transferred",
        value: executed ? "250 units" : "0 units",
        tone: "neutral",
      },
    ],
  };
}

function travelChecks(
  additionalCost: number,
  approved: boolean,
): DemoPolicyCheck[] {
  const insideAutomaticThreshold = additionalCost <= 20;

  return [
    { label: "Delegated agent", state: "pass", detail: "TravelRecoveryAgent" },
    { label: "Action type", state: "pass", detail: "flight.replace" },
    { label: "Emergency budget", state: "pass", detail: `+${additionalCost} / 100 USD` },
    { label: "Arrival goal", state: "pass", detail: "before 17:00" },
    {
      label: "Automatic threshold",
      state: insideAutomaticThreshold ? "pass" : "escalate",
      detail:
        !insideAutomaticThreshold && approved
          ? `+${additionalCost} > 20 USD auto · exact approval satisfied`
          : `+${additionalCost} / 20 USD auto`,
    },
  ];
}

function travelState(input: {
  id: DemoScenarioState["id"];
  result: Awaited<ReturnType<typeof runTravelRecovery>>;
  title: string;
  subtitle: string;
  amount: number;
  approved: boolean;
  reason: string;
  priceChange?: boolean;
}): DemoScenarioState {
  const { result } = input;
  const executed = result.receipt?.status === "EXECUTED";

  return {
    id: input.id,
    scenario: "Travel",
    mode: "fixture",
    title: input.title,
    subtitle: input.subtitle,
    incidentLabel: input.priceChange ? "QUOTE CHANGED" : "FLIGHT DELAY · 6H",
    goalLabel: "Arrive in Singapore before 17:00",
    decision: result.decision.decision,
    decisionReason: input.reason,
    amount: input.amount,
    currency: "USD",
    approvalRequired: input.amount > 20 && result.decision.decision !== "BLOCK",
    approved: input.approved,
    executed,
    ...(result.receipt ? { receiptStatus: result.receipt.status } : {}),
    ...(result.receipt?.providerRef
      ? { receiptRef: result.receipt.providerRef }
      : {}),
    actionTitle:
      input.id === "travel-a"
        ? "Replace with FIX-A · arrive 16:20"
        : "Replace with FIX-B · arrive 14:30",
    actionReason:
      "Use a verified replacement option that preserves the conference arrival goal.",
    policyChecks: travelChecks(input.amount, input.approved),
    graphNodes: travelGraphFor({
      executed,
      arrivalAt: result.arrivalAt,
      priceChanged: input.priceChange,
    }),
    trace: traceOf(result.trace.steps),
    metrics: [
      { label: "Additional cost", value: `+${input.amount} USD`, tone: "neutral" },
      { label: "Arrival", value: input.id === "travel-a" ? "16:20" : "14:30", tone: "good" },
      {
        label: "Goal preserved",
        value: "YES",
        tone: "good",
      },
      {
        label: "Provider",
        value: "FIXTURE",
        tone: "neutral",
      },
    ],
  };
}

export async function buildOperatorWorkspaceData(): Promise<OperatorWorkspaceData> {
  const logisticsFixture = createLogisticsFixture();
  const logisticsPending = await runLogisticsFixture({
    fixture: logisticsFixture,
    now: NOW,
  });

  const logisticsApproval: Approval = {
    id: "approval-logistics-demo",
    policyId: logisticsFixture.authorityPolicy.id,
    approvedBy: "manager-demo",
    approvedAt: NOW,
    expiresAt: NOW + 60_000,
    action: snapshotAction(logisticsFixture.proposedAction),
  };

  const logisticsApproved = await runLogisticsFixture({
    fixture: createLogisticsFixture(),
    approval: logisticsApproval,
    now: NOW,
  });

  const blockedFixture = createLogisticsFixture();
  blockedFixture.proposedAction = {
    ...blockedFixture.proposedAction,
    amount: 9_632,
    payload: {
      ...blockedFixture.proposedAction.payload,
      quantity: 301,
    },
  };
  const logisticsBlocked = await runLogisticsFixture({
    fixture: blockedFixture,
    now: NOW,
  });

  const providerFailFixture = createLogisticsFixture();
  const providerFailApproval: Approval = {
    id: "approval-logistics-provider-fail-demo",
    policyId: providerFailFixture.authorityPolicy.id,
    approvedBy: "manager-demo",
    approvedAt: NOW,
    expiresAt: NOW + 60_000,
    action: snapshotAction(providerFailFixture.proposedAction),
  };
  const logisticsProviderFailed = await runLogisticsFixture({
    fixture: providerFailFixture,
    approval: providerFailApproval,
    now: NOW,
    provider: {
      getState: () => structuredClone(providerFailFixture.state),
      execute: async () => {
        throw new Error("simulated WMS outage");
      },
    },
  });

  const travelProviderA = new FixtureTravelProvider({
    options: TRAVEL_OPTIONS_FIXTURE,
  });
  const optionA = await runTravelRecovery({
    provider: travelProviderA,
    optionId: "flight-a",
    now: NOW,
  });

  const travelProviderB = new FixtureTravelProvider({
    options: TRAVEL_OPTIONS_FIXTURE,
  });
  const optionB = await runTravelRecovery({
    provider: travelProviderB,
    optionId: "flight-b",
    now: NOW,
  });

  const optionBAction = createTravelAction(TRAVEL_OPTIONS_FIXTURE[1]!);
  const travelPolicy = createTravelPolicy();
  const travelApproval: Approval = {
    id: "approval-travel-demo",
    policyId: travelPolicy.id,
    approvedBy: "traveller-demo",
    approvedAt: NOW,
    expiresAt: NOW + 60_000,
    action: snapshotAction(optionBAction),
  };

  const travelProviderBApproved = new FixtureTravelProvider({
    options: TRAVEL_OPTIONS_FIXTURE,
  });
  const optionBApproved = await runTravelRecovery({
    provider: travelProviderBApproved,
    optionId: "flight-b",
    approval: travelApproval,
    now: NOW,
  });

  const changedProvider = new FixtureTravelProvider({
    options: TRAVEL_OPTIONS_FIXTURE,
    verifiedAdditionalCosts: { "flight-b": 48 },
  });
  const changed = await runTravelRecovery({
    provider: changedProvider,
    optionId: "flight-b",
    approval: travelApproval,
    now: NOW,
  });

  const evidence: DemoEvidenceItem[] = [
    {
      id: "fixture-logistics",
      source: "fixture",
      label: "WMS execution adapter",
      value: "fixture:wms",
      detail: "Deterministic warehouse mutation is isolated behind the authorized executor.",
      status: "confirmed",
    },
    {
      id: "fixture-travel",
      source: "fixture",
      label: "Travel provider fallback",
      value: "FixtureTravelProvider",
      detail: "Stage demo remains functional with no external provider credentials.",
      status: "confirmed",
    },
    {
      id: "localnet-policy",
      source: "localnet",
      label: "Anchor authority lifecycle",
      value: "8 local tests PASS",
      detail: "Initialize → authorize → settle → approve → exact authorize → replay rejection.",
      status: "confirmed",
    },
    {
      id: "devnet",
      source: "devnet",
      label: "Solana Devnet evidence",
      value: "4YDM1jeqh…wdW1QiYGr",
      detail:
        "initialize_policy finalized at slot 504826447; AgentPolicy PDA FBxjL53RR…zEkwKcrtV is verified on Devnet.",
      status: "confirmed",
    },
  ];

  return {
    logistics: {
      pending: logisticsState(logisticsPending, false),
      approved: logisticsState(logisticsApproved, true),
      blocked: {
        ...logisticsState(logisticsBlocked, false),
        id: "logistics-block",
        title: "Policy block · Quantity ceiling",
        subtitle: "The proposed transfer exceeds the deterministic 300-unit action limit.",
        incidentLabel: "POLICY VIOLATION",
        decisionReason:
          logisticsBlocked.decision.reasons[0] ??
          "The transfer quantity exceeds the deterministic limit.",
        actionTitle: "Transfer 301 units · Binh Duong → HCM",
        amount: 9_632,
        graphNodes: logisticsGraphFor({ executed: false, blocked: true }),
        policyChecks: [
          { label: "Delegated agent", state: "pass", detail: "WarehouseRebalancer" },
          { label: "Action type", state: "pass", detail: "inventory.transfer" },
          { label: "Quantity", state: "fail", detail: "301 / 300 max" },
          { label: "Receiving capacity", state: "pass", detail: "not reached" },
          { label: "Execution", state: "fail", detail: "blocked before provider call" },
        ],
        metrics: [
          { label: "HCM SKU-X", value: "50", tone: "watch" },
          { label: "Provider called", value: "NO", tone: "good" },
          { label: "Transferred", value: "0 units", tone: "neutral" },
          { label: "Rule", value: "MAX 300", tone: "watch" },
        ],
      },
      providerFailed: {
        ...logisticsState(logisticsProviderFailed, true),
        id: "logistics-provider-fail",
        title: "Provider failure · WMS unavailable",
        subtitle: "Authority passes, but the downstream executor fails closed and records a FAILED receipt.",
        incidentLabel: "PROVIDER FAILURE",
        decisionReason:
          "The exact action was authorized, but execution did not succeed. Authority is not rewritten as provider success.",
        policyChecks: [
          { label: "Delegated agent", state: "pass", detail: "WarehouseRebalancer" },
          { label: "Action type", state: "pass", detail: "inventory.transfer" },
          { label: "Exact approval", state: "pass", detail: "$8,000 action bound to nonce" },
          { label: "Policy decision", state: "pass", detail: "ALLOW" },
          { label: "Provider execution", state: "fail", detail: "simulated WMS outage" },
        ],
        metrics: [
          { label: "HCM SKU-X", value: "50", tone: "watch" },
          { label: "Receipt", value: "FAILED", tone: "watch" },
          { label: "Mutation", value: "NONE", tone: "good" },
          { label: "Retry", value: "SAFE", tone: "neutral" },
        ],
      },
    },
    travel: {
      caseStudy: buildDemoTravelCaseStudy(),
      optionA: travelState({
        id: "travel-a",
        result: optionA,
        title: "Travel recovery · Option A",
        subtitle: "Cheapest viable replacement. Arrives before the conference deadline.",
        amount: 15,
        approved: false,
        reason: "The verified additional cost stays inside the 20 USD autonomous threshold.",
      }),
      optionB: travelState({
        id: "travel-b",
        result: optionB,
        title: "Travel recovery · Option B",
        subtitle: "Earlier arrival, but the added cost exceeds autonomous authority.",
        amount: 45,
        approved: false,
        reason: "The option preserves the goal but needs exact human approval above 20 USD.",
      }),
      optionBApproved: travelState({
        id: "travel-b",
        result: optionBApproved,
        title: "Travel recovery · Option B",
        subtitle: "Exact approval matches the verified +45 USD action.",
        amount: 45,
        approved: true,
        reason: "The approved amount, quote and nonce match the current verified action.",
      }),
      priceChanged: travelState({
        id: "travel-price-change",
        result: changed,
        title: "Travel recovery · Price changed",
        subtitle: "Provider verification moved the approved +45 USD quote to +48 USD.",
        amount: 48,
        approved: false,
        priceChange: true,
        reason: "The old approval is invalid because the provider-verified amount changed.",
      }),
    },
    evidence,
  };
}

export type DemoDecision = "ALLOW" | "BLOCK" | "ESCALATE";

export interface DemoTraceStep {
  name: string;
  status: "SUCCESS" | "PENDING" | "FAILED";
  detail?: string;
}

export interface DemoPolicyCheck {
  label: string;
  state: "pass" | "fail" | "escalate";
  detail?: string;
}

export interface DemoGraphNode {
  id: string;
  eyebrow: string;
  title: string;
  meta: string;
  tone: "healthy" | "watch" | "failed" | "neutral";
  focal?: boolean;
}

export interface DemoScenarioState {
  id: "logistics" | "logistics-block" | "logistics-provider-fail" | "travel-a" | "travel-b" | "travel-price-change";
  scenario: "Logistics" | "Travel";
  mode: "fixture";
  title: string;
  subtitle: string;
  incidentLabel: string;
  goalLabel: string;
  decision: DemoDecision;
  decisionReason: string;
  amount: number;
  currency: string;
  approvalRequired: boolean;
  approved: boolean;
  executed: boolean;
  receiptStatus?: "EXECUTED" | "FAILED" | "REJECTED";
  receiptRef?: string;
  actionTitle: string;
  actionReason: string;
  policyChecks: DemoPolicyCheck[];
  graphNodes: DemoGraphNode[];
  trace: DemoTraceStep[];
  metrics: Array<{ label: string; value: string; tone?: "good" | "watch" | "neutral" }>;
}

export interface DemoEvidenceItem {
  id: string;
  source: "fixture" | "localnet" | "devnet";
  label: string;
  value: string;
  detail: string;
  status: "confirmed" | "pending" | "not-configured";
}

import type { TravelCaseStudy } from "@/scenarios/travel/case-study-types";

export interface OperatorWorkspaceData {
  logistics: {
    pending: DemoScenarioState;
    approved: DemoScenarioState;
    blocked: DemoScenarioState;
    providerFailed: DemoScenarioState;
  };
  travel: {
    optionA: DemoScenarioState;
    optionB: DemoScenarioState;
    optionBApproved: DemoScenarioState;
    priceChanged: DemoScenarioState;
    caseStudy: TravelCaseStudy;
  };
  evidence: DemoEvidenceItem[];
}

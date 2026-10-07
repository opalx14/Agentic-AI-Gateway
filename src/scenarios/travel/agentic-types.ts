export type TripNodeKind =
  | "FLIGHT"
  | "TRANSFER"
  | "STAY"
  | "ACTIVITY"
  | "COMMITMENT";

export type TripNodeStatus =
  | "PLANNED"
  | "AFFECTED"
  | "REPLANNED"
  | "DROPPED"
  | "EXECUTED";

export type ToolCallStatus = "SUCCESS" | "PENDING" | "FAILED";

export interface DestinationVisual {
  key: string;
  city: string;
  country: string;
  airportCode: string;
  imageUrl: string;
  tagline: string;
}

export type TravelServiceKind = "FLIGHT" | "STAY" | "TRANSFER" | "ACTIVITY";

export interface TravelAgentIntent {
  origin: string;
  destination: string;
  destinationAirport: string;
  startDate: string;
  days: number;
  travelers: number;
  goal: string;
  requestedServices: TravelServiceKind[];
  budgetUsd: number;
  delegatedBudgetUsd: number;
  autoApproveUsd: number;
}

export type TravelChangeTarget =
  | "FLIGHT"
  | "STAY"
  | "TRANSFER"
  | "ACTIVITY"
  | "SCHEDULE"
  | "GENERAL";

export type TravelChangeKind = "DELAY" | "REPLACE" | "PREFERENCE";

export interface TravelChangeIntent {
  target: TravelChangeTarget;
  kind: TravelChangeKind;
  delayMinutes?: number;
  newStartDate?: string;
  request: string;
  summary: string;
  source: "DEEPSEEK" | "DETERMINISTIC";
}

export interface TripNode {
  id: string;
  kind: TripNodeKind;
  title: string;
  subtitle: string;
  startAt: string;
  endAt?: string;
  location: string;
  provider: string;
  source: "DEMO" | "ATLAS" | "PROVIDER";
  status: TripNodeStatus;
  amountUsd?: number;
  providerRef?: string;
  dependsOn: string[];
  consequence?: string;
}

export interface AgentToolCall {
  id: string;
  actor: "LIAISON" | "FLIGHT" | "HOTEL" | "PLACES" | "ORCHESTRATOR" | "POLICY";
  tool: string;
  provider: string;
  operation: string;
  mode: "DEMO" | "LIVE";
  status: ToolCallStatus;
  inputSummary: string;
  outputSummary: string;
  digestHex: string;
  chainBinding: "TRACE_ROOT" | "ACTION_HASH" | "NONE";
}

export interface TripConsequence {
  affectedNodeIds: string[];
  droppedNodeIds: string[];
  commitmentPreserved: boolean;
  summary: string;
}

export interface TravelAuthority {
  decision: "ALLOW" | "ESCALATE" | "BLOCK";
  delegatedBudgetUsd: number;
  autoApproveUsd: number;
  exactAmountUsd: number;
  reason: string;
}

export interface PaymentRail {
  id: "provider" | "usdc";
  label: string;
  status: "READY" | "NOT_ENABLED";
  detail: string;
}

export interface TripComboRecommendation {
  id: string;
  rank: number;
  flightProviderRef: string;
  flightNumber: string;
  flightAmountUsd: number;
  hotelTitle: string;
  hotelTier: "value" | "central" | "premium";
  hotelAmountUsd: number;
  hotelBudgetUsd: number;
  transferAmountUsd: number;
  activitiesAmountUsd: number;
  totalUsd: number;
  remainingBudgetUsd: number;
  budgetFit: boolean;
  source: "ATLAS+DEMO" | "DEMO";
  rationale: string;
}

import type { TravelFlightOption } from "./types";

export interface AgenticTripPlan {
  id: string;
  version: number;
  prompt: string;
  summary: string;
  destination: DestinationVisual;
  intent: TravelAgentIntent;
  nodes: TripNode[];
  toolCalls: AgentToolCall[];
  traceRootHex: string;
  actionDigestHex: string;
  authority: TravelAuthority;
  consequence: TripConsequence;
  totalUsd: number;
  paymentRails: PaymentRail[];
  recommendedCombos?: TripComboRecommendation[];
  flightCandidates?: TravelFlightOption[];
  flightInventorySource?: "ATLAS" | "DEMO";
  flightRankingSource?: "DEEPSEEK" | "DETERMINISTIC";
  flightRankingReasons?: Record<string, string>;
  flightFallbackReason?: string;
  planner: "fixture" | "deepseek";
  plannerModel: string;
  createdAt: string;
}

export interface AgenticTripRequest {
  action: "plan" | "modify";
  prompt: string;
  planner?: "fixture" | "deepseek";
  mode?: "demo" | "live" | "live-preferred";
  origin?: string;
  currentPlan?: AgenticTripPlan;
}

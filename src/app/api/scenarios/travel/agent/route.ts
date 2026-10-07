import { z } from "zod";

import {
  modifyAgenticTrip,
  planAgenticTrip,
} from "@/scenarios/travel/agentic-orchestrator";

const destinationSchema = z.object({
  key: z.string(),
  city: z.string(),
  country: z.string(),
  airportCode: z.string(),
  imageUrl: z.string(),
  tagline: z.string(),
}).strict();

const intentSchema = z.object({
  origin: z.string(),
  destination: z.string(),
  destinationAirport: z.string(),
  startDate: z.string(),
  days: z.number(),
  travelers: z.number(),
  goal: z.string(),
  requestedServices: z.array(z.enum(["FLIGHT", "STAY", "TRANSFER", "ACTIVITY"])),
  budgetUsd: z.number(),
  delegatedBudgetUsd: z.number(),
  autoApproveUsd: z.number(),
}).strict();

const nodeSchema = z.object({
  id: z.string(),
  kind: z.enum(["FLIGHT","TRANSFER","STAY","ACTIVITY","COMMITMENT"]),
  title: z.string(),
  subtitle: z.string(),
  startAt: z.string(),
  endAt: z.string().optional(),
  location: z.string(),
  provider: z.string(),
  source: z.enum(["DEMO","ATLAS","PROVIDER"]),
  status: z.enum(["PLANNED","AFFECTED","REPLANNED","DROPPED","EXECUTED"]),
  amountUsd: z.number().optional(),
  providerRef: z.string().optional(),
  dependsOn: z.array(z.string()),
  consequence: z.string().optional(),
}).strict();

const toolSchema = z.object({
  id: z.string(),
  actor: z.enum(["LIAISON","FLIGHT","HOTEL","PLACES","ORCHESTRATOR","POLICY"]),
  tool: z.string(),
  provider: z.string(),
  operation: z.string(),
  mode: z.enum(["DEMO","LIVE"]),
  status: z.enum(["SUCCESS","PENDING","FAILED"]),
  inputSummary: z.string(),
  outputSummary: z.string(),
  digestHex: z.string(),
  chainBinding: z.enum(["TRACE_ROOT","ACTION_HASH","NONE"]),
}).strict();

const consequenceSchema = z.object({
  affectedNodeIds: z.array(z.string()),
  droppedNodeIds: z.array(z.string()),
  commitmentPreserved: z.boolean(),
  summary: z.string(),
}).strict();

const authoritySchema = z.object({
  decision: z.enum(["ALLOW","ESCALATE","BLOCK"]),
  delegatedBudgetUsd: z.number(),
  autoApproveUsd: z.number(),
  exactAmountUsd: z.number(),
  reason: z.string(),
}).strict();

const flightOptionSchema = z.object({
  id: z.string(),
  provider: z.enum(["fixture", "atlas"]),
  flightNumber: z.string(),
  origin: z.string(),
  destination: z.string(),
  departureAt: z.string(),
  arrivalAt: z.string(),
  total: z.number(),
  additionalCost: z.number(),
  currency: z.string(),
  expiresAt: z.number(),
  carrier: z.string().optional(),
  operatingCarrier: z.string().nullable().optional(),
  segmentCount: z.number().int().positive().optional(),
  stops: z.number().int().nonnegative().optional(),
  durationMinutes: z.number().int().nonnegative().optional(),
  cabinClass: z.number().int().nonnegative().optional(),
  bookable: z.boolean().optional(),
  ancillarySupported: z.array(z.string()).optional(),
  priceStatus: z.string().optional(),
}).strict();

const paymentRailSchema = z.object({
  id: z.enum(["provider","usdc"]),
  label: z.string(),
  status: z.enum(["READY","NOT_ENABLED"]),
  detail: z.string(),
}).strict();

const comboSchema = z.object({
  id: z.string(),
  rank: z.number().int().positive(),
  flightProviderRef: z.string(),
  flightNumber: z.string(),
  flightAmountUsd: z.number(),
  hotelTitle: z.string(),
  hotelTier: z.enum(["value", "central", "premium"]),
  hotelAmountUsd: z.number(),
  hotelBudgetUsd: z.number(),
  transferAmountUsd: z.number(),
  activitiesAmountUsd: z.number(),
  totalUsd: z.number(),
  remainingBudgetUsd: z.number(),
  budgetFit: z.boolean(),
  source: z.enum(["ATLAS+DEMO", "DEMO"]),
  rationale: z.string(),
}).strict();

const planSchema = z.object({
  id: z.string(),
  version: z.number().int().positive(),
  prompt: z.string(),
  summary: z.string(),
  destination: destinationSchema,
  intent: intentSchema,
  nodes: z.array(nodeSchema),
  toolCalls: z.array(toolSchema),
  traceRootHex: z.string(),
  actionDigestHex: z.string(),
  authority: authoritySchema,
  consequence: consequenceSchema,
  totalUsd: z.number(),
  paymentRails: z.array(paymentRailSchema),
  recommendedCombos: z.array(comboSchema).optional(),
  flightCandidates: z.array(flightOptionSchema).optional(),
  flightInventorySource: z.enum(["ATLAS", "DEMO"]).optional(),
  flightRankingSource: z.enum(["DEEPSEEK", "DETERMINISTIC"]).optional(),
  flightRankingReasons: z.record(z.string(), z.string()).optional(),
  flightFallbackReason: z.string().optional(),
  planner: z.enum(["fixture","deepseek"]),
  plannerModel: z.string(),
  createdAt: z.string(),
}).strict();

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("plan"),
    prompt: z.string().trim().min(3).max(1000),
    planner: z.enum(["fixture","deepseek"]).default("fixture"),
    mode: z.enum(["demo","live","live-preferred"]).default("demo"),
    origin: z.string().length(3).optional(),
  }).strict(),
  z.object({
    action: z.literal("modify"),
    prompt: z.string().trim().min(2).max(1000),
    currentPlan: planSchema,
  }).strict(),
]);

export async function POST(request: Request) {
  let decoded: unknown;
  try {
    decoded = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(decoded);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid whole-trip request.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result =
      parsed.data.action === "plan"
        ? await planAgenticTrip(parsed.data)
        : await modifyAgenticTrip({
            currentPlan: parsed.data.currentPlan,
            prompt: parsed.data.prompt,
          });

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Travel agent failed.";
    const status =
      /DEEPSEEK_API_KEY|Atlas|atlas|AUTH_REQUIRED|not configured/i.test(message)
        ? 503
        : 500;
    return Response.json({ error: message }, { status });
  }
}

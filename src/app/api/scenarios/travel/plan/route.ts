import { z } from "zod";

import {
  buildDemoTravelCaseStudy,
  buildLiveTravelCaseStudy,
} from "@/scenarios/travel/case-study";
import {
  runTravelDeepSeekPlanner,
  runTravelFixturePlanner,
} from "@/scenarios/travel/planning";

const requestSchema = z.object({
  mode: z.enum(["demo", "live"]).default("demo"),
  planner: z.enum(["fixture", "deepseek"]).default("fixture"),
});

export async function POST(request: Request) {
  let body: z.infer<typeof requestSchema>;

  try {
    body = requestSchema.parse(await request.json());
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "invalid_request",
      },
      { status: 400 },
    );
  }

  const caseStudy =
    body.mode === "live"
      ? await buildLiveTravelCaseStudy()
      : buildDemoTravelCaseStudy();

  if (body.mode === "live" && caseStudy.provider.status !== "READY") {
    return Response.json(
      {
        ok: false,
        error:
          caseStudy.provider.status === "AUTH_REQUIRED"
            ? "atlas_authorization_required"
            : "atlas_live_unavailable",
        caseStudy,
      },
      { status: 409 },
    );
  }

  try {
    const plan =
      body.planner === "deepseek"
        ? await runTravelDeepSeekPlanner(caseStudy)
        : await runTravelFixturePlanner(caseStudy);

    const proposed = plan.actions[0];
    const proposedCandidate = proposed?.quoteId
      ? caseStudy.candidates.find((candidate) => candidate.id === proposed.quoteId)
      : undefined;

    const policy = proposedCandidate
      ? proposedCandidate.outcome === "REJECTED"
        ? {
            decision: "BLOCK" as const,
            reason: proposedCandidate.reasons[0] ?? "Outcome contract failed.",
          }
        : proposedCandidate.outcome === "VALID_HUMAN"
          ? {
              decision: "ESCALATE" as const,
              reason:
                proposedCandidate.reasons[0] ??
                "Human sponsor authority is required.",
            }
          : {
              decision: "ALLOW" as const,
              reason:
                proposedCandidate.reasons[0] ??
                "Inside delegated sponsor authority.",
            }
      : {
          decision: "BLOCK" as const,
          reason: "Planner output did not bind to a known provider option.",
        };

    return Response.json({
      ok: true,
      planner: body.planner,
      model:
        body.planner === "deepseek"
          ? process.env.DEEPSEEK_MODEL ?? "deepseek-flash"
          : "deterministic-fixture-planner",
      caseStudy,
      plan,
      policy,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "travel_planning_failed";
    const status =
      message === "DEEPSEEK_API_KEY is not configured." ? 503 : 400;

    return Response.json(
      {
        ok: false,
        error: message,
        planner: body.planner,
        caseStudy,
      },
      { status },
    );
  }
}

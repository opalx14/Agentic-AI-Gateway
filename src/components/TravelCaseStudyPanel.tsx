"use client";

import { useState } from "react";

import type {
  TravelCaseCandidate,
  TravelCaseStudy,
} from "@/scenarios/travel/case-study-types";

type PlannerAction = {
  type: string;
  resource: string;
  amount?: number;
  currency?: string;
  quoteId?: string;
  reason: string;
};

type PlannerRun = {
  planner: "fixture" | "deepseek";
  model: string;
  summary: string;
  action: PlannerAction | null;
  policy: {
    decision: "ALLOW" | "ESCALATE" | "BLOCK";
    reason: string;
  };
};

export type TravelPlannerResult = {
  quoteId?: string;
  summary: string;
  policy: PlannerRun["policy"];
  planner: PlannerRun["planner"];
  model: string;
};

function candidateTone(candidate: TravelCaseCandidate) {
  if (candidate.outcome === "REJECTED") return "is-rejected";
  if (candidate.outcome === "VALID_HUMAN") return "is-human";
  return "is-auto";
}

function candidateLabel(candidate: TravelCaseCandidate) {
  if (candidate.outcome === "REJECTED") return "REJECTED";
  if (candidate.outcome === "VALID_HUMAN") return "HUMAN";
  return "AUTO";
}

export function TravelCaseStudyPanel({
  initial,
  onPlannerResult,
  onBrowseOptions,
}: {
  initial: TravelCaseStudy;
  onPlannerResult?: (result: TravelPlannerResult) => void;
  onBrowseOptions?: () => void;
}) {
  const [caseStudy, setCaseStudy] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [plannerBusy, setPlannerBusy] = useState<"fixture" | "deepseek" | null>(null);
  const [plannerRun, setPlannerRun] = useState<PlannerRun | null>(null);
  const [plannerError, setPlannerError] = useState<string | null>(null);
  const [traceOpen, setTraceOpen] = useState(false);

  async function switchMode(mode: "demo" | "live") {
    if (busy || caseStudy.mode === mode) return;
    setBusy(true);
    setPlannerRun(null);
    setPlannerError(null);
    setTraceOpen(false);
    try {
      const response = await fetch(
        `/api/scenarios/travel/case-study?mode=${mode}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as {
        ok?: boolean;
        caseStudy?: TravelCaseStudy;
      };
      if (!response.ok || !payload.caseStudy) {
        throw new Error("case_study_unavailable");
      }
      setCaseStudy(payload.caseStudy);
    } finally {
      setBusy(false);
    }
  }

  async function runPlanner(planner: "fixture" | "deepseek") {
    if (plannerBusy) return;
    setPlannerBusy(planner);
    setPlannerError(null);

    try {
      const response = await fetch("/api/scenarios/travel/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: caseStudy.mode,
          planner,
        }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        planner?: "fixture" | "deepseek";
        model?: string;
        plan?: {
          summary: string;
          actions: PlannerAction[];
        };
        policy?: PlannerRun["policy"];
      };

      if (!response.ok || !payload.ok || !payload.plan || !payload.policy) {
        const message =
          payload.error === "DEEPSEEK_API_KEY is not configured."
            ? "DeepSeek Live is not configured on this machine yet."
            : payload.error === "atlas_authorization_required"
              ? "Atlas Live must be authorized before a provider-backed plan can run."
              : payload.error ?? "AI planner request failed.";
        throw new Error(message);
      }

      const result: PlannerRun = {
        planner: payload.planner ?? planner,
        model: payload.model ?? planner,
        summary: payload.plan.summary,
        action: payload.plan.actions[0] ?? null,
        policy: payload.policy,
      };

      setPlannerRun(result);
      onPlannerResult?.({
        quoteId: result.action?.quoteId,
        summary: result.summary,
        policy: result.policy,
        planner: result.planner,
        model: result.model,
      });
    } catch (error) {
      setPlannerRun(null);
      setPlannerError(
        error instanceof Error ? error.message : "AI planner request failed.",
      );
    } finally {
      setPlannerBusy(null);
    }
  }

  const plannerCandidate = plannerRun?.action?.quoteId
    ? caseStudy.candidates.find(
        (candidate) => candidate.id === plannerRun.action?.quoteId,
      )
    : null;

  const rejectedCheapest = caseStudy.candidates.find(
    (candidate) => candidate.outcome === "REJECTED",
  );

  return (
    <section className="travel-resolution-focus" data-test="travel-ai-planner">
      {!plannerRun ? (
        <div className="travel-focus-idle">
          <div className="travel-focus-copy">
            <span>AI RECOVERY</span>
            <h2>Find a trip that still achieves the goal.</h2>
            <p>
              The model can propose a verified Atlas option. It cannot authorize
              spend or execute a booking.
            </p>
          </div>

          <div className="travel-focus-constraint">
            <div><span>ARRIVE</span><strong>≤ {caseStudy.contract.latestArrival}</strong></div>
            <div><span>BAGGAGE</span><strong>≥ {caseStudy.contract.minBaggageKg}kg</strong></div>
            <div><span>SPONSOR</span><strong>+{caseStudy.contract.maxExtraSpendUsd} USD max</strong></div>
          </div>

          <div className="travel-focus-actions">
            <button
              type="button"
              className="travel-focus-primary"
              data-tour="travel-run-demo-ai"
              onClick={() => void runPlanner("fixture")}
              disabled={plannerBusy !== null}
            >
              <span>{plannerBusy === "fixture" ? "AI is evaluating…" : "Run AI recovery"}</span>
              <b>→</b>
            </button>
            <button
              type="button"
              className="travel-focus-secondary"
              data-tour="travel-run-deepseek"
              onClick={() => void runPlanner("deepseek")}
              disabled={plannerBusy !== null}
            >
              {plannerBusy === "deepseek" ? "Calling DeepSeek…" : "DeepSeek Live"}
            </button>
          </div>

          {plannerError ? (
            <div className="travel-focus-error" role="alert">
              <strong>{plannerError}</strong>
              <span>Demo AI remains available with the same validated contract.</span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="travel-focus-proposal">
          <div className="travel-focus-model">
            <span>{plannerRun.planner === "deepseek" ? "DEEPSEEK" : "DEMO AI"}</span>
            <strong>{plannerCandidate?.flightNumber ?? "No option"}</strong>
            <small>{plannerRun.model}</small>
          </div>

          <div className="travel-focus-reason">
            <span>WHY THIS OPTION</span>
            <strong>
              {plannerCandidate
                ? `${plannerCandidate.arrival} arrival · +${plannerCandidate.extraCostUsd.toFixed(0)} USD`
                : "No provider-bound proposal"}
            </strong>
            <p>{plannerRun.summary}</p>
            {rejectedCheapest ? (
              <small>
                Rejected cheapest: +{rejectedCheapest.extraCostUsd.toFixed(0)} USD ·
                arrives {rejectedCheapest.arrival} after the deadline.
              </small>
            ) : null}
          </div>

          <div className="travel-focus-policy">
            <span>POLICY</span>
            <strong className={`is-${plannerRun.policy.decision.toLowerCase()}`}>
              {plannerRun.policy.decision}
            </strong>
            <p>{plannerRun.policy.reason}</p>
          </div>

          <button
            type="button"
            className="travel-focus-continue"
            data-tour="travel-open-options"
            onClick={onBrowseOptions}
          >
            Review recovery options →
          </button>
        </div>
      )}

      <div className="travel-focus-tools">
        <div className="travel-case-modes" aria-label="Travel provider mode">
          <button
            type="button"
            className={caseStudy.mode === "demo" ? "is-active" : ""}
            onClick={() => void switchMode("demo")}
            disabled={busy}
          >
            Demo
          </button>
          <button
            type="button"
            className={caseStudy.mode === "live" ? "is-active" : ""}
            onClick={() => void switchMode("live")}
            disabled={busy}
          >
            {busy ? "Checking…" : "Atlas Live"}
          </button>
        </div>

        <button
          type="button"
          className="travel-trace-toggle"
          onClick={() => setTraceOpen((open) => !open)}
          aria-expanded={traceOpen}
        >
          {traceOpen ? "Hide technical trace" : "View technical trace"}
        </button>
      </div>

      {traceOpen ? (
        <div className="travel-technical-trace">
          <div className="travel-case-disruption">
            <div>
              <span>{caseStudy.disruption.route}</span>
              <strong>{caseStudy.disruption.originalArrival}</strong>
              <small>original arrival</small>
            </div>
            <i>→</i>
            <div className="is-bad">
              <span>+{caseStudy.disruption.delayHours}H</span>
              <strong>{caseStudy.disruption.disruptedArrival}</strong>
              <small>breaks outcome</small>
            </div>
            <p>{caseStudy.provider.detail}</p>
          </div>

          {caseStudy.provider.status === "AUTH_REQUIRED" ? (
            <div className="travel-case-blocked">
              <span>ATLAS LIVE BLOCKED</span>
              <strong>CLI installed · authorization required.</strong>
              <p>No provider evidence is relabeled as live.</p>
            </div>
          ) : (
            <div className="travel-case-candidates">
              {caseStudy.candidates.map((candidate) => (
                <article
                  key={candidate.id}
                  className={[
                    "travel-case-candidate",
                    candidateTone(candidate),
                    candidate.id === plannerCandidate?.id ? "is-ai-picked" : "",
                  ].join(" ")}
                >
                  <div className="travel-case-candidate-top">
                    <span>{candidate.flightNumber}</span>
                    <b>{candidateLabel(candidate)}</b>
                  </div>
                  <div className="travel-case-route">
                    <strong>{candidate.departure}</strong>
                    <i>→</i>
                    <strong>{candidate.arrival}</strong>
                  </div>
                  <div className="travel-case-price">
                    <span>Extra cost</span>
                    <strong>+{candidate.extraCostUsd.toFixed(0)} USD</strong>
                  </div>
                  <p>{candidate.reasons[0]}</p>
                </article>
              ))}
            </div>
          )}

          <ol className="travel-case-journey" aria-label="AI recovery journey">
            {caseStudy.journey.map((step, stepIndex) => (
              <li className={`is-${step.state.toLowerCase()}`} key={step.id}>
                <span>{String(stepIndex + 1).padStart(2, "0")}</span>
                <div>
                  <small>{step.actor}</small>
                  <strong>{step.title}</strong>
                  <p>{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

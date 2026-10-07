"use client";

import type { TripNode, TripNodeKind } from "@/scenarios/travel/agentic-types";

import type { TravelAgentFlowController } from "./useTravelAgentFlow";

const NODE_MARKS: Record<TripNodeKind, string> = {
  FLIGHT: "FL",
  TRANSFER: "TR",
  STAY: "ST",
  ACTIVITY: "GO",
  COMMITMENT: "OK",
};

function nodeTime(node: TripNode) {
  const start = new Date(node.startAt);
  const end = node.endAt ? new Date(node.endAt) : null;
  const day = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const startTime = start.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  const endTime = end
    ? end.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      })
    : null;

  return day + " · " + startTime + (endTime ? "–" + endTime : "");
}

function statusLabel(node: TripNode) {
  if (node.status === "PLANNED") return "READY";
  return node.status;
}

export function TravelTripGraph({
  flow,
}: {
  flow: TravelAgentFlowController;
}) {
  const plan = flow.plan;
  if (!plan) return null;

  const changed = plan.nodes.filter((node) => node.status !== "PLANNED");
  const activities = plan.nodes.filter((node) => node.kind === "ACTIVITY").length;
  return (
    <section className="travel-trip-graph" data-test="travel-trip-graph">
      <header className="travel-trip-graph-head">
        <div>
          <span className="travel-agent-kicker">WHOLE-TRIP GRAPH</span>
          <h2>One change, every dependency rechecked</h2>
          <p>
            Flight, transfer, stay, {activities} activities and your trip goal
            are linked as one plan instead of isolated booking tabs.
          </p>
        </div>

        <div className="travel-trip-graph-actions">
          <span
            className={
              "travel-goal-state " +
              (plan.consequence.commitmentPreserved ? "is-safe" : "is-risk")
            }
          >
            {plan.consequence.commitmentPreserved
              ? "GOAL PRESERVED"
              : "GOAL AT RISK"}
          </span>
        </div>
      </header>

      <div className="travel-trip-graph-summary">
        <strong>{plan.consequence.summary}</strong>
        <span>
          Plan v{plan.version} · {plan.nodes.length} linked nodes ·{" "}
          {changed.length
            ? changed.length + " reassessed after change"
            : "dependency graph ready"}
        </span>
      </div>

      <div className="travel-trip-graph-list">
        {plan.nodes.map((node, index) => (
          <article
            key={node.id}
            className={
              "travel-trip-graph-node is-" + node.status.toLowerCase()
            }
            data-kind={node.kind}
            data-status={node.status}
          >
            <div className="travel-trip-graph-rail">
              <b>{NODE_MARKS[node.kind]}</b>
              {index < plan.nodes.length - 1 ? <i /> : null}
            </div>

            <div className="travel-trip-graph-copy">
              <div className="travel-trip-graph-title">
                <span>{node.kind}</span>
                <em>{statusLabel(node)}</em>
              </div>
              <strong>{node.title}</strong>
              <small>
                {nodeTime(node)} · {node.location}
              </small>
              {node.consequence ? <p>{node.consequence}</p> : null}
            </div>

            <div className="travel-trip-graph-meta">
              {node.amountUsd ? <strong>{"$" + node.amountUsd}</strong> : null}
              <span>{node.source}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

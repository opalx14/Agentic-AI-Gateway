"use client";

import type { TravelCatalogOption } from "@/scenarios/travel/catalog-registry";
import type { TravelAgentFlowController } from "./useTravelAgentFlow";

function timePair(option: TravelCatalogOption) {
  const parts = option.subtitle.split("·").map((part) => part.trim());
  return { route: parts[0] ?? option.subtitle, timing: parts.slice(1).join(" · ") };
}

export function TravelFlightSelection({ flow, option, index }: { flow: TravelAgentFlowController; option: TravelCatalogOption; index: number }) {
  const detail = timePair(option);
  return (
    <article className={"travel-flight-result " + (flow.busy ? "is-busy" : "")} data-test="travel-choice" data-option-id={option.id}>
      <div className="travel-flight-route">
        <span>{String(index + 1).padStart(2, "0")} · {option.source === "ATLAS" ? "LIVE" : "DEMO"}</span>
        <strong>{detail.route}</strong>
        <small>{detail.timing || option.meta}</small>
      </div>
      <div className="travel-flight-carrier">
        <strong>{option.title}</strong>
        <small>{option.aircraft ?? option.badge}</small>
        {option.rankingReason ? <em>{option.rankingReason}</em> : null}
      </div>
      <div className="travel-flight-price">
        <small>{option.source === "ATLAS" ? "Exact live total" : "Demo fare"}</small>
        <strong>{"$" + option.amount}</strong>
        <div className="travel-choice-actions">
          <button type="button" className="is-select" disabled={flow.busy} onClick={() => void flow.choose("flight", option)}>Select</button>
          <button type="button" className="is-decline" disabled={flow.busy} onClick={() => flow.declineChoice(option)}>Decline</button>
        </div>
      </div>
    </article>
  );
}

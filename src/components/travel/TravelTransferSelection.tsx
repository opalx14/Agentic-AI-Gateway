"use client";

import type { TravelCatalogOption } from "@/scenarios/travel/catalog-registry";
import type { TravelAgentFlowController } from "./useTravelAgentFlow";

export function TravelTransferSelection({ flow, option, index }: { flow: TravelAgentFlowController; option: TravelCatalogOption; index: number }) {
  const destination = flow.plan?.destination.city ?? "hotel";
  return (
    <article className={"travel-transfer-result " + (flow.busy ? "is-busy" : "")} data-test="travel-choice" data-option-id={option.id}>
      <div className="travel-transfer-marker">{String(index + 1).padStart(2, "0")}</div>
      <div className="travel-transfer-copy">
        <span>DEMO TRANSFER</span>
        <strong>{option.title}</strong>
        <small>{option.subtitle}</small>
        <em>Airport pickup → {destination} · {option.badge}</em>
        {option.rankingReason ? <p>{option.rankingReason}</p> : null}
      </div>
      <div className="travel-transfer-price">
        <small>Demo price</small>
        <strong>{"$" + option.amount}</strong>
        <div className="travel-choice-actions">
          <button type="button" className="is-select" disabled={flow.busy} onClick={() => void flow.choose("transfer", option)}>Select</button>
          <button type="button" className="is-decline" disabled={flow.busy} onClick={() => flow.declineChoice(option)}>Decline</button>
        </div>
      </div>
    </article>
  );
}

"use client";

import Image from "next/image";
import type { TravelCatalogOption } from "@/scenarios/travel/catalog-registry";
import type { TravelAgentFlowController } from "./useTravelAgentFlow";

export function TravelHotelSelection({ flow, option, index }: { flow: TravelAgentFlowController; option: TravelCatalogOption; index: number }) {
  const nights = Math.max(1, (flow.plan?.intent.days ?? 2) - 1);
  return (
    <article className={"travel-hotel-result " + (flow.busy ? "is-busy" : "")} data-test="travel-choice" data-option-id={option.id}>
      <div className="travel-hotel-image">
        <Image src={option.imageUrl} alt="" fill sizes="(max-width: 720px) 120px, 180px" />
        <b>{option.aiRecommended ? "AI PICK" : "DEMO"}</b>
      </div>
      <div className="travel-hotel-copy">
        <span>{String(index + 1).padStart(2, "0")} · DEMO STAY</span>
        <strong>{option.title}</strong>
        <small>{option.subtitle}</small>
        <em>{nights} night{nights === 1 ? "" : "s"} · {option.meta}</em>
        {option.rankingReason ? <p>{option.rankingReason}</p> : null}
      </div>
      <div className="travel-hotel-price">
        <small>{option.budgetFit ? "Budget fit" : "Over budget"}</small>
        <strong>{"$" + option.amount}</strong>
        <div className="travel-choice-actions">
          <button type="button" className="is-select" disabled={flow.busy} onClick={() => void flow.choose("hotel", option)}>Select</button>
          <button type="button" className="is-decline" disabled={flow.busy} onClick={() => flow.declineChoice(option)}>Decline</button>
        </div>
      </div>
    </article>
  );
}

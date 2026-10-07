"use client";

import type { ServiceStage } from "./travel-flow";
import type { TravelAgentFlowController } from "./useTravelAgentFlow";
import { TravelFlightSelection } from "./TravelFlightSelection";
import { TravelHotelSelection } from "./TravelHotelSelection";
import { TravelTransferSelection } from "./TravelTransferSelection";

export function TravelChoiceList({
  flow,
  stage,
}: {
  flow: TravelAgentFlowController;
  stage: ServiceStage;
}) {
  return (
    <div className={"travel-choice-list is-" + stage}>
      {flow.choices.map((option, index) =>
        stage === "flight" ? (
          <TravelFlightSelection key={option.id} flow={flow} option={option} index={index} />
        ) : stage === "hotel" ? (
          <TravelHotelSelection key={option.id} flow={flow} option={option} index={index} />
        ) : (
          <TravelTransferSelection key={option.id} flow={flow} option={option} index={index} />
        ),
      )}

      {flow.choices.length === 0 ? (
        <div className="travel-choice-empty">
          <strong>No option selected.</strong>
          <p>
            You declined this shortlist. Nothing was booked and the draft is
            unchanged.
          </p>
          <button
            type="button"
            disabled={flow.busy}
            onClick={() => flow.searchStageAgain(stage)}
          >
            Search this step again
          </button>
        </div>
      ) : null}
    </div>
  );
}

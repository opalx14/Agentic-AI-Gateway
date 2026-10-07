"use client";

import { TravelActiveView } from "./TravelActiveView";
import { TravelEmptyState } from "./TravelEmptyState";
import { TravelHistoryDrawer } from "./TravelHistoryDrawer";
import { useTravelAgentFlow } from "./useTravelAgentFlow";

export function AgentTravelClient() {
  const flow = useTravelAgentFlow();

  return (
    <main
      className={
        "travel-chat-shell " +
        (flow.plan ? "is-active" : flow.requests.length > 0 ? "is-intake" : "is-empty")
      }
    >
      <TravelHistoryDrawer flow={flow} />
      {flow.plan ? (
        <TravelActiveView flow={flow} />
      ) : (
        <TravelEmptyState flow={flow} />
      )}
    </main>
  );
}

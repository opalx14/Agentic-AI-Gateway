import { TravelDemoClient } from "@/components/demo/TravelDemoClient";
import { buildTravelDemoResponse } from "@/scenarios/travel";

export default async function TravelScenarioPage() {
  const initialData = await buildTravelDemoResponse({ optionId: "flight-a" });

  return (
    <main className="subpage-shell">
      <section className="subpage-head">
        <div>
          <p className="operator-eyebrow">CROSS-DOMAIN PROOF / ATLAS OPTIONAL</p>
          <h1>Travel recovery authority demo</h1>
          <p>
            Replacement flights prove the Control Plane is domain-independent.
            Provider verification occurs before final authority so stale consent
            cannot silently authorize a changed price.
          </p>
        </div>
        <div className="subpage-status">
          <span>Goal</span>
          <strong>Arrive before 17:00</strong>
          <span>Autonomous limit</span>
          <strong>$20 additional cost</strong>
        </div>
      </section>

      <div className="scenario-detail-runtime">
        <TravelDemoClient initialData={initialData} />
      </div>
    </main>
  );
}

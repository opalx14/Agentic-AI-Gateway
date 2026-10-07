import { LogisticsDemoClient } from "@/components/demo/LogisticsDemoClient";
import { buildLogisticsDemoResponse } from "@/scenarios/logistics";

export default async function LogisticsScenarioPage() {
  const initialData = await buildLogisticsDemoResponse();

  return (
    <main className="subpage-shell">
      <section className="subpage-head">
        <div>
          <p className="operator-eyebrow">PRIMARY BUSINESS CASE / VJAI</p>
          <h1>Logistics authority demo</h1>
          <p>
            The agent can reason about a disruption, but inventory mutation
            occurs only after deterministic constraints and delegated authority
            pass.
          </p>
        </div>
        <div className="subpage-status">
          <span>Incident</span>
          <strong>Inbound delay · 12h</strong>
          <span>Initial decision</span>
          <strong className="status-watch">ESCALATE</strong>
        </div>
      </section>

      <div className="scenario-detail-runtime">
        <LogisticsDemoClient initialData={initialData} />
      </div>
    </main>
  );
}

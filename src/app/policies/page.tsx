import { createLogisticsFixture } from "@/scenarios/logistics";
import { createTravelPolicy } from "@/scenarios/travel";

export default function PoliciesPage() {
  const logistics = createLogisticsFixture();
  const travel = createTravelPolicy();

  const rows = [
    {
      label: "Allowed action",
      logistics: logistics.authorityPolicy.allowedActionTypes.join(", "),
      travel: travel.allowedActionTypes.join(", "),
    },
    {
      label: "Autonomous threshold",
      logistics: "$" + String(logistics.authorityPolicy.approvalAbove ?? "—"),
      travel: "$" + String(travel.approvalAbove ?? "—"),
    },
    {
      label: "Hard action ceiling",
      logistics: "$" + String(logistics.authorityPolicy.maxPerAction ?? "—"),
      travel: "$" + String(travel.maxPerAction ?? "—"),
    },
    {
      label: "Total delegated budget",
      logistics: "$" + String(logistics.authorityPolicy.maxTotal ?? "—"),
      travel: "$" + String(travel.maxTotal ?? "—"),
    },
    {
      label: "Delegated role",
      logistics: logistics.authorityPolicy.allowedRoles.join(", "),
      travel: travel.allowedRoles.join(", "),
    },
  ];

  return (
    <main className="subpage-shell">
      <section className="subpage-head">
        <div>
          <p className="operator-eyebrow">DETERMINISTIC AUTHORITY</p>
          <h1>Policies are code, not prompts.</h1>
          <p>
            AI can recommend. These deterministic limits decide whether the
            proposed action can execute, needs exact approval, or is blocked.
          </p>
        </div>
        <div className="subpage-status">
          <span>Decisions</span>
          <strong>ALLOW / BLOCK / ESCALATE</strong>
          <span>Evaluation</span>
          <strong>Fail closed</strong>
        </div>
      </section>

      <section className="policy-table" aria-label="Policy comparison">
        <div className="policy-row policy-header">
          <span>Rule</span>
          <strong>Logistics</strong>
          <strong>Travel</strong>
        </div>
        {rows.map((row) => (
          <div className="policy-row" key={row.label}>
            <span>{row.label}</span>
            <code>{row.logistics}</code>
            <code>{row.travel}</code>
          </div>
        ))}
      </section>

      <section className="decision-grid">
        <article className="decision-definition decision-definition-allow">
          <span>ALLOW</span>
          <strong>Inside delegated authority</strong>
          <p>All deterministic checks pass. Provider execution may begin.</p>
        </article>
        <article className="decision-definition decision-definition-escalate">
          <span>ESCALATE</span>
          <strong>Permitted, but not autonomous</strong>
          <p>Exact approval is required before the execution boundary opens.</p>
        </article>
        <article className="decision-definition decision-definition-block">
          <span>BLOCK</span>
          <strong>Hard rule violation</strong>
          <p>Execution remains closed. Approval cannot override a hard block.</p>
        </article>
      </section>
    </main>
  );
}

import Link from "next/link";

const scenarios = [
  {
    href: "/scenarios/logistics",
    eyebrow: "PRIMARY / VJAI",
    title: "Logistics Operations",
    decision: "ESCALATE → ALLOW",
    description:
      "Inbound delay → stockout risk → inventory transfer → deterministic gate → exact manager approval → WMS execution.",
    checks: ["SLA", "Inventory", "Capacity", "Cold-chain", "Exact approval"],
  },
  {
    href: "/scenarios/travel",
    eyebrow: "CROSS-DOMAIN / UNIHACKFEST",
    title: "Travel Recovery",
    decision: "ALLOW / ESCALATE",
    description:
      "Flight disruption → verified replacement → tiered authority → exact consent → quote-change invalidation.",
    checks: ["Replan", "Budget", "Provider verify", "Exact consent", "Atlas optional"],
  },
] as const;

export default function ScenariosPage() {
  return (
    <main className="subpage-shell">
      <section className="subpage-head">
        <div>
          <p className="operator-eyebrow">SCENARIO ENGINE</p>
          <h1>One authority layer. Different operational domains.</h1>
          <p>
            The scenario changes. Identity, deterministic policy, approval,
            execution and receipt boundaries remain the same.
          </p>
        </div>
        <div className="subpage-status">
          <span>Runtime</span>
          <strong>Fixture-safe</strong>
          <span>Domains</span>
          <strong>2 implemented</strong>
        </div>
      </section>

      <section className="scenario-index">
        {scenarios.map((scenario, index) => (
          <Link key={scenario.href} href={scenario.href} className="scenario-row">
            <span className="scenario-number">{String(index + 1).padStart(2, "0")}</span>
            <div className="scenario-main">
              <span className="scenario-eyebrow">{scenario.eyebrow}</span>
              <h2>{scenario.title}</h2>
              <p>{scenario.description}</p>
            </div>
            <div className="scenario-checks">
              {scenario.checks.map((check) => (
                <span key={check}>{check}</span>
              ))}
            </div>
            <div className="scenario-decision">
              <span>Expected authority path</span>
              <strong>{scenario.decision}</strong>
            </div>
            <span className="scenario-open">Open →</span>
          </Link>
        ))}
      </section>

      <section className="subpage-note">
        <strong>Shared invariant</strong>
        <span>
          No consequential provider call can skip deterministic policy or reuse
          stale approval.
        </span>
      </section>
    </main>
  );
}

const steps = [
  ["01", "Observation received", "Incident enters the scenario runtime.", "INPUT"],
  ["02", "Context built", "Goal, dependency and operational facts are assembled.", "CONTEXT"],
  ["03", "AI plan generated", "Structured candidate action only; no authority.", "AI"],
  ["04", "Schema validated", "Malformed or hallucinated candidates are rejected.", "VALIDATE"],
  ["05", "Policy evaluated", "Identity, limits, expiry, risk and replay checks.", "AUTHORITY"],
  ["06", "Exact approval", "Only when deterministic rules require escalation.", "HUMAN"],
  ["07", "Execution adapter", "Provider call occurs only after ALLOW.", "PROVIDER"],
  ["08", "Receipt", "Outcome is recorded independently from authority decision.", "EVIDENCE"],
] as const;

export default function ExecutionsPage() {
  return (
    <main className="subpage-shell">
      <section className="subpage-head">
        <div>
          <p className="operator-eyebrow">EXECUTION TRACE</p>
          <h1>The authority path is visible.</h1>
          <p>
            A judge can see exactly where intelligence ends and authority
            begins. Provider success is never inferred from policy success.
          </p>
        </div>
        <div className="subpage-status">
          <span>Pipeline</span>
          <strong>8 explicit stages</strong>
          <span>Failure model</span>
          <strong>No execution on uncertainty</strong>
        </div>
      </section>

      <section className="execution-table">
        <div className="execution-head">
          <span>#</span>
          <span>Boundary</span>
          <span>Meaning</span>
          <span>Layer</span>
        </div>
        {steps.map(([number, title, copy, layer]) => (
          <div className="execution-row" key={number}>
            <code>{number}</code>
            <strong>{title}</strong>
            <p>{copy}</p>
            <span className="layer-badge">{layer}</span>
          </div>
        ))}
      </section>

      <section className="fail-closed-banner">
        <span>FAIL CLOSED</span>
        <strong>
          Parse failure, policy failure, stale approval, provider failure or
          chain rejection never becomes a successful execution.
        </strong>
      </section>
    </main>
  );
}

import type { DemoScenarioState } from "@/app/demo-model";

function statusForApproval(state: DemoScenarioState) {
  if (state.decision === "BLOCK") {
    return { label: "Not requested", tone: "closed" as const };
  }
  if (!state.approvalRequired) {
    return { label: "Delegated", tone: "done" as const };
  }
  if (state.approved) {
    return { label: "Exact consent", tone: "done" as const };
  }
  return { label: "Waiting for human", tone: "current" as const };
}

function chainCopy(state: DemoScenarioState) {
  if (state.decision === "BLOCK") {
    return {
      title: "No authorization is created",
      detail: "A blocked action should leave no executable on-chain authorization.",
    };
  }

  if (state.approvalRequired) {
    return {
      title: state.approved
        ? "Approval + authorization model"
        : "Approval record required",
      detail:
        "ActionApproval binds the exact action hash, amount and nonce; ActionAuthorization reserves the permitted amount.",
    };
  }

  return {
    title: "Delegated authorization model",
    detail:
      "ActionAuthorization binds the action hash, amount and nonce inside the policy's automatic limit.",
  };
}

function activeStepIndex(state: DemoScenarioState) {
  if (state.decision === "BLOCK") return 2;
  if (state.executed) return 5;
  if (state.approvalRequired && !state.approved) return 3;
  return 4;
}

export function ScenarioJourneyLedger({
  state,
  compact = false,
}: {
  state: DemoScenarioState;
  compact?: boolean;
}) {
  const approval = statusForApproval(state);
  const chain = chainCopy(state);

  const steps = [
    {
      index: "01",
      scope: "APP",
      title: "Observe",
      detail: state.incidentLabel,
      status: "Observed",
      tone: "done",
    },
    {
      index: "02",
      scope: "AI",
      title: "Propose",
      detail: state.actionTitle,
      status: "Structured action",
      tone: "done",
    },
    {
      index: "03",
      scope: "POLICY",
      title: "Decide",
      detail: state.decisionReason,
      status: state.decision,
      tone:
        state.decision === "ALLOW"
          ? "done"
          : state.decision === "ESCALATE"
            ? "current"
            : "closed",
    },
    {
      index: "04",
      scope: "HUMAN",
      title: "Consent",
      detail:
        state.decision === "BLOCK"
          ? "The policy closes execution before a signer is asked."
          : state.approvalRequired
            ? "The signer approves this exact action, amount and nonce."
            : "The action stays inside delegated authority; no human approval is needed.",
      status: approval.label,
      tone: approval.tone,
    },
    {
      index: "05",
      scope: "SOLANA",
      title: "Authorize",
      detail: chain.detail,
      status: "Authority proof",
      tone: state.decision === "BLOCK" ? "closed" : "chain",
    },
    {
      index: "06",
      scope: "PROVIDER",
      title: "Execute + settle",
      detail: state.executed
        ? `Provider receipt: ${state.receiptRef ?? "recorded"}`
        : state.decision === "BLOCK"
          ? "No provider call is permitted."
          : "Provider execution waits until authority is valid.",
      status: state.executed ? "Receipt recorded" : "Pending",
      tone: state.executed ? "done" : state.decision === "BLOCK" ? "closed" : "pending",
    },
  ] as const;

  const activeIndex = activeStepIndex(state);
  const active = steps[activeIndex];

  return (
    <section className={compact ? "action-journey is-compact" : "action-journey"}>
      <div className="action-journey-head">
        <div>
          <span>ACTION JOURNEY</span>
          <h2>One action. Six visible checkpoints.</h2>
          <p>Follow the handoff first; open technical proof only when you need it.</p>
        </div>
        <div className="action-journey-legend" aria-label="Journey scopes">
          <span><i className="is-app" /> App / AI</span>
          <span><i className="is-human" /> Human</span>
          <span><i className="is-chain" /> Solana</span>
          <span><i className="is-provider" /> Provider</span>
        </div>
      </div>

      <div className="action-journey-summary" aria-label="Action summary">
        <div>
          <span>INCIDENT</span>
          <strong>{state.incidentLabel}</strong>
        </div>
        <i aria-hidden="true">→</i>
        <div>
          <span>AI PROPOSES</span>
          <strong>{state.actionTitle}</strong>
        </div>
        <i aria-hidden="true">→</i>
        <div className={`is-${active.tone}`}>
          <span>CURRENT GATE</span>
          <strong>{active.status}</strong>
        </div>
      </div>

      <ol className="action-journey-rail">
        {steps.map((step, index) => (
          <li
            className={`action-journey-node is-${step.tone} ${index === activeIndex ? "is-active" : ""}`}
            key={step.index}
            title={step.detail}
          >
            <div className="action-journey-dot">
              <span>{step.index}</span>
            </div>
            <b>{step.scope}</b>
            <strong>{step.title}</strong>
            <small>{step.status}</small>
          </li>
        ))}
      </ol>

      <div className="action-journey-focus">
        <div className={`action-journey-focus-state is-${active.tone}`}>
          <span>NOW AT {active.index} · {active.scope}</span>
          <strong>{active.title}</strong>
          <p>{active.detail}</p>
        </div>

        <div className="action-journey-proof-boundary">
          <span>PROOF BOUNDARY</span>
          <strong>{chain.title}</strong>
          <p>
            Solana proves policy, approval when required, authorization, nonce state
            and settlement evidence. Business context and AI reasoning stay off-chain.
          </p>
        </div>
      </div>
    </section>
  );
}

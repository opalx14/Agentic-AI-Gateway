"use client";

import { useMemo, useState } from "react";

import {
  PhantomWalletControl,
  type WalletAuthorityState,
} from "@/components/PhantomWalletControl";
import { ScenarioJourneyLedger } from "@/components/ScenarioJourneyLedger";

import type {
  DemoScenarioState,
  OperatorWorkspaceData,
} from "./demo-model";
import { TravelRecoveryDemo } from "./travel-recovery-demo";
import { EvidenceDrawer, ReviewActionSheet, SafetyDrawer } from "./operator-workspace-drawers";
import { decisionClass, demoCoachState, type Domain, type TravelOption } from "./operator-workspace-utils";

export function OperatorWorkspace({
  data,
  fixedDomain,
}: {
  data: OperatorWorkspaceData;
  fixedDomain?: Domain;
}) {
  const [domain, setDomain] = useState<Domain>(fixedDomain ?? "logistics");
  const [travelOption, setTravelOption] = useState<TravelOption>("A");
  const [logisticsApproved, setLogisticsApproved] = useState(false);
  const [travelBApproved, setTravelBApproved] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [walletAuthority, setWalletAuthority] = useState<WalletAuthorityState>({
    provider: "phantom",
    status: "disconnected",
    address: null,
    signatureBytes: null,
  });

  const current = useMemo<DemoScenarioState>(() => {
    if (domain === "logistics") {
      return logisticsApproved ? data.logistics.approved : data.logistics.pending;
    }

    if (travelOption === "A") {
      return data.travel.optionA;
    }

    return travelBApproved ? data.travel.optionBApproved : data.travel.optionB;
  }, [data, domain, logisticsApproved, travelBApproved, travelOption]);

  const coach = useMemo(
    () =>
      demoCoachState({
        domain,
        travelOption,
        logisticsApproved,
        travelBApproved,
      }),
    [domain, logisticsApproved, travelBApproved, travelOption],
  );

  async function approveExact() {
    setApprovalSubmitting(true);
    setApprovalError(null);

    try {
      const endpoint =
        domain === "logistics"
          ? "/api/scenarios/logistics"
          : "/api/scenarios/travel";

      const body =
        domain === "logistics"
          ? { approved: true }
          : { optionId: "flight-b", approved: true };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as {
        error?: string;
        result?: {
          decision?: { decision?: string };
          receipt?: { status?: string };
        };
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Approval execution request failed.");
      }

      if (
        payload.result?.decision?.decision !== "ALLOW" ||
        payload.result.receipt?.status !== "EXECUTED"
      ) {
        throw new Error(
          "Execution did not return an authorized EXECUTED receipt.",
        );
      }

      if (domain === "logistics") {
        setLogisticsApproved(true);
      } else {
        setTravelBApproved(true);
      }

      setApprovalOpen(false);
    } catch (error) {
      setApprovalError(
        error instanceof Error ? error.message : "Approval execution failed.",
      );
    } finally {
      setApprovalSubmitting(false);
    }
  }

  function resetCurrent() {
    if (domain === "logistics") {
      setLogisticsApproved(false);
    } else if (travelOption === "B") {
      setTravelBApproved(false);
    }
  }

  function runCoachAction() {
    if (coach.action === "travel-b") {
      setTravelOption("B");
      return;
    }

    if (coach.action === "review") {
      setApprovalError(null);
      setApprovalOpen(true);
      return;
    }

    setEvidenceOpen(true);
  }

  return (
    <div className="ned-shell ned-web3-shell">
      <main className="ned-main">
        <section className={`demo-stage ${domain === "travel" ? "is-travel" : ""}`} data-test="demo-coach">
          <div className="demo-stage-top">
            <div className="demo-stage-id">
              <span>{domain === "logistics" ? "LOGISTICS" : "CREATOR TRAVEL"}</span>
              <strong>{domain === "logistics" ? "Stockout recovery" : "Sponsored trip recovery"}</strong>
            </div>

            {!fixedDomain ? (
              <div className="ned-domain-tabs" role="tablist" aria-label="Demo domain">
                <button
                  type="button"
                  className={domain === "logistics" ? "is-active" : ""}
                  onClick={() => setDomain("logistics")}
                >
                  Logistics
                </button>
                <button
                  type="button"
                  className={domain === "travel" ? "is-active" : ""}
                  onClick={() => setDomain("travel")}
                >
                  Travel
                </button>
              </div>
            ) : null}

            <div className="demo-stage-badges">
              <span>Fixture</span>
              <b>Devnet confirmed</b>
            </div>
          </div>

          <div className="demo-stage-main">
            <div className="demo-stage-copy">
              <span>{domain === "logistics" ? "INBOUND DELAY · 12H" : "EDUCATION / CREATOR ECONOMY · FLIGHT DELAY"}</span>
              <h1>{domain === "logistics" ? "Prevent the HCM stockout." : "Protect a sponsored trip."}</h1>
              <p>
                {domain === "logistics"
                  ? "AI wants to move 250 units. The $8K action is valid — but above its $5K autonomous limit."
                  : "A student builder or creator must reach Demo Day before 17:00. AI may recover the trip, but it cannot overspend the sponsor grant."}
              </p>
            </div>

            <div className="demo-stage-metrics" aria-label="Scenario facts">
              {domain === "logistics" ? (
                <>
                  <div><span>HCM stock</span><strong>50 units</strong></div>
                  <div><span>Action</span><strong>$8,000</strong></div>
                  <div><span>Auto limit</span><strong>$5,000</strong></div>
                </>
              ) : (
                <>
                  <div><span>Deadline</span><strong>17:00</strong></div>
                  <div><span>Grant authority</span><strong>+$20</strong></div>
                  <div><span>Exception</span><strong>+$45</strong></div>
                </>
              )}
            </div>

            {domain === "logistics" ? (
              <div className="demo-stage-control">
                <div className="demo-stage-authority">
                  <span>AUTHORITY</span>
                  <strong className={decisionClass(current.decision)}>{current.decision}</strong>
                  <small>
                    {current.executed
                      ? "Executed"
                      : current.decision === "ESCALATE"
                        ? "Needs approval"
                        : current.decision === "BLOCK"
                          ? "Blocked"
                          : "Automatic"}
                  </small>
                </div>

                <ol className="demo-stage-progress" aria-label="Demo progress">
                  {coach.steps.map((step, index) => (
                    <li className={`is-${step.state}`} key={step.label} title={step.detail}>
                      <span>{index + 1}</span>
                      <small>{step.label}</small>
                    </li>
                  ))}
                </ol>

                <button
                  type="button"
                  className="demo-stage-cta"
                  data-test="demo-next-step"
                  onClick={runCoachAction}
                >
                  <span>{coach.actionLabel}</span>
                  <b aria-hidden="true">→</b>
                </button>
              </div>
            ) : null}
          </div>
        </section>

        {domain === "travel" ? (
          <TravelRecoveryDemo
            data={data.travel}
            current={current}
            selected={travelOption}
            onSelect={setTravelOption}
            onReview={() => {
              setApprovalError(null);
              setApprovalOpen(true);
            }}
            onSafety={() => setSafetyOpen(true)}
            onEvidence={() => setEvidenceOpen(true)}
            onReset={resetCurrent}
          />
        ) : (
          <section className="ned-content">
            <section className="logistics-flow-strip" aria-label="Operational impact">
              {current.graphNodes.map((node, index) => (
                <div className="ned-path-fragment" key={node.id}>
                  <div className={"ned-path-node ned-path-" + node.tone}>
                    <small>{node.eyebrow}</small>
                    <strong>{node.title}</strong>
                  </div>
                  {index < current.graphNodes.length - 1 ? (
                    <span className="ned-path-arrow">→</span>
                  ) : null}
                </div>
              ))}
            </section>

            <section className="ned-action-grid">
              <article className="ned-proposal-card" data-tour="logistics-proposal">
                <div className="ned-section-title">
                  <span>AI</span>
                  <div>
                    <small>PROPOSED ACTION</small>
                    <h2>{current.actionTitle}</h2>
                  </div>
                </div>

                <div className="logistics-action-visual">
                  <div>
                    <span>MOVE</span>
                    <strong>250</strong>
                    <small>units</small>
                  </div>
                  <i>→</i>
                  <div>
                    <span>DESTINATION</span>
                    <strong>HCM</strong>
                    <small>SKU-X recovery</small>
                  </div>
                </div>

                <div className="ned-metrics">
                  {current.metrics.slice(0, 3).map((metric) => (
                    <div key={metric.label}>
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                    </div>
                  ))}
                </div>
              </article>

              <article className="ned-authority-card">
                <div className="ned-section-title">
                  <span>!</span>
                  <div>
                    <small>WHY IT STOPPED</small>
                    <h2>Policy boundary</h2>
                  </div>
                </div>

                <div className="ned-check-list">
                  {current.policyChecks
                    .filter((check) =>
                      ["Quantity", "Receiving capacity", "Automatic value limit"].includes(
                        check.label,
                      ),
                    )
                    .map((check) => (
                      <div key={check.label}>
                        <span
                          className={
                            check.state === "pass"
                              ? "ned-check-pass"
                              : check.state === "fail"
                                ? "ned-check-fail"
                                : "ned-check-escalate"
                          }
                        >
                          {check.state === "pass" ? "✓" : check.state === "fail" ? "×" : "!"}
                        </span>
                        <p>
                          <strong>{check.label}</strong>
                          <small>{check.detail}</small>
                        </p>
                      </div>
                    ))}
                </div>

                <div className="ned-inline-wallet">
                  <span>OPTIONAL SIGNER EVIDENCE</span>
                  <PhantomWalletControl onAuthorityChange={setWalletAuthority} />
                </div>

                {current.executed ? (
                  <div className="ned-result-success" data-test="executed-receipt">
                    <span>✓ EXECUTED</span>
                    <strong>{current.receiptRef ?? "receipt recorded"}</strong>
                  </div>
                ) : null}
              </article>
            </section>

            {current.executed ? (
              <section className="ned-result-card">
                <div className="ned-result-grid">
                  <div>
                    <span>Status</span>
                    <strong className="ned-green">EXECUTED</strong>
                  </div>
                  <div>
                    <span>Receipt</span>
                    <code>{current.receiptRef ?? "recorded"}</code>
                  </div>
                  <div>
                    <span>Authority</span>
                    <strong>Exact match</strong>
                  </div>
                </div>
              </section>
            ) : null}

            <div className="demo-toolbar">
              <button type="button" onClick={() => setSafetyOpen(true)}>Safety</button>
              <button type="button" data-tour="logistics-evidence" onClick={() => setEvidenceOpen(true)}>Evidence</button>
              <button type="button" onClick={resetCurrent}>Reset</button>
            </div>
          </section>
        )}

        <div className="demo-system-view">
          <div className="demo-system-view-head">
            <span>AFTER THE INTERACTION · SYSTEM VIEW</span>
            <strong>Now inspect how the action moved through authority checkpoints.</strong>
            <p>
              This section is explanatory, not another task. Use it after the main
              interaction when you want to explain the architecture to a judge.
            </p>
          </div>
          <ScenarioJourneyLedger state={current} compact />
        </div>
      </main>

      {approvalOpen ? (
        <ReviewActionSheet
          state={current}
          busy={approvalSubmitting}
          error={approvalError}
          walletAuthority={walletAuthority}
          onClose={() => {
            if (!approvalSubmitting) setApprovalOpen(false);
          }}
          onConfirm={approveExact}
        />
      ) : null}

      {safetyOpen ? (
        <SafetyDrawer
          data={data}
          onClose={() => setSafetyOpen(false)}
        />
      ) : null}

      {evidenceOpen ? (
        <EvidenceDrawer
          items={data.evidence}
          walletAuthority={walletAuthority}
          onClose={() => setEvidenceOpen(false)}
        />
      ) : null}
    </div>
  );
}


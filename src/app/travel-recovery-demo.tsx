"use client";

import { useState } from "react";

import { TravelCaseStudyPanel } from "@/components/TravelCaseStudyPanel";

import type { DemoScenarioState, OperatorWorkspaceData } from "./demo-model";

type TravelOption = "A" | "B";

function optionClass(active: boolean, decision: DemoScenarioState["decision"]) {
  return [
    "travel-option-card",
    active ? "is-active" : "",
    decision === "ALLOW" ? "is-allow" : "is-escalate",
  ]
    .filter(Boolean)
    .join(" ");
}

export function TravelRecoveryDemo({
  data,
  current,
  selected,
  onSelect,
  onReview,
  onSafety,
  onEvidence,
  onReset,
}: {
  data: OperatorWorkspaceData["travel"];
  current: DemoScenarioState;
  selected: TravelOption;
  onSelect: (option: TravelOption) => void;
  onReview: () => void;
  onSafety: () => void;
  onEvidence: () => void;
  onReset: () => void;
}) {
  const needsApproval = current.decision === "ESCALATE";
  const recovered = current.executed;
  const [optionsVisible, setOptionsVisible] = useState(false);

  return (
    <section className="travel-demo" data-test="travel-recovery-demo">
      <TravelCaseStudyPanel
        initial={data.caseStudy}
        onPlannerResult={(result) => {
          setOptionsVisible(true);
          if (result.quoteId === "demo-human") {
            onSelect("B");
          } else if (result.quoteId === "demo-auto") {
            onSelect("A");
          }
        }}
        onBrowseOptions={() => setOptionsVisible(true)}
      />

      {optionsVisible || recovered ? (
      <div className="travel-workspace is-progressive">
        <div className="travel-options-panel">
          <div className="travel-section-heading">
            <div>
              <span>RECOVERY OPTIONS</span>
              <h3>Pick the trade-off.</h3>
            </div>
            <small>Both protect 17:00.</small>
          </div>

          <div className="travel-options" role="radiogroup" aria-label="Replacement flight options">
            <button
              type="button"
              role="radio"
              aria-checked={selected === "A"}
              className={optionClass(selected === "A", data.optionA.decision)}
              onClick={() => onSelect("A")}
              data-test="travel-option-a"
            >
              <div className="travel-option-top">
                <div>
                  <span className="travel-option-label">LOWEST COST</span>
                  <strong>FIX-A</strong>
                </div>
                <span className="travel-authority-chip is-auto">AUTO</span>
              </div>

              <div className="travel-route">
                <div><strong>13:30</strong><span>SGN</span></div>
                <div className="travel-route-line"><span>DIRECT</span></div>
                <div><strong>16:20</strong><span>SIN</span></div>
              </div>

              <div className="travel-option-footer">
                <div>
                  <span>Delta</span>
                  <strong>+$15</strong>
                </div>
                <p>Inside +$20 limit</p>
              </div>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={selected === "B"}
              className={optionClass(selected === "B", data.optionB.decision)}
              onClick={() => onSelect("B")}
              data-test="travel-option-b"
            >
              <div className="travel-option-top">
                <div>
                  <span className="travel-option-label">EARLIER ARRIVAL</span>
                  <strong>FIX-B</strong>
                </div>
                <span className="travel-authority-chip is-human">HUMAN</span>
              </div>

              <div className="travel-route">
                <div><strong>11:40</strong><span>SGN</span></div>
                <div className="travel-route-line"><span>DIRECT</span></div>
                <div><strong>14:30</strong><span>SIN</span></div>
              </div>

              <div className="travel-option-footer">
                <div>
                  <span>Delta</span>
                  <strong>+$45</strong>
                </div>
                <p>Above +$20 limit</p>
              </div>
            </button>
          </div>
        </div>

        <aside className="travel-authority-rail">
          <span>SELECTED · {selected === "A" ? "FIX-A" : "FIX-B"}</span>
          <div className="travel-rail-arrival">
            <small>ARRIVAL</small>
            <strong>{selected === "A" ? "16:20" : "14:30"}</strong>
            <em>before 17:00</em>
          </div>

          <div className="travel-budget-meter">
            <div>
              <span>Delegated</span>
              <strong>+$20</strong>
            </div>
            <div className="travel-budget-track">
              <i
                className={selected === "A" ? "is-inside" : "is-over"}
                style={{ width: selected === "A" ? "33%" : "100%" }}
              />
            </div>
            <small>{selected === "A" ? "+$15 inside limit" : "+$45 exceeds limit"}</small>
          </div>

          <div
            className={
              "travel-rail-state " +
              (current.decision === "ALLOW" ? "is-allow" : "is-escalate")
            }
          >
            <span>AUTHORITY</span>
            <strong data-test="authority-decision">
              {recovered ? "EXECUTED" : current.decision}
            </strong>
          </div>

          {needsApproval ? (
            <button
              type="button"
              className="travel-review-cta is-demo-next"
              data-test="demo-next-step"
              onClick={onReview}
            >
              <span>Review exact +$45</span>
              <strong>→</strong>
            </button>
          ) : recovered ? (
            <div className="travel-recovery-result" data-test="executed-receipt">
              <div>
                <span>RECOVERED</span>
                <strong>Commitment protected</strong>
              </div>
              <code>{current.receiptRef ?? "recorded"}</code>
            </div>
          ) : (
            <div className="travel-auto-result">
              <span>AUTONOMOUS</span>
              <strong>No approval needed</strong>
            </div>
          )}
        </aside>
      </div>
      ) : null}

      <div className="travel-secondary-actions">
        <button type="button" onClick={onSafety}>Safety cases</button>
        <button type="button" data-tour="travel-evidence" onClick={onEvidence}>Evidence</button>
        <button type="button" onClick={onReset}>Reset</button>
      </div>
    </section>
  );
}

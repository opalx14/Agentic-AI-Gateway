"use client";

import { useEffect, useRef, useState } from "react";

import {
  STEP_LABELS,
  STEP_ORDER,
  stageCopy,
  stageTitle,
  type ServiceStage,
} from "./travel-flow";
import { TravelChoiceList } from "./TravelChoiceList";
import { TravelComboSuggestions } from "./TravelComboSuggestions";
import { TravelComposer } from "./TravelComposer";
import { TravelFinalReview } from "./TravelFinalReview";
import { TravelTripGraph } from "./TravelTripGraph";
import { TravelVerificationReceipt } from "./TravelVerificationReceipt";
import type { TravelAgentFlowController } from "./useTravelAgentFlow";

function TrustLanes({
  mode,
}: {
  mode: "offchain" | "human" | "onchain";
}) {
  return (
    <div className="travel-trust-lanes" data-test="travel-trust-lanes">
      <div
        className={
          "travel-trust-lane " + (mode === "offchain" ? "is-active" : "is-done")
        }
      >
        <b>01</b>
        <div>
          <span>OFF-CHAIN</span>
          <strong>AI search + rank + draft</strong>
          <small>No smart-contract write</small>
        </div>
      </div>

      <div
        className={
          "travel-trust-lane " +
          (mode === "human"
            ? "is-active"
            : mode === "onchain"
              ? "is-done"
              : "")
        }
      >
        <b>02</b>
        <div>
          <span>HUMAN CONFIRMATION</span>
          <strong>Review exact services</strong>
          <small>Selections remain local draft</small>
        </div>
      </div>

      <div
        className={
          "travel-trust-lane " + (mode === "onchain" ? "is-active" : "")
        }
      >
        <b>03</b>
        <div>
          <span>ON-CHAIN</span>
          <strong>Final action only</strong>
          <small>Email wallet / Phantom + Solana Devnet proof</small>
        </div>
      </div>
    </div>
  );
}

function CompletedTrip({ flow }: { flow: TravelAgentFlowController }) {
  const demoComplete =
    flow.activeBooking?.lifecycleStatus === "DEMO_COMPLETE";

  return (
    <div className="travel-complete-chat">
      <div className="travel-complete-check">✓</div>
      <div>
        <span className="travel-agent-kicker">
          {demoComplete ? "DEMO COMPLETE" : "ON-CHAIN VERIFIED"}
        </span>
        <h2>
          {demoComplete
            ? "Demo booking completed"
            : "Final AI action verified"}
        </h2>
        <p>
          {demoComplete
            ? "Demo Wallet completed the local booking flow. No faucet, Solana transaction or PDA was created."
            : "The booking draft stayed off-chain. The exact final action is backed by a real Devnet transaction and PDA readback."}
        </p>
        {flow.activeBooking?.verificationStatus === "VERIFIED" ? (
          <TravelVerificationReceipt record={flow.activeBooking} />
        ) : null}
        <div className="travel-post-booking-change" data-test="travel-post-booking-change">
          <div>
            <strong>Plans changed after booking?</strong>
            <small>
              Nói tiếp với AI ở ô chat bên dưới. Mọi thay đổi sẽ tạo version mới
              thay vì ghi đè lịch sử đã xác minh.
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TravelActiveView({
  flow,
}: {
  flow: TravelAgentFlowController;
}) {
  const currentStepRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const plan = flow.plan;

  useEffect(() => {
    if (!plan) return;

    const updateScrollState = () => {
      const distance =
        document.documentElement.scrollHeight -
        window.innerHeight -
        window.scrollY;
      const nearBottom = distance < 180;
      stickToBottomRef.current = nearBottom;
      setShowScrollButton(!nearBottom);
    };

    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    window.visualViewport?.addEventListener("resize", updateScrollState);
    return () => {
      window.removeEventListener("scroll", updateScrollState);
      window.visualViewport?.removeEventListener("resize", updateScrollState);
    };
  }, [plan]);

  useEffect(() => {
    if (!plan || !stickToBottomRef.current) return;
    const timer = window.setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [
    plan,
    flow.stage,
    flow.searching,
    flow.requests.length,
    flow.clarificationQuestion,
    flow.notice,
    flow.busy,
    flow.bookings.length,
  ]);

  if (!plan) return null;

  const serviceStage =
    flow.stage === "flight" ||
    flow.stage === "hotel" ||
    flow.stage === "transfer";
  const laneMode = flow.searching
    ? "offchain"
    : flow.stage === "final" || flow.stage === "complete"
      ? "onchain"
      : "human";

  return (
    <>
      <section className="travel-thread" aria-live="polite">
        <div className="travel-thread-inner">
          <div className="travel-trip-context">
            <div>
              <span className="travel-agent-kicker">CURRENT TRIP</span>
              <strong>
                {plan.destination.city} · {plan.destination.country}
              </strong>
              <small data-test="travel-trip-start-date">
                Plan v{plan.version} · {plan.intent.startDate} · {plan.intent.origin} →{" "}
                {plan.intent.destinationAirport} · local draft
              </small>
            </div>
            <div className="travel-trip-context-actions">
              <span className="travel-demo-pill">
                {plan.flightInventorySource === "ATLAS"
                  ? plan.planner === "deepseek"
                    ? "ATLAS LIVE FLIGHTS · LIVE AI · DEMO STAY/RIDE"
                    : "ATLAS LIVE FLIGHTS · DETERMINISTIC FALLBACK · DEMO STAY/RIDE"
                  : plan.planner === "deepseek"
                    ? "DEMO INVENTORY · LIVE AI"
                    : "DEMO INVENTORY · DETERMINISTIC FALLBACK"}
              </span>
              <button
                type="button"
                className="travel-history-trigger"
                onClick={() => flow.setHistoryOpen(true)}
                disabled={flow.bookings.length === 0}
                title={
                  flow.walletConnected
                    ? "Open wallet-scoped booking history"
                    : "Open current session drafts; verified history is wallet-scoped"
                }
              >
                Trips <span>{flow.bookings.length}</span>
              </button>
            </div>
          </div>

          {flow.requests.map((request, index) => (
            <div className="travel-thread-user" key={index + request}>
              <span>You</span>
              <p>{request}</p>
            </div>
          ))}

          {flow.clarificationQuestion ? (
            <div className="travel-thread-agent-note" data-test="travel-clarification-question">
              <span className="travel-cascade-pulse" />
              <p>{flow.clarificationQuestion}</p>
            </div>
          ) : null}

          {flow.notice ? (
            <div className="travel-thread-agent-note">
              <span className="travel-cascade-pulse" />
              <p>{flow.notice}</p>
            </div>
          ) : null}

          <TravelComboSuggestions plan={plan} />
          {flow.stage !== "final" && flow.stage !== "complete" ? (
            <TravelTripGraph flow={flow} />
          ) : null}

          {flow.activeBooking?.needsReview.length ? (
            <div className="travel-review-warning">
              <strong>NEEDS REVIEW</strong>
              <span>
                {flow.activeBooking.needsReview
                  .map((item) => STEP_LABELS[item])
                  .join(" · ")}
              </span>
              <small>
                Upstream change kept the old selection visible for audit, but
                it must be reviewed before final verification.
              </small>
            </div>
          ) : null}

          <div
            ref={currentStepRef}
            className="travel-current-step"
            data-test="travel-current-step"
            data-stage={flow.stage}
          >
            {flow.stage === "complete" ? (
              <CompletedTrip flow={flow} />
            ) : (
              <>
                {flow.stage !== "final" ? (
                  <>
                    <header className="travel-current-step-head">
                      <div>
                        <span className="travel-step-count">
                          STEP {flow.activeStepIndex + 1} OF {STEP_ORDER.length}
                        </span>
                        <h2>{stageTitle(flow.stage)}</h2>
                        <p>{stageCopy(flow.stage)}</p>
                      </div>
                      <div
                        className="travel-step-dots"
                        aria-label={
                          "Step " +
                          (flow.activeStepIndex + 1) +
                          " of " +
                          STEP_ORDER.length
                        }
                      >
                        {STEP_ORDER.map((item, index) => (
                          <i
                            key={item}
                            className={
                              index < flow.activeStepIndex
                                ? "is-done"
                                : index === flow.activeStepIndex
                                  ? "is-active"
                                  : ""
                            }
                          />
                        ))}
                      </div>
                    </header>

                    <TrustLanes mode={laneMode} />
                  </>
                ) : null}

                {flow.searching ? (
                  <div className="travel-stage-search" role="status">
                    <div className="travel-stage-search-orbit">
                      <span />
                      <span />
                      <span />
                    </div>
                    <strong>{flow.searchStatus || "AI is searching…"}</strong>
                    <small>
                      {flow.stage === "flight" &&
                      plan.flightInventorySource === "ATLAS"
                        ? "OFF-CHAIN · AI WORKING · ATLAS LIVE INVENTORY"
                        : "OFF-CHAIN · AI WORKING · DEMO INVENTORY · availability not live"}
                    </small>
                  </div>
                ) : null}

                {!flow.searching && serviceStage ? (
                  <TravelChoiceList
                    flow={flow}
                    stage={flow.stage as ServiceStage}
                  />
                ) : null}

                {flow.stage === "final" ? (
                  <TravelFinalReview flow={flow} />
                ) : null}

                {flow.error ? (
                  <div className="travel-error">{flow.error}</div>
                ) : null}
              </>
            )}
          </div>

          <details className="travel-technical-drawer">
            <summary>Technical provider trace</summary>
            <code>trace root · {plan.traceRootHex}</code>
            {plan.toolCalls.map((call) => (
              <code key={call.id}>
                {call.actor} · {call.provider} · {call.mode} · {call.operation} ·{" "}
                {call.digestHex}
              </code>
            ))}
          </details>
          <div ref={bottomRef} className="travel-thread-bottom-sentinel" />
        </div>
      </section>

      {showScrollButton ? (
        <button
          type="button"
          className="travel-scroll-bottom"
          aria-label="Scroll to latest message"
          onClick={() => {
            stickToBottomRef.current = true;
            setShowScrollButton(false);
            bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
          }}
        >
          ↓
        </button>
      ) : null}

      <div className="travel-composer-dock" data-test="travel-composer-dock">
        <div className="travel-composer-dock-inner">
          <TravelComposer flow={flow} docked />
          <small>
            Enter to send · Shift+Enter for a new line · changes create a new
            auditable version
          </small>
        </div>
      </div>
    </>
  );
}

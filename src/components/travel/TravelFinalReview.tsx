"use client";

import { shortWalletAddress } from "@/components/PhantomWalletControl";

import { STEP_LABELS, short } from "./travel-flow";
import { TravelOnchainApproval } from "./TravelOnchainApproval";
import { TravelWalletControl } from "./TravelWalletControl";
import type { TravelAgentFlowController } from "./useTravelAgentFlow";

export function TravelFinalReview({
  flow,
}: {
  flow: TravelAgentFlowController;
}) {
  const activityNodes =
    flow.plan?.nodes.filter((node) => node.kind === "ACTIVITY") ?? [];
  const activityReserve = activityNodes.reduce(
    (sum, node) => sum + (node.amountUsd ?? 0),
    0,
  );
  const draftBudgetUse = flow.total + activityReserve;

  return (
    <div className="travel-final-review" data-tour="travel-final-review">
      <section className="travel-review-itinerary">
        <header className="travel-review-itinerary-head">
          <div>
            <span>TRIP ITINERARY</span>
            <strong>
              {flow.plan?.destination.city ?? "Trip"} · {flow.plan?.intent.days ?? 0} days
            </strong>
          </div>
          <b>
            ${draftBudgetUse} / ${flow.plan?.intent.budgetUsd ?? draftBudgetUse}
          </b>
        </header>

        <div className="travel-final-timeline">
          {(["flight", "hotel", "transfer"] as const).map((item, index) => {
            const selected = flow.selections[item];
            if (!selected) return null;
            return (
              <div
                className="travel-final-timeline-row"
                data-kind={item}
                key={item}
              >
                <div className="travel-final-timeline-rail">
                  <i>{String(index + 1).padStart(2, "0")}</i>
                  <span />
                </div>
                <div className="travel-final-timeline-copy">
                  <span>{STEP_LABELS[item]}</span>
                  <strong>{selected.title}</strong>
                  <small>{selected.subtitle}</small>
                </div>
                <b>{"$" + selected.amount}</b>
              </div>
            );
          })}

          {flow.plan?.intent.requestedServices.includes("ACTIVITY") ? (
            <div className="travel-final-timeline-row" data-kind="activity">
              <div className="travel-final-timeline-rail">
                <i>04</i>
              </div>
              <div className="travel-final-timeline-copy">
                <span>Activity</span>
                <strong>
                  {activityNodes.length > 0
                    ? `${activityNodes.length} route-compatible plan item${activityNodes.length > 1 ? "s" : ""}`
                    : "Activity plan"}
                </strong>
                <small>Off-chain planning reserve; not provider settlement.</small>
              </div>
              <b>{activityReserve > 0 ? "$" + activityReserve : "Plan"}</b>
            </div>
          ) : null}
        </div>

        <p className="travel-review-chat-hint">
          Muốn đổi lịch, vé, khách sạn hoặc ngân sách? Chỉ cần nói tiếp với AI ở ô chat bên dưới.
        </p>
      </section>

      <div className="travel-final-authority">
        <div>
          <span className="travel-agent-kicker">FINAL AUTHORITY</span>
          <h3>Verify one exact final action</h3>
          <p>
            Planning and revisions stay off-chain. Your wallet verifies only this
            final booking version.
          </p>
        </div>
        <dl>
          <div>
            <dt>Wallet</dt>
            <dd>
              {flow.walletAuthority.address
                ? shortWalletAddress(flow.walletAuthority.address)
                : "Not connected"}
            </dd>
          </div>
          <div>
            <dt>Wallet type</dt>
            <dd>
              {flow.walletAuthority.address
                ? flow.walletAuthority.provider === "email"
                  ? "Email wallet"
                  : flow.walletAuthority.provider === "phantom"
                    ? "Phantom"
                    : "Demo wallet"
                : "—"}
            </dd>
          </div>
          <div>
            <dt>Network</dt>
            <dd>{flow.walletAuthority.address ? "Solana Devnet" : "—"}</dd>
          </div>
          <div>
            <dt>Trip date</dt>
            <dd>{flow.plan?.intent.startDate ?? "—"}</dd>
          </div>
          <div>
            <dt>Exact provider draft</dt>
            <dd>{"$" + flow.total}</dd>
          </div>
          <div>
            <dt>Action digest</dt>
            <dd>
              {flow.finalDigest
                ? short(flow.finalDigest.actionHashHex, 14, 10)
                : "After wallet"}
            </dd>
          </div>
        </dl>
      </div>

      {!flow.walletConnected ? (
        <TravelWalletControl
          compact
          onAuthorityChange={flow.setWalletAuthority}
        />
      ) : null}

      {flow.walletConnected ? (
        flow.finalDigest ? (
          flow.walletAuthority.provider === "demo" ? (
            <div className="travel-contract-write is-demo-complete" data-tour="travel-final-verify">
              <div className="travel-contract-write-head">
                <div>
                  <span>DEMO MODE · LOCAL ONLY</span>
                  <strong>Complete demo booking</strong>
                </div>
                <b>NO CHAIN WRITE</b>
              </div>
              <p>
                Demo Wallet skips Devnet fees, faucet requests and PDA creation.
                The final digest is kept only as local demo evidence.
              </p>
              <dl className="travel-demo-final-summary">
                <div>
                  <dt>Exact amount</dt>
                  <dd>{"$" + flow.finalDigest.total}</dd>
                </div>
                <div>
                  <dt>Action digest</dt>
                  <dd>{short(flow.finalDigest.actionHashHex, 12, 8)}</dd>
                </div>
                <div>
                  <dt>Wallet</dt>
                  <dd>
                    {flow.walletAuthority.address
                      ? shortWalletAddress(flow.walletAuthority.address)
                      : "Demo wallet"}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                className="landing-primary"
                onClick={flow.onDemoComplete}
              >
                Complete demo
              </button>
            </div>
          ) : (
            <div className="travel-contract-write" data-tour="travel-final-verify">
              <div className="travel-contract-write-head">
                <div>
                  <span>ON-CHAIN · SOLANA DEVNET</span>
                  <strong>Verify final AI action</strong>
                </div>
                <b>FINAL ONLY</b>
              </div>
              <p>
                This payload binds the booking version, wallet, provider selections,
                exact amount and trace root.
              </p>
              <TravelOnchainApproval
                key={flow.finalDigest.actionHashHex}
                actionHashHex={flow.finalDigest.actionHashHex}
                amount={flow.finalDigest.total}
                walletAddress={flow.walletAuthority.address}
                walletProvider={flow.walletAuthority.provider}
                label="Verify final AI action"
                onConfirmed={flow.onFinalConfirmed}
              />
            </div>
          )
        ) : (
          <div className="travel-loading">
            Preparing canonical final booking digest…
          </div>
        )
      ) : null}
    </div>
  );
}

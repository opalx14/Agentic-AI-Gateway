"use client";

import { useMemo, useState } from "react";

import type { TravelBookingRecord } from "@/scenarios/travel/booking-history";
import { short } from "./travel-flow";
import { TravelVerificationReceipt } from "./TravelVerificationReceipt";
import type { TravelAgentFlowController } from "./useTravelAgentFlow";

function minutesRemaining(record: TravelBookingRecord) {
  if (!record.expiresAt) return null;
  return Math.max(0, Math.ceil((new Date(record.expiresAt).getTime() - Date.now()) / 60_000));
}

function sourceLabel(source?: "ATLAS" | "DEMO") {
  return source === "ATLAS" ? "LIVE" : "DEMO";
}

function BookingDetail({ record }: { record: TravelBookingRecord }) {
  const activities = record.plan.nodes.filter((node) => node.kind === "ACTIVITY");
  return (
    <div className="travel-history-detail">
      <header>
        <div>
          <span>BOOKING REFERENCE</span>
          <strong>{record.bookingReference ?? "Pending — assigned after verification"}</strong>
        </div>
        <b>{record.lifecycleStatus === "DEMO_COMPLETE" ? "DEMO · NO CHAIN WRITE" : record.verificationStatus === "VERIFIED" ? "PDA VERIFIED" : "NOT VERIFIED"}</b>
      </header>

      <div className="travel-history-combo">
        {record.selectedFlight ? (
          <section>
            <span>Flight · {sourceLabel(record.selectedFlight.source)}</span>
            <strong>{record.selectedFlight.title}</strong>
            <small>{record.selectedFlight.subtitle}</small>
            <b>{"$" + record.selectedFlight.amount}</b>
          </section>
        ) : null}
        {record.selectedHotel ? (
          <section>
            <span>Hotel · DEMO</span>
            <strong>{record.selectedHotel.title}</strong>
            <small>{record.selectedHotel.subtitle}</small>
            <b>{"$" + record.selectedHotel.amount}</b>
          </section>
        ) : null}
        {record.selectedTransfer ? (
          <section>
            <span>Transfer · DEMO</span>
            <strong>{record.selectedTransfer.title}</strong>
            <small>{record.selectedTransfer.subtitle}</small>
            <b>{"$" + record.selectedTransfer.amount}</b>
          </section>
        ) : null}
        {activities.length > 0 ? (
          <section>
            <span>Activities · OFF-CHAIN PLAN</span>
            <strong>{activities.length} planned item{activities.length > 1 ? "s" : ""}</strong>
            <small>No provider settlement claimed.</small>
          </section>
        ) : null}
      </div>

      <div className="travel-history-payment-truth">
        <span>Blockchain authority</span>
        <strong>{record.lifecycleStatus === "DEMO_COMPLETE" ? "DEMO ONLY" : record.verificationStatus === "VERIFIED" ? "VERIFIED" : "NOT SUBMITTED"}</strong>
        <span>Payment / provider settlement</span>
        <strong>{record.paymentStatus === "CONFIRMED" ? "CONFIRMED" : record.paymentStatus === "NOT_ENABLED" ? "NOT ENABLED" : "NOT COMPLETED"}</strong>
      </div>

      {record.lifecycleStatus === "DEMO_COMPLETE" ? (
        <div className="travel-receipt-pending">
          <strong>Demo completed</strong>
          <span>No Solana transaction or PDA was created.</span>
        </div>
      ) : (
        <TravelVerificationReceipt record={record} compact={false} />
      )}
    </div>
  );
}

export function TravelHistoryDrawer({
  flow,
}: {
  flow: TravelAgentFlowController;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => flow.bookings.find((record) => record.id === selectedId) ?? null,
    [flow.bookings, selectedId],
  );

  if (!flow.historyOpen) return null;

  const pending = flow.bookings.filter((record) => record.verificationStatus !== "VERIFIED" && record.lifecycleStatus !== "DEMO_COMPLETE");
  const verified = flow.bookings.filter((record) => record.verificationStatus === "VERIFIED" || record.lifecycleStatus === "DEMO_COMPLETE");

  return (
    <div className="travel-history-backdrop" role="presentation">
      <aside className="travel-history-panel" aria-label="Trip history">
        <div className="travel-history-head">
          <div>
            <span className="travel-agent-kicker">WALLET-SCOPED BOOKING HISTORY</span>
            <h2>Trips / History</h2>
            <p>Pending drafts expire after 1 hour. Verified receipts never use draft TTL cleanup.</p>
          </div>
          <button type="button" onClick={() => flow.setHistoryOpen(false)}>Close</button>
        </div>

        {selected ? (
          <>
            <button type="button" className="travel-history-back" onClick={() => setSelectedId(null)}>← Back to trips</button>
            <BookingDetail record={selected} />
          </>
        ) : (
          <div className="travel-history-groups">
            <section>
              <header><span>ACTIVE / PENDING</span><b>{pending.length}</b></header>
              <div className="travel-history-list">
                {pending.length === 0 ? <div className="travel-history-empty">No pending drafts.</div> : pending.map((record) => {
                  const remaining = minutesRemaining(record);
                  return (
                    <article key={record.id} className="travel-history-card is-pending">
                      <div>
                        <span>PENDING · V{record.version}</span>
                        <strong>{record.destination}</strong>
                        <small>{record.plan.intent.startDate} · {"$" + record.total}</small>
                        <em>Payment not completed · Not on-chain</em>
                        <small>{remaining === null ? "Session draft" : "Expires in " + remaining + " min"}</small>
                      </div>
                      <button type="button" onClick={() => { flow.loadBooking(record); flow.setHistoryOpen(true); setSelectedId(record.id); }}>Continue</button>
                    </article>
                  );
                })}
              </div>
            </section>

            <section>
              <header><span>COMPLETED</span><b>{verified.length}</b></header>
              <div className="travel-history-list">
                {verified.length === 0 ? <div className="travel-history-empty">No completed bookings for this wallet.</div> : verified.map((record) => (
                  <article key={record.id} className={"travel-history-card " + (record.lifecycleStatus === "SUPERSEDED" ? "is-superseded" : "")}>
                    <div>
                      <span>{record.lifecycleStatus === "DEMO_COMPLETE" ? "DEMO COMPLETE" : "VERIFIED"} · V{record.version}</span>
                      <strong>{record.bookingReference ?? record.destination}</strong>
                      <small>{record.destination} · {record.plan.intent.startDate} · {"$" + record.total}</small>
                      {record.lifecycleStatus === "DEMO_COMPLETE" ? (
                        <em>DEMO ONLY · Payment NOT ENABLED</em>
                      ) : (
                        <em>PDA VERIFIED · Payment {record.paymentStatus === "NOT_ENABLED" ? "NOT ENABLED" : record.paymentStatus}</em>
                      )}
                      {record.finalTx ? <small>tx {short(record.finalTx)}</small> : null}
                    </div>
                    <button type="button" onClick={() => setSelectedId(record.id)}>View booking</button>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}

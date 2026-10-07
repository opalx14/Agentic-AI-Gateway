"use client";

import { useState } from "react";

import type { TravelBookingRecord } from "@/scenarios/travel/booking-history";
import { short } from "./travel-flow";

function walletLabel(record: TravelBookingRecord) {
  return record.walletProvider === "email"
    ? "Email wallet"
    : record.walletProvider === "phantom"
      ? "Phantom"
      : record.walletProvider === "demo"
        ? "Demo wallet"
        : "Wallet";
}

export function TravelVerificationReceipt({
  record,
  compact = false,
}: {
  record: TravelBookingRecord;
  compact?: boolean;
}) {
  const [detailsOpen, setDetailsOpen] = useState(!compact);

  if (record.verificationStatus !== "VERIFIED") {
    return (
      <div className="travel-receipt-pending">
        <strong>Final verification</strong>
        <span>Not completed</span>
      </div>
    );
  }

  const steps = [
    ["Final booking digest locked", record.finalActionDigest ? short(record.finalActionDigest, 12, 8) : "—"],
    ["Wallet authority verified", record.walletAddress ? walletLabel(record) + " · " + short(record.walletAddress, 8, 6) : "—"],
    ["Policy checked", record.policyPda ? short(record.policyPda, 8, 6) + " · " + (record.policyState ?? "EXISTING") : "—"],
    ["ActionApproval created", record.approvalPda ? short(record.approvalPda, 8, 6) : "—"],
    ["ActionAuthorization created", record.authorizationPda ? short(record.authorizationPda, 8, 6) : "—"],
    ["Transaction confirmed on Solana Devnet", record.finalTx ? short(record.finalTx, 10, 8) : "—"],
    ["PDA readback verified", "VERIFIED"],
  ] as const;

  return (
    <section className="travel-verification-receipt" data-test="travel-verification-receipt">
      <header>
        <div>
          <span>VERIFIED RECEIPT</span>
          <strong>{record.bookingReference ?? "Confirmed booking"}</strong>
        </div>
        <b>PDA VERIFIED</b>
      </header>

      <div className="travel-receipt-summary">
        <div><span>Booking version</span><strong>V{record.version}</strong></div>
        <div><span>Exact amount</span><strong>{"$" + record.total}</strong></div>
        <div><span>Wallet</span><strong>{walletLabel(record)}{record.walletAddress ? " · " + short(record.walletAddress, 8, 6) : ""}</strong></div>
        <div><span>Network</span><strong>{record.network ?? "Solana Devnet"}</strong></div>
        <div><span>Provider payment</span><strong>NOT ENABLED</strong></div>
      </div>

      <button type="button" className="travel-receipt-toggle" onClick={() => setDetailsOpen((value) => !value)}>
        {detailsOpen ? "Hide verification detail" : "View verification"}
      </button>

      {detailsOpen ? (
        <>
          <div className="travel-verification-timeline">
            {steps.map(([label, value], index) => (
              <div className="travel-verification-step is-verified" key={label}>
                <i>✓</i>
                <div>
                  <span>{index + 1}. {label}</span>
                  <code>{value}</code>
                </div>
              </div>
            ))}
          </div>

          <dl className="travel-receipt-technical">
            <div><dt>Transaction</dt><dd>{record.finalTx ?? "—"}</dd></div>
            <div><dt>Slot</dt><dd>{record.finalSlot ?? "confirmed"}</dd></div>
            <div><dt>Policy PDA</dt><dd>{record.policyPda ?? "—"}</dd></div>
            <div><dt>Approval PDA</dt><dd>{record.approvalPda ?? "—"}</dd></div>
            <div><dt>Authorization PDA</dt><dd>{record.authorizationPda ?? "—"}</dd></div>
          </dl>

          {record.finalExplorerUrl ? (
            <a href={record.finalExplorerUrl} target="_blank" rel="noreferrer">
              View on Solana Explorer ↗
            </a>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

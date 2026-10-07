"use client";

import { useState } from "react";

import type { LogisticsDemoResponse } from "@/scenarios/logistics";

const decisionClass = {
  ALLOW: "border-emerald-300 bg-emerald-50 text-emerald-800",
  BLOCK: "border-red-300 bg-red-50 text-red-800",
  ESCALATE: "border-amber-300 bg-amber-50 text-amber-800",
} as const;

export function LogisticsDemoClient({
  initialData,
}: {
  initialData: LogisticsDemoResponse;
}) {
  const [data, setData] = useState<LogisticsDemoResponse>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(approved: boolean) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/scenarios/logistics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved }),
      });

      const payload = (await response.json()) as
        | LogisticsDemoResponse
        | { error?: string };

      if (!response.ok || !("result" in payload)) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : "Logistics demo request failed.",
        );
      }

      setData(payload);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Logistics demo request failed.",
      );
    } finally {
      setLoading(false);
    }
  }


  const beforeHcm =
    data?.result.before.warehouses.HCM?.inventory["SKU-X"] ?? 50;
  const afterHcm =
    data?.result.after.warehouses.HCM?.inventory["SKU-X"] ?? 50;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-zinc-100 pb-5 sm:flex-row sm:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Live fixture · Logistics
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              HCM stockout recovery
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">
              Inbound shipment is delayed 12 hours. The agent proposes moving
              250 units from Binh Duong to HCM before the 6-hour SLA is missed.
            </p>
          </div>
          <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
            INBOUND_DELAY
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric label="HCM before" value={String(beforeHcm)} suffix="units" />
          <Metric label="HCM after" value={String(afterHcm)} suffix="units" />
          <Metric
            label="Action value"
            value={
              data?.proposal.amount === undefined
                ? "—"
                : "$" + data.proposal.amount.toLocaleString("en-US")
            }
          />
        </div>

        <div className="mt-5 rounded-2xl bg-zinc-950 p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
            Agent proposal
          </p>
          <p className="mt-2 text-lg font-semibold">
            Transfer 250 units · Binh Duong → HCM
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            {data?.proposal.reason ??
              "Rebalance inventory before the delayed inbound shipment causes a stockout."}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void run(false)}
            disabled={loading}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50"
          >
            {loading ? "Running…" : "Run without approval"}
          </button>
          <button
            type="button"
            onClick={() => void run(true)}
            disabled={loading}
            className="rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? "Running…" : "Manager approve & execute"}
          </button>
        </div>

        {error ? (
          <div
            role="alert"
            className="mt-4 border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </div>
        ) : null}

        {data?.result.metrics.stockoutPrevented ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric label="Stockout prevented" value="YES" />
            <Metric label="SLA preserved" value="YES" />
            <Metric
              label="Transferred"
              value={String(data.result.metrics.transferredUnits)}
              suffix="units"
            />
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Deterministic decision
        </p>

        {data ? (
          <>
            <div
              className={
                "mt-4 rounded-2xl border p-5 " +
                decisionClass[data.result.decision.decision]
              }
            >
              <p className="text-4xl font-semibold tracking-tight">
                {data.result.decision.decision}
              </p>
              <p className="mt-2 text-sm leading-6 opacity-80">
                {data.result.decision.reasons.join(" ")}
              </p>
              {data.result.receipt ? (
                <p className="mt-3 font-mono text-xs">
                  receipt: {data.result.receipt.status}
                  {data.result.receipt.providerRef
                    ? " · " + data.result.receipt.providerRef
                    : ""}
                </p>
              ) : null}
            </div>

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Execution trace
              </p>
              <div className="mt-3 space-y-2">
                {data.result.trace.steps.map((step, index) => (
                  <div
                    key={step.name + index}
                    className="flex items-start gap-3 rounded-xl border border-zinc-100 px-3 py-2.5"
                  >
                    <span
                      className={
                        "mt-0.5 h-2.5 w-2.5 rounded-full " +
                        (step.status === "SUCCESS"
                          ? "bg-emerald-500"
                          : step.status === "PENDING"
                            ? "bg-amber-500"
                            : "bg-red-500")
                      }
                    />
                    <div>
                      <p className="font-mono text-xs font-semibold text-zinc-800">
                        {step.name}
                      </p>
                      {step.detail ? (
                        <p className="mt-1 text-xs text-zinc-500">
                          {step.detail}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">Loading demo…</p>
        )}
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-4">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-950">
        {value}
        {suffix ? (
          <span className="ml-1 text-xs font-medium text-zinc-500">
            {suffix}
          </span>
        ) : null}
      </p>
    </div>
  );
}

"use client";

import { useState } from "react";

import type { TravelDemoResponse } from "@/scenarios/travel";

type TravelCase = {
  label: string;
  description: string;
  body: {
    optionId: string;
    approved?: boolean;
    priceChange?: boolean;
  };
};

const cases: TravelCase[] = [
  {
    label: "Option A · +$15",
    description: "Inside $20 autonomous threshold → ALLOW.",
    body: { optionId: "flight-a" },
  },
  {
    label: "Option B · +$45",
    description: "Above auto threshold → ESCALATE.",
    body: { optionId: "flight-b" },
  },
  {
    label: "Approve +$45",
    description: "Exact manager consent → ALLOW + execute.",
    body: { optionId: "flight-b", approved: true },
  },
  {
    label: "$45 → $48",
    description: "Provider re-price invalidates prior approval.",
    body: { optionId: "flight-b", approved: true, priceChange: true },
  },
];

const decisionClass = {
  ALLOW: "border-emerald-300 bg-emerald-50 text-emerald-800",
  BLOCK: "border-red-300 bg-red-50 text-red-800",
  ESCALATE: "border-amber-300 bg-amber-50 text-amber-800",
} as const;

export function TravelDemoClient({
  initialData,
}: {
  initialData: TravelDemoResponse;
}) {
  const [data, setData] = useState<TravelDemoResponse>(initialData);
  const [active, setActive] = useState<string>(cases[0]!.label);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(travelCase: TravelCase) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/scenarios/travel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(travelCase.body),
      });
      const payload = (await response.json()) as
        | TravelDemoResponse
        | { error?: string };

      if (!response.ok || !("result" in payload)) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : "Travel demo request failed.",
        );
      }

      setData(payload);
      setActive(travelCase.label);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Travel demo request failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Travel recovery · Cross-domain proof
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">
          Arrive in Singapore before 17:00
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Emergency budget is $100. The agent may auto-act up to $20; larger
          changes require exact human approval.
        </p>

        <div className="mt-5 space-y-3">
          {cases.map((travelCase) => (
            <button
              key={travelCase.label}
              type="button"
              disabled={loading}
              onClick={() => void run(travelCase)}
              className={
                "w-full rounded-2xl border p-4 text-left transition disabled:opacity-50 " +
                (active === travelCase.label
                  ? "border-zinc-950 bg-zinc-950 text-white"
                  : "border-zinc-200 bg-white hover:border-zinc-400")
              }
            >
              <p className="font-semibold">{travelCase.label}</p>
              <p
                className={
                  "mt-1 text-sm " +
                  (active === travelCase.label
                    ? "text-zinc-400"
                    : "text-zinc-500")
                }
              >
                {travelCase.description}
              </p>
            </button>
          ))}
        </div>

        {error ? (
          <div
            role="alert"
            className="mt-5 border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </div>
        ) : null}

        <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
          Atlas is an optional downstream sandbox adapter. Fixture mode remains
          the default so this demo never depends on external credentials.
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        {data ? (
          <>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Verified action
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {data.result.selectedOptionId} · +$
                  {data.result.verifiedAdditionalCost}
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  Arrival{" "}
                  {new Date(data.result.arrivalAt).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Singapore",
                  })}
                </p>
              </div>
              <span
                className={
                  "rounded-full border px-3 py-1 text-sm font-semibold " +
                  decisionClass[data.result.decision.decision]
                }
              >
                {data.result.decision.decision}
              </span>
            </div>

            {data.verifiedPriceChanged ? (
              <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4">
                <p className="font-semibold text-amber-900">
                  Exact consent invalidated
                </p>
                <p className="mt-1 text-sm leading-6 text-amber-800">
                  Approved +$
                  {data.initialOption.additionalCost}, provider verified +$
                  {data.result.verifiedAdditionalCost}. The old approval cannot
                  be reused.
                </p>
              </div>
            ) : null}

            <div className="mt-5 rounded-2xl bg-zinc-50 p-4">
              <p className="text-sm font-semibold text-zinc-900">
                {data.result.decision.reasons.join(" ")}
              </p>
              {data.result.decision.violatedRules.length > 0 ? (
                <p className="mt-2 font-mono text-xs text-red-600">
                  {data.result.decision.violatedRules.join(", ")}
                </p>
              ) : null}
              {data.result.receipt ? (
                <p className="mt-2 font-mono text-xs text-zinc-500">
                  {data.result.receipt.status}
                  {data.result.receipt.providerRef
                    ? " · " + data.result.receipt.providerRef
                    : ""}
                </p>
              ) : null}
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {data.result.trace.steps.map((step) => (
                <div
                  key={step.name}
                  className="rounded-xl border border-zinc-100 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        "h-2 w-2 rounded-full " +
                        (step.status === "SUCCESS"
                          ? "bg-emerald-500"
                          : step.status === "PENDING"
                            ? "bg-amber-500"
                            : "bg-red-500")
                      }
                    />
                    <p className="font-mono text-xs font-semibold">
                      {step.name}
                    </p>
                  </div>
                  {step.detail ? (
                    <p className="mt-1 text-xs text-zinc-500">
                      {step.detail}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex min-h-96 items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
            <div>
              <p className="text-lg font-semibold text-zinc-800">
                Choose a recovery case
              </p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">
                Each case uses the same deterministic Control Plane as the
                Logistics demo.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

"use client";

import { useState } from "react";

import type { AgenticTripPlan } from "@/scenarios/travel/agentic-types";

function money(value: number) {
  return "$" + Math.round(value);
}

function timeLabel(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function TravelComboSuggestions({
  plan,
}: {
  plan: AgenticTripPlan;
}) {
  const [showAll, setShowAll] = useState(false);
  const combos = plan.recommendedCombos?.slice(0, 3) ?? [];
  const fitIndex = combos.findIndex((combo) => combo.budgetFit);
  const preferredIndex = fitIndex >= 0 ? fitIndex : 0;

  if (combos.length === 0) return null;

  const visibleCombos = showAll ? combos : [combos[preferredIndex]!];
  const services = plan.intent.requestedServices;
  const fullTrip = services.length === 4;

  return (
    <section
      className="travel-combo-suggestions"
      data-test="travel-combo-suggestions"
      data-tour="travel-ai-combo"
    >
      <div className="travel-combo-head">
        <div>
          <span>AI COMBO</span>
          <strong>
            Best {fullTrip ? "whole-trip" : "requested-service"} draft ·{" "}
            {money(plan.intent.budgetUsd)} budget
          </strong>
        </div>
        <small>
          {plan.flightInventorySource === "ATLAS"
            ? plan.planner === "deepseek"
              ? "LIVE FLIGHT · LIVE AI · DEMO HOTEL/RIDE"
              : "LIVE FLIGHT · DETERMINISTIC FALLBACK · DEMO HOTEL/RIDE"
            : plan.planner === "deepseek"
              ? "DEMO INVENTORY · LIVE AI"
              : "DEMO INVENTORY · DETERMINISTIC FALLBACK"}
        </small>
      </div>

      <div className="travel-combo-stack">
        {visibleCombos.map((combo) => {
          const isPreferred = combo.id === combos[preferredIndex]?.id;
          const flight = plan.flightCandidates?.find(
            (candidate) =>
              candidate.id === combo.flightProviderRef ||
              candidate.flightNumber === combo.flightNumber,
          );
          return (
            <article
              key={combo.id + combo.flightProviderRef}
              className={
                "travel-combo-ticket " +
                (isPreferred ? "is-ai-pick " : "") +
                (combo.budgetFit ? "is-fit" : "is-over")
              }
            >
              <header className="travel-combo-ticket-head">
                <div>
                  <span>
                    {isPreferred
                      ? combo.budgetFit
                        ? "AI PICK"
                        : "CLOSEST OPTION"
                      : "ALTERNATIVE"}
                  </span>
                  <strong>
                    {combo.budgetFit ? "Fits your budget" : "Over budget"}
                  </strong>
                </div>
                <div className="travel-combo-ticket-price">
                  <strong>{money(combo.totalUsd)}</strong>
                  <small>of {money(plan.intent.budgetUsd)}</small>
                </div>
              </header>

              <div className="travel-combo-timeline">
                {services.includes("FLIGHT") ? (
                  <div className="travel-combo-stop is-flight">
                    <i>01</i>
                    <div className="travel-combo-stop-main">
                      <span>FLIGHT · {flight?.provider === "atlas" ? "LIVE" : "DEMO"}</span>
                      <strong>
                        {flight?.origin ?? plan.intent.origin} → {flight?.destination ?? plan.intent.destinationAirport}
                      </strong>
                      <small>
                        {combo.flightNumber}
                        {flight?.carrier ? ` · ${flight.carrier}` : ""} · {timeLabel(flight?.departureAt)} → {timeLabel(flight?.arrivalAt)}
                      </small>
                    </div>
                    <b>{money(combo.flightAmountUsd)}</b>
                  </div>
                ) : null}

                {services.includes("STAY") ? (
                  <div className="travel-combo-stop">
                    <i>02</i>
                    <div className="travel-combo-stop-main">
                      <span>STAY · DEMO</span>
                      <strong>{combo.hotelTitle}</strong>
                      <small>
                        {Math.max(1, plan.intent.days - 1)} nights · {combo.hotelTier.toUpperCase()} · destination-local stay
                      </small>
                    </div>
                    <b>{money(combo.hotelAmountUsd)}</b>
                  </div>
                ) : null}

                {services.includes("TRANSFER") ? (
                  <div className="travel-combo-stop">
                    <i>03</i>
                    <div className="travel-combo-stop-main">
                      <span>AIRPORT RIDE · DEMO</span>
                      <strong>Arrival-aware transfer</strong>
                      <small>Re-timed when arrival changes</small>
                    </div>
                    <b>{money(combo.transferAmountUsd)}</b>
                  </div>
                ) : null}

                {services.includes("ACTIVITY") ? (
                  <div className="travel-combo-stop">
                    <i>04</i>
                    <div className="travel-combo-stop-main">
                      <span>ACTIVITIES · PLAN</span>
                      <strong>Route-compatible activities</strong>
                      <small>Budget reserve, not provider settlement</small>
                    </div>
                    <b>{money(combo.activitiesAmountUsd)}</b>
                  </div>
                ) : null}
              </div>

              <footer className="travel-combo-ticket-foot">
                <p>{combo.rationale}</p>
                <span>
                  {combo.budgetFit
                    ? `${money(combo.remainingBudgetUsd)} remaining`
                    : "Needs budget change"}
                </span>
              </footer>
            </article>
          );
        })}
      </div>

      {combos.length > 1 ? (
        <button
          type="button"
          className="travel-combo-more"
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll
            ? "Show AI pick only"
            : `Compare ${combos.length - 1} alternative${combos.length > 2 ? "s" : ""}`}
        </button>
      ) : null}
    </section>
  );
}

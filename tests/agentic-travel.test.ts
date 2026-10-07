import { describe, expect, test } from "bun:test";

import {
  modifyAgenticTrip,
  planAgenticTrip,
  sha256Hex,
} from "@/scenarios/travel/agentic-orchestrator";
import { POST } from "@/app/api/scenarios/travel/agent/route";
import { flightReplacementNodes } from "@/scenarios/travel/agentic-modifiers";
import { flightReplacementSatisfiesRequest } from "@/scenarios/travel/agentic-flight-planning";
import { deterministicChangeIntent, fixtureIntent } from "@/scenarios/travel/agentic-intent";

const tokyoPrompt =
  "Plan me a 4-day Tokyo trip from Ho Chi Minh City. I like local food, culture and walkable neighborhoods. Budget $1,200.";

describe("whole-trip travel agent", () => {
  test("scoped $300 prompt composes only flight + hotel against that budget", async () => {
    const prompt =
      "Tôi có 300$, cần vé máy bay và khách sạn ở Bangkok. Đề xuất combo phù hợp.";
    const intent = fixtureIntent(prompt, "SGN");

    expect(intent.budgetUsd).toBe(300);
    expect(intent.requestedServices).toEqual(["FLIGHT", "STAY"]);

    const plan = await planAgenticTrip({
      prompt,
      planner: "fixture",
      mode: "demo",
      origin: "SGN",
    });

    expect(plan.intent.requestedServices).toEqual(["FLIGHT", "STAY"]);
    expect(plan.nodes.some((node) => node.kind === "FLIGHT")).toBe(true);
    expect(plan.nodes.some((node) => node.kind === "STAY")).toBe(true);
    expect(plan.nodes.some((node) => node.kind === "TRANSFER")).toBe(false);
    expect(plan.nodes.some((node) => node.kind === "ACTIVITY")).toBe(false);
    expect(plan.recommendedCombos?.[0]?.transferAmountUsd).toBe(0);
    expect(plan.recommendedCombos?.[0]?.activitiesAmountUsd).toBe(0);
    expect(plan.recommendedCombos?.[0]?.totalUsd).toBeLessThanOrEqual(300);
  });

  test("Tokyo prompt builds the whole trip graph", async () => {
    const plan = await planAgenticTrip({
      prompt: tokyoPrompt,
      planner: "fixture",
      mode: "demo",
    });

    expect(plan.destination.city).toBe("Tokyo");
    expect(new Set(plan.nodes.map((node) => node.kind))).toEqual(
      new Set(["FLIGHT", "TRANSFER", "STAY", "ACTIVITY", "COMMITMENT"]),
    );
    expect(plan.toolCalls.every((call) => /^[a-f0-9]{64}$/.test(call.digestHex))).toBe(true);
    expect(plan.traceRootHex).toMatch(/^[a-f0-9]{64}$/);
    expect(plan.actionDigestHex).toMatch(/^[a-f0-9]{64}$/);
    expect(plan.paymentRails.find((rail) => rail.id === "provider")?.status).toBe("NOT_ENABLED");
    expect(plan.paymentRails.find((rail) => rail.id === "usdc")?.status).toBe("NOT_ENABLED");
    expect(plan.authority.decision).toBe("ESCALATE");
  });

  test("stable hash is deterministic and action digest changes after re-plan", async () => {
    expect(sha256Hex({ b: 2, a: 1 })).toBe(sha256Hex({ a: 1, b: 2 }));

    const plan = await planAgenticTrip({
      prompt: tokyoPrompt,
      planner: "fixture",
      mode: "demo",
    });
    const changed = await modifyAgenticTrip({
      currentPlan: plan,
      prompt: "My flight is delayed 6 hours.",
    });

    expect(changed.version).toBe(plan.version + 1);
    expect(changed.actionDigestHex).not.toBe(plan.actionDigestHex);
    expect(changed.traceRootHex).not.toBe(plan.traceRootHex);
    expect(changed.nodes.find((node) => node.id === "flight-out")?.status).toBe("REPLANNED");
    expect(changed.nodes.find((node) => node.id === "airport-transfer")?.status).toBe("REPLANNED");
    expect(changed.nodes.find((node) => node.kind === "ACTIVITY")?.status).toBe("REPLANNED");
    expect(changed.nodes.find((node) => node.kind === "COMMITMENT")?.status).toBe("REPLANNED");
    expect(changed.consequence.commitmentPreserved).toBe(true);
    expect(changed.consequence.summary).toContain("downstream items changed");
  });

  test("rescheduling by prompt moves the canonical trip date and downstream graph", async () => {
    const plan = await planAgenticTrip({
      prompt: tokyoPrompt,
      planner: "fixture",
      mode: "demo",
    });
    const originalActivity = plan.nodes.find((node) => node.kind === "ACTIVITY");

    const changed = await modifyAgenticTrip({
      currentPlan: plan,
      prompt: "Đổi lịch chuyến đi sang 15/11/2026 và tính lại toàn bộ combo.",
    });

    expect(changed.version).toBe(plan.version + 1);
    expect(changed.intent.startDate).toBe("2026-11-15");
    expect(changed.nodes.find((node) => node.kind === "FLIGHT")?.startAt).toContain(
      "2026-11-15",
    );
    expect(changed.nodes.find((node) => node.kind === "STAY")?.status).toBe(
      "REPLANNED",
    );
    expect(changed.nodes.find((node) => node.kind === "ACTIVITY")?.startAt).not.toBe(
      originalActivity?.startAt,
    );
    expect(changed.nodes.find((node) => node.kind === "COMMITMENT")?.status).toBe(
      "REPLANNED",
    );
    expect(changed.actionDigestHex).not.toBe(plan.actionDigestHex);
  });

  test("budget increase recomputes a more comfortable combo", async () => {
    const plan = await planAgenticTrip({
      prompt: tokyoPrompt,
      planner: "fixture",
      mode: "demo",
    });

    const changed = await modifyAgenticTrip({
      currentPlan: plan,
      prompt: "Tăng ngân sách lên $1500 và chọn combo thoải mái hơn",
    });

    expect(changed.version).toBe(plan.version + 1);
    expect(changed.intent.budgetUsd).toBe(1500);
    expect(changed.intent.startDate).toBe(plan.intent.startDate);
    expect(changed.recommendedCombos?.[0]?.hotelTier).toBe("premium");
    expect(changed.nodes.find((node) => node.kind === "STAY")?.status).toBe(
      "REPLANNED",
    );
  });

  test("budget increase recomputes the stay and combo instead of keeping stale recommendations", async () => {
    const plan = await planAgenticTrip({
      prompt: tokyoPrompt,
      planner: "fixture",
      mode: "demo",
    });
    const previousStay = plan.nodes.find((node) => node.kind === "STAY");

    const changed = await modifyAgenticTrip({
      currentPlan: plan,
      prompt: "Tăng ngân sách lên $1500 và chọn combo thoải mái hơn",
    });

    expect(changed.version).toBe(plan.version + 1);
    expect(changed.intent.budgetUsd).toBe(1500);
    expect(changed.intent.delegatedBudgetUsd).toBe(1200);
    expect(changed.nodes.find((node) => node.kind === "STAY")?.status).toBe(
      "REPLANNED",
    );
    expect(changed.nodes.find((node) => node.kind === "STAY")?.providerRef).toContain(
      ":premium",
    );
    expect(changed.nodes.find((node) => node.kind === "STAY")?.amountUsd).toBeGreaterThanOrEqual(
      previousStay?.amountUsd ?? 0,
    );
    expect(changed.recommendedCombos?.[0]?.budgetFit).toBe(true);
    expect(changed.recommendedCombos?.[0]?.hotelTier).toBe("premium");
  });

  test("targeted changes re-plan the correct dependency branch", async () => {
    const plan = await planAgenticTrip({
      prompt: tokyoPrompt,
      planner: "fixture",
      mode: "demo",
    });

    const hotelChange = await modifyAgenticTrip({
      currentPlan: plan,
      prompt: "Change my hotel to a quieter neighborhood.",
    });
    expect(hotelChange.nodes.find((node) => node.kind === "STAY")?.status).toBe(
      "REPLANNED",
    );
    expect(
      hotelChange.nodes.find((node) => node.kind === "ACTIVITY")?.status,
    ).toBe("AFFECTED");
    expect(
      hotelChange.nodes.find((node) => node.kind === "FLIGHT")?.status,
    ).toBe("PLANNED");

    const delay = await modifyAgenticTrip({
      currentPlan: plan,
      prompt: "My flight is delayed 3 hours.",
    });
    expect(delay.nodes.find((node) => node.id === "flight-out")?.consequence).toBe(
      "Arrival shifted by +3h.",
    );
  });

  test("prompt reschedule changes canonical trip date and downstream itinerary", async () => {
    const plan = await planAgenticTrip({
      prompt: tokyoPrompt,
      planner: "fixture",
      mode: "demo",
    });
    const changed = await modifyAgenticTrip({
      currentPlan: plan,
      prompt: "Đổi lịch chuyến đi sang 2026-11-10.",
    });

    expect(changed.version).toBe(plan.version + 1);
    expect(changed.intent.startDate).toBe("2026-11-10");
    expect(changed.nodes.find((node) => node.kind === "FLIGHT")?.startAt).toContain("2026-11-10");
    expect(changed.nodes.find((node) => node.kind === "STAY")?.status).toBe("REPLANNED");
    expect(changed.nodes.find((node) => node.kind === "ACTIVITY")?.startAt).not.toBe(
      plan.nodes.find((node) => node.kind === "ACTIVITY")?.startAt,
    );
    expect(changed.actionDigestHex).not.toBe(plan.actionDigestHex);
  });

  test("reschedule prompt moves the canonical whole-trip dates and creates a new version", async () => {
    const plan = await planAgenticTrip({
      prompt: tokyoPrompt,
      planner: "fixture",
      mode: "demo",
    });
    const oldActivity = plan.nodes.find((node) => node.kind === "ACTIVITY");
    const change = deterministicChangeIntent(
      "Đổi lịch chuyến đi sang 2026-11-10 và tính lại toàn bộ combo",
    );

    expect(change.target).toBe("SCHEDULE");
    expect(change.newStartDate).toBe("2026-11-10");

    const revised = await modifyAgenticTrip({
      currentPlan: plan,
      prompt: "Đổi lịch chuyến đi sang 2026-11-10 và tính lại toàn bộ combo",
    });

    expect(revised.version).toBe(plan.version + 1);
    expect(revised.intent.startDate).toBe("2026-11-10");
    expect(revised.nodes.find((node) => node.kind === "FLIGHT")?.startAt).toContain(
      "2026-11-10",
    );
    expect(revised.nodes.find((node) => node.kind === "STAY")?.status).toBe(
      "REPLANNED",
    );
    expect(revised.nodes.find((node) => node.kind === "ACTIVITY")?.startAt).not.toBe(
      oldActivity?.startAt,
    );
    expect(revised.actionDigestHex).not.toBe(plan.actionDigestHex);
  });

  test("provider replacement flight becomes the canonical graph branch", async () => {
    const plan = await planAgenticTrip({
      prompt: tokyoPrompt,
      planner: "fixture",
      mode: "demo",
    });
    const replaced = flightReplacementNodes(plan, {
      flightNumber: "JL752",
      departureAt: "2026-11-07T05:00:00+07:00",
      arrivalAt: "2026-11-07T13:00:00+09:00",
      amountUsd: 344,
      provider: "Atlas",
      source: "ATLAS",
      providerRef: "atlas-offer-jl752",
    });

    const flight = replaced.find((node) => node.kind === "FLIGHT");
    expect(flight?.subtitle).toBe("JL752");
    expect(flight?.provider).toBe("Atlas");
    expect(flight?.providerRef).toBe("atlas-offer-jl752");
    expect(flight?.status).toBe("REPLANNED");
    expect(replaced.find((node) => node.kind === "TRANSFER")?.status).toBe(
      "REPLANNED",
    );
  });

  test("flight change intent wins over preserved hotel/date/budget mentions", () => {
    const change = deterministicChangeIntent(
      "Tìm chuyến bay khác nhưng giữ nguyên hotel, trip date và budget",
    );

    expect(change.target).toBe("FLIGHT");
    expect(change.kind).toBe("REPLACE");
  });

  test("flight replacement constraints reject a same-time direct offer for a later request", async () => {
    expect(
      flightReplacementSatisfiesRequest({
        prompt: "Change my flight to a later direct option.",
        currentFlight: {
          subtitle: "VJ960",
          startAt: "2026-11-07T01:45:00+07:00",
          amountUsd: 179.4,
        },
        flight: {
          provider: "Atlas",
          source: "ATLAS",
          flightNumber: "VJ960",
          departureAt: "2026-11-07T01:45:00+07:00",
          arrivalAt: "2026-11-07T07:55:00+09:00",
          amountUsd: 179.4,
          providerRef: "off-new-vj960",
          optionCount: 2,
          options: [
            {
              id: "off-new-vj960",
              provider: "atlas",
              flightNumber: "VJ960",
              origin: "HAN",
              destination: "ICN",
              departureAt: "2026-11-07T01:45:00+07:00",
              arrivalAt: "2026-11-07T07:55:00+09:00",
              total: 179.4,
              additionalCost: 179.4,
              currency: "USD",
              expiresAt: 1_900_000_000_000,
              stops: 0,
            },
          ],
          flightRankingSource: "DEEPSEEK",
          flightRankingReasons: {},
        },
      }),
    ).toBe(false);
  });

  test("API accepts plan and rejects invalid payload", async () => {
    const good = await POST(new Request("http://local/api/scenarios/travel/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "plan", prompt: tokyoPrompt, planner: "fixture", mode: "demo" }),
    }));
    expect(good.status).toBe(200);

    const bad = await POST(new Request("http://local/api/scenarios/travel/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "modify", prompt: "delay" }),
    }));
    expect(bad.status).toBe(400);
  });

  test("DeepSeek live-preferred planning falls back truthfully when the model is unavailable", async () => {
    const previous = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    try {
      const plan = await planAgenticTrip({
        prompt: tokyoPrompt,
        planner: "deepseek",
        mode: "live-preferred",
      });

      expect(plan.planner).toBe("fixture");
      expect(plan.plannerModel).toContain("fallback");
      expect(
        plan.toolCalls.some(
          (call) =>
            call.provider === "DeepSeek" && call.status === "FAILED",
        ),
      ).toBe(true);
      expect(
        plan.toolCalls.some(
          (call) =>
            call.provider === "Deterministic liaison" && call.status === "SUCCESS",
        ),
      ).toBe(true);
    } finally {
      if (previous) process.env.DEEPSEEK_API_KEY = previous;
    }
  });

  test("DeepSeek without configuration fails closed outside live-preferred mode", async () => {
    const previous = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    try {
      await expect(planAgenticTrip({
        prompt: tokyoPrompt,
        planner: "deepseek",
        mode: "demo",
      })).rejects.toThrow("DEEPSEEK_API_KEY is not configured.");
    } finally {
      if (previous) process.env.DEEPSEEK_API_KEY = previous;
    }
  });
});

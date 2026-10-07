import { z } from "zod";

import { createDeepSeekProviderFromEnv } from "@/providers/ai/deepseek";

import {
  DESTINATION_VISUALS,
  destinationByAirport,
  destinationFromPrompt,
} from "./agentic-fixtures";
import type {
  AgenticTripPlan,
  TravelAgentIntent,
  TravelChangeIntent,
  TravelServiceKind,
} from "./agentic-types";

const DEFAULT_START_DATE = "2026-11-07";
const DEFAULT_ORIGIN = "SGN";

const intentPayloadSchema = z.object({
  origin: z.string().min(3).max(3),
  destinationAirport: z.string().min(3).max(3),
  days: z.number().int().min(1).max(14),
  travelers: z.number().int().min(1).max(8),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  budgetUsd: z.number().finite().positive().max(25_000),
  goal: z.string().min(1).max(280),
});

const changePayloadSchema = z.object({
  target: z.enum(["FLIGHT", "STAY", "TRANSFER", "ACTIVITY", "SCHEDULE", "GENERAL"]),
  kind: z.enum(["DELAY", "REPLACE", "PREFERENCE"]),
  delayMinutes: z.number().int().min(1).max(1_440).optional(),
  newStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  request: z.string().min(1).max(280),
  summary: z.string().min(1).max(280),
});

function readNumber(prompt: string, pattern: RegExp, fallback: number) {
  const hit = pattern.exec(prompt);
  return hit?.[1] ? Number(hit[1].replace(/,/g, "")) : fallback;
}

function readBudget(prompt: string, fallback: number) {
  const patterns = [
    /(?:budget|ngân sách|ngan sach|tôi có|toi co|i have)\s*(?:is|là|la|:)?\s*\$?\s*([\d,]+)\s*\$?/i,
    /\$\s*([\d,]+)/,
    /([\d,]+)\s*\$/,
  ];
  for (const pattern of patterns) {
    const hit = pattern.exec(prompt);
    if (hit?.[1]) return Number(hit[1].replace(/,/g, ""));
  }
  return fallback;
}

export function inferRequestedServices(prompt: string): TravelServiceKind[] {
  const normalized = prompt.toLowerCase();
  const mentioned: TravelServiceKind[] = [];

  if (/flight|airline|airfare|vé máy bay|ve may bay|chuyến bay|chuyen bay/.test(normalized)) {
    mentioned.push("FLIGHT");
  }
  if (/hotel|stay|room|accommodation|khách sạn|khach san|phòng|phong/.test(normalized)) {
    mentioned.push("STAY");
  }
  if (/transfer|airport ride|taxi|car|shuttle|đưa đón|dua don|xe sân bay|xe san bay/.test(normalized)) {
    mentioned.push("TRANSFER");
  }
  if (/activity|activities|tour|museum|food|culture|place|tham quan|đi chơi|di choi|ăn uống|an uong/.test(normalized)) {
    mentioned.push("ACTIVITY");
  }

  const explicitlyScoped =
    /(?:only|just|chỉ|chi)/.test(normalized) ||
    (mentioned.includes("FLIGHT") &&
      mentioned.includes("STAY") &&
      !/whole trip|full trip|entire trip|trọn chuyến|tron chuyen/.test(normalized));

  if (explicitlyScoped && mentioned.length > 0) {
    return Array.from(new Set(mentioned));
  }

  if (mentioned.length === 1 && !/plan|trip|chuyến đi|chuyen di/.test(normalized)) {
    return mentioned;
  }

  return ["FLIGHT", "STAY", "TRANSFER", "ACTIVITY"];
}

export function fixtureIntent(
  prompt: string,
  originOverride?: string,
): TravelAgentIntent {
  const destination = destinationFromPrompt(prompt);
  const days = readNumber(prompt, /(\d+)\s*(?:ngày|day|days)/i, 4);
  const travelers = readNumber(
    prompt,
    /(\d+)\s*(?:người|traveler|travelers|people)/i,
    1,
  );
  const budgetUsd = readBudget(
    prompt,
    destination.key === "tokyo" ? 1_200 : 900,
  );

  return {
    origin: (originOverride ?? DEFAULT_ORIGIN).toUpperCase(),
    destination: destination.city,
    destinationAirport: destination.airportCode,
    startDate: DEFAULT_START_DATE,
    days: Math.max(1, Math.min(14, days)),
    travelers: Math.max(1, Math.min(8, travelers)),
    goal: prompt.trim() || "Plan a " + destination.city + " trip",
    requestedServices: inferRequestedServices(prompt),
    budgetUsd,
    delegatedBudgetUsd: Math.max(200, Math.round(budgetUsd * 0.8)),
    autoApproveUsd: 200,
  };
}

function hasExplicitFlightChange(prompt: string) {
  return (
    /(?:find|search|tìm|tim|change|replace|đổi|doi)[^.\n]{0,48}(?:flight|airline|vé máy bay|ve may bay|chuyến bay|chuyen bay)/i.test(
      prompt,
    ) ||
    /(?:flight|airline|vé máy bay|ve may bay|chuyến bay|chuyen bay)[^.\n]{0,40}(?:another|different|khác|khac|replace|đổi|doi)/i.test(
      prompt,
    )
  );
}

export function deterministicChangeIntent(
  prompt: string,
): TravelChangeIntent {
  const delayMatch = /(\d+)\s*(?:h|hr|hrs|hour|hours|giờ|gio)/i.exec(prompt);
  const isDelay =
    /delay|delayed|late|trễ|tre|chậm|cham/i.test(prompt) || !!delayMatch;
  const isoDateMatch = /\b(20\d{2})-(\d{2})-(\d{2})\b/.exec(prompt);
  const slashDateMatch = /\b(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2})\b/.exec(prompt);
  const newStartDate = isoDateMatch
    ? isoDateMatch[0]
    : slashDateMatch
      ? slashDateMatch[3] + "-" + slashDateMatch[2]!.padStart(2, "0") + "-" + slashDateMatch[1]!.padStart(2, "0")
      : undefined;
  const scheduleChange = /reschedule|move (?:my )?trip|change (?:my )?(?:trip )?date|đổi lịch|doi lich|đổi ngày|doi ngay|dời lịch|dời ngày|dời chuyến đi|doi chuyen di/i.test(prompt) || !!newStartDate;
  const explicitFlightChange = hasExplicitFlightChange(prompt);
  const target =
    scheduleChange
      ? "SCHEDULE"
      : explicitFlightChange
        ? "FLIGHT"
        : /hotel|stay|room|phòng|khách sạn|khach san/i.test(prompt)
      ? "STAY"
      : /ride|transfer|taxi|car|train|airport transport|xe|đưa đón|dua don/i.test(prompt)
        ? "TRANSFER"
        : /activity|activities|place|places|food|museum|cafe|café|temple|tour|đi chơi|tham quan|ăn|an /i.test(prompt)
          ? "ACTIVITY"
          : /flight|airline|airport|bay|chuyến bay|chuyen bay|delay|late|trễ|tre|chậm|cham/i.test(prompt)
            ? "FLIGHT"
            : "GENERAL";
  const delayMinutes = isDelay
    ? Math.max(1, Number(delayMatch?.[1] ?? 6) * 60)
    : undefined;

  return {
    target: isDelay ? "FLIGHT" : target,
    newStartDate: scheduleChange ? newStartDate : undefined,
    kind: isDelay
      ? "DELAY"
      : /change|replace|đổi|doi|khác|khac/i.test(prompt)
        ? "REPLACE"
        : "PREFERENCE",
    delayMinutes,
    request: prompt.trim(),
    summary: isDelay
      ? "Flight timing changed by " + delayMinutes + " minutes."
      : scheduleChange
        ? "Traveller requested a trip schedule change" + (newStartDate ? " to " + newStartDate : "") + "."
        : "Traveller requested a " + target.toLowerCase() + " change.",
    source: "DETERMINISTIC",
  };
}

export async function deepSeekIntent(
  prompt: string,
): Promise<{ intent: TravelAgentIntent; model: string }> {
  const provider = createDeepSeekProviderFromEnv();
  const plan = await provider.plan({
    scenarioId: "whole-trip-agent-booking",
    goal: prompt,
    context: {
      today: "2026-09-29",
      defaultOrigin: DEFAULT_ORIGIN,
      defaultStartDate: DEFAULT_START_DATE,
      supportedDemoDestinations: DESTINATION_VISUALS.map((item) => ({
        city: item.city,
        airportCode: item.airportCode,
      })),
      expectedPayloadShape: {
        origin: "IATA code",
        destinationAirport: "IATA code",
        days: "integer 1..14",
        travelers: "integer 1..8",
        startDate: "YYYY-MM-DD",
        budgetUsd: "number",
        goal: "short traveller goal",
      },
    },
    allowedActionTypes: ["trip.compose"],
    allowedResources: ["whole-trip"],
  });

  const action = plan.actions[0];
  const parsed = intentPayloadSchema.parse(action?.payload ?? {});
  const destination = destinationByAirport(parsed.destinationAirport);

  return {
    intent: {
      ...parsed,
      origin: parsed.origin.toUpperCase(),
      destination: destination.city,
      requestedServices: inferRequestedServices(prompt),
      destinationAirport: destination.airportCode,
      delegatedBudgetUsd: Math.max(
        200,
        Math.round(parsed.budgetUsd * 0.8),
      ),
      autoApproveUsd: 200,
    },
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-flash",
  };
}

export async function deepSeekChangeIntent(
  prompt: string,
  currentPlan: AgenticTripPlan,
): Promise<TravelChangeIntent> {
  const provider = createDeepSeekProviderFromEnv();
  const plan = await provider.plan({
    scenarioId: "whole-trip-agent-change",
    goal: prompt,
    context: {
      destination: currentPlan.destination.city,
      currentVersion: currentPlan.version,
      currentTripGoal: currentPlan.intent.goal,
      currentNodes: currentPlan.nodes.map((node) => ({
        id: node.id,
        kind: node.kind,
        title: node.title,
        startAt: node.startAt,
        endAt: node.endAt,
        status: node.status,
      })),
      expectedPayloadShape: {
        target: "FLIGHT | STAY | TRANSFER | ACTIVITY | SCHEDULE | GENERAL",
        kind: "DELAY | REPLACE | PREFERENCE",
        delayMinutes: "positive integer only for a flight delay",
        newStartDate: "YYYY-MM-DD only when the traveller changes the trip date",
        request: "normalized traveller request",
        summary: "one concise sentence describing the requested change",
      },
      rules: [
        "Use STAY for hotel/accommodation changes.",
        "Use TRANSFER for airport ride/taxi/train changes.",
        "Use ACTIVITY for places, food, museum, cafe, tour or itinerary stop changes.",
        "Use FLIGHT for airline, flight, departure or arrival changes.",
        "Use SCHEDULE when the traveller changes the trip start date or asks to reschedule the whole trip.",
        "When SCHEDULE includes a concrete date, return that exact date in newStartDate.",
        "If the traveller states a delay duration, return that exact duration in minutes.",
      ],
    },
    allowedActionTypes: ["trip.modify"],
    allowedResources: ["whole-trip"],
  });

  const action = plan.actions[0];
  const parsed = changePayloadSchema.parse(action?.payload ?? {});
  const deterministic = deterministicChangeIntent(prompt);
  const explicitSchedule =
    deterministic.target === "SCHEDULE" && !!deterministic.newStartDate;
  const explicitFlight = hasExplicitFlightChange(prompt);

  return {
    ...parsed,
    kind: explicitSchedule || explicitFlight ? "REPLACE" : parsed.kind,
    newStartDate: explicitSchedule
      ? deterministic.newStartDate
      : parsed.target === "SCHEDULE"
        ? (parsed.newStartDate ?? deterministic.newStartDate)
        : parsed.newStartDate,
    target:
      parsed.kind === "DELAY"
        ? "FLIGHT"
        : explicitSchedule
          ? "SCHEDULE"
          : explicitFlight
            ? "FLIGHT"
            : parsed.target,
    summary: explicitSchedule ? deterministic.summary : parsed.summary,
    source: "DEEPSEEK",
  };
}

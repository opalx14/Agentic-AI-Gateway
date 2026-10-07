import { describe, expect, test } from "bun:test";

import {
  assessTravelIntake,
  mergeTravelIntakeAnswer,
  travelChangeClarification,
} from "@/scenarios/travel/travel-intake";
import { DEMO_PROMPTS } from "@/components/travel/travel-flow";

describe("travel conversational intake", () => {
  test("asks for missing timing and budget before planning", () => {
    const assessment = assessTravelIntake("Tôi muốn đi Tokyo");

    expect(assessment.complete).toBe(false);
    expect(assessment.missing).toEqual(["startDate", "duration", "budget"]);
    expect(assessment.question).toContain("ngày khởi hành");
    expect(assessment.question).toContain("ngân sách");
  });

  test("accepts a complete trip request", () => {
    const assessment = assessTravelIntake(
      "Đi Singapore từ 2026-11-15 trong 4 ngày, budget $900",
    );

    expect(assessment.complete).toBe(true);
    expect(assessment.missing).toEqual([]);
  });

  test("all demo prompts are complete enough to plan immediately", () => {
    for (const item of DEMO_PROMPTS) {
      const assessment = assessTravelIntake(item.prompt);
      expect(assessment.complete).toBe(true);
      expect(assessment.missing).toEqual([]);
    }
  });

  test("asks for missing details on an ambiguous change request", () => {
    expect(travelChangeClarification("Đổi lịch chuyến đi")).toBe("Bạn muốn đổi sang ngày nào?");
    expect(travelChangeClarification("Đổi lịch chuyến đi sang 2026-11-20")).toBeNull();
    expect(travelChangeClarification("Đổi ngân sách")).toContain("bao nhiêu USD");
    expect(travelChangeClarification("Đổi ngân sách lên $1500")).toBeNull();
  });

  test("normalizes a one-slot budget answer into the accumulated request", () => {
    const merged = mergeTravelIntakeAnswer({
      current: "Tokyo starting 2026-11-15 for 4 days",
      answer: "1200",
      missing: ["budget"],
    });

    expect(merged).toContain("Budget $1200");
    expect(assessTravelIntake(merged).complete).toBe(true);
  });
});

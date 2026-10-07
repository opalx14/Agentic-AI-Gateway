import { describe, expect, test } from "bun:test";

import { POST as postLogistics } from "../../src/app/api/scenarios/logistics/route";
import { POST as postTravel } from "../../src/app/api/scenarios/travel/route";

function jsonRequest(url: string, value: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
}

describe("scenario demo API validation", () => {
  test("Logistics defaults to escalation without approval", async () => {
    const response = await postLogistics(
      jsonRequest("http://localhost/api/scenarios/logistics", {}),
    );
    const body = (await response.json()) as {
      result: { decision: { decision: string } };
    };

    expect(response.status).toBe(200);
    expect(body.result.decision.decision).toBe("ESCALATE");
  });

  test("Logistics exact boolean approval permits execution", async () => {
    const response = await postLogistics(
      jsonRequest("http://localhost/api/scenarios/logistics", {
        approved: true,
      }),
    );
    const body = (await response.json()) as {
      result: {
        decision: { decision: string };
        receipt?: { status: string };
      };
    };

    expect(response.status).toBe(200);
    expect(body.result.decision.decision).toBe("ALLOW");
    expect(body.result.receipt?.status).toBe("EXECUTED");
  });

  test("Logistics rejects truthy non-boolean approval input", async () => {
    const response = await postLogistics(
      jsonRequest("http://localhost/api/scenarios/logistics", {
        approved: "yes",
      }),
    );

    expect(response.status).toBe(400);
  });

  test("Logistics rejects malformed JSON", async () => {
    const response = await postLogistics(
      new Request("http://localhost/api/scenarios/logistics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
  });

  test("Travel rejects unknown option ids", async () => {
    const response = await postTravel(
      jsonRequest("http://localhost/api/scenarios/travel", {
        optionId: "flight-invented",
      }),
    );

    expect(response.status).toBe(400);
  });

  test("Travel Option A remains inside delegated authority", async () => {
    const response = await postTravel(
      jsonRequest("http://localhost/api/scenarios/travel", {
        optionId: "flight-a",
      }),
    );
    const body = (await response.json()) as {
      result: {
        decision: { decision: string };
        receipt?: { status: string };
      };
    };

    expect(response.status).toBe(200);
    expect(body.result.decision.decision).toBe("ALLOW");
    expect(body.result.receipt?.status).toBe("EXECUTED");
  });

  test("Travel Option B requires exact boolean approval", async () => {
    const invalid = await postTravel(
      jsonRequest("http://localhost/api/scenarios/travel", {
        optionId: "flight-b",
        approved: "true",
      }),
    );

    expect(invalid.status).toBe(400);

    const approved = await postTravel(
      jsonRequest("http://localhost/api/scenarios/travel", {
        optionId: "flight-b",
        approved: true,
      }),
    );
    const body = (await approved.json()) as {
      result: {
        decision: { decision: string };
        receipt?: { status: string };
      };
    };

    expect(approved.status).toBe(200);
    expect(body.result.decision.decision).toBe("ALLOW");
    expect(body.result.receipt?.status).toBe("EXECUTED");
  });

  test("Travel quote change invalidates an old exact approval", async () => {
    const response = await postTravel(
      jsonRequest("http://localhost/api/scenarios/travel", {
        optionId: "flight-b",
        approved: true,
        priceChange: true,
      }),
    );
    const body = (await response.json()) as {
      result: {
        decision: { decision: string };
        verifiedAdditionalCost: number;
      };
      verifiedPriceChanged: boolean;
    };

    expect(response.status).toBe(200);
    expect(body.result.decision.decision).toBe("ESCALATE");
    expect(body.result.verifiedAdditionalCost).toBe(48);
    expect(body.verifiedPriceChanged).toBe(true);
  });
});

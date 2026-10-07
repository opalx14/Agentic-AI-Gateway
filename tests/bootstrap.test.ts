import { describe, expect, test } from "bun:test";

import packageJson from "../package.json";

describe("Phase 0 bootstrap", () => {
  test("uses the expected package identity", () => {
    expect(packageJson.name).toBe("agentic-ai-gateway");
  });
});

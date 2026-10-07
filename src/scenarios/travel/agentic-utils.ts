import { createHash } from "node:crypto";

function stable(value: unknown): string {
  if (Array.isArray(value)) {
    return "[" + value.map((item) => stable(item)).join(",") + "]";
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      "{" +
      Object.keys(record)
        .sort()
        .map((key) => JSON.stringify(key) + ":" + stable(record[key]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
}

export function sha256Hex(value: unknown) {
  return createHash("sha256").update(stable(value)).digest("hex");
}

export function iso(date: string, time: string) {
  return new Date(date + "T" + time + ":00.000Z").toISOString();
}

export function addMinutes(value: string, minutes: number) {
  return new Date(new Date(value).getTime() + minutes * 60_000).toISOString();
}

export function addDays(date: string, days: number) {
  const current = new Date(date + "T00:00:00.000Z");
  current.setUTCDate(current.getUTCDate() + days);
  return current.toISOString().slice(0, 10);
}

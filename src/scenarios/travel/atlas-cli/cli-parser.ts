import type {
  AtlasEnvelope,
  AtlasPriceChange,
  RawAtlasBaggageData,
  RawAtlasBaggageOption,
  RawAtlasOffer,
  RawAtlasSearchData,
  RawAtlasVerifyData,
} from "./cli-types";

export type CliParseResult =
  | { kind: "SEARCH_OK"; searchId: string; offerCount: number; offers: RawAtlasOffer[] }
  | { kind: "SEARCH_EMPTY" }
  | {
      kind: "VERIFY_OK";
      priceChange: AtlasPriceChange;
      previousPrice?: number;
      currentPrice?: number;
      currency?: string;
      baggageSupported?: boolean;
      seatSupported?: boolean;
      bookingId?: string;
      priceConfirmed?: boolean;
    }
  | { kind: "BAGGAGE_OK"; bookingId: string; options: RawAtlasBaggageOption[] }
  | { kind: "BAGGAGE_UNAVAILABLE" }
  | { kind: "FAILURE"; code: string }
  | { kind: "MALFORMED" };

const PRICE_CHANGES = ["unchanged", "decreased", "increased"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseVerifyData(data: unknown, fallback: AtlasPriceChange) {
  const record: RawAtlasVerifyData = isRecord(data) ? (data as RawAtlasVerifyData) : {};
  const priceChange = PRICE_CHANGES.includes(record.price_change as AtlasPriceChange)
    ? (record.price_change as AtlasPriceChange)
    : fallback;

  return {
    priceChange,
    previousPrice: optionalNumber(record.previous_price),
    currentPrice: optionalNumber(record.current_price),
    currency: typeof record.currency === "string" ? record.currency : undefined,
    baggageSupported:
      typeof record.baggage_supported === "boolean" ? record.baggage_supported : undefined,
    seatSupported:
      typeof record.seat_supported === "boolean" ? record.seat_supported : undefined,
    bookingId: typeof record.booking_id === "string" ? record.booking_id : undefined,
  };
}

function parseBaggageData(data: unknown) {
  if (!isRecord(data)) return null;
  const record = data as unknown as RawAtlasBaggageData;
  if (typeof record.booking_id !== "string" || !Array.isArray(record.options)) return null;
  const options = record.options.filter((option): option is RawAtlasBaggageOption => {
    if (!isRecord(option)) return false;
    return (
      typeof option.baggage_id === "string" &&
      typeof option.segment_id === "string" &&
      typeof option.weight_kg === "number" &&
      Number.isFinite(option.weight_kg) &&
      typeof option.price === "number" &&
      Number.isFinite(option.price) &&
      typeof option.currency === "string"
    );
  });
  return { bookingId: record.booking_id, options };
}

export function parseCliOutput(stdout: string): CliParseResult {
  let envelope: AtlasEnvelope;
  try {
    envelope = JSON.parse(stdout) as AtlasEnvelope;
  } catch {
    return { kind: "MALFORMED" };
  }
  if (!isRecord(envelope) || typeof envelope.code !== "string") return { kind: "MALFORMED" };

  switch (envelope.code) {
    case "FLIGHT_SEARCHED": {
      const data = isRecord(envelope.data) ? (envelope.data as unknown as RawAtlasSearchData) : null;
      if (!data || typeof data.search_id !== "string") return { kind: "MALFORMED" };
      return {
        kind: "SEARCH_OK",
        searchId: data.search_id,
        offerCount: typeof data.offer_count === "number" ? data.offer_count : (data.offers?.length ?? 0),
        offers: Array.isArray(data.offers) ? data.offers : [],
      };
    }
    case "SEARCH_NO_RESULTS":
      return { kind: "SEARCH_EMPTY" };
    case "OFFER_VERIFIED":
      return { kind: "VERIFY_OK", ...parseVerifyData(envelope.data, "unchanged") };
    case "PRICE_CONFIRMATION_REQUIRED":
      return { kind: "VERIFY_OK", ...parseVerifyData(envelope.data, "increased") };
    case "PRICE_CONFIRMED":
      return { kind: "VERIFY_OK", ...parseVerifyData(envelope.data, "increased"), priceConfirmed: true };
    case "BAGGAGE_OPTIONS_LISTED": {
      const parsed = parseBaggageData(envelope.data);
      return parsed ? { kind: "BAGGAGE_OK", ...parsed } : { kind: "MALFORMED" };
    }
    case "BAGGAGE_UNAVAILABLE":
      return { kind: "BAGGAGE_UNAVAILABLE" };
    default:
      return { kind: "FAILURE", code: envelope.code };
  }
}

import { execFile } from "node:child_process";

import { z } from "zod";

import type {
  BookingInput,
  BookingResult,
  FlightSearchInput,
  FlightVerifyInput,
  TravelFlightOption,
  TravelProvider,
} from "../types";
import { TravelQuoteChangedError } from "../types";

interface AtlasCommandRunner {
  run(args: string[], stdin?: string): Promise<string>;
}

const atlasEnvelopeSchema = z.object({
  status: z.enum(["ok", "success", "error", "action_required"]),
  code: z.string(),
  message: z.string().default(""),
  request_id: z.string().nullable().optional(),
  data: z.unknown().nullable(),
});

const atlasLegacyOfferSchema = z.object({
  offer_id: z.string(),
  flight_no: z.string(),
  origin: z.string(),
  destination: z.string(),
  departIso: z.string(),
  arriveIso: z.string(),
  price: z.object({
    base: z.number().finite().nonnegative(),
    currency: z.string().min(1),
  }),
  bags: z
    .object({
      checked_fee: z.number().finite().nonnegative().default(0),
    })
    .default({ checked_fee: 0 }),
});

const atlasSegmentSchema = z.object({
  departure_airport: z.string(),
  arrival_airport: z.string(),
  departure_time: z.string(),
  arrival_time: z.string(),
  carrier: z.string(),
  operating_carrier: z.string().nullable().optional(),
  flight_number: z.string(),
  duration_minutes: z.number().int().nonnegative(),
  cabin_class: z.number().int().nonnegative().optional(),
  direction: z.string().optional(),
});

const atlasLiveOfferSchema = z.object({
  offer_id: z.string(),
  currency: z.string().min(1),
  total_price: z.number().finite().nonnegative(),
  segments: z.array(atlasSegmentSchema).min(1),
  ancillary_supported: z.array(z.string()).default([]),
  bookable: z.boolean().default(true),
  price_status: z.string().default("current"),
  expire_time: z.string().optional(),
});

const atlasSearchDataSchema = z.object({
  offers: z.array(z.union([atlasLegacyOfferSchema, atlasLiveOfferSchema])),
});

const atlasLegacyVerifyDataSchema = z.object({
  booking_id: z.string(),
  verified_total_with_bag: z.number().finite().nonnegative(),
});

const atlasLiveVerifyDataSchema = z.object({
  booking_id: z.string(),
  current_price: z.number().finite().nonnegative(),
  currency: z.string().min(1),
  price_change: z.string().optional(),
});

const atlasVerifyDataSchema = z.union([
  atlasLegacyVerifyDataSchema,
  atlasLiveVerifyDataSchema,
]);

const atlasOrderDataSchema = z.object({
  order_no: z.string(),
});

const AIRPORT_OFFSETS: Record<string, string> = {
  SGN: "+07:00",
  HAN: "+07:00",
  BKK: "+07:00",
  SIN: "+08:00",
  DPS: "+08:00",
  HKG: "+08:00",
  KUL: "+08:00",
  NRT: "+09:00",
  HND: "+09:00",
  ICN: "+09:00",
  DXB: "+04:00",
  LHR: "+00:00",
  CDG: "+01:00",
  FRA: "+01:00",
  AMS: "+01:00",
  JFK: "-05:00",
  SYD: "+11:00",
};

function atlasLocalTime(value: string, airport: string) {
  if (!/^\d{12}$/.test(value)) return value;
  const year = value.slice(0, 4);
  const month = value.slice(4, 6);
  const day = value.slice(6, 8);
  const hour = value.slice(8, 10);
  const minute = value.slice(10, 12);
  const offset = AIRPORT_OFFSETS[airport.toUpperCase()] ?? "Z";
  return year + "-" + month + "-" + day + "T" + hour + ":" + minute + ":00" + offset;
}

class DefaultAtlasCommandRunner implements AtlasCommandRunner {
  constructor(
    private readonly binary = "atlas-flight",
    private readonly timeoutMs = 120_000,
  ) {}

  async run(args: string[], stdin?: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const child = execFile(
        this.binary,
        [...args, "--json"],
        { timeout: this.timeoutMs },
        (error, stdout, stderr) => {
          if (error && !stdout) {
            reject(
              new Error(
                stderr.trim() ||
                  error.message ||
                  "Atlas CLI command failed.",
              ),
            );
            return;
          }

          resolve(stdout);
        },
      );

      if (stdin && child.stdin) {
        child.stdin.write(stdin);
        child.stdin.end();
      }
    });
  }
}

export interface AtlasTravelProviderOptions {
  commandRunner?: AtlasCommandRunner;
  allowSandboxBooking?: boolean;
}

interface CachedVerification {
  bookingId: string;
  verified: TravelFlightOption;
}

export class AtlasTravelProvider implements TravelProvider {
  private readonly runner: AtlasCommandRunner;
  private readonly allowSandboxBooking: boolean;
  private readonly verificationCache = new Map<string, CachedVerification>();

  constructor(options: AtlasTravelProviderOptions = {}) {
    this.runner = options.commandRunner ?? new DefaultAtlasCommandRunner();
    this.allowSandboxBooking = options.allowSandboxBooking ?? false;
  }

  async searchFlights(
    input: FlightSearchInput,
  ): Promise<TravelFlightOption[]> {
    const raw = await this.runner.run([
      "search",
      "--origin",
      input.origin,
      "--destination",
      input.destination,
      "--depart",
      input.departDate,
      "--adults",
      String(input.adults),
    ]);

    const envelope = this.parseEnvelope(raw, "Atlas search");
    const data = atlasSearchDataSchema.parse(envelope.data);

    return data.offers.map((offer) => {
      if ("flight_no" in offer) {
        const total = offer.price.base + offer.bags.checked_fee;
        return {
          id: offer.offer_id,
          provider: "atlas" as const,
          flightNumber: offer.flight_no,
          origin: offer.origin,
          destination: offer.destination,
          departureAt: offer.departIso,
          arrivalAt: offer.arriveIso,
          total,
          additionalCost: Math.max(0, total - input.baselineTotal),
          currency: offer.price.currency,
          expiresAt: Date.now() + 5 * 60_000,
        };
      }

      const first = offer.segments[0]!;
      const last = offer.segments[offer.segments.length - 1]!;
      const carriers = Array.from(
        new Set(offer.segments.map((segment) => segment.carrier)),
      );
      const operating = Array.from(
        new Set(
          offer.segments
            .map((segment) => segment.operating_carrier)
            .filter((value): value is string => !!value),
        ),
      );
      const total = offer.total_price;
      return {
        id: offer.offer_id,
        provider: "atlas" as const,
        flightNumber: offer.segments
          .map((segment) => segment.flight_number)
          .join(" / "),
        origin: first.departure_airport,
        destination: last.arrival_airport,
        departureAt: atlasLocalTime(first.departure_time, first.departure_airport),
        arrivalAt: atlasLocalTime(last.arrival_time, last.arrival_airport),
        total,
        additionalCost: Math.max(0, total - input.baselineTotal),
        currency: offer.currency,
        expiresAt: offer.expire_time
          ? Date.parse(offer.expire_time)
          : Date.now() + 5 * 60_000,
        carrier: carriers.join("/"),
        operatingCarrier: operating.join("/") || null,
        segmentCount: offer.segments.length,
        stops: Math.max(0, offer.segments.length - 1),
        durationMinutes: offer.segments.reduce(
          (sum, segment) => sum + segment.duration_minutes,
          0,
        ),
        cabinClass: first.cabin_class,
        bookable: offer.bookable,
        ancillarySupported: offer.ancillary_supported,
        priceStatus: offer.price_status,
      };
    });
  }

  async verifyFlight(
    input: FlightVerifyInput,
  ): Promise<TravelFlightOption> {
    const raw = await this.runner.run([
      "offer",
      "verify",
      "--offer-id",
      input.option.id,
    ]);
    const envelope = this.parseEnvelope(raw, "Atlas offer verify");
    const data = atlasVerifyDataSchema.parse(envelope.data);
    const verifiedTotal =
      "verified_total_with_bag" in data
        ? data.verified_total_with_bag
        : data.current_price;
    const additionalCost = Math.max(
      0,
      verifiedTotal - input.search.baselineTotal,
    );
    const verified: TravelFlightOption = {
      ...input.option,
      total: verifiedTotal,
      additionalCost,
      currency: "currency" in data ? data.currency : input.option.currency,
    };

    this.verificationCache.set(input.option.id, {
      bookingId: data.booking_id,
      verified,
    });

    return verified;
  }

  async createBooking(input: BookingInput): Promise<BookingResult> {
    if (!this.allowSandboxBooking) {
      throw new Error(
        "Atlas sandbox booking is disabled. Set ATLAS_ALLOW_SANDBOX_BOOKING=true explicitly.",
      );
    }

    if (!input.passengers || input.passengers.length === 0) {
      throw new Error(
        "Atlas sandbox order creation requires passenger input.",
      );
    }

    const latest = await this.verifyFlight({
      search: input.search,
      option: input.option,
    });

    if (
      latest.additionalCost !== input.option.additionalCost ||
      latest.currency.toUpperCase() !==
        input.option.currency.toUpperCase()
    ) {
      throw new TravelQuoteChangedError(
        input.option.additionalCost,
        latest.additionalCost,
        latest.currency,
      );
    }

    const verification = this.verificationCache.get(input.option.id);

    if (!verification) {
      throw new Error("Atlas verification state is unavailable.");
    }

    const passengerPayload = input.passengers.map((passenger) => ({
      full_name: passenger.fullName,
      gender: passenger.gender,
      date_of_birth: passenger.dateOfBirth,
      nationality: passenger.nationality,
      document_type: passenger.documentType,
      document_number: passenger.documentNumber,
      issuing_country: passenger.issuingCountry,
      expiry_date: passenger.expiryDate,
      contact_name: passenger.contactName,
    }));

    const raw = await this.runner.run(
      [
        "order",
        "create",
        "--booking-id",
        verification.bookingId,
        "--passengers-stdin",
      ],
      JSON.stringify(passengerPayload),
    );
    const envelope = this.parseEnvelope(raw, "Atlas order create");
    const data = atlasOrderDataSchema.parse(envelope.data);

    return {
      bookingRef: data.order_no,
      status: "HELD",
      provider: "atlas",
    };
  }

  private parseEnvelope(raw: string, operation: string) {
    let decoded: unknown;

    try {
      decoded = JSON.parse(raw);
    } catch {
      throw new Error(`${operation} returned non-JSON output.`);
    }

    const envelope = atlasEnvelopeSchema.parse(decoded);

    if (!["ok", "success"].includes(envelope.status)) {
      throw new Error(
        `${operation} failed: ${envelope.code} ${envelope.message}`.trim(),
      );
    }

    return envelope;
  }
}

export function createAtlasTravelProviderFromEnv(): AtlasTravelProvider {
  return new AtlasTravelProvider({
    allowSandboxBooking:
      process.env.ATLAS_ALLOW_SANDBOX_BOOKING === "true",
  });
}

export type { AtlasCommandRunner };

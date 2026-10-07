import type {
  BookingInput,
  BookingResult,
  FlightSearchInput,
  FlightVerifyInput,
  TravelFlightOption,
  TravelProvider,
} from "../types";
import { TravelQuoteChangedError } from "../types";

export interface FixtureTravelProviderOptions {
  options: TravelFlightOption[];
  verifiedAdditionalCosts?: Record<string, number>;
}

export class FixtureTravelProvider implements TravelProvider {
  private bookingCount = 0;

  constructor(private readonly config: FixtureTravelProviderOptions) {}

  async searchFlights(
    input: FlightSearchInput,
  ): Promise<TravelFlightOption[]> {
    void input;
    return structuredClone(this.config.options);
  }

  async verifyFlight(
    input: FlightVerifyInput,
  ): Promise<TravelFlightOption> {
    const additionalCost =
      this.config.verifiedAdditionalCosts?.[input.option.id] ??
      input.option.additionalCost;

    return {
      ...structuredClone(input.option),
      total: input.search.baselineTotal + additionalCost,
      additionalCost,
    };
  }

  async createBooking(input: BookingInput): Promise<BookingResult> {
    const verified = await this.verifyFlight({
      search: input.search,
      option: input.option,
    });

    if (
      verified.additionalCost !== input.option.additionalCost ||
      verified.currency !== input.option.currency
    ) {
      throw new TravelQuoteChangedError(
        input.option.additionalCost,
        verified.additionalCost,
        verified.currency,
      );
    }

    this.bookingCount += 1;

    return {
      bookingRef: `fixture:travel:booking-${this.bookingCount}`,
      status: "CONFIRMED",
      provider: "fixture",
    };
  }
}

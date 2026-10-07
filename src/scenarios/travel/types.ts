export interface FlightSearchInput {
  origin: string;
  destination: string;
  departDate: string;
  adults: number;
  baselineTotal: number;
  currency: string;
}

export interface TravelFlightOption {
  id: string;
  provider: "fixture" | "atlas";
  flightNumber: string;
  origin: string;
  destination: string;
  departureAt: string;
  arrivalAt: string;
  total: number;
  additionalCost: number;
  currency: string;
  expiresAt: number;
  carrier?: string;
  operatingCarrier?: string | null;
  segmentCount?: number;
  stops?: number;
  durationMinutes?: number;
  cabinClass?: number;
  bookable?: boolean;
  ancillarySupported?: string[];
  priceStatus?: string;
}

export interface TravelPassenger {
  fullName: string;
  gender: "M" | "F";
  dateOfBirth: string;
  nationality: string;
  documentType: string;
  documentNumber: string;
  issuingCountry: string;
  expiryDate: string;
  contactName: string;
}

export interface FlightVerifyInput {
  search: FlightSearchInput;
  option: TravelFlightOption;
}

export interface BookingInput {
  search: FlightSearchInput;
  option: TravelFlightOption;
  passengers?: TravelPassenger[];
}

export interface BookingResult {
  bookingRef: string;
  status: "HELD" | "CONFIRMED";
  provider: "fixture" | "atlas";
}

export interface TravelProvider {
  searchFlights(input: FlightSearchInput): Promise<TravelFlightOption[]>;
  verifyFlight(input: FlightVerifyInput): Promise<TravelFlightOption>;
  createBooking(input: BookingInput): Promise<BookingResult>;
}

export class TravelQuoteChangedError extends Error {
  constructor(
    public readonly previousAdditionalCost: number,
    public readonly currentAdditionalCost: number,
    public readonly currency: string,
  ) {
    super(
      `Travel quote changed from ${previousAdditionalCost} to ${currentAdditionalCost} ${currency}.`,
    );
    this.name = "TravelQuoteChangedError";
  }
}

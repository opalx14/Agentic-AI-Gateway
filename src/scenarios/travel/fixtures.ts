import type {
  FlightSearchInput,
  TravelFlightOption,
} from "./types";

export const TRAVEL_SEARCH_FIXTURE: FlightSearchInput = {
  origin: "SGN",
  destination: "SIN",
  departDate: "2026-11-06",
  adults: 1,
  baselineTotal: 200,
  currency: "USD",
};

export const TRAVEL_OPTIONS_FIXTURE: TravelFlightOption[] = [
  {
    id: "flight-a",
    provider: "fixture",
    flightNumber: "FIX-A",
    origin: "SGN",
    destination: "SIN",
    departureAt: "2026-11-06T13:30:00+07:00",
    arrivalAt: "2026-11-06T16:20:00+08:00",
    total: 215,
    additionalCost: 15,
    currency: "USD",
    expiresAt: 1_900_000_000_000,
  },
  {
    id: "flight-b",
    provider: "fixture",
    flightNumber: "FIX-B",
    origin: "SGN",
    destination: "SIN",
    departureAt: "2026-11-06T11:40:00+07:00",
    arrivalAt: "2026-11-06T14:30:00+08:00",
    total: 245,
    additionalCost: 45,
    currency: "USD",
    expiresAt: 1_900_000_000_000,
  },
];

export interface AtlasEnvelope {
  schema_version?: string;
  status?: string;
  code: string;
  message?: string;
  retryable?: boolean;
  request_id?: string;
  data?: unknown;
  details?: unknown;
}

export interface RawAtlasSegment {
  departure_airport: string;
  arrival_airport: string;
  departure_time: string;
  arrival_time: string;
  carrier: string;
  operating_carrier?: string | null;
  flight_number: string;
  duration_minutes?: number;
  cabin_class?: number | null;
  direction?: string;
}

export interface RawAtlasOffer {
  offer_id: string;
  currency: string;
  total_price: number;
  transaction_fee_total?: number;
  passenger_prices?: unknown[];
  segments: RawAtlasSegment[];
  ancillary_supported?: string[];
  bookable: boolean;
  price_status: string;
  refresh_time?: string | null;
  expire_time?: string | null;
}

export interface RawAtlasSearchData {
  search_id: string;
  offer_count: number;
  offers: RawAtlasOffer[];
}

export type AtlasPriceChange = "unchanged" | "decreased" | "increased";

export interface RawAtlasVerifyData {
  price_change?: AtlasPriceChange;
  previous_price?: number;
  current_price?: number;
  currency?: string;
  baggage_supported?: boolean;
  seat_supported?: boolean;
  booking_id?: string;
}

export interface RawAtlasBaggageOption {
  baggage_id: string;
  segment_id: string;
  piece?: number;
  weight_kg: number;
  size?: string;
  category?: string;
  price: number;
  currency: string;
}

export interface RawAtlasBaggageData {
  booking_id: string;
  options: RawAtlasBaggageOption[];
}

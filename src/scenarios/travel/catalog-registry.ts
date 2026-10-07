import type { TravelFlightOption } from "./types";

export type AirportRecord = {
  code: string;
  name: string;
  city: string;
  country: string;
};

export type TravelCatalogOption = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  amount: number;
  badge: string;
  imageUrl: string;
  aircraft?: string;
  imageCredit?: string;
  airport?: AirportRecord;
  source?: "ATLAS" | "DEMO";
  provider?: "atlas" | "demo";
  currency?: string;
  expiresAt?: number;
  rankingReason?: string;
  aiRecommended?: boolean;
  budgetFit?: boolean;
  budgetRemainingAfter?: number;
  flightOffer?: TravelFlightOption;
  verificationDigestHex?: string;
};

export type TravelCatalogStage = "flight" | "hotel" | "transfer";

type DestinationCatalog = {
  key: string;
  city: string;
  country: string;
  airports: string[];
  images: {
    hotel: string[];
    transfer: string[];
  };
  hotels: string[];
  transfers: Array<{ id: string; title: string; subtitle: string; badge: string }>;
  airlines: Array<{
    id: string;
    title: string;
    badge: string;
    imageUrl: string;
    aircraft?: string;
    preferredAirport?: string;
  }>;
};

export const AIRPORTS: Record<string, AirportRecord> = {
  SGN: { code: "SGN", name: "Tan Son Nhat International Airport", city: "Ho Chi Minh City", country: "Vietnam" },
  HAN: { code: "HAN", name: "Noi Bai International Airport", city: "Hanoi", country: "Vietnam" },
  NRT: { code: "NRT", name: "Narita International Airport", city: "Tokyo", country: "Japan" },
  HND: { code: "HND", name: "Tokyo Haneda Airport", city: "Tokyo", country: "Japan" },
  SIN: { code: "SIN", name: "Singapore Changi Airport", city: "Singapore", country: "Singapore" },
  DPS: { code: "DPS", name: "I Gusti Ngurah Rai International Airport", city: "Bali", country: "Indonesia" },
  ICN: { code: "ICN", name: "Incheon International Airport", city: "Seoul", country: "South Korea" },
  BKK: { code: "BKK", name: "Suvarnabhumi Airport", city: "Bangkok", country: "Thailand" },
  HKG: { code: "HKG", name: "Hong Kong International Airport", city: "Hong Kong", country: "Hong Kong" },
  DXB: { code: "DXB", name: "Dubai International Airport", city: "Dubai", country: "United Arab Emirates" },
  LHR: { code: "LHR", name: "London Heathrow Airport", city: "London", country: "United Kingdom" },
  CDG: { code: "CDG", name: "Paris Charles de Gaulle Airport", city: "Paris", country: "France" },
  JFK: { code: "JFK", name: "John F. Kennedy International Airport", city: "New York", country: "United States" },
  SYD: { code: "SYD", name: "Sydney Kingsford Smith Airport", city: "Sydney", country: "Australia" },
  FRA: { code: "FRA", name: "Frankfurt Airport", city: "Frankfurt", country: "Germany" },
  AMS: { code: "AMS", name: "Amsterdam Airport Schiphol", city: "Amsterdam", country: "Netherlands" },
};

const AIRLINE_IMAGES = {
  vietnamAirlines: "/airlines/vietnam-airlines.jpg",
  bamboo: "/airlines/bamboo-airways.jpg",
  ana: "/airlines/ana.jpg",
  jal: "/airlines/japan-airlines.jpg",
  generic: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1000&q=82",
};

export const TRAVEL_CATALOG: Record<string, DestinationCatalog> = {
  tokyo: {
    key: "tokyo",
    city: "Tokyo",
    country: "Japan",
    airports: ["NRT", "HND"],
    images: {
      hotel: [
        "https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=1000&q=82",
        "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1000&q=82",
        "https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1000&q=82",
      ],
      transfer: [
        "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?auto=format&fit=crop&w=1000&q=82",
        "https://images.unsplash.com/photo-1524413840807-0c3cb6fa808d?auto=format&fit=crop&w=1000&q=82",
        "https://images.unsplash.com/photo-1493780474015-ba834fd0ce2f?auto=format&fit=crop&w=1000&q=82",
      ],
    },
    hotels: ["Tokyo Ueno Transit Stay", "Tokyo Shinjuku Central Hotel", "Tokyo Marunouchi Premium Stay"],
    transfers: [
      { id: "transfer-rail", title: "Narita / Haneda airport rail", subtitle: "Airport → central Tokyo rail connection", badge: "RAIL" },
      { id: "transfer-taxi", title: "Tokyo airport taxi", subtitle: "Arrivals → hotel · metered demo option", badge: "DIRECT" },
      { id: "transfer-private", title: "Japan private airport transfer", subtitle: "Meet & greet → hotel · luggage included", badge: "PRIVATE" },
    ],
    airlines: [
      { id: "flight-vietnam-airlines", title: "Vietnam Airlines", badge: "FLAG CARRIER", imageUrl: AIRLINE_IMAGES.vietnamAirlines, aircraft: "Boeing 787 / Airbus A350 sample", preferredAirport: "NRT" },
      { id: "flight-ana", title: "ANA", badge: "HND", imageUrl: AIRLINE_IMAGES.ana, aircraft: "Boeing 787 sample", preferredAirport: "HND" },
      { id: "flight-jal", title: "Japan Airlines", badge: "FULL SERVICE", imageUrl: AIRLINE_IMAGES.jal, aircraft: "Boeing 787 sample", preferredAirport: "NRT" },
    ],
  },
  singapore: {
    key: "singapore",
    city: "Singapore",
    country: "Singapore",
    airports: ["SIN"],
    images: {
      hotel: [
        "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=1000&q=82",
        "https://images.unsplash.com/photo-1496939376851-89342e90adcd?auto=format&fit=crop&w=1000&q=82",
        "https://images.unsplash.com/photo-1565967511849-76a60a516170?auto=format&fit=crop&w=1000&q=82",
      ],
      transfer: [
        "https://images.unsplash.com/photo-1565967511849-76a60a516170?auto=format&fit=crop&w=1000&q=82",
        "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=1000&q=82",
        "https://images.unsplash.com/photo-1496939376851-89342e90adcd?auto=format&fit=crop&w=1000&q=82",
      ],
    },
    hotels: ["Changi Transit Stay", "Singapore City Hall Central Hotel", "Marina Bay Premium Stay"],
    transfers: [
      { id: "transfer-rail", title: "Changi MRT connection", subtitle: "SIN → central Singapore public transit", badge: "MRT" },
      { id: "transfer-taxi", title: "Singapore airport taxi", subtitle: "Changi arrivals → hotel", badge: "DIRECT" },
      { id: "transfer-private", title: "Singapore private transfer", subtitle: "Meet & greet → hotel", badge: "PRIVATE" },
    ],
    airlines: [
      { id: "flight-vietnam-airlines", title: "Vietnam Airlines", badge: "FLAG CARRIER", imageUrl: AIRLINE_IMAGES.vietnamAirlines, aircraft: "Airbus A321 sample", preferredAirport: "SIN" },
      { id: "flight-singapore-airlines", title: "Singapore Airlines", badge: "FULL SERVICE", imageUrl: AIRLINE_IMAGES.generic, aircraft: "Boeing 787 / Airbus A350 sample", preferredAirport: "SIN" },
      { id: "flight-scoot", title: "Scoot", badge: "VALUE", imageUrl: AIRLINE_IMAGES.generic, aircraft: "Airbus A320 family sample", preferredAirport: "SIN" },
    ],
  },
  bali: {
    key: "bali",
    city: "Bali",
    country: "Indonesia",
    airports: ["DPS"],
    images: {
      hotel: [
        "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1000&q=82",
        "https://images.unsplash.com/photo-1533669955142-6a73332af4db?auto=format&fit=crop&w=1000&q=82",
        "https://images.unsplash.com/photo-1539367628448-4bc5c9d171c8?auto=format&fit=crop&w=1000&q=82",
      ],
      transfer: [
        "https://images.unsplash.com/photo-1539367628448-4bc5c9d171c8?auto=format&fit=crop&w=1000&q=82",
        "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1000&q=82",
        "https://images.unsplash.com/photo-1533669955142-6a73332af4db?auto=format&fit=crop&w=1000&q=82",
      ],
    },
    hotels: ["DPS Airport Transit Stay", "Seminyak Central Stay", "Ubud Premium Retreat"],
    transfers: [
      { id: "transfer-taxi", title: "Bali airport taxi", subtitle: "DPS arrivals → hotel", badge: "DIRECT" },
      { id: "transfer-private", title: "Bali private driver", subtitle: "Meet & greet → hotel · luggage included", badge: "PRIVATE" },
      { id: "transfer-shuttle", title: "Bali hotel shuttle", subtitle: "DPS → selected hotel zone", badge: "SHUTTLE" },
    ],
    airlines: [
      { id: "flight-vietnam-airlines", title: "Vietnam Airlines", badge: "CONNECTING", imageUrl: AIRLINE_IMAGES.vietnamAirlines, aircraft: "Regional international sample", preferredAirport: "DPS" },
      { id: "flight-garuda", title: "Garuda Indonesia", badge: "FLAG CARRIER", imageUrl: AIRLINE_IMAGES.generic, aircraft: "Boeing 737 / Airbus A330 sample", preferredAirport: "DPS" },
      { id: "flight-airasia", title: "AirAsia", badge: "VALUE", imageUrl: AIRLINE_IMAGES.generic, aircraft: "Airbus A320 family sample", preferredAirport: "DPS" },
    ],
  },
};

const DEFAULT_CATALOG: DestinationCatalog = {
  key: "generic",
  city: "Destination",
  country: "International",
  airports: ["NRT"],
  images: {
    hotel: ["https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1000&q=82"],
    transfer: ["https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=1000&q=82"],
  },
  hotels: ["Transit Stay", "Central Hotel", "Premium Stay"],
  transfers: [
    { id: "transfer-rail", title: "Airport rail", subtitle: "Airport → city centre", badge: "RAIL" },
    { id: "transfer-taxi", title: "Airport taxi", subtitle: "Arrivals → hotel", badge: "DIRECT" },
    { id: "transfer-private", title: "Private transfer", subtitle: "Meet & greet → hotel", badge: "PRIVATE" },
  ],
  airlines: [
    { id: "flight-vietnam-airlines", title: "Vietnam Airlines", badge: "FLAG CARRIER", imageUrl: AIRLINE_IMAGES.vietnamAirlines },
    { id: "flight-partner", title: "International partner", badge: "FULL SERVICE", imageUrl: AIRLINE_IMAGES.generic },
    { id: "flight-value", title: "Value carrier", badge: "VALUE", imageUrl: AIRLINE_IMAGES.generic },
  ],
};

export function liveFlightCatalogOptions(
  offers: TravelFlightOption[],
  reasons: Record<string, string> = {},
): TravelCatalogOption[] {
  return offers.map((offer, index) => {
    const origin = airportByCode(offer.origin);
    const destination = airportByCode(offer.destination);
    const depart = offer.departureAt.replace("T", " ").slice(0, 16);
    const arrive = offer.arrivalAt.replace("T", " ").slice(0, 16);
    const reason = reasons[offer.id];

    return {
      id: offer.id,
      title: offer.flightNumber,
      subtitle:
        origin.code + " → " + destination.code + " · " + depart + " → " + arrive,
      meta: reason
        ? "ATLAS LIVE · AI rank · " + reason
        : "ATLAS LIVE · provider offer · verified before selection",
      amount: Math.round(offer.total),
      badge: index === 0 ? "AI PICK" : "ATLAS LIVE",
      imageUrl:
        "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1000&q=82",
      airport: destination,
      imageCredit: "Atlas provider data · Unsplash visual",
      source: "ATLAS",
      provider: "atlas",
      currency: offer.currency,
      expiresAt: offer.expiresAt,
      rankingReason: reason,
      flightOffer: offer,
    };
  });
}

export function airportByCode(code: string) {
  const normalized = code.toUpperCase();
  return AIRPORTS[normalized] ?? { code: normalized, name: normalized + " International Airport", city: normalized, country: "International" };
}

export function destinationCatalog(key: string, fallbackAirport?: string): DestinationCatalog {
  const known = TRAVEL_CATALOG[key];
  if (known) return known;
  return {
    ...DEFAULT_CATALOG,
    airports: fallbackAirport ? [fallbackAirport.toUpperCase()] : DEFAULT_CATALOG.airports,
  };
}

export function buildCatalogOptions(input: {
  stage: TravelCatalogStage;
  destinationKey: string;
  city: string;
  origin: string;
  destinationAirport: string;
  days: number;
  baseAmount: number;
}): TravelCatalogOption[] {
  const catalog = destinationCatalog(input.destinationKey, input.destinationAirport);
  const origin = airportByCode(input.origin);
  const destinationAirports = catalog.airports.map(airportByCode);

  if (input.stage === "flight") {
    return catalog.airlines.map((airline, index) => {
      const destination =
        destinationAirports.find((item) => item.code === airline.preferredAirport) ??
        destinationAirports[index % destinationAirports.length] ??
        airportByCode(input.destinationAirport);
      const adjustments = [-42, 0, 86];
      return {
        id: airline.id,
        title: airline.title,
        subtitle: origin.code + " · " + origin.name + " → " + destination.code + " · " + destination.name,
        meta: "DEMO CATALOG · sample fare · availability not live",
        amount: Math.max(80, input.baseAmount + (adjustments[index] ?? index * 45)),
        badge: airline.badge,
        imageUrl: airline.imageUrl,
        aircraft: airline.aircraft,
        airport: destination,
        imageCredit: airline.imageUrl.startsWith("/") ? "Wikimedia Commons" : "Unsplash demo visual",
      };
    }).sort((a, b) => a.amount - b.amount);
  }

  if (input.stage === "hotel") {
    const nights = Math.max(1, input.days - 1);
    const adjustments = [-70, 0, 110];
    return catalog.hotels.map((title, index) => ({
      id: "hotel-" + (index === 0 ? "value" : index === 1 ? "central" : "premium"),
      title,
      subtitle: nights + " nights · " + catalog.city + ", " + catalog.country,
      meta: "DEMO CATALOG · sample property · availability not live",
      amount: Math.max(120, input.baseAmount + (adjustments[index] ?? index * 80)),
      badge: index === 0 ? "VALUE" : index === 1 ? "CENTRAL" : "PREMIUM",
      imageUrl: catalog.images.hotel[index % catalog.images.hotel.length]!,
      imageCredit: "Unsplash destination visual",
    })).sort((a, b) => a.amount - b.amount);
  }

  const destination = destinationAirports[0] ?? airportByCode(input.destinationAirport);
  const adjustments = [-12, 0, 28];
  return catalog.transfers.map((transfer, index) => ({
    id: transfer.id,
    title: transfer.title,
    subtitle: destination.code + " · " + destination.name + " · " + transfer.subtitle,
    meta: "DEMO CATALOG · destination-local sample · availability not live",
    amount: Math.max(10, input.baseAmount + (adjustments[index] ?? index * 20)),
    badge: transfer.badge,
    imageUrl: catalog.images.transfer[index % catalog.images.transfer.length]!,
    airport: destination,
    imageCredit: "Unsplash destination visual",
  })).sort((a, b) => a.amount - b.amount);
}

export type OriginContext = {
  country: string;
  city: string | null;
  selectedAirport: "SGN" | "HAN";
  airportOptions: Array<AirportRecord>;
  confidence: "country" | "city";
  message: string;
};

export function inferVietnamOrigin(input: { timeZone?: string; language?: string }): OriginContext {
  const zone = input.timeZone ?? "";
  const language = (input.language ?? "").toLowerCase();
  const vietnamSignal =
    zone === "Asia/Ho_Chi_Minh" ||
    zone === "Asia/Saigon" ||
    language.startsWith("vi");

  if (vietnamSignal) {
    return {
      country: "Vietnam",
      city: null,
      selectedAirport: "SGN",
      airportOptions: [AIRPORTS.SGN!, AIRPORTS.HAN!],
      confidence: "country",
      message: "We think you're in Vietnam — choose your departure airport.",
    };
  }

  return {
    country: "Vietnam",
    city: null,
    selectedAirport: "SGN",
    airportOptions: [AIRPORTS.SGN!, AIRPORTS.HAN!],
    confidence: "country",
    message: "Choose your departure airport.",
  };
}

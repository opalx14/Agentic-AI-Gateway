import type { DestinationVisual } from "./agentic-types";

export const DESTINATION_VISUALS: DestinationVisual[] = [
  {
    key: "tokyo",
    city: "Tokyo",
    country: "Japan",
    airportCode: "NRT",
    imageUrl:
      "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1400&q=82",
    tagline: "Neon districts, quiet shrines and precise city rhythm.",
  },
  {
    key: "singapore",
    city: "Singapore",
    country: "Singapore",
    airportCode: "SIN",
    imageUrl:
      "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=1400&q=82",
    tagline: "Fast connections, food culture and compact city discovery.",
  },
  {
    key: "seoul",
    city: "Seoul",
    country: "South Korea",
    airportCode: "ICN",
    imageUrl:
      "https://images.unsplash.com/photo-1517154421773-0529f29ea451?auto=format&fit=crop&w=1400&q=82",
    tagline: "Design, food, palaces and late-night neighborhoods.",
  },
  {
    key: "bali",
    city: "Bali",
    country: "Indonesia",
    airportCode: "DPS",
    imageUrl:
      "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1400&q=82",
    tagline: "Temples, coastlines and slow days between local experiences.",
  },
  {
    key: "paris",
    city: "Paris",
    country: "France",
    airportCode: "CDG",
    imageUrl:
      "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1400&q=82",
    tagline: "Walkable neighborhoods, museums and late café evenings.",
  },
  {
    key: "bangkok",
    city: "Bangkok",
    country: "Thailand",
    airportCode: "BKK",
    imageUrl:
      "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=1400&q=82",
    tagline: "Street food, river routes and dense cultural neighborhoods.",
  },
];

const aliases: Record<string, string[]> = {
  tokyo: ["tokyo", "nhật", "nhat", "japan"],
  singapore: ["singapore", "sin"],
  seoul: ["seoul", "hàn", "han quoc", "korea"],
  bali: ["bali", "indonesia"],
  paris: ["paris", "pháp", "phap", "france"],
  bangkok: ["bangkok", "thái", "thai lan", "thailand"],
};

export function matchDestinationFromPrompt(prompt: string) {
  const normalized = prompt.toLowerCase();
  for (const destination of DESTINATION_VISUALS) {
    const keys = aliases[destination.key] ?? [destination.city.toLowerCase()];
    if (keys.some((key) => normalized.includes(key))) return destination;
  }
  return null;
}

export function destinationFromPrompt(prompt: string) {
  return matchDestinationFromPrompt(prompt) ?? DESTINATION_VISUALS[0]!;
}

export function destinationByAirport(code: string) {
  return (
    DESTINATION_VISUALS.find(
      (destination) => destination.airportCode === code.toUpperCase(),
    ) ?? DESTINATION_VISUALS[0]!
  );
}

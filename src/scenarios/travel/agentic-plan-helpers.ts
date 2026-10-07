import type { AgentToolCall, DestinationVisual } from "./agentic-types";
import { sha256Hex } from "./agentic-utils";

export function toolCall(
  input: Omit<AgentToolCall, "digestHex">,
): AgentToolCall {
  return {
    ...input,
    digestHex: sha256Hex({
      actor: input.actor,
      tool: input.tool,
      provider: input.provider,
      operation: input.operation,
      mode: input.mode,
      status: input.status,
      inputSummary: input.inputSummary,
      outputSummary: input.outputSummary,
    }),
  };
}

export function destinationCosts(destination: DestinationVisual) {
  const byKey: Record<
    string,
    { flight: number; hotelNight: number; activities: number; transfer: number }
  > = {
    tokyo: { flight: 310, hotelNight: 105, activities: 78, transfer: 28 },
    singapore: { flight: 120, hotelNight: 145, activities: 65, transfer: 24 },
    seoul: { flight: 275, hotelNight: 92, activities: 70, transfer: 25 },
    bali: { flight: 150, hotelNight: 75, activities: 82, transfer: 22 },
    paris: { flight: 720, hotelNight: 160, activities: 96, transfer: 45 },
    bangkok: { flight: 115, hotelNight: 80, activities: 60, transfer: 18 },
  };
  return byKey[destination.key] ?? byKey.tokyo!;
}

export function activitiesFor(destination: DestinationVisual) {
  const byKey: Record<string, Array<[string, string]>> = {
    tokyo: [
      ["Meiji Shrine & Harajuku", "Shibuya"],
      ["Tsukiji food walk", "Chuo"],
      ["Tokyo Skytree sunset", "Sumida"],
    ],
    singapore: [
      ["Hawker food trail", "Maxwell"],
      ["Gardens by the Bay", "Marina Bay"],
      ["National Gallery", "Civic District"],
    ],
    seoul: [
      ["Gyeongbokgung Palace", "Jongno"],
      ["Ikseon-dong food walk", "Jongno"],
      ["N Seoul Tower", "Yongsan"],
    ],
    bali: [
      ["Uluwatu Temple", "Badung"],
      ["Ubud rice terraces", "Ubud"],
      ["Sunset beach dinner", "Seminyak"],
    ],
    paris: [
      ["Louvre highlights", "1st arrondissement"],
      ["Le Marais food walk", "Le Marais"],
      ["Seine evening cruise", "Pont Neuf"],
    ],
    bangkok: [
      ["Grand Palace", "Phra Nakhon"],
      ["Chinatown food walk", "Yaowarat"],
      ["Wat Arun sunset", "Bangkok Yai"],
    ],
  };
  return byKey[destination.key] ?? byKey.tokyo!;
}

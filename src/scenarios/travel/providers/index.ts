import { TRAVEL_OPTIONS_FIXTURE } from "../fixtures";
import type { TravelProvider } from "../types";
import {
  AtlasTravelProvider,
  createAtlasTravelProviderFromEnv,
} from "./atlas";
import { FixtureTravelProvider } from "./fixture";

export * from "./atlas";
export * from "./fixture";

export function createTravelProviderFromEnv(): TravelProvider {
  if (process.env.TRAVEL_PROVIDER === "atlas") {
    return createAtlasTravelProviderFromEnv();
  }

  return new FixtureTravelProvider({
    options: TRAVEL_OPTIONS_FIXTURE,
  });
}

export { AtlasTravelProvider, FixtureTravelProvider };

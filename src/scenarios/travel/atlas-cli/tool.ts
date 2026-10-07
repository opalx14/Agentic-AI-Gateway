import { baggageListArgs, CliError, authStatusArgs, runCli, searchArgs, verifyArgs } from "./cli-client";
import { parseCliOutput } from "./cli-parser";
import type { AtlasEnvelope, RawAtlasOffer } from "./cli-types";

export class AtlasCaseStudyError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "AtlasCaseStudyError";
  }
}

export interface AtlasCaseSearchResult {
  searchId: string | null;
  offerCount: number;
  offers: RawAtlasOffer[];
}

function classifyCliError(error: unknown) {
  return error instanceof CliError ? error.kind : "SERVICE_REQUEST_FAILED";
}

export async function atlasAuthStatus(): Promise<"READY" | "AUTH_REQUIRED" | "ERROR"> {
  let stdout: string;
  try {
    stdout = await runCli(authStatusArgs(), 10_000);
  } catch (error) {
    if (error instanceof CliError && error.kind === "CLI_FAILURE") {
      // atlas-flight auth status uses a non-zero exit when authorization is required.
      try {
        const result = await import("./cli-client").then(({ defaultCliRunner, resolveCliCommand }) =>
          defaultCliRunner()(resolveCliCommand(), authStatusArgs(), 10_000),
        );
        const envelope = JSON.parse(result.stdout || "{}") as AtlasEnvelope;
        return envelope.code === "AUTHORIZATION_REQUIRED" || envelope.code === "AUTH_PENDING"
          ? "AUTH_REQUIRED"
          : "ERROR";
      } catch {
        return "ERROR";
      }
    }
    return "ERROR";
  }

  try {
    const envelope = JSON.parse(stdout) as AtlasEnvelope;
    if (envelope.code === "AUTHORIZATION_REQUIRED" || envelope.code === "AUTH_PENDING") {
      return "AUTH_REQUIRED";
    }
    return envelope.status === "ok" ? "READY" : "ERROR";
  } catch {
    return "ERROR";
  }
}

export async function atlasSearchCase(input: {
  origin: string;
  destination: string;
  depart: string;
  adults: number;
}): Promise<AtlasCaseSearchResult> {
  let stdout: string;
  try {
    stdout = await runCli(searchArgs(input), 40_000);
  } catch (error) {
    throw new AtlasCaseStudyError(classifyCliError(error));
  }

  const parsed = parseCliOutput(stdout);
  if (parsed.kind === "SEARCH_EMPTY") {
    return { searchId: null, offerCount: 0, offers: [] };
  }
  if (parsed.kind !== "SEARCH_OK") {
    throw new AtlasCaseStudyError(
      parsed.kind === "FAILURE" ? parsed.code : "SERVICE_RESPONSE_INVALID",
    );
  }

  return {
    searchId: parsed.searchId,
    offerCount: parsed.offerCount,
    offers: parsed.offers,
  };
}

export async function atlasVerifyCase(offerId: string) {
  let stdout: string;
  try {
    stdout = await runCli(verifyArgs(offerId), 20_000);
  } catch (error) {
    throw new AtlasCaseStudyError(classifyCliError(error));
  }

  const parsed = parseCliOutput(stdout);
  if (parsed.kind !== "VERIFY_OK") {
    throw new AtlasCaseStudyError(
      parsed.kind === "FAILURE" ? parsed.code : "SERVICE_RESPONSE_INVALID",
    );
  }
  return parsed;
}

export async function atlasBaggageCase(bookingId: string) {
  let stdout: string;
  try {
    stdout = await runCli(baggageListArgs(bookingId), 15_000);
  } catch (error) {
    throw new AtlasCaseStudyError(classifyCliError(error));
  }

  const parsed = parseCliOutput(stdout);
  if (parsed.kind === "BAGGAGE_UNAVAILABLE") return [];
  if (parsed.kind !== "BAGGAGE_OK") {
    throw new AtlasCaseStudyError(
      parsed.kind === "FAILURE" ? parsed.code : "SERVICE_RESPONSE_INVALID",
    );
  }
  return parsed.options;
}

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface CliRunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  spawnFailed?: boolean;
}

export type CliRunner = (
  command: string,
  args: string[],
  timeoutMs: number,
) => Promise<CliRunResult>;

export type CliErrorKind = "TIMEOUT" | "CLI_FAILURE" | "SPAWN_ERROR";

export class CliError extends Error {
  constructor(
    public readonly kind: CliErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "CliError";
  }
}

const MAX_BUFFER = 10 * 1024 * 1024;

export function resolveCliCommand() {
  const fromEnv = process.env.ATLAS_CLI_PATH;
  if (fromEnv?.trim()) return fromEnv;
  const localBin = join(homedir(), ".local", "bin", "atlas-flight");
  return existsSync(localBin) ? localBin : "atlas-flight";
}

export function defaultCliRunner(): CliRunner {
  return (command, args, timeoutMs) =>
    new Promise<CliRunResult>((resolve) => {
      let timedOut = false;
      const child = execFile(
        command,
        args,
        { maxBuffer: MAX_BUFFER, timeout: 0 },
        (error, stdout, stderr) => {
          clearTimeout(timer);
          if (error) {
            const err = error as NodeJS.ErrnoException & { signal?: string };
            if (timedOut || err.signal) {
              resolve({ stdout, stderr, exitCode: null, timedOut: true });
              return;
            }
            if (typeof err.code === "string") {
              resolve({ stdout, stderr, exitCode: null, timedOut: false, spawnFailed: true });
              return;
            }
            resolve({
              stdout,
              stderr,
              exitCode: typeof err.code === "number" ? err.code : null,
              timedOut: false,
            });
            return;
          }
          resolve({ stdout, stderr, exitCode: 0, timedOut: false });
        },
      );
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, timeoutMs);
      timer.unref?.();
    });
}

export async function runCli(
  args: string[],
  timeoutMs: number,
  runner: CliRunner = defaultCliRunner(),
  command = resolveCliCommand(),
) {
  const result = await runner(command, args, timeoutMs);
  if (result.timedOut) throw new CliError("TIMEOUT", "atlas-flight CLI timed out");
  if (result.spawnFailed) throw new CliError("SPAWN_ERROR", "atlas-flight CLI could not be started");
  if (result.exitCode !== 0) {
    throw new CliError("CLI_FAILURE", `atlas-flight CLI exited with code ${result.exitCode ?? "unknown"}`);
  }
  return result.stdout;
}

export function searchArgs(input: {
  origin: string;
  destination: string;
  depart: string;
  adults: number;
}) {
  return [
    "search",
    "--origin",
    input.origin,
    "--destination",
    input.destination,
    "--depart",
    input.depart,
    "--adults",
    String(input.adults),
    "--currency",
    "USD",
    "--json",
  ];
}

export function verifyArgs(offerId: string) {
  return ["offer", "verify", "--offer-id", offerId, "--json"];
}

export function baggageListArgs(bookingId: string) {
  return ["booking", "baggage", "list", "--booking-id", bookingId, "--json"];
}

export function authStatusArgs() {
  return ["auth", "status", "--json"];
}

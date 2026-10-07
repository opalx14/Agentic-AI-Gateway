import { validatePlanningResult } from "./schema";
import type {
  PlanningInput,
  PlanningProvider,
  PlanningResult,
} from "./types";

interface DeepSeekChatCompletion {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string | null;
    };
  }>;
}

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface DeepSeekProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  maxTokens?: number;
  fetchImpl?: FetchLike;
}

export class DeepSeekProvider implements PlanningProvider {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: FetchLike;

  constructor(private readonly config: DeepSeekProviderConfig) {
    if (!config.apiKey) {
      throw new Error("DeepSeek API key is required.");
    }

    if (!config.model) {
      throw new Error("DeepSeek model is required.");
    }

    this.baseUrl = config.baseUrl ?? "https://api.deepseek.com";
    this.timeoutMs = config.timeoutMs ?? 15_000;
    this.maxRetries = config.maxRetries ?? 1;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async plan(input: PlanningInput): Promise<PlanningResult> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        return await this.requestPlan(input);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("DeepSeek planning failed.");
  }

  private async requestPlan(input: PlanningInput): Promise<PlanningResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(
        `${this.baseUrl.replace(/\/$/, "")}/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: this.config.model,
            response_format: {
              type: "json_object",
            },
            max_tokens: this.config.maxTokens ?? 2_000,
            messages: [
              {
                role: "system",
                content:
                  "You are an action-planning component. Return JSON only. You may propose actions but you do not authorize or execute them. Use exactly this JSON shape: {\"summary\":\"...\",\"actions\":[{\"type\":\"...\",\"resource\":\"...\",\"amount\":0,\"currency\":\"USD\",\"payload\":{},\"reason\":\"...\"}]}. Never invent action types, resources, or provider options outside the supplied context.",
              },
              {
                role: "user",
                content: JSON.stringify(input),
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `DeepSeek API request failed with status ${response.status}.`,
        );
      }

      const body = (await response.json()) as DeepSeekChatCompletion;
      const choice = body.choices?.[0];

      if (!choice?.message?.content) {
        throw new Error("DeepSeek returned empty planning content.");
      }

      if (choice.finish_reason === "length") {
        throw new Error("DeepSeek planning JSON was truncated.");
      }

      let parsed: unknown;

      try {
        parsed = JSON.parse(choice.message.content);
      } catch {
        throw new Error("DeepSeek returned invalid JSON.");
      }

      return validatePlanningResult(input, parsed);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createDeepSeekProviderFromEnv(): DeepSeekProvider {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-flash";

  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured.");
  }

  return new DeepSeekProvider({
    apiKey,
    model,
  });
}

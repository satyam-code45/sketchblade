import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ZodType } from "zod";
import { AIError, classify, RETRYABLE } from "./errors.ts";
import { costOf, modelFor, FALLBACK_MODEL, type AITask } from "./models.ts";

export type { AITask } from "./models.ts";
export { AIError } from "./errors.ts";
export { seal, open, fingerprint, last4, type SealedKey } from "./crypto.ts";
export { redact } from "./redact.ts";
export { resolveCredential, FREE_TIER_DAILY_CALLS, type Preference, type StoredCredential } from "./credentials.ts";
export { PRICES, modelFor, costOf } from "./models.ts";

export type AIResult<T> = {
  data: T;
  provider: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number; costUsd: number };
  latencyMs: number;
};

export type GenerateRequest<T> = {
  task: AITask;
  system: string;
  user: string;
  schema: ZodType<T>;
  schemaName?: string;
  apiKey?: string;
  model?: string;
  signal?: AbortSignal;
};

const MAX_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callOpenAI<T>(req: GenerateRequest<T>, model: string): Promise<AIResult<T>> {
  const apiKey = req.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AIError("auth", "No OpenAI API key available.");

  const client = new OpenAI({ apiKey });
  const startedAt = Date.now();

  const res = await client.responses.parse({
    model,
    input: [
      { role: "system", content: req.system },
      { role: "user", content: req.user },
    ],
    text: { format: zodTextFormat(req.schema, req.schemaName ?? req.task) },
  }, { signal: req.signal });

  const data = res.output_parsed;
  if (data == null) throw new AIError("invalid_output", "Model returned no parseable output.");

  const inputTokens = res.usage?.input_tokens ?? 0;
  const outputTokens = res.usage?.output_tokens ?? 0;

  return {
    data: data as T,
    provider: "openai",
    model,
    usage: { inputTokens, outputTokens, costUsd: costOf(model, inputTokens, outputTokens) },
    latencyMs: Date.now() - startedAt,
  };
}

// Structured JSON out, against a Zod schema. Every AI feature goes through here.
export async function generate<T>(req: GenerateRequest<T>): Promise<AIResult<T>> {
  const provider = process.env.AI_PROVIDER ?? "openai";
  if (provider !== "openai") throw new AIError("unknown", `Unsupported AI_PROVIDER: ${provider}`);

  const ladder = [modelFor(req.task, req.model), FALLBACK_MODEL];
  let last: AIError | undefined;

  for (const model of ladder) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await callOpenAI(req, model);
      } catch (err) {
        last = classify(err);
        if (!RETRYABLE.includes(last.kind)) throw last;
        // Full jitter: spreads retries out instead of synchronising every client.
        if (attempt < MAX_ATTEMPTS) await sleep(Math.random() * 2 ** attempt * 250);
      }
    }
  }

  throw last ?? new AIError("unknown", "AI request failed.");
}

// Cheapest authenticated call there is, so a key is never stored unverified.
export async function validateKey(apiKey: string): Promise<{ ok: true } | { ok: false; kind: string; message: string }> {
  try {
    await new OpenAI({ apiKey }).models.list();
    return { ok: true };
  } catch (err) {
    const e = classify(err);
    return { ok: false, kind: e.kind, message: e.message };
  }
}

export type AITask = "diagram" | "evaluate" | "edit" | "chat";

// USD per 1M tokens, from developers.openai.com/api/docs/pricing (Sept 2026).
export const PRICES: Record<string, { in: number; out: number }> = {
  "gpt-5-nano": { in: 0.05, out: 0.4 },
  "gpt-4.1-nano": { in: 0.1, out: 0.4 },
  "gpt-6-luna": { in: 0.1, out: 0.5 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-5.6-luna": { in: 0.2, out: 1.2 },
  "gpt-5-mini": { in: 0.25, out: 2 },
  "gpt-4.1-mini": { in: 0.4, out: 1.6 },
  "gpt-5.6-terra": { in: 2, out: 12 },
  "gpt-5.6-sol": { in: 4, out: 20 },
  "gpt-6-astra": { in: 10, out: 50 },
};

// Production tiers: reasoning-shaped tasks pay for the stronger model,
// formatting-shaped ones do not. Dev overrides these to gpt-5-nano via env.
const DEFAULTS: Record<AITask, string> = {
  diagram: "gpt-5.6-luna",
  evaluate: "gpt-5.6-terra",
  edit: "gpt-5.6-terra",
  chat: "gpt-5.6-luna",
};

export const FALLBACK_MODEL = "gpt-5-nano";

export function modelFor(task: AITask, override?: string): string {
  const env = process.env[`AI_MODEL_${task.toUpperCase()}`];
  return override || env || DEFAULTS[task];
}

export function costOf(model: string, inTokens: number, outTokens: number): number {
  const p = PRICES[model];
  if (!p) return 0;
  return (inTokens * p.in + outTokens * p.out) / 1_000_000;
}

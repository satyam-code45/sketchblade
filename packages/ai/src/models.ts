export type AITask = "diagram" | "evaluate" | "edit" | "chat";

// USD per 1M tokens. Verified against developers.openai.com/api/docs/pricing, Sept 2026.
export const PRICES: Record<string, { in: number; out: number }> = {
  "gpt-6-astra": { in: 10, out: 50 },
  "gpt-5.6-sol": { in: 4, out: 20 },
  "gpt-5.6-terra": { in: 2, out: 12 },
  "gpt-5.6-luna": { in: 0.2, out: 1.2 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
};

// Reasoning-shaped tasks get the stronger tier; formatting-shaped ones do not.
const DEFAULTS: Record<AITask, string> = {
  diagram: "gpt-5.6-luna",
  evaluate: "gpt-5.6-terra",
  edit: "gpt-5.6-terra",
  chat: "gpt-5.6-luna",
};

export const FALLBACK_MODEL = "gpt-4o-mini";

export function modelFor(task: AITask, override?: string): string {
  const env = process.env[`AI_MODEL_${task.toUpperCase()}`];
  return override || env || DEFAULTS[task];
}

export function costOf(model: string, inTokens: number, outTokens: number): number {
  const p = PRICES[model];
  if (!p) return 0;
  return (inTokens * p.in + outTokens * p.out) / 1_000_000;
}

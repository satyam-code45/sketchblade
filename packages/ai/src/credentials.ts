import { AIError } from "./errors.ts";
import { open, type SealedKey } from "./crypto.ts";
import type { AITask } from "./models.ts";

export type StoredCredential = SealedKey & { id: string; provider: string };

export type Resolved = {
  apiKey: string;
  model?: string;
  credentialId: string | null;
  onPlatformKey: boolean;
};

export type Preference = {
  credentialId: string | null;
  modelDiagram: string | null;
  modelEvaluate: string | null;
  modelEdit: string | null;
  modelChat: string | null;
};

const MODEL_FIELD: Record<AITask, keyof Preference> = {
  diagram: "modelDiagram",
  evaluate: "modelEvaluate",
  edit: "modelEdit",
  chat: "modelChat",
};

export const FREE_TIER_DAILY_CALLS = Number(process.env.AI_FREE_TIER_DAILY_CALLS ?? 10);

// BYOK first, platform key second, quota error third. The credential is opened
// here and handed straight to the call — never cached, never logged.
export function resolveCredential(
  task: AITask,
  pref: Preference | null,
  credential: StoredCredential | null,
  platformCallsToday: number,
): Resolved {
  const model = pref?.[MODEL_FIELD[task]] ?? undefined;

  if (credential) {
    return { apiKey: open(credential), model, credentialId: credential.id, onPlatformKey: false };
  }

  const platformKey = process.env.OPENAI_API_KEY;
  if (!platformKey) throw new AIError("auth", "Add your own API key to use AI features.");

  if (platformCallsToday >= FREE_TIER_DAILY_CALLS) {
    throw new AIError("auth", `Free tier limit of ${FREE_TIER_DAILY_CALLS} calls/day reached. Add your own API key to continue.`);
  }

  return { apiKey: platformKey, model, credentialId: null, onPlatformKey: true };
}

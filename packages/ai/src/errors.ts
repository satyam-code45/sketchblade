export type AIErrorKind =
  | "rate_limit" | "overloaded" | "timeout"
  | "auth" | "invalid_output" | "content_filter" | "unknown";

export class AIError extends Error {
  kind: AIErrorKind;

  constructor(kind: AIErrorKind, message: string) {
    super(message);
    this.name = "AIError";
    this.kind = kind;
  }
}

// instanceof is unreliable here: the package can be loaded more than once and
// Prisma re-throws across a transaction boundary. Check the shape instead.
export function isAIError(err: unknown): err is AIError {
  return Boolean(err) && (err as AIError).name === "AIError" && typeof (err as AIError).kind === "string";
}

const BY_STATUS: Record<number, AIErrorKind> = {
  401: "auth", 403: "auth", 408: "timeout", 429: "rate_limit",
  500: "overloaded", 502: "overloaded", 503: "overloaded", 504: "overloaded",
};

// Retry decisions key off our own taxonomy, never vendor status codes, so the
// logic stays testable and survives a provider swap.
export function classify(err: unknown): AIError {
  if (err instanceof AIError) return err;

  const e = err as { status?: number; code?: string; message?: string };
  const message = e?.message ?? "unknown AI error";
  const byStatus = typeof e?.status === "number" ? BY_STATUS[e.status] : undefined;
  if (byStatus) return new AIError(byStatus, message);

  if (e?.code === "ETIMEDOUT" || e?.code === "ECONNRESET") return new AIError("timeout", message);
  if (/content[_ ]filter|safety/i.test(message)) return new AIError("content_filter", message);
  return new AIError("unknown", message);
}

export const RETRYABLE: AIErrorKind[] = ["rate_limit", "overloaded", "timeout"];

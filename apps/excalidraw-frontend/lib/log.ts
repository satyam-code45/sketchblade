import { redact } from "@repo/ai";

type Level = "info" | "warn" | "error";

// Scrubbing happens here rather than at call sites: a credential store leaks
// through logs far more often than through the database.
export function log(level: Level, event: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...redact(fields) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

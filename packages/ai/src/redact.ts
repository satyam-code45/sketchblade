// Credential stores leak through logs far more often than through the database,
// so scrub at the sink rather than trusting every call site.
const KEY_PATTERNS = [/sk-[A-Za-z0-9_-]{8,}/g, /AIza[A-Za-z0-9_-]{10,}/g];

export function redact<T>(value: T): T {
  if (typeof value === "string") return scrub(value) as T;
  if (Array.isArray(value)) return value.map(redact) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = /key|secret|token|authorization/i.test(k) && typeof v === "string" ? "[redacted]" : redact(v);
    }
    return out as T;
  }
  return value;
}

function scrub(s: string): string {
  return KEY_PATTERNS.reduce((acc, p) => acc.replace(p, "[redacted]"), s);
}

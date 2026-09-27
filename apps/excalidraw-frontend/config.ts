export const HTTP_BACKEND =
  process.env.NEXT_PUBLIC_HTTP_BACKEND ?? "/api";

// A WebSocket URL must use ws:// or wss://. Pasting the https:// service URL is
// the obvious mistake to make, and the browser just fails, so normalise it.
function toWebSocketUrl(raw: string): string {
  const url = raw.trim().replace(/\/+$/, "");
  if (url.startsWith("https://")) return `wss://${url.slice(8)}`;
  if (url.startsWith("http://")) return `ws://${url.slice(7)}`;
  if (url.startsWith("ws://") || url.startsWith("wss://")) return url;
  // Bare host: assume TLS unless it is clearly local.
  return /^(localhost|127\.|0\.0\.0\.0)/.test(url) ? `ws://${url}` : `wss://${url}`;
}

export const WS_URL = toWebSocketUrl(
  process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080",
);

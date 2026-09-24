import { test } from "node:test";
import assert from "node:assert/strict";

// Mirrors config.ts; importing it would drag in Next's env handling.
function toWebSocketUrl(raw: string): string {
  const url = raw.trim().replace(/\/+$/, "");
  if (url.startsWith("https://")) return `wss://${url.slice(8)}`;
  if (url.startsWith("http://")) return `ws://${url.slice(7)}`;
  if (url.startsWith("ws://") || url.startsWith("wss://")) return url;
  return /^(localhost|127\.|0\.0\.0\.0)/.test(url) ? `ws://${url}` : `wss://${url}`;
}

test("the https service url becomes wss", () => {
  assert.equal(toWebSocketUrl("https://sketchblade.onrender.com"), "wss://sketchblade.onrender.com");
});

test("plain http becomes ws", () => {
  assert.equal(toWebSocketUrl("http://localhost:8080"), "ws://localhost:8080");
});

test("an already correct url is left alone", () => {
  assert.equal(toWebSocketUrl("wss://sketchblade.onrender.com"), "wss://sketchblade.onrender.com");
  assert.equal(toWebSocketUrl("ws://localhost:8080"), "ws://localhost:8080");
});

test("trailing slashes and whitespace are trimmed", () => {
  assert.equal(toWebSocketUrl("  https://example.com//  "), "wss://example.com");
});

test("a bare host assumes tls unless it is local", () => {
  assert.equal(toWebSocketUrl("sketchblade.onrender.com"), "wss://sketchblade.onrender.com");
  assert.equal(toWebSocketUrl("localhost:8080"), "ws://localhost:8080");
});

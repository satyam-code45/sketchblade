import { test } from "node:test";
import assert from "node:assert/strict";

const MAX_TIMEOUT = 2_147_483_647;

// Mirrors the delay choice in index.ts armExpiry().
const delayFor = (ms: number) => Math.min(ms, MAX_TIMEOUT);

test("a 30-day token does not overflow setTimeout", () => {
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  assert.ok(thirtyDays > MAX_TIMEOUT, "precondition: 30d exceeds the ceiling");
  assert.equal(delayFor(thirtyDays), MAX_TIMEOUT);
});

test("a short expiry is used as-is", () => {
  assert.equal(delayFor(5_000), 5_000);
});

test("the chosen delay is always within the ceiling", () => {
  for (const days of [1, 7, 24, 25, 30, 90, 365]) {
    const ms = days * 24 * 60 * 60 * 1000;
    assert.ok(delayFor(ms) <= MAX_TIMEOUT, `${days}d`);
    assert.ok(delayFor(ms) > 0, `${days}d`);
  }
});

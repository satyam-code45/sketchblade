import { test } from "node:test";
import assert from "node:assert/strict";
import { modelFor, costOf } from "./models.ts";
import { classify, RETRYABLE } from "./errors.ts";

test("task picks its default model", () => {
  delete process.env.AI_MODEL_DIAGRAM;
  assert.equal(modelFor("diagram"), "gpt-5.6-luna");
  assert.equal(modelFor("evaluate"), "gpt-5.6-terra");
});

test("env overrides the default, an explicit model overrides env", () => {
  process.env.AI_MODEL_DIAGRAM = "gpt-5.6-sol";
  assert.equal(modelFor("diagram"), "gpt-5.6-sol");
  assert.equal(modelFor("diagram", "gpt-6-astra"), "gpt-6-astra");
  delete process.env.AI_MODEL_DIAGRAM;
});

test("cost uses the per-million price table", () => {
  assert.equal(costOf("gpt-5-nano", 1_000_000, 1_000_000), 0.45);
  assert.equal(costOf("no-such-model", 1000, 1000), 0);
});

test("vendor errors map onto our taxonomy", () => {
  assert.equal(classify({ status: 429, message: "slow down" }).kind, "rate_limit");
  assert.equal(classify({ status: 503, message: "busy" }).kind, "overloaded");
  assert.equal(classify({ status: 401, message: "bad key" }).kind, "auth");
  assert.equal(classify(new Error("weird")).kind, "unknown");
});

test("only transient kinds retry", () => {
  assert.ok(RETRYABLE.includes(classify({ status: 429 }).kind));
  assert.ok(!RETRYABLE.includes(classify({ status: 401 }).kind));
});

test("AIError is recognised structurally, not by instanceof", async () => {
  const { AIError, isAIError } = await import("./errors.ts");
  const err = new AIError("rate_limit", "slow down");
  // Same shape crossing a module boundary, where instanceof would fail.
  const copy = Object.assign(Object.create(Object.getPrototypeOf({})), {
    name: "AIError", kind: "rate_limit", message: "slow down",
  });
  assert.ok(isAIError(err));
  assert.ok(isAIError(copy));
  assert.ok(!isAIError(new Error("plain")));
  assert.ok(!isAIError(null));
});

test("the retry ladder falls back to the cheap model", async () => {
  const { modelFor, FALLBACK_MODEL } = await import("./models.ts");
  process.env.AI_MODEL_EVALUATE = "gpt-5.6-terra";
  const ladder = [modelFor("evaluate"), FALLBACK_MODEL];
  assert.deepEqual(ladder, ["gpt-5.6-terra", "gpt-5-nano"]);
  delete process.env.AI_MODEL_EVALUATE;
});

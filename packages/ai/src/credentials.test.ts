import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { seal } from "./crypto.ts";
import { resolveCredential, FREE_TIER_DAILY_CALLS } from "./credentials.ts";

const pref = {
  credentialId: null,
  modelDiagram: "gpt-5-nano",
  modelEvaluate: null,
  modelEdit: null,
  modelChat: null,
};

before(() => {
  process.env.AI_KEY_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.OPENAI_API_KEY = "sk-platform-key";
});

test("a user credential wins and is not quota limited", () => {
  const cred = { ...seal("sk-user-key"), id: "c1", provider: "openai" };
  const r = resolveCredential("diagram", pref, cred, 9999);
  assert.equal(r.apiKey, "sk-user-key");
  assert.equal(r.credentialId, "c1");
  assert.equal(r.onPlatformKey, false);
});

test("no credential falls back to the platform key", () => {
  const r = resolveCredential("diagram", pref, null, 0);
  assert.equal(r.apiKey, "sk-platform-key");
  assert.equal(r.onPlatformKey, true);
});

test("the free tier runs out", () => {
  assert.throws(
    () => resolveCredential("diagram", pref, null, FREE_TIER_DAILY_CALLS),
    /Free tier limit/,
  );
});

test("per-task model preference is applied", () => {
  assert.equal(resolveCredential("diagram", pref, null, 0).model, "gpt-5-nano");
  assert.equal(resolveCredential("chat", pref, null, 0).model, undefined);
});

test("no key anywhere asks the user for one", () => {
  delete process.env.OPENAI_API_KEY;
  assert.throws(() => resolveCredential("diagram", pref, null, 0), /Add your own API key/);
  process.env.OPENAI_API_KEY = "sk-platform-key";
});

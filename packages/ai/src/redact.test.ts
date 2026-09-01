import { test } from "node:test";
import assert from "node:assert/strict";
import { redact } from "./redact.ts";

test("provider keys are scrubbed out of strings", () => {
  assert.equal(redact("using sk-proj-abcdef1234567890 now"), "using [redacted] now");
  assert.equal(redact("google AIzaSyABCDEFGH123"), "google [redacted]");
});

test("secret-looking fields are dropped whole", () => {
  assert.deepEqual(
    redact({ apiKey: "sk-proj-abcdef1234567890", model: "gpt-5.6-luna" }),
    { apiKey: "[redacted]", model: "gpt-5.6-luna" },
  );
});

test("nested values and arrays are walked", () => {
  assert.deepEqual(
    redact({ req: { headers: { authorization: "Bearer abc" } }, notes: ["sk-proj-zzzzzzzzzz"] }),
    { req: { headers: { authorization: "[redacted]" } }, notes: ["[redacted]"] },
  );
});

test("ordinary values pass through untouched", () => {
  assert.deepEqual(redact({ n: 1, ok: true, s: "hello" }), { n: 1, ok: true, s: "hello" });
});

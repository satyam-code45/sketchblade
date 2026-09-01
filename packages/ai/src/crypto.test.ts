import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { seal, open, fingerprint, last4 } from "./crypto.ts";

before(() => {
  process.env.AI_KEY_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

test("a sealed key round-trips exactly", () => {
  const key = "sk-proj-abcdef1234567890";
  assert.equal(open(seal(key)), key);
});

// Load-bearing: nonce reuse under GCM is a total break, not a small one.
test("every seal uses a fresh iv and produces distinct ciphertext", () => {
  const ivs = new Set<string>();
  const texts = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    const s = seal("sk-same-key-every-time");
    ivs.add(s.iv.toString("hex"));
    texts.add(s.ciphertext.toString("hex"));
  }
  assert.equal(ivs.size, 1000);
  assert.equal(texts.size, 1000);
});

test("tampering with the ciphertext fails the auth tag", () => {
  const sealed = seal("sk-tamper-me");
  sealed.ciphertext.writeUInt8(sealed.ciphertext.readUInt8(0) ^ 0xff, 0);
  assert.throws(() => open(sealed));
});

test("a wrong master key cannot open it", () => {
  const sealed = seal("sk-secret");
  process.env.AI_KEY_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  assert.throws(() => open(sealed));
});

test("fingerprints match for identical keys and differ otherwise", () => {
  assert.equal(fingerprint("sk-a"), fingerprint("sk-a"));
  assert.notEqual(fingerprint("sk-a"), fingerprint("sk-b"));
  assert.equal(last4("sk-proj-9f2a"), "9f2a");
});

test("a missing or wrong-length master key is rejected", () => {
  delete process.env.AI_KEY_ENCRYPTION_KEY;
  assert.throws(() => seal("x"), /not set/);
  process.env.AI_KEY_ENCRYPTION_KEY = Buffer.from("tooshort").toString("base64");
  assert.throws(() => seal("x"), /32 bytes/);
});

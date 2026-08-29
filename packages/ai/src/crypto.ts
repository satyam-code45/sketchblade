import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type SealedKey = {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keyVersion: number;
};

const ALGO = "aes-256-gcm";
const KEY_VERSION = 1;

function masterKey(): Buffer {
  const raw = process.env.AI_KEY_ENCRYPTION_KEY;
  if (!raw) throw new Error("AI_KEY_ENCRYPTION_KEY is not set.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("AI_KEY_ENCRYPTION_KEY must be 32 bytes, base64 encoded.");
  return key;
}

// GCM over CBC so a tampered ciphertext fails loudly instead of decrypting to garbage.
export function seal(plaintext: string): SealedKey {
  // Fresh nonce every time — reuse under GCM leaks the key stream.
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, masterKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag(), keyVersion: KEY_VERSION };
}

export function open(sealed: SealedKey): string {
  const decipher = createDecipheriv(ALGO, masterKey(), sealed.iv);
  decipher.setAuthTag(sealed.authTag);
  return Buffer.concat([decipher.update(sealed.ciphertext), decipher.final()]).toString("utf8");
}

// One-way is correct here: spotting a duplicate key never needs the key back.
export function fingerprint(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export function last4(plaintext: string): string {
  return plaintext.slice(-4);
}

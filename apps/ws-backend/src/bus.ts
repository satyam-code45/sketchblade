import Redis from "ioredis";
import { randomUUID } from "crypto";

type Handler = (roomId: string, payload: string) => void;

const CHANNEL = "sketchblade:room";
// Stamped on every publish so an instance ignores its own echo.
const INSTANCE = randomUUID();

let pub: Redis | null = null;
let sub: Redis | null = null;
let onRemote: Handler | null = null;

export const busEnabled = () => pub !== null;

// Without REDIS_URL the process is its own island, which is correct for a
// single instance and keeps local dev dependency-free.
export function startBus(handler: Handler) {
  onRemote = handler;
  const url = process.env.REDIS_URL;
  if (!url) {
    console.log("[bus] REDIS_URL not set, running single-instance");
    return;
  }

  pub = new Redis(url);
  sub = new Redis(url);
  sub.subscribe(CHANNEL, (err) => {
    if (err) console.error("[bus] subscribe failed:", err.message);
    else console.log(`[bus] connected, instance ${INSTANCE.slice(0, 8)}`);
  });

  sub.on("message", (_channel, raw) => {
    try {
      const { from, roomId, payload } = JSON.parse(raw);
      if (from === INSTANCE) return;
      onRemote?.(roomId, payload);
    } catch {}
  });
}

export function publish(roomId: string, payload: string) {
  pub?.publish(CHANNEL, JSON.stringify({ from: INSTANCE, roomId, payload }));
}

const presenceKey = (roomId: string) => `sketchblade:presence:${roomId}`;
const PRESENCE_TTL = 45;

// A hard-crashed instance cannot clean up after itself, so entries expire
// instead of haunting the room forever.
export async function markPresent(roomId: string, userId: string, name: string) {
  if (!pub) return;
  await pub.hset(presenceKey(roomId), userId, JSON.stringify({ name, at: Date.now() }));
  await pub.expire(presenceKey(roomId), PRESENCE_TTL);
}

export async function markAbsent(roomId: string, userId: string) {
  if (!pub) return;
  await pub.hdel(presenceKey(roomId), userId);
}

export async function presentIn(roomId: string): Promise<{ userId: string; name: string }[]> {
  if (!pub) return [];
  const raw = await pub.hgetall(presenceKey(roomId));
  const cutoff = Date.now() - PRESENCE_TTL * 1000;
  return Object.entries(raw)
    .map(([userId, v]) => ({ userId, ...JSON.parse(v) }))
    .filter((u) => u.at > cutoff)
    .map(({ userId, name }) => ({ userId, name }));
}

export function stopBus() {
  pub?.quit();
  sub?.quit();
  pub = null;
  sub = null;
}

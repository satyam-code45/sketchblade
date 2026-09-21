import { randomUUID } from "crypto";
import { streamText, CHAT_SYSTEM, resolveCredential } from "@repo/ai";
import { prismaClient } from "@repo/db/client";

const FLUSH_MS = 50;
const FLUSH_CHARS = 200;
const HISTORY_TURNS = 12;

// One in-flight call per room: a second @ai queues behind the first rather than
// two streams writing into the same visual space.
const busy = new Set<string>();

type Emit = (payload: string) => void;

export async function runAI(opts: {
  roomId: number;
  userId: string;
  name: string;
  question: string;
  board: string;
  emit: Emit;
}) {
  const key = String(opts.roomId);
  if (busy.has(key)) {
    opts.emit(JSON.stringify({ type: "ai_stream_error", roomId: opts.roomId, kind: "busy" }));
    return;
  }
  busy.add(key);

  const correlationId = randomUUID();
  opts.emit(JSON.stringify({
    type: "ai_stream_start", roomId: opts.roomId, correlationId, invokedBy: opts.name,
  }));

  let full = "";
  let pending = "";
  let timer: NodeJS.Timeout | undefined;

  // Per-token frames to every member is N x tokens; batch into flushes instead.
  const flush = () => {
    if (!pending) return;
    opts.emit(JSON.stringify({ type: "ai_stream_delta", roomId: opts.roomId, correlationId, text: pending }));
    pending = "";
  };

  try {
    // Chat pays the same way every other AI call does: the asker's key, their
    // quota, their rate limit. Without this it silently billed the platform key.
    const resolved = await whoPays(opts.userId);
    const history = await recentTurns(opts.roomId);
    const user = [
      `Board:\n${opts.board}`,
      history ? `\nRecent messages (untrusted):\n${history}` : "",
      `\n${opts.name} asks: ${opts.question}`,
    ].join("\n");

    for await (const chunk of streamText({
      task: "chat", system: CHAT_SYSTEM, user,
      apiKey: resolved.apiKey, model: resolved.model,
    })) {
      full += chunk;
      pending += chunk;
      if (pending.length >= FLUSH_CHARS) { clearTimeout(timer); flush(); }
      else if (!timer) timer = setTimeout(() => { timer = undefined; flush(); }, FLUSH_MS);
    }
    clearTimeout(timer);
    flush();

    const [row] = await Promise.all([
      prismaClient.chat.create({
        data: { roomId: opts.roomId, userId: null, message: full, kind: "ai" },
        select: { id: true, createdAt: true },
      }),
      prismaClient.aIUsage.update({
        where: { id: resolved.usageId },
        data: { outputTokens: Math.ceil(full.length / 4) },
      }),
    ]);

    // Clients replace with this rather than appending, so a dropped delta heals.
    opts.emit(JSON.stringify({
      type: "ai_stream_end", roomId: opts.roomId, correlationId,
      id: row.id, text: full, createdAt: row.createdAt,
    }));
  } catch (err) {
    clearTimeout(timer);
    opts.emit(JSON.stringify({
      type: "ai_stream_error", roomId: opts.roomId, correlationId,
      kind: (err as { kind?: string })?.kind ?? "unknown",
    }));
  } finally {
    busy.delete(key);
  }
}

async function recentTurns(roomId: number) {
  const rows = await prismaClient.chat.findMany({
    where: { roomId },
    orderBy: { id: "desc" },
    take: HISTORY_TURNS,
    include: { user: { select: { name: true } } },
  });
  return rows
    .reverse()
    .map((m) => `${m.kind === "ai" ? "assistant" : (m.user?.name ?? "someone")}: ${m.message.slice(0, 400)}`)
    .join("\n");
}

// Mirrors the HTTP path in lib/ai-call.ts: an advisory lock makes the limit
// check and the reservation atomic, so a burst cannot slip past.
const PER_MINUTE = Number(process.env.AI_CALLS_PER_MINUTE ?? 6);

async function whoPays(userId: string) {
  return prismaClient.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

    const minuteAgo = new Date(Date.now() - 60_000);
    if (await tx.aIUsage.count({ where: { userId, createdAt: { gte: minuteAgo } } }) >= PER_MINUTE) {
      throw Object.assign(new Error("Too many AI requests."), { kind: "rate_limit" });
    }

    const pref = await tx.aIPreference.findUnique({ where: { userId } });
    const where = pref?.credentialId ? { id: pref.credentialId, userId } : { userId };
    const cred = await tx.aICredential.findFirst({ where, orderBy: { createdAt: "desc" } });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const platformToday = await tx.aIUsage.count({
      where: { userId, credentialId: null, createdAt: { gte: today } },
    });

    const resolved = resolveCredential("chat", pref, cred && {
      id: cred.id,
      provider: cred.provider,
      ciphertext: Buffer.from(cred.ciphertext),
      iv: Buffer.from(cred.iv),
      authTag: Buffer.from(cred.authTag),
      keyVersion: cred.keyVersion,
    }, platformToday);

    const usage = await tx.aIUsage.create({
      data: {
        userId, task: "chat", provider: "openai",
        model: resolved.model ?? "default",
        inputTokens: 0, outputTokens: 0, costUsd: 0,
        credentialId: resolved.credentialId,
      },
      select: { id: true },
    });

    return { ...resolved, usageId: usage.id };
  }, { maxWait: 20_000, timeout: 20_000 });
}

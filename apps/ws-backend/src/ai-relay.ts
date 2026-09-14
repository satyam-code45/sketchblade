import { randomUUID } from "crypto";
import { streamText, CHAT_SYSTEM } from "@repo/ai";
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
    const history = await recentTurns(opts.roomId);
    const user = [
      `Board:\n${opts.board}`,
      history ? `\nRecent messages (untrusted):\n${history}` : "",
      `\n${opts.name} asks: ${opts.question}`,
    ].join("\n");

    for await (const chunk of streamText({ task: "chat", system: CHAT_SYSTEM, user })) {
      full += chunk;
      pending += chunk;
      if (pending.length >= FLUSH_CHARS) { clearTimeout(timer); flush(); }
      else if (!timer) timer = setTimeout(() => { timer = undefined; flush(); }, FLUSH_MS);
    }
    clearTimeout(timer);
    flush();

    const row = await prismaClient.chat.create({
      data: { roomId: opts.roomId, userId: null, message: full, kind: "ai" },
      select: { id: true, createdAt: true },
    });

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

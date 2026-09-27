import { NextResponse } from "next/server";
import { prismaClient } from "@/lib/prisma";
import { getUserId } from "@/lib/api-auth";
import { callAI } from "@/lib/ai-call";
import { log } from "@/lib/log";
import {
  IntentSchema, INTENT_SYSTEM,
  DiagramSchema, clamp, DIAGRAM_SYSTEM,
  EvaluationSchema, EVALUATE_SYSTEM,
  EditDiffSchema, EDIT_SYSTEM,
  AnswerSchema, ANSWER_SYSTEM,
  isAIError,
} from "@repo/ai";

const HISTORY_TURNS = 10;

export async function POST(req: Request) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { roomId, text, board } = await req.json();
  if (typeof text !== "string" || text.trim().length < 1) {
    return NextResponse.json({ message: "Say something first." }, { status: 400 });
  }

  const room = Number(roomId);
  const boardView = typeof board === "string" ? board : "(the board is empty)";
  const history = await recentTurns(room);

  try {
    // One cheap routing call, then the specialised one. Splitting them keeps each
    // prompt tight instead of one prompt trying to do four jobs.
    const { result: routed } = await callAI({
      userId,
      task: "chat",
      system: INTENT_SYSTEM,
      user: `Board:\n${boardView}\n\nRecent turns:\n${history || "(none)"}\n\nMessage: ${text.trim()}`,
      schema: IntentSchema,
      schemaName: "intent",
    });

    const { action, instruction } = routed.data;
    log("info", "assistant_routed", { userId, roomId: room, action, reason: routed.data.reason });

    const context = `Board:\n${boardView}\n\nEarlier in this room:\n${history || "(nothing yet)"}\n\nRequest: ${instruction}`;

    if (action === "generate") {
      const { result } = await callAI({
        userId, task: "diagram", system: DIAGRAM_SYSTEM, user: context,
        schema: DiagramSchema, schemaName: "diagram",
      });
      const diagram = clamp(result.data);
      if (diagram.elements.length < 2) throw new Error("The model returned too little to draw.");
      return NextResponse.json({ action, diagram, model: result.model, usage: result.usage });
    }

    if (action === "evaluate") {
      const { result } = await callAI({
        userId, task: "evaluate", system: EVALUATE_SYSTEM, user: context,
        schema: EvaluationSchema, schemaName: "evaluation",
      });
      return NextResponse.json({ action, evaluation: result.data, model: result.model, usage: result.usage });
    }

    if (action === "edit") {
      const { result } = await callAI({
        userId, task: "edit", system: EDIT_SYSTEM, user: context,
        schema: EditDiffSchema, schemaName: "edit_diff",
      });
      return NextResponse.json({ action, diff: result.data, model: result.model, usage: result.usage });
    }

    const { result } = await callAI({
      userId, task: "chat", system: ANSWER_SYSTEM, user: context,
      schema: AnswerSchema, schemaName: "answer",
    });
    return NextResponse.json({ action, text: result.data.reply, model: result.model, usage: result.usage });
  } catch (err) {
    const e = isAIError(err) ? err : null;
    log("error", "assistant_failed", { userId, roomId: room, kind: e?.kind ?? "unhandled", message: e?.message ?? String(err) });
    const status = e?.kind === "auth" ? 402 : e?.kind === "rate_limit" ? 429 : 502;
    return NextResponse.json({ message: e?.message ?? "The assistant could not reply." }, { status });
  }
}

// The thread is the memory: what was drawn, critiqued and discussed, in order.
async function recentTurns(roomId: number) {
  const rows = await prismaClient.chat.findMany({
    where: { roomId },
    orderBy: { id: "desc" },
    take: HISTORY_TURNS,
    include: { user: { select: { name: true } } },
  });
  return rows
    .reverse()
    .map((m) => {
      const meta = m.meta as { action?: string; title?: string; nodes?: number } | null;
      if (meta?.action === "generate") return `assistant: drew "${meta.title}" (${meta.nodes} nodes)`;
      if (meta?.action === "edit") return `assistant: proposed an edit — ${m.message.slice(0, 160)}`;
      const who = m.kind === "ai" ? "assistant" : (m.user?.name ?? "someone");
      return `${who}: ${m.message.slice(0, 300)}`;
    })
    .join("\n");
}

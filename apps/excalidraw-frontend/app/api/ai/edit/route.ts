import { NextResponse } from "next/server";
import { getUserId } from "@/lib/api-auth";
import { callAI } from "@/lib/ai-call";
import { overRateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/log";
import { EditDiffSchema, EDIT_SYSTEM, AIError } from "@repo/ai";

export async function POST(req: Request) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  if (await overRateLimit(userId)) {
    return NextResponse.json({ message: "Slow down a moment — too many AI requests." }, { status: 429 });
  }

  const { board, instruction } = await req.json();
  if (typeof board !== "string" || typeof instruction !== "string" || instruction.trim().length < 3) {
    return NextResponse.json({ message: "Say what you want changed." }, { status: 400 });
  }

  try {
    const { result } = await callAI({
      userId,
      task: "edit",
      system: EDIT_SYSTEM,
      user: `Board:\n${board}\n\nChange requested: ${instruction.trim()}`,
      schema: EditDiffSchema,
      schemaName: "edit_diff",
    });
    return NextResponse.json({ diff: result.data, model: result.model, usage: result.usage });
  } catch (err) {
    const e = err instanceof AIError ? err : null;
    log("error", "ai_call_failed", { task: "edit", userId, kind: e?.kind, message: e?.message });
    const status = e?.kind === "auth" ? 402 : e?.kind === "rate_limit" ? 429 : 502;
    return NextResponse.json({ message: e?.message ?? "Could not work out an edit." }, { status });
  }
}

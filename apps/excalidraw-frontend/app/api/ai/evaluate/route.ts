import { NextResponse } from "next/server";
import { getUserId } from "@/lib/api-auth";
import { callAI } from "@/lib/ai-call";
import { overRateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/log";
import { EvaluationSchema, EVALUATE_SYSTEM, AIError } from "@repo/ai";

export async function POST(req: Request) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  if (await overRateLimit(userId)) {
    return NextResponse.json({ message: "Slow down a moment — too many AI requests." }, { status: 429 });
  }

  const { board } = await req.json();
  if (typeof board !== "string" || board.length < 5) {
    return NextResponse.json({ message: "There is nothing on the board to review." }, { status: 400 });
  }

  try {
    const { result } = await callAI({
      userId,
      task: "evaluate",
      system: EVALUATE_SYSTEM,
      user: `Board:\n${board}`,
      schema: EvaluationSchema,
      schemaName: "evaluation",
    });
    return NextResponse.json({ evaluation: result.data, model: result.model, usage: result.usage });
  } catch (err) {
    const e = err instanceof AIError ? err : null;
    log("error", "ai_call_failed", { task: "evaluate", userId, kind: e?.kind, message: e?.message });
    const status = e?.kind === "auth" ? 402 : e?.kind === "rate_limit" ? 429 : 502;
    return NextResponse.json({ message: e?.message ?? "Evaluation failed." }, { status });
  }
}

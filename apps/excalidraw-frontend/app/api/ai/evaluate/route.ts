import { NextResponse } from "next/server";
import { getUserId } from "@/lib/api-auth";
import { callAI } from "@/lib/ai-call";
import { EvaluationSchema, EVALUATE_SYSTEM, AIError } from "@repo/ai";

export async function POST(req: Request) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

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
    const status = e?.kind === "auth" ? 402 : e?.kind === "rate_limit" ? 429 : 502;
    return NextResponse.json({ message: e?.message ?? "Evaluation failed." }, { status });
  }
}

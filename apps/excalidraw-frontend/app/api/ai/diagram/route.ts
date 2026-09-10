import { NextResponse } from "next/server";
import { getUserId } from "@/lib/api-auth";
import { callAI } from "@/lib/ai-call";
import { log } from "@/lib/log";
import { DiagramSchema, clamp, PRESETS, isAIError, type PresetId } from "@repo/ai";

export async function POST(req: Request) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { prompt, preset = "diagram" } = await req.json();
  if (typeof prompt !== "string" || prompt.trim().length < 3) {
    return NextResponse.json({ message: "Describe what you want to draw." }, { status: 400 });
  }

  const chosen = PRESETS[preset as PresetId] ?? PRESETS.diagram;

  try {
    const { result, onPlatformKey } = await callAI({
      userId,
      task: "diagram",
      system: chosen.system,
      user: prompt.trim(),
      schema: DiagramSchema,
      schemaName: "diagram",
    });

    const diagram = clamp(result.data);
    if (diagram.elements.length < 2) {
      return NextResponse.json({ message: "The model returned too little to draw." }, { status: 502 });
    }

    return NextResponse.json({
      diagram,
      model: result.model,
      usage: result.usage,
      onPlatformKey,
    });
  } catch (err) {
    const e = isAIError(err) ? err : null;
    log("error", "ai_call_failed", { task: "diagram", userId, kind: e?.kind ?? "unhandled", message: e?.message ?? String(err) });
    const status = e?.kind === "auth" ? 402 : e?.kind === "rate_limit" ? 429 : 502;
    return NextResponse.json({ message: e?.message ?? "Diagram generation failed." }, { status });
  }
}

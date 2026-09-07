"use client";

import { useState } from "react";
import { Sparkles, X, ArrowUp, Loader2 } from "lucide-react";
import type { Game, Shape } from "@/draw";
import { compileDiagram } from "@/draw/ai/diagram-to-shapes";
import ReviewPanel from "@/components/ai/ReviewPanel";

// Local only: never added to the scene, never broadcast.
function placeholderShapes(c: { x: number; y: number }): Shape[] {
  const x = c.x - 210;
  const y = c.y - 110;
  return [
    { type: "rect", x, y, width: 420, height: 220, color: "#8b5cf6", fillColor: "#f5f3ff", strokeWidth: 2 },
    { type: "text", x: x + 24, y: y + 48, text: "Generating…", fontSize: 22, color: "#6d28d9" },
    { type: "rect", x: x + 24, y: y + 90, width: 330, height: 16, color: "#8b5cf6", fillColor: "#ddd6fe", strokeWidth: 1 },
    { type: "rect", x: x + 24, y: y + 126, width: 250, height: 16, color: "#8b5cf6", fillColor: "#ddd6fe", strokeWidth: 1 },
    { type: "rect", x: x + 24, y: y + 162, width: 180, height: 16, color: "#8b5cf6", fillColor: "#ddd6fe", strokeWidth: 1 },
  ];
}

const PRESETS = [
  { id: "diagram", label: "Diagram", hint: "General ideas and relationships" },
  { id: "flowchart", label: "Flowchart", hint: "Steps, branches, decisions" },
  { id: "architecture", label: "Architecture", hint: "Services, data, infra" },
  { id: "web", label: "Web mockup", hint: "Page sections and flows" },
  { id: "mobile", label: "Mobile mockup", hint: "Screens and navigation" },
] as const;

type Props = { game: Game | null; onClose: () => void };

export default function AIPanel({ game, onClose }: Props) {
  const [tab, setTab] = useState<"generate" | "review">("generate");
  const [preset, setPreset] = useState<string>("diagram");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const generate = async () => {
    if (!game || prompt.trim().length < 3) return;
    setBusy(true);
    setError("");
    setNote("");

    // Generation takes tens of seconds; anchor the wait where the shapes land.
    const centre = game.getViewportCenter();
    game.setPreview(placeholderShapes(centre));
    game.broadcastAIActivity("generating");

    try {
      const res = await fetch("/api/ai/diagram", {
        method: "POST",
        headers: {
          authorization: localStorage.getItem("token") ?? "",
          "content-type": "application/json",
        },
        body: JSON.stringify({ prompt: prompt.trim(), preset }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Generation failed.");

      // Centre the diagram on what the user is looking at.
      const spanX = Math.max(...body.diagram.elements.map((e: { x: number; width: number }) => e.x + e.width), 0);
      const spanY = Math.max(...body.diagram.elements.map((e: { y: number; height: number }) => e.y + e.height), 0);
      const shapes = compileDiagram(body.diagram, {
        x: centre.x - spanX / 2,
        y: centre.y - spanY / 2,
      });

      game.clearPreview();
      game.addShapes(shapes);
      setNote(`${body.diagram.elements.length} nodes · ${body.model} · $${body.usage.costUsd.toFixed(4)}`);
      setPrompt("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      game.broadcastAIActivity("idle");
      game.clearPreview();
      setBusy(false);
    }
  };

  return (
    <div className="absolute bottom-20 right-4 z-40 w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-border/60 bg-background/95 p-4 shadow-xl backdrop-blur-md">
      <div className="mb-3 flex items-start justify-between">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4" /> Generate with AI
        </span>
        <button onClick={onClose} title="Close" className="rounded-md p-1 text-muted-foreground hover:bg-accent">
          <X className="size-4" />
        </button>
      </div>

      <div className="mb-3 flex rounded-lg bg-muted/60 p-0.5">
        {(["generate", "review"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-2 py-1 text-xs font-medium capitalize transition-colors ${
              tab === t ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "review" && <ReviewPanel game={game} />}

      {tab === "generate" && (
      <>
      <div className="mb-3 grid grid-cols-2 gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPreset(p.id)}
            title={p.hint}
            className={`rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
              preset === p.id
                ? "border-primary/60 bg-primary/10 font-medium"
                : "border-border/60 hover:bg-accent"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void generate();
        }}
        placeholder="Describe what to draw…"
        rows={3}
        className="w-full resize-none rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-ring"
      />

      <button
        onClick={generate}
        disabled={busy || prompt.trim().length < 3}
        className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
        {busy ? "Generating…" : "Generate"}
      </button>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
      {!error && !note && (
        <p className="mt-2 text-[11px] text-muted-foreground">Everyone in the room sees it appear. ⌘↵ to generate.</p>
      )}
      </>
      )}
    </div>
  );
}

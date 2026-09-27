"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Loader2, Clock, Crosshair } from "lucide-react";
import type { Game, Shape } from "@/draw";
import { compileDiagram } from "@/draw/ai/diagram-to-shapes";

const PRESETS = [
  { id: "diagram", label: "Diagram" },
  { id: "flowchart", label: "Flowchart" },
  { id: "architecture", label: "Architecture" },
  { id: "web", label: "Web mockup" },
  { id: "mobile", label: "Mobile mockup" },
] as const;

type Entry = {
  id: string;
  prompt: string;
  preset: string;
  title: string;
  nodes: number;
  model: string;
  costUsd: number;
  at: number;
  centre: { x: number; y: number };
};

const key = (roomId: string) => `sketchblade-ai-history-${roomId}`;

// localStorage throws in private mode, so every access is guarded.
const readHistory = (roomId: string): Entry[] => {
  try { return JSON.parse(localStorage.getItem(key(roomId)) ?? "[]"); } catch { return []; }
};

function placeholderShapes(c: { x: number; y: number }): Shape[] {
  const x = c.x - 210;
  const y = c.y - 110;
  return [
    { type: "rect", x, y, width: 420, height: 220, color: "#8b5cf6", fillColor: "#f5f3ff", strokeWidth: 2 },
    { type: "text", x: x + 24, y: y + 48, text: "Generating...", fontSize: 22, color: "#6d28d9" },
    { type: "rect", x: x + 24, y: y + 90, width: 330, height: 16, color: "#8b5cf6", fillColor: "#ddd6fe", strokeWidth: 1 },
    { type: "rect", x: x + 24, y: y + 126, width: 250, height: 16, color: "#8b5cf6", fillColor: "#ddd6fe", strokeWidth: 1 },
  ];
}

const ago = (t: number) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default function GenerateTab({ game, roomId }: { game: Game | null; roomId: string }) {
  const [preset, setPreset] = useState<string>("diagram");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<Entry[]>([]);

  useEffect(() => { setHistory(readHistory(roomId)); }, [roomId]);

  const remember = (e: Entry) => {
    const next = [e, ...history].slice(0, 20);
    setHistory(next);
    try { localStorage.setItem(key(roomId), JSON.stringify(next)); } catch {}
  };

  const generate = async () => {
    if (!game || prompt.trim().length < 3) return;
    setBusy(true);
    setError("");

    const centre = game.getViewportCenter();
    game.setPreview(placeholderShapes(centre));
    game.broadcastAIActivity("generating");

    try {
      const res = await fetch("/api/ai/diagram", {
        method: "POST",
        headers: { authorization: localStorage.getItem("token") ?? "", "content-type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), preset }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Generation failed.");

      const spanX = Math.max(...body.diagram.elements.map((e: { x: number; width: number }) => e.x + e.width), 0);
      const spanY = Math.max(...body.diagram.elements.map((e: { y: number; height: number }) => e.y + e.height), 0);
      const origin = { x: centre.x - spanX / 2, y: centre.y - spanY / 2 };

      game.clearPreview();
      game.addShapes(compileDiagram(body.diagram, origin));

      remember({
        id: crypto.randomUUID(),
        prompt: prompt.trim(),
        preset,
        title: body.diagram.title,
        nodes: body.diagram.elements.length,
        model: body.model,
        costUsd: body.usage.costUsd,
        at: Date.now(),
        centre,
      });
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
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Style</p>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                preset === p.id ? "border-primary/60 bg-primary/10 font-medium" : "border-border/60 hover:bg-accent"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void generate(); }}
          placeholder="Describe what to draw..."
          rows={4}
          className="w-full resize-none rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-ring"
        />

        <button
          onClick={generate}
          disabled={busy || prompt.trim().length < 3}
          className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          {busy ? "Generating..." : "Generate"}
        </button>

        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        {!error && <p className="mt-2 text-[10px] text-muted-foreground">Everyone in the room sees it appear. Cmd+Enter to generate.</p>}

        {history.length > 0 && (
          <>
            <div className="mb-2 mt-5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Clock className="size-3.5" /> This room
            </div>
            <ul className="space-y-1.5">
              {history.map((h) => (
                <li key={h.id} className="rounded-lg border border-border/50 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium leading-snug">{h.title}</p>
                    <button
                      onClick={() => game?.centreOn(h.centre)}
                      title="Scroll to it"
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent"
                    >
                      <Crosshair className="size-3.5" />
                    </button>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{h.prompt}</p>
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    {h.nodes} nodes · {h.preset} · ${h.costUsd.toFixed(4)} · {ago(h.at)}
                  </p>
                  <button
                    onClick={() => { setPrompt(h.prompt); setPreset(h.preset); }}
                    className="mt-1.5 text-[11px] text-primary hover:underline"
                  >
                    Use again
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Crosshair, RotateCcw, Waypoints } from "lucide-react";
import type { Game, Shape } from "@/draw";
import { compileDiagram } from "@/draw/ai/diagram-to-shapes";

type Entry = {
  id: string;
  prompt: string;
  title: string;
  nodes: number;
  model: string;
  costUsd: number;
  at: number;
  centre: { x: number; y: number };
};

const EXAMPLES = [
  "A checkout flow with payment retries and a fraud check",
  "How a URL shortener serves a redirect",
  "Sign-up screens for a mobile banking app",
];

const key = (roomId: string) => `sketchblade-ai-history-${roomId}`;

// localStorage throws in private mode, so every access is guarded.
const readHistory = (roomId: string): Entry[] => {
  try { return JSON.parse(localStorage.getItem(key(roomId)) ?? "[]"); } catch { return []; }
};

function placeholderShapes(c: { x: number; y: number }): Shape[] {
  const x = c.x - 210;
  const y = c.y - 100;
  return [
    { type: "rect", x, y, width: 420, height: 200, color: "#8b5cf6", strokeWidth: 2 },
    { type: "text", x: x + 22, y: y + 44, text: "Generating…", fontSize: 18, color: "#a78bfa" },
    { type: "rect", x: x + 22, y: y + 78, width: 300, height: 12, color: "#8b5cf6", strokeWidth: 1 },
    { type: "rect", x: x + 22, y: y + 110, width: 220, height: 12, color: "#8b5cf6", strokeWidth: 1 },
    { type: "rect", x: x + 22, y: y + 142, width: 260, height: 12, color: "#8b5cf6", strokeWidth: 1 },
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
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Generation failed.");

      const spanX = Math.max(...body.diagram.elements.map((e: { x: number; width: number }) => e.x + e.width), 0);
      const spanY = Math.max(...body.diagram.elements.map((e: { y: number; height: number }) => e.y + e.height), 0);

      game.clearPreview();
      game.addShapes(compileDiagram(body.diagram, { x: centre.x - spanX / 2, y: centre.y - spanY / 2 }));

      remember({
        id: crypto.randomUUID(),
        prompt: prompt.trim(),
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
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {busy && (
          <div className="space-y-2 rounded-xl border border-border/50 p-3">
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-full animate-pulse rounded bg-muted/70" />
            <div className="h-2.5 w-4/5 animate-pulse rounded bg-muted/70" />
          </div>
        )}

        {!busy && history.length === 0 && (
          <div className="mt-6">
            <div className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-center">
              <Waypoints className="mx-auto size-5 text-muted-foreground/60" strokeWidth={1.75} />
              <p className="mt-2 text-[12px] font-medium">Nothing generated yet</p>
              <p className="mx-auto mt-1 max-w-[30ch] text-[11px] leading-relaxed text-muted-foreground">
                Describe a system and it lands on the canvas for everyone in the room.
              </p>
            </div>

            <p className="mb-2 mt-5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Try
            </p>
            <ul className="space-y-1">
              {EXAMPLES.map((e) => (
                <li key={e}>
                  <button
                    onClick={() => setPrompt(e)}
                    className="w-full rounded-lg px-2.5 py-2 text-left text-[12px] leading-snug text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {e}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {history.length > 0 && (
          <section className="mt-1">
            <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Earlier in this room
            </h3>
            <ul className="space-y-1">
              {history.map((h) => (
                <li key={h.id} className="group rounded-lg px-2.5 py-2 transition-colors hover:bg-accent/50">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-pretty text-[13px] font-medium leading-snug">{h.title}</p>
                    <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <button
                        onClick={() => game?.centreOn(h.centre)}
                        title="Scroll to it"
                        aria-label={`Scroll to ${h.title}`}
                        className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        <Crosshair className="size-3.5" />
                      </button>
                      <button
                        onClick={() => setPrompt(h.prompt)}
                        title="Use this prompt again"
                        aria-label={`Reuse prompt: ${h.prompt}`}
                        className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        <RotateCcw className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{h.prompt}</p>
                  <p className="nums mt-1 text-[10px] text-muted-foreground/80">
                    {h.nodes} nodes · ${h.costUsd.toFixed(4)} · {ago(h.at)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-destructive/10 px-2.5 py-2 text-[12px] text-destructive">
            {error}
          </p>
        )}
      </div>

      {/* Docked like the chat composer so every tab writes from the same place */}
      <div className="px-4 pb-4">
        <div className="rounded-xl border border-border/60 bg-card/40 p-1 transition-colors focus-within:border-primary/40">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void generate(); }}
            placeholder="Describe a system, a flow or a screen…"
            rows={3}
            aria-label="Describe the diagram"
            className="w-full resize-none bg-transparent px-2.5 py-2 text-[13px] leading-relaxed outline-none placeholder:text-muted-foreground/60"
          />
          <div className="flex items-center justify-between gap-2 pl-2.5 pr-1 pb-1">
            <span className="text-[10px] text-muted-foreground">⌘↵ to send</span>
            <button
              onClick={generate}
              disabled={busy || prompt.trim().length < 3}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[12px] font-medium text-primary-foreground transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-95 disabled:opacity-40 disabled:active:scale-100"
            >
              {busy ? "Generating…" : <><ArrowUp className="size-3.5" strokeWidth={2.25} /> Generate</>}
            </button>
          </div>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
          Everyone in the room sees it appear.
        </p>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Crosshair, MessagesSquare, Sparkles } from "lucide-react";
import type { Game, Shape } from "@/draw";
import { serializeBoard } from "@/draw/ai/serialize-board";
import { compileDiagram } from "@/draw/ai/diagram-to-shapes";
import { classifyDiff, applyToShape, type Change } from "@/draw/ai/apply-diff";

type Finding = { severity: string; category: string; title: string; detail: string; suggestion: string; refs: string[] };

type Turn = {
  id: string | number;
  who: "you" | "ai" | "them";
  name: string;
  text: string;
  streaming?: boolean;
  diagram?: { title: string; nodes: number; centre: { x: number; y: number } };
  findings?: Finding[];
  changes?: Change[];
  pending?: boolean;
};

const SEVERITY: Record<string, string> = {
  critical: "bg-destructive",
  warning: "bg-amber-500",
  suggestion: "bg-muted-foreground",
};

const STATUS_NOTE: Record<string, string> = {
  stale: "changed by someone else",
  orphaned: "no longer on the board",
};

const EXAMPLES = [
  "Draw a checkout flow with payment retries",
  "What are the single points of failure here?",
  "Add a cache between the API and the database",
];

const auth = () => ({
  authorization: localStorage.getItem("token") ?? "",
  "content-type": "application/json",
});

export default function Thread({ game, roomId }: { game: Game | null; roomId: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/rooms/${roomId}/messages`, { headers: auth() })
      .then((r) => r.json())
      .then((b) => setTurns((b.messages ?? []).map(fromRow)))
      .catch(() => {});
  }, [roomId]);

  // Messages from other people in the room arrive over the socket.
  const onEvent = useCallback((msg: Record<string, unknown>) => {
    if (msg.type !== "chat_message") return;
    setTurns((t) => [...t, fromRow(msg as never)]);
  }, []);
  useEffect(() => { if (game) game.onChat = onEvent; }, [game, onEvent]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [turns, busy]);

  const say = (t: Turn) => setTurns((prev) => [...prev, t]);

  const send = async (raw?: string) => {
    const text = (raw ?? draft).trim();
    if (!game || !text || busy) return;
    setDraft("");
    setBusy(true);

    const board = serializeBoard(game.existingShapes);
    game.sendChat(text, board.text);
    say({ id: `me-${Date.now()}`, who: "you", name: "You", text });

    const centre = game.getViewportCenter();
    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: auth(),
        body: JSON.stringify({ roomId: Number(roomId), text, board: board.text }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "The assistant could not reply.");

      if (body.action === "generate") {
        const spanX = Math.max(...body.diagram.elements.map((e: { x: number; width: number }) => e.x + e.width), 0);
        const spanY = Math.max(...body.diagram.elements.map((e: { y: number; height: number }) => e.y + e.height), 0);
        game.addShapes(compileDiagram(body.diagram, { x: centre.x - spanX / 2, y: centre.y - spanY / 2 }));
        say({
          id: `ai-${Date.now()}`, who: "ai", name: "Assistant",
          text: `Drew “${body.diagram.title}”.`,
          diagram: { title: body.diagram.title, nodes: body.diagram.elements.length, centre },
        });
      } else if (body.action === "evaluate") {
        say({ id: `ai-${Date.now()}`, who: "ai", name: "Assistant", text: body.evaluation.summary, findings: body.evaluation.findings });
      } else if (body.action === "edit") {
        const classified = classifyDiff(body.diff, board.byAlias, game.existingShapes);
        game.setPreview(classified.filter((c) => c.kind === "add" && c.status === "applicable").map((c) => (c as { shape: Shape }).shape));
        say({ id: `ai-${Date.now()}`, who: "ai", name: "Assistant", text: body.diff.rationale, changes: classified, pending: true });
      } else {
        say({ id: `ai-${Date.now()}`, who: "ai", name: "Assistant", text: body.text });
      }
    } catch (e) {
      say({ id: `err-${Date.now()}`, who: "ai", name: "Assistant", text: e instanceof Error ? e.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  };

  const resolve = (id: string | number, accept: boolean) => {
    setTurns((prev) => prev.map((t) => {
      if (t.id !== id || !t.changes) return t;
      if (accept && game) {
        const live = t.changes.filter((c) => c.status === "applicable");
        game.applyDiff({
          add: live.filter((c) => c.kind === "add").map((c) => (c as { shape: Shape }).shape),
          modify: live.filter((c) => c.kind === "modify").map((c) => {
            const m = c as { id: string; field: string; value: string };
            return { id: m.id, apply: (s: Shape) => applyToShape(s, m.field, m.value) };
          }),
          removeIds: live.filter((c) => c.kind === "remove").map((c) => (c as { id: string }).id),
        });
      }
      return { ...t, pending: false, text: accept ? `${t.text}\n\nApplied.` : `${t.text}\n\nDiscarded.` };
    }));
    game?.clearPreview();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
        {turns.length === 0 && !busy && (
          <div className="mt-8">
            <div className="text-center">
              <MessagesSquare className="mx-auto size-5 text-muted-foreground/60" strokeWidth={1.75} />
              <p className="mt-2 text-[12px] font-medium">Ask for anything</p>
              <p className="mx-auto mt-1 max-w-[34ch] text-[11px] leading-relaxed text-muted-foreground">
                Draw something new, get a critique, or change what is already there. Everyone in the room sees it.
              </p>
            </div>
            <ul className="mt-5 space-y-1">
              {EXAMPLES.map((e) => (
                <li key={e}>
                  <button
                    onClick={() => send(e)}
                    className="w-full rounded-lg px-2.5 py-2 text-left text-[12px] leading-snug text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {e}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {turns.map((t) => (
          <article key={t.id}>
            <div className="mb-1 flex items-center gap-1.5">
              {t.who === "ai" && <Sparkles className="size-3 text-primary" strokeWidth={2.25} />}
              <span className={`text-[11px] font-semibold ${t.who === "ai" ? "text-primary" : "text-foreground"}`}>
                {t.name}
              </span>
            </div>

            <p className={`whitespace-pre-wrap text-pretty text-[13px] leading-relaxed ${
              t.who === "ai" ? "border-l-2 border-primary/25 pl-3 text-foreground/90" : "text-foreground/80"
            }`}>
              {t.text}
            </p>

            {t.diagram && (
              <button
                onClick={() => game?.centreOn(t.diagram!.centre)}
                className="nums ml-3 mt-1.5 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Crosshair className="size-3" /> {t.diagram.nodes} nodes · scroll to it
              </button>
            )}

            {t.findings && (
              <ul className="ml-3 mt-2 space-y-2">
                {t.findings.map((f, i) => (
                  <li key={i}>
                    <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide">
                      <span className={`size-1.5 rounded-full ${SEVERITY[f.severity]}`} />
                      <span className="text-muted-foreground">{f.category}</span>
                    </p>
                    <p className="mt-0.5 text-[12px] font-medium leading-snug">{f.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{f.detail}</p>
                    <button
                      onClick={() => send(f.suggestion)}
                      disabled={busy}
                      className="mt-1 text-[11px] font-medium text-primary hover:underline disabled:opacity-40"
                    >
                      Fix it
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {t.changes && (
              <div className="ml-3 mt-2">
                {t.changes.some((c) => c.status !== "applicable") && (
                  <p className="mb-1.5 text-[11px] text-amber-500">
                    {t.changes.filter((c) => c.status !== "applicable").length} skipped — the board moved while the AI was thinking.
                  </p>
                )}
                <ul className="space-y-0.5">
                  {t.changes.map((c, i) => (
                    <li key={i} className={`text-[11px] ${c.status === "applicable" ? "text-muted-foreground" : "text-muted-foreground/50 line-through"}`}>
                      {c.describe}
                      {c.status !== "applicable" && <span className="ml-1 no-underline">({STATUS_NOTE[c.status]})</span>}
                    </li>
                  ))}
                </ul>
                {t.pending && (
                  <div className="mt-2 flex gap-1.5">
                    <button
                      onClick={() => resolve(t.id, true)}
                      className="h-7 rounded-lg bg-primary px-3 text-[11px] font-medium text-primary-foreground transition-all hover:brightness-110 active:scale-95"
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => resolve(t.id, false)}
                      className="h-7 rounded-lg border border-border/60 px-3 text-[11px] transition-colors hover:bg-accent"
                    >
                      Discard
                    </button>
                  </div>
                )}
              </div>
            )}
          </article>
        ))}

        {busy && (
          <div className="flex items-center gap-1.5 pl-3">
            <span className="size-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.3s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.15s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-primary/60" />
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="px-4 pb-4">
        <div className="rounded-xl border border-border/60 bg-card/40 p-1 transition-colors focus-within:border-primary/40">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
            }}
            placeholder="Draw something, ask about the board, or request a change…"
            rows={2}
            aria-label="Message the assistant"
            className="w-full resize-none bg-transparent px-2.5 py-2 text-[13px] leading-relaxed outline-none placeholder:text-muted-foreground/60"
          />
          <div className="flex items-center justify-between gap-2 pb-1 pl-2.5 pr-1">
            <span className="text-[10px] text-muted-foreground">Enter to send</span>
            <button
              onClick={() => send()}
              disabled={busy || draft.trim().length === 0}
              title="Send"
              aria-label="Send"
              className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-95 disabled:opacity-40 disabled:active:scale-100"
            >
              <ArrowUp className="size-4" strokeWidth={2.25} />
            </button>
          </div>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
          Runs on your key. Changes are proposed, never applied without you.
        </p>
      </div>
    </div>
  );
}

function fromRow(m: { id: number; name: string; kind: string; text: string; meta?: { action?: string; title?: string; nodes?: number } }): Turn {
  return {
    id: m.id,
    who: m.kind === "ai" ? "ai" : "them",
    name: m.kind === "ai" ? "Assistant" : m.name,
    text: m.text,
  };
}

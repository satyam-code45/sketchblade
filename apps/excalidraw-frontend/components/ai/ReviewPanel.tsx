"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { Game, Shape } from "@/draw";
import { serializeBoard } from "@/draw/ai/serialize-board";
import { classifyDiff, applyToShape, type Change } from "@/draw/ai/apply-diff";

type Finding = {
  severity: "critical" | "warning" | "suggestion";
  category: string;
  title: string;
  detail: string;
  suggestion: string;
  refs: string[];
};

// A left rule carries severity without shouting; colour stays on the label.
const SEVERITY: Record<string, { rule: string; dot: string; text: string }> = {
  critical:   { rule: "border-destructive/50", dot: "bg-destructive",  text: "text-destructive" },
  warning:    { rule: "border-amber-500/50",   dot: "bg-amber-500",    text: "text-amber-500" },
  suggestion: { rule: "border-border",         dot: "bg-muted-foreground", text: "text-muted-foreground" },
};

const STATUS_NOTE: Record<string, string> = {
  stale: "changed by someone else",
  orphaned: "no longer on the board",
};

// A hollow box around a shape's bounds, drawn on the preview layer.
function outlineOf(s: Shape): Shape | null {
  if (s.type === "rect" || s.type === "diamond" || s.type === "image" || s.type === "video") {
    return { type: "rect", x: s.x - 6, y: s.y - 6, width: s.width + 12, height: s.height + 12, color: "#f59e0b", strokeWidth: 3 };
  }
  if (s.type === "ellipse") {
    return { type: "rect", x: s.centerX - s.rx - 6, y: s.centerY - s.ry - 6, width: s.rx * 2 + 12, height: s.ry * 2 + 12, color: "#f59e0b", strokeWidth: 3 };
  }
  return null;
}

const auth = () => ({
  authorization: localStorage.getItem("token") ?? "",
  "content-type": "application/json",
});

export default function ReviewPanel({ game }: { game: Game | null }) {
  const [busy, setBusy] = useState<"evaluate" | "edit" | null>(null);
  const [error, setError] = useState("");
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [summary, setSummary] = useState("");
  const [instruction, setInstruction] = useState("");
  const [changes, setChanges] = useState<Change[] | null>(null);
  const [rejected, setRejected] = useState<Set<number>>(new Set());
  const [rationale, setRationale] = useState("");
  const [view, setView] = useState<ReturnType<typeof serializeBoard> | null>(null);

  // Hovering a finding outlines the shapes it refers to, using the same
  // translucent preview layer as proposed edits.
  const highlight = (refs: string[]) => {
    if (!game || !view) return;
    const boxes = refs
      .map((r) => view.byAlias.get(r))
      .filter((s): s is Shape => Boolean(s))
      .map((s) => outlineOf(s))
      .filter((b): b is Shape => Boolean(b));
    game.setPreview(boxes);
  };

  const evaluate = async () => {
    if (!game) return;
    setBusy("evaluate");
    setError("");
    setFindings(null);
    try {
      const boardView = serializeBoard(game.existingShapes);
      setView(boardView);
      const res = await fetch("/api/ai/evaluate", { method: "POST", headers: auth(), body: JSON.stringify({ board: boardView.text }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message);
      setFindings(body.evaluation.findings);
      setSummary(body.evaluation.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evaluation failed.");
    } finally {
      setBusy(null);
    }
  };

  const propose = async (text: string) => {
    if (!game || text.trim().length < 3) return;
    setBusy("edit");
    setError("");
    try {
      const view = serializeBoard(game.existingShapes);
      setView(view);
      const res = await fetch("/api/ai/edit", {
        method: "POST",
        headers: auth(),
        body: JSON.stringify({ board: view.text, instruction: text.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message);

      // Re-checked against live state, not the snapshot the model saw.
      const classified = classifyDiff(body.diff, view.byAlias, game.existingShapes);
      setChanges(classified);
      setRationale(body.diff.rationale);
      setRejected(new Set());
      game.setPreview(classified.filter((c) => c.kind === "add" && c.status === "applicable").map((c) => c.shape));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not work out an edit.");
    } finally {
      setBusy(null);
    }
  };

  const discard = () => {
    game?.clearPreview();
    setChanges(null);
    setRationale("");
  };

  const accept = () => {
    if (!game || !changes) return;
    const live = changes.filter((c, i) => c.status === "applicable" && !rejected.has(i));
    game.clearPreview();
    game.applyDiff({
      add: live.filter((c): c is Extract<Change, { kind: "add" }> => c.kind === "add").map((c) => c.shape as Shape),
      modify: live
        .filter((c): c is Extract<Change, { kind: "modify" }> => c.kind === "modify")
        .map((c) => ({ id: c.id, apply: (s: Shape) => applyToShape(s, c.field, c.value) })),
      removeIds: live.filter((c) => c.kind === "remove").map((c) => c.id),
    });
    setChanges(null);
    setRationale("");
  };

  const skipped = changes?.filter((c) => c.status !== "applicable").length ?? 0;

  return (
    <div className="h-full space-y-3 overflow-y-auto px-4 pb-4">
      {!changes && (
        <>
          <button
            onClick={evaluate}
            disabled={busy !== null}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border/60 bg-card/40 text-[13px] font-medium transition-all duration-200 hover:border-primary/40 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.98] disabled:opacity-40"
          >
            {busy === "evaluate" && <Loader2 className="size-4 animate-spin" />}
            {busy === "evaluate" ? "Reading the board\u2026" : "Review this board"}
          </button>

          {busy === "evaluate" && (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-1.5 rounded-xl border border-border/50 p-3">
                  <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-3/4 animate-pulse rounded bg-muted/70" />
                  <div className="h-2.5 w-full animate-pulse rounded bg-muted/60" />
                </div>
              ))}
            </div>
          )}

          {summary && (
            <p className="rounded-lg bg-muted/40 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground text-pretty">
              {summary}
            </p>
          )}

          {!busy && !findings && (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Gets a read on single points of failure, missing caches, unclear data flow and scaling limits.
            </p>
          )}

          {findings?.map((f, i) => (
            <div
              key={i}
              onMouseEnter={() => highlight(f.refs)}
              onMouseLeave={() => game?.clearPreview()}
              className={`border-l-2 py-1.5 pl-3 transition-colors hover:bg-accent/30 ${SEVERITY[f.severity]?.rule}`}
            >
              <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide">
                <span className={`size-1.5 rounded-full ${SEVERITY[f.severity]?.dot}`} />
                <span className={SEVERITY[f.severity]?.text}>{f.severity}</span>
                <span className="text-muted-foreground/60">{f.category}</span>
              </p>
              <p className="mt-1 text-[13px] font-medium leading-snug text-pretty">{f.title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground text-pretty">{f.detail}</p>
              <button
                onClick={() => propose(f.suggestion)}
                disabled={busy !== null}
                className="mt-1.5 text-[11px] font-medium text-primary transition-opacity hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-40"
              >
                Propose a fix
              </button>
            </div>
          ))}

          <div className="flex gap-2">
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && propose(instruction)}
              placeholder="Or describe a change…"
              className="h-9 flex-1 rounded-lg border border-border/60 bg-background px-3 text-sm outline-none focus:border-ring"
            />
            <button
              onClick={() => propose(instruction)}
              disabled={busy !== null || instruction.trim().length < 3}
              className="h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {busy === "edit" ? <Loader2 className="size-4 animate-spin" /> : "Propose"}
            </button>
          </div>
        </>
      )}

      {changes && (
        <>
          <p className="text-xs text-muted-foreground">{rationale}</p>
          {skipped > 0 && (
            <p className="rounded-md bg-amber-500/10 px-2 py-1.5 text-xs text-amber-600">
              {skipped} change{skipped > 1 ? "s" : ""} skipped — the board moved while the AI was thinking.
            </p>
          )}

          <ul className="max-h-56 space-y-1 overflow-y-auto">
            {changes.map((c, i) => (
              <li key={i} className="flex items-start gap-2 rounded-md border border-border/60 px-2 py-1.5 text-xs">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  disabled={c.status !== "applicable"}
                  checked={c.status === "applicable" && !rejected.has(i)}
                  onChange={() =>
                    setRejected((r) => {
                      const next = new Set(r);
                      if (next.has(i)) next.delete(i);
                      else next.add(i);
                      return next;
                    })
                  }
                />
                <span className={c.status === "applicable" ? "" : "text-muted-foreground line-through"}>
                  {c.describe}
                  {c.status !== "applicable" && <span className="ml-1 no-underline">({STATUS_NOTE[c.status]})</span>}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex gap-2">
            <button onClick={accept} className="h-9 flex-1 rounded-lg bg-primary text-sm font-medium text-primary-foreground">
              Accept
            </button>
            <button onClick={discard} className="h-9 rounded-lg border border-border/60 px-3 text-sm hover:bg-accent">
              Discard
            </button>
          </div>
        </>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

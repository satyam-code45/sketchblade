"use client";

import { useEffect, useState } from "react";
import { StickyNote, X } from "lucide-react";
import type { Game, Shape } from "@/draw";

const NOTES = [
  { id: "sticky", label: "Sticky note", bg: "#fef3c7", stroke: "#d97706", title: "Sticky note", body: "Write an idea..." },
  { id: "glass", label: "Meeting note", bg: "#e0f2fe", stroke: "#0284c7", title: "Meeting note", body: "Add a note..." },
  { id: "task", label: "Task card", bg: "#dcfce7", stroke: "#16a34a", title: "TODO", body: "Add a task..." },
];

const EMOJI = ["😀", "😂", "😍", "🤔", "🎉", "👍", "❤️", "🔥", "✅", "❌", "⭐", "⚡", "💡", "📌", "🚀", "⚠️", "🐛", "🔒", "📦", "🧠"];

const RECENT_KEY = "sketchblade-recent-emoji";

// localStorage throws in private mode, so every access is guarded.
const readRecent = (): string[] => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); } catch { return []; }
};

export default function StickerPicker({ game }: { game: Game | null }) {
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => { setRecent(readRecent()); }, []);

  const addNote = (n: (typeof NOTES)[number]) => {
    if (!game) return;
    const c = game.getViewportCenter();
    const x = c.x - 150;
    const y = c.y - 95;
    const shapes: Shape[] = [
      { type: "rect", x, y, width: 300, height: 190, color: n.stroke, fillColor: n.bg, strokeWidth: 2 },
      { type: "text", x: x + 20, y: y + 40, text: n.title, fontSize: 20, color: n.stroke },
      { type: "text", x: x + 20, y: y + 80, text: n.body, fontSize: 16, color: n.stroke },
    ];
    game.addShapes(shapes);
    setOpen(false);
  };

  const addEmoji = (e: string) => {
    if (!game) return;
    const c = game.getViewportCenter();
    game.addShapes([{ type: "text", x: c.x, y: c.y, text: e, fontSize: 48 }]);
    const next = [e, ...recent.filter((r) => r !== e)].slice(0, 12);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
    setOpen(false);
  };

  return (
    <>
      <button onClick={() => setOpen((v) => !v)} title="Notes and emoji" className="flex h-10 items-center gap-2 rounded-xl border border-border/60 bg-background/90 px-3 text-sm font-medium shadow-lg backdrop-blur-md hover:bg-accent">
        <StickyNote className="size-4" /> Notes
      </button>
      {open && (
    <div className="fixed bottom-20 right-4 z-40 w-[300px] rounded-xl border border-border/60 bg-background/95 p-3 shadow-xl backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">Notes and emoji</span>
        <button onClick={() => setOpen(false)} title="Close" className="rounded-md p-1 text-muted-foreground hover:bg-accent">
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-1.5">
        {NOTES.map((n) => (
          <button
            key={n.id}
            onClick={() => addNote(n)}
            className="flex w-full items-center gap-2 rounded-lg border border-border/60 px-2.5 py-2 text-left text-sm hover:bg-accent"
          >
            <span className="size-4 rounded" style={{ background: n.bg, border: `1px solid ${n.stroke}` }} />
            {n.label}
          </button>
        ))}
      </div>

      {recent.length > 0 && (
        <>
          <p className="mb-1 mt-3 text-xs text-muted-foreground">Recent</p>
          <div className="flex flex-wrap gap-1">
            {recent.map((e) => (
              <button key={e} onClick={() => addEmoji(e)} className="rounded-md p-1 text-xl hover:bg-accent">{e}</button>
            ))}
          </div>
        </>
      )}

      <p className="mb-1 mt-3 text-xs text-muted-foreground">Emoji</p>
      <div className="grid grid-cols-8 gap-0.5">
        {EMOJI.map((e) => (
          <button key={e} onClick={() => addEmoji(e)} title={e} className="rounded-md p-1 text-xl hover:bg-accent">{e}</button>
        ))}
      </div>
    </div>
      )}
    </>
  );
}

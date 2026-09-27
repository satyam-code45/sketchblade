"use client";

import { useEffect } from "react";
import { Sparkles, PanelRightClose } from "lucide-react";
import type { Game } from "@/draw";
import Thread from "@/components/ai/Thread";

type Props = {
  game: Game | null;
  roomId: string;
  open: boolean;
  onClose: () => void;
};

// One thread rather than tabs: the assistant can only build on what came before
// if drawing, critiquing and chatting share a single history.
export default function AISidebar({ game, roomId, open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <aside
      aria-label="Assistant"
      className="absolute right-0 top-0 z-40 flex h-full w-[380px] max-w-[calc(100vw-1rem)] flex-col bg-background/80 shadow-[-8px_0_40px_-12px_oklch(0.15_0.04_293/0.5)] backdrop-blur-xl duration-200 animate-in slide-in-from-right-4"
    >
      {/* 1px inner edge reads as refraction rather than a plain border */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-white/12 via-white/5 to-transparent" />

      <header className="flex items-center justify-between px-4 pb-3 pt-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/12 text-primary">
            <Sparkles className="size-3.5" strokeWidth={2.25} />
          </span>
          <div className="leading-none">
            <h2 className="text-[13px] font-semibold tracking-tight">Assistant</h2>
            <p className="mt-1 text-[11px] text-muted-foreground">Room {roomId}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          title="Close panel"
          aria-label="Close panel"
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-95"
        >
          <PanelRightClose className="size-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1">
        <Thread game={game} roomId={roomId} />
      </div>
    </aside>
  );
}

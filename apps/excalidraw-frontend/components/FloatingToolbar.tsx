"use client";

import { Copy, Trash2, Lock, Unlock, ArrowUpToLine, ArrowDownToLine } from "lucide-react";
import type { Game, SelectionInfo } from "@/draw";

type Props = { game: Game | null; selection: SelectionInfo };

// Acts on the selection; the left panel keeps owning tool defaults.
export default function FloatingToolbar({ game, selection }: Props) {
  if (!game || selection.count === 0) return null;

  const actions = [
    { icon: Copy, label: "Duplicate", run: () => game.duplicateSelected() },
    { icon: ArrowUpToLine, label: "Bring to front", run: () => game.reorderSelected("front") },
    { icon: ArrowDownToLine, label: "Send to back", run: () => game.reorderSelected("back") },
    {
      icon: selection.allLocked ? Lock : Unlock,
      label: selection.allLocked ? "Unlock" : "Lock",
      run: () => game.toggleLockSelected(),
    },
    { icon: Trash2, label: "Delete", run: () => game.deleteSelected() },
  ];

  return (
    <div className="absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-border/60 bg-background/90 p-1 shadow-lg backdrop-blur-md">
      <span className="px-2 text-xs text-muted-foreground">{selection.count} selected</span>
      <div className="mx-0.5 h-5 w-px bg-border/60" />
      {actions.map(({ icon: Icon, label, run }) => (
        <button
          key={label}
          onClick={run}
          title={label}
          aria-label={label}
          className="flex size-8 items-center justify-center rounded-lg hover:bg-accent"
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}

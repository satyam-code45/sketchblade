"use client";

import { useEffect, useState } from "react";
import { Sparkles, MessagesSquare, PanelRightClose, ScanSearch, PenLine } from "lucide-react";
import type { Game } from "@/draw";
import GenerateTab from "@/components/ai/GenerateTab";
import ReviewPanel from "@/components/ai/ReviewPanel";
import ChatBody from "@/components/chat/ChatBody";

export type SidebarTab = "generate" | "review" | "chat";

type Props = {
  game: Game | null;
  roomId: string;
  tab: SidebarTab | null;
  onTab: (tab: SidebarTab | null) => void;
  onUnread: (n: number) => void;
};

const TABS = [
  { id: "generate" as const, label: "Generate", icon: PenLine },
  { id: "review" as const, label: "Review", icon: ScanSearch },
  { id: "chat" as const, label: "Chat", icon: MessagesSquare },
];

// One dock instead of stacked popups: only ever one thing on screen, with room
// for history rather than a cramped floating card.
export default function AISidebar({ game, roomId, tab, onTab, onUnread }: Props) {
  const [mounted, setMounted] = useState(false);

  // Chat stays mounted once opened so streaming replies and unread counts keep
  // arriving while you are on another tab.
  useEffect(() => { if (tab === "chat") setMounted(true); }, [tab]);

  useEffect(() => {
    if (!tab) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onTab(null); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [tab, onTab]);

  if (!tab) return null;

  return (
    <aside
      aria-label="AI and chat"
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
          onClick={() => onTab(null)}
          title="Close panel"
          aria-label="Close panel"
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-95"
        >
          <PanelRightClose className="size-4" />
        </button>
      </header>

      <nav className="mx-4 mb-3 flex gap-1 rounded-xl bg-muted/50 p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onTab(t.id)}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" strokeWidth={2} />
              {t.label}
            </button>
          );
        })}
      </nav>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className={tab === "generate" ? "h-full" : "hidden"}>
          <GenerateTab game={game} roomId={roomId} />
        </div>
        <div className={tab === "review" ? "h-full overflow-hidden" : "hidden"}>
          <ReviewPanel game={game} />
        </div>
        {mounted && (
          <div className={tab === "chat" ? "h-full" : "hidden"}>
            <ChatBody game={game} roomId={roomId} onUnread={onUnread} />
          </div>
        )}
      </div>
    </aside>
  );
}

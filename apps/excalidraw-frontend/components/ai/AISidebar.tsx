"use client";

import { useEffect, useState } from "react";
import { Sparkles, MessageSquare, X, PanelRightClose } from "lucide-react";
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

const TABS: { id: SidebarTab; label: string }[] = [
  { id: "generate", label: "Generate" },
  { id: "review", label: "Review" },
  { id: "chat", label: "Chat" },
];

// One dock instead of stacked popups: only ever one thing on screen, and it
// has room for history rather than a cramped floating card.
export default function AISidebar({ game, roomId, tab, onTab, onUnread }: Props) {
  const [mounted, setMounted] = useState(false);

  // Chat stays mounted once opened so streaming replies and unread counts keep
  // arriving while you are on another tab.
  useEffect(() => { if (tab === "chat") setMounted(true); }, [tab]);

  if (!tab) return null;

  return (
    <aside className="absolute right-0 top-0 z-40 flex h-full w-[360px] max-w-[calc(100vw-1rem)] flex-col border-l border-border/60 bg-background/95 shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
        <span className="flex items-center gap-2 text-sm font-medium">
          {tab === "chat" ? <MessageSquare className="size-4" /> : <Sparkles className="size-4" />}
          {tab === "chat" ? "Room chat" : "AI assistant"}
        </span>
        <button
          onClick={() => onTab(null)}
          title="Close panel"
          className="rounded-md p-1 text-muted-foreground hover:bg-accent"
        >
          <PanelRightClose className="size-4" />
        </button>
      </div>

      <div className="flex gap-0.5 border-b border-border/60 px-2 py-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onTab(t.id)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              tab === t.id ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className={tab === "generate" ? "h-full" : "hidden"}>
          <GenerateTab game={game} roomId={roomId} />
        </div>
        <div className={tab === "review" ? "h-full overflow-y-auto px-4 py-3" : "hidden"}>
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

export { X };

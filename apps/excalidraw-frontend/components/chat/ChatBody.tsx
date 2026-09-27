"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, MessagesSquare } from "lucide-react";
import type { Game } from "@/draw";
import { serializeBoard } from "@/draw/ai/serialize-board";

type Message = {
  id: number | string;
  userId: string | null;
  name: string;
  kind: "user" | "ai" | "system";
  text: string;
  streaming?: boolean;
};

export default function ChatBody({
  game,
  roomId,
  onUnread,
}: {
  game: Game | null;
  roomId: string;
  onUnread?: (n: number) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/rooms/${roomId}/messages`, { headers: { authorization: localStorage.getItem("token") ?? "" } })
      .then((r) => r.json())
      .then((b) => setMessages(b.messages ?? []))
      .catch(() => {});
  }, [roomId]);

  const onEvent = useCallback((msg: Record<string, unknown>) => {
    const type = msg.type as string;

    if (type === "chat_message") {
      setMessages((m) => [...m, msg as unknown as Message]);
      onUnread?.(1);
      return;
    }
    if (type === "ai_stream_start") {
      setMessages((m) => [...m, { id: msg.correlationId as string, userId: null, name: "AI", kind: "ai", text: "", streaming: true }]);
      return;
    }
    if (type === "ai_stream_delta") {
      setMessages((m) => m.map((x) => (x.id === msg.correlationId ? { ...x, text: x.text + (msg.text as string) } : x)));
      return;
    }
    if (type === "ai_stream_end") {
      // Replace rather than append, so a dropped delta heals here.
      setMessages((m) => m.map((x) => (x.id === msg.correlationId ? { ...x, id: msg.id as number, text: msg.text as string, streaming: false } : x)));
      return;
    }
    if (type === "ai_stream_error") {
      setMessages((m) => m.filter((x) => x.id !== msg.correlationId).concat({
        id: `err-${Date.now()}`,
        userId: null,
        name: "AI",
        kind: "system",
        text: msg.kind === "busy" ? "Already answering something — try again in a moment." : "The assistant could not reply.",
      }));
    }
  }, [onUnread]);

  useEffect(() => { if (game) game.onChat = onEvent; }, [game, onEvent]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = () => {
    const text = draft.trim();
    if (!game || !text) return;
    // The board goes with the message so @ai can see what everyone is looking at.
    game.sendChat(text, serializeBoard(game.existingShapes).text);
    setDraft("");
  };

  const isAI = (m: Message) => m.kind !== "user";

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        {messages.length === 0 && (
          <div className="mt-8 text-center">
            <MessagesSquare className="mx-auto size-5 text-muted-foreground/60" strokeWidth={1.75} />
            <p className="mt-2 text-[12px] font-medium">No messages yet</p>
            <p className="mx-auto mt-1 max-w-[32ch] text-[11px] leading-relaxed text-muted-foreground">
              Talk to the room, or start with{" "}
              <span className="rounded bg-primary/12 px-1 py-0.5 font-medium text-primary">@ai</span>{" "}
              to ask about what is on the board.
            </p>
          </div>
        )}

        {messages.map((m) => (
          <article key={m.id} className="group">
            <div className="mb-1 flex items-baseline gap-2">
              <span className={`text-[11px] font-semibold ${isAI(m) ? "text-primary" : "text-foreground"}`}>
                {m.name}
              </span>
              {isAI(m) && (
                <span className="rounded bg-primary/12 px-1 text-[9px] font-medium uppercase tracking-wide text-primary">
                  ai
                </span>
              )}
            </div>
            <p
              className={`whitespace-pre-wrap text-[13px] leading-relaxed text-pretty ${
                isAI(m)
                  ? "border-l-2 border-primary/25 pl-3 text-foreground/90"
                  : "text-foreground/80"
              }`}
            >
              {m.text}
              {m.streaming && (
                <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse bg-primary" />
              )}
            </p>
          </article>
        ))}
        <div ref={endRef} />
      </div>

      <div className="px-4 pb-4">
        <div className="rounded-xl border border-border/60 bg-card/40 p-1 transition-colors focus-within:border-primary/40">
          <div className="flex items-end gap-1">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Message the room, or @ai…"
              aria-label="Message"
              className="h-9 flex-1 bg-transparent px-2.5 text-[13px] outline-none placeholder:text-muted-foreground/60"
            />
            <button
              onClick={send}
              disabled={draft.trim().length === 0}
              title="Send"
              aria-label="Send message"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-95 disabled:opacity-40 disabled:active:scale-100"
            >
              <ArrowUp className="size-4" strokeWidth={2.25} />
            </button>
          </div>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
          @ai runs on your key. It reads the board but cannot change it.
        </p>
      </div>
    </div>
  );
}

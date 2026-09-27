"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Say something, or start a message with <span className="font-medium text-foreground">@ai</span> to ask about the board.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.kind === "user" ? "" : "rounded-lg border border-border/50 bg-muted/40 p-2.5"}>
            <p className="text-[11px] font-medium text-muted-foreground">{m.name}</p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed">
              {m.text}
              {m.streaming && <span className="ml-0.5 animate-pulse">|</span>}
            </p>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border/60 p-3">
        <div className="flex gap-1.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Message, or @ai..."
            className="h-9 flex-1 rounded-lg border border-border/60 bg-background px-3 text-sm outline-none focus:border-ring"
          />
          <button onClick={send} title="Send" className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Send className="size-4" />
          </button>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">@ai runs on your key and can read the board, not change it.</p>
      </div>
    </div>
  );
}

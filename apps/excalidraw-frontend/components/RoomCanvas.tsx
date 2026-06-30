"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { HTTP_BACKEND, WS_URL } from "@/config";
import Canvas, { RoomInfo } from "./Canvas";

interface OnlineUser {
  userId: string;
  name: string;
}

export function RoomCanvas({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [socket, setSocket]           = useState<WebSocket | null>(null);
  const [roomInfo, setRoomInfo]       = useState<RoomInfo | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    const token    = localStorage.getItem("token");
    const userName = localStorage.getItem("userName") ?? "Anonymous";

    if (!token) { router.push("/sign-in"); return; }

    // Fetch room info for the canvas header
    axios.get(`${HTTP_BACKEND}/room/by-id/${roomId}`)
      .then((res) => { if (res.data.room) setRoomInfo(res.data.room); })
      .catch(() => {}); // non-critical — canvas works without it

    const ws = new WebSocket(`${WS_URL}?token=${token}`);

    const presenceHandler = (event: MessageEvent) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "presence") setOnlineUsers(msg.users ?? []);
    };

    ws.addEventListener("message", presenceHandler);

    ws.onopen = () => {
      setSocket(ws);
      ws.send(JSON.stringify({ type: "join_room", roomId, name: userName }));
    };

    ws.onclose = () => setSocket(null);

    return () => ws.close();
  }, [roomId, router]);

  if (!socket) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-2.5 w-2.5 rounded-full bg-violet-500 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Connecting to room…</p>
        </div>
      </div>
    );
  }

  return (
    <Canvas
      roomId={roomId}
      socket={socket}
      onlineUsers={onlineUsers}
      roomInfo={roomInfo}
    />
  );
}

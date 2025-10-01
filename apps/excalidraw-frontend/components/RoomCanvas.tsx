"use client";

import { WS_URL } from "@/config";
import { useEffect, useState } from "react";
import Canvas from "./Canvas";

export function RoomCanvas({ roomId }: { roomId: string }) {
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(
      `${WS_URL}?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4MTVkMDkwZC0wZDcwLTQ1N2QtOGMyOS04MzZjMjJiNGUwYmMiLCJpYXQiOjE3NTkzMTkyODMsImV4cCI6MTc2MTkxMTI4M30.dPMeqDjWM-5kzWQmVBvmvfixPjxS-rb0A9_hMxs0LNg`
    );

    ws.onopen = () => {
      setSocket(ws);
      ws.send(
        JSON.stringify({
          type: "join_room",
          roomId,
        })
      );
    };
  }, [roomId]);

  if (!socket) {
    return <div>Loading chat shapes for you.....</div>;
  }

  return (
    <div>
      <Canvas roomId={roomId} socket={socket} />
    </div>
  );
}

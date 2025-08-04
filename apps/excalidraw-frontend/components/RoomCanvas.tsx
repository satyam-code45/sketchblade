"use client";

import { WS_URL } from "@/config";
import { useEffect, useState } from "react";
import Canvas from "./Canvas";

export function RoomCanvas({ roomId }: { roomId: string }) {
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(
      `${WS_URL}?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMTM0OGU4My03NjM1LTQ0YmYtOWJjMy1kYWQ4YTVkYjdkN2UiLCJpYXQiOjE3NTM3OTU1ODQsImV4cCI6MTc1NjM4NzU4NH0.RmXsWm_Heb708PckV5yhzMzrXFkWG_QsIBUhrh7CQ1c`
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

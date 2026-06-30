"use client";

import { WS_URL } from "@/config";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Canvas from "./Canvas";

export function RoomCanvas({ roomId }: { roomId: string }) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/sign-in");
      return;
    }

    const ws = new WebSocket(`${WS_URL}?token=${token}`);

    ws.onopen = () => {
      setSocket(ws);
      ws.send(JSON.stringify({ type: "join_room", roomId }));
    };

    ws.onclose = () => setSocket(null);

    return () => ws.close();
  }, [roomId, router]);

  if (!socket) {
    return <div>Loading chat shapes for you.....</div>;
  }

  return (
    <div>
      <Canvas roomId={roomId} socket={socket} />
    </div>
  );
}

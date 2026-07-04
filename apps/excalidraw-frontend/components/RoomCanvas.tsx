"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { RefreshCw, Wifi } from "lucide-react";
import { HTTP_BACKEND, WS_URL } from "@/config";
import Canvas, { RoomInfo } from "./Canvas";

interface OnlineUser {
  userId: string;
  name: string;
}

// The health endpoint lives on the WS server's HTTP port (see apps/ws-backend).
const HEALTH_URL = WS_URL.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://") + "/health";

const POLL_INTERVAL_MS = 3000;
const HEALTH_TIMEOUT_MS = 5000;

export function RoomCanvas({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [socket, setSocket]           = useState<WebSocket | null>(null);
  const [roomInfo, setRoomInfo]       = useState<RoomInfo | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  // Render's free tier spins the WS server down when idle — poll /health
  // before opening the real socket so we can show a helpful message instead
  // of a spinner that never resolves.
  const [serverAwake, setServerAwake] = useState(false);
  const [waking, setWaking]           = useState(false);
  const [retryNonce, setRetryNonce]   = useState(0);

  useEffect(() => {
    if (serverAwake) return; // already up — nothing to poll

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const check = async () => {
      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
      try {
        const res = await fetch(HEALTH_URL, { cache: "no-store", signal: controller.signal });
        clearTimeout(abortTimer);
        if (!cancelled && res.ok) { setServerAwake(true); return; }
      } catch {
        clearTimeout(abortTimer);
      }
      if (cancelled) return;
      setWaking(true);
      timer = setTimeout(check, POLL_INTERVAL_MS);
    };

    check();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [retryNonce, serverAwake]);

  useEffect(() => {
    if (!serverAwake) return;

    const token    = localStorage.getItem("token");
    const userName = localStorage.getItem("userName") ?? "Anonymous";

    if (!token) { router.push("/sign-in"); return; }

    // Fetch room info for the canvas header
    axios.get(`${HTTP_BACKEND}/room/by-id/${roomId}`)
      .then((res) => { if (res.data.room) setRoomInfo(res.data.room); })
      .catch(() => {}); // non-critical — canvas works without it

    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    let intentionalClose = false;

    const presenceHandler = (event: MessageEvent) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "presence") setOnlineUsers(msg.users ?? []);
    };

    ws.addEventListener("message", presenceHandler);

    ws.onopen = () => {
      setSocket(ws);
      ws.send(JSON.stringify({ type: "join_room", roomId, name: userName }));
    };

    ws.onclose = () => {
      setSocket(null);
      // Dropped unexpectedly (e.g. the connection never actually completed) —
      // go back to polling health rather than hanging forever.
      if (!intentionalClose) setServerAwake(false);
    };

    return () => { intentionalClose = true; ws.close(); };
  }, [serverAwake, roomId, router]);

  if (!serverAwake || !socket) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-background/95 p-6 text-center shadow-xl backdrop-blur-md">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-violet-600/10">
            <Wifi className="size-6 text-violet-500" />
          </div>
          <h2 className="text-base font-semibold">Connecting to room…</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {waking
              ? "Our realtime server is waking up — this can take up to a minute on the free tier. Hang tight, you'll be dropped in automatically."
              : "Checking connection…"}
          </p>
          <div className="mt-5 flex justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-2 w-2 rounded-full bg-violet-500 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          {waking && (
            <button
              onClick={() => setRetryNonce((n) => n + 1)}
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <RefreshCw className="size-3.5" />
              Try again
            </button>
          )}
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

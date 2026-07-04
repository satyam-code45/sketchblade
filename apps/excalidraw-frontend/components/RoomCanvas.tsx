"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { RefreshCw, Wifi } from "lucide-react";
import { HTTP_BACKEND, WS_URL } from "@/config";
import Canvas, { RoomInfo } from "./Canvas";

interface OnlineUser {
  userId: string;
  name: string;
}

// If the socket closes faster than this after opening, treat it as a real failure
// (bad token, cold server rejecting the handshake, etc.) rather than a random blip.
const QUICK_FAILURE_MS = 2000;
const MAX_QUICK_FAILURES = 6;

export function RoomCanvas({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [socket, setSocket]           = useState<WebSocket | null>(null);
  const [roomInfo, setRoomInfo]       = useState<RoomInfo | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  // Connect straight to the WebSocket with retry/backoff — deliberately NOT gated
  // behind a separate /health polling fetch. Brave Shields (and some ad-blockers)
  // silently block a repeating fetch to the same third-party URL as a tracking-beacon
  // pattern, which left Brave users stuck forever waiting on a check that could never
  // pass, even though the real WebSocket connection would have worked fine. The
  // WebSocket itself is what actually matters, so we just retry that directly.
  const [connectGen, setConnectGen] = useState(0);
  const [hasFailedOnce, setHasFailedOnce] = useState(false);
  const [gaveUp, setGaveUp]         = useState(false);
  const failureStreakRef = useRef(0);
  const backoffTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (gaveUp) return;

    const token    = localStorage.getItem("token");
    const userName = localStorage.getItem("userName") ?? "Anonymous";
    if (!token) { router.push("/sign-in"); return; }

    // Fetch room info for the canvas header
    axios.get(`${HTTP_BACKEND}/room/by-id/${roomId}`)
      .then((res) => { if (res.data.room) setRoomInfo(res.data.room); })
      .catch(() => {}); // non-critical — canvas works without it

    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    let intentionalClose = false;
    let openedAt = 0;

    const presenceHandler = (event: MessageEvent) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "presence") setOnlineUsers(msg.users ?? []);
    };
    ws.addEventListener("message", presenceHandler);

    ws.onopen = () => {
      openedAt = Date.now();
      failureStreakRef.current = 0;
      setHasFailedOnce(false);
      setSocket(ws);
      ws.send(JSON.stringify({ type: "join_room", roomId, name: userName }));
    };

    ws.onclose = () => {
      setSocket(null);
      if (intentionalClose) return;

      const closedQuickly = openedAt === 0 || Date.now() - openedAt < QUICK_FAILURE_MS;
      if (!closedQuickly) {
        // Was connected for a while, then dropped — a normal blip, reconnect right away.
        failureStreakRef.current = 0;
        setConnectGen((g) => g + 1);
        return;
      }

      setHasFailedOnce(true);
      failureStreakRef.current += 1;
      if (failureStreakRef.current >= MAX_QUICK_FAILURES) {
        setGaveUp(true);
        return;
      }
      const delay = Math.min(1000 * 2 ** failureStreakRef.current, 8000);
      backoffTimerRef.current = setTimeout(() => setConnectGen((g) => g + 1), delay);
    };

    return () => {
      intentionalClose = true;
      ws.close();
      if (backoffTimerRef.current) { clearTimeout(backoffTimerRef.current); backoffTimerRef.current = null; }
    };
  }, [connectGen, gaveUp, roomId, router]);

  const retryNow = () => {
    if (backoffTimerRef.current) { clearTimeout(backoffTimerRef.current); backoffTimerRef.current = null; }
    failureStreakRef.current = 0;
    setHasFailedOnce(false);
    setGaveUp(false);
    setConnectGen((g) => g + 1);
  };

  if (gaveUp) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-background/95 p-6 text-center shadow-xl backdrop-blur-md">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <Wifi className="size-6 text-red-500" />
          </div>
          <h2 className="text-base font-semibold">Couldn&apos;t join this room</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The realtime connection kept dropping right after connecting. This usually means
            your session needs a refresh — try signing in again, or try once more.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              onClick={retryNow}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <RefreshCw className="size-3.5" />
              Try again
            </button>
            <button
              onClick={() => router.push("/sign-in")}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-700"
            >
              Sign in again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!socket) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-background/95 p-6 text-center shadow-xl backdrop-blur-md">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-violet-600/10">
            <Wifi className="size-6 text-violet-500" />
          </div>
          <h2 className="text-base font-semibold">Connecting to room…</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {hasFailedOnce
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
          {hasFailedOnce && (
            <button
              onClick={retryNow}
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

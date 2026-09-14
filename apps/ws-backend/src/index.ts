import { createServer } from "http";
import { WebSocket, WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { prismaClient } from "@repo/db/client";
import { startBus, publish, markPresent, markAbsent, presentIn, busEnabled } from "./bus";

const PORT = Number(process.env.PORT) || 8080;

// HTTP server — serves /health for uptime monitors and for the frontend to poll
// while waiting for a sleeping Render free-tier instance to wake up.
const metrics = { connections: 0, messages: 0, startedAt: Date.now() };

const server = createServer((req, res) => {
  if (req.url === "/metrics") {
    const rooms = new Set(users.flatMap((u) => u.rooms));
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({
      openSockets: users.filter((u) => u.ws.readyState === WebSocket.OPEN).length,
      connectionsTotal: metrics.connections,
      rooms: rooms.size,
      boardMessages: metrics.messages,
      uptimeSeconds: Math.round((Date.now() - metrics.startedAt) / 1000),
      busEnabled: busEnabled(),
    }));
    return;
  }

  if (req.url === "/health") {
    // Cross-origin: the frontend (Vercel) polls this from a different origin.
    res.writeHead(200, { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" });
    res.end("ok");
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

server.listen(PORT, () =>
  console.log(`WS + HTTP server listening on port ${PORT}`)
);

interface User {
  ws: WebSocket;
  rooms: string[];
  userId: string;
  name: string;
}

const users: User[] = [];

// Everything the room should see goes through here: published to the bus so
// other instances deliver it too, then handed to our own sockets.
function toRoom(roomId: string, payload: string) {
  publish(roomId, payload);
  deliverLocally(roomId, payload);
}

function deliverLocally(roomId: string, payload: string) {
  users.forEach((u) => {
    if (!u.rooms.includes(roomId) || u.ws.readyState !== WebSocket.OPEN) return;
    // A slow reader must not grow an unbounded send buffer.
    if (u.ws.bufferedAmount > 1_000_000) return;
    u.ws.send(payload);
  });
}

startBus(deliverLocally);

// Distinct close codes so the client can tell "log in again" from "bad token".
const CLOSE_INVALID = 4001;
const CLOSE_EXPIRED = 4002;

function checkUser(token: string): { userId: string; expiresAt: number } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === "string" || !decoded || !decoded.userId) return null;
    // exp is seconds since epoch; no exp means a token that never lapses.
    return { userId: decoded.userId, expiresAt: (decoded.exp ?? 0) * 1000 };
  } catch {
    return null;
  }
}

async function broadcastPresence(roomId: string) {
  // Reconnects can leave a stale entry overlapping the new one, so dedupe by userId.
  const roomUsers = users.filter((u) => u.rooms.includes(roomId) && u.ws.readyState === WebSocket.OPEN);
  const local = Array.from(new Map(roomUsers.map((u) => [u.userId, u])).values())
    .map((u) => ({ userId: u.userId, name: u.name }));

  const everyone = busEnabled()
    ? Array.from(new Map((await presentIn(roomId)).map((u) => [u.userId, u])).values())
    : local;

  toRoom(roomId, JSON.stringify({ type: "presence", roomId, users: everyone }));
}

wss.on("connection", function connection(ws, request) {
  const url = request.url;
  if (!url) { ws.close(); return; }

  const queryParams = new URLSearchParams(url.split("?")[1]);
  const token = queryParams.get("token") || "";
  const auth = checkUser(token);
  if (!auth) { ws.close(CLOSE_INVALID, "invalid token"); return; }

  const userId = auth.userId;
  users.push({ userId, rooms: [], ws, name: "Anonymous" });
  metrics.connections++;

  // The token was only ever checked at connect; without this a 30-day JWT is
  // trusted for 30 days of uninterrupted socket.
  let expiryTimer: NodeJS.Timeout | undefined;
  const armExpiry = (expiresAt: number) => {
    clearTimeout(expiryTimer);
    if (!expiresAt) return;
    const ms = expiresAt - Date.now();
    if (ms <= 0) { ws.close(CLOSE_EXPIRED, "token expired"); return; }
    expiryTimer = setTimeout(() => ws.close(CLOSE_EXPIRED, "token expired"), ms);
  };
  armExpiry(auth.expiresAt);
  ws.on("close", () => clearTimeout(expiryTimer));

  ws.on("message", async function message(data) {
    let parsedData: Record<string, unknown>;
    try {
      parsedData = JSON.parse(data as unknown as string);
    } catch {
      return; // malformed frame — ignore rather than crash the handler
    }

    try {
      if (parsedData.type === "reauth") {
        const next = checkUser(String(parsedData.token ?? ""));
        if (!next || next.userId !== userId) { ws.close(CLOSE_INVALID, "invalid token"); return; }
        armExpiry(next.expiresAt);
        return;
      }

      if (parsedData.type === "join_room") {
        const user = users.find((x) => x.ws === ws);
        if (!user) return;
        const roomId = String(parsedData.roomId);
        if (!user.rooms.includes(roomId)) user.rooms.push(roomId);
        if (typeof parsedData.name === "string") user.name = parsedData.name;
        await markPresent(roomId, user.userId, user.name);
        await broadcastPresence(roomId);
        return;
      }

      if (parsedData.type === "leave_room") {
        const user = users.find((x) => x.ws === ws);
        if (!user) return;
        const roomId = String(parsedData.roomId);
        user.rooms = user.rooms.filter((r) => r !== roomId);
        await markAbsent(roomId, user.userId);
        await broadcastPresence(roomId);
        return;
      }

      // Ephemeral: tells the room why shapes are about to appear. Never stored.
      if (parsedData.type === "ai_activity") {
        const user = users.find((x) => x.ws === ws);
        if (!user) return;
        const roomId = String(parsedData.roomId);
        const payload = JSON.stringify({
          type: "ai_activity",
          roomId: parsedData.roomId,
          name: user.name,
          state: parsedData.state,
        });
        toRoom(roomId, payload);
        return;
      }

      if (parsedData.type === "chat_message") {
        const user = users.find((x) => x.ws === ws);
        if (!user) return;
        const roomId = Number(parsedData.roomId);
        const text = String(parsedData.text ?? "").slice(0, 2000).trim();
        if (!text) return;

        const row = await prismaClient.chat.create({
          data: { roomId, userId, message: text, kind: "user" },
          select: { id: true, createdAt: true },
        });

        toRoom(String(roomId), JSON.stringify({
          type: "chat_message",
          roomId,
          id: row.id,
          userId,
          name: user.name,
          kind: "user",
          text,
          createdAt: row.createdAt,
        }));
        return;
      }

      if (parsedData.type === "board") {
        metrics.messages++;
        const roomId = parsedData.roomId as number;
        const message = parsedData.message as string;

        // Neon (and Render, right after a cold start) can drop or time out the very
        // first query after a period of inactivity while compute resumes — retry once
        // with a short delay before giving up, instead of silently losing the draw.
        let persisted = false;
        let lastErr: unknown;
        for (let attempt = 0; attempt < 2 && !persisted; attempt++) {
          try {
            const kind = message.includes('"snapshot"') ? "snapshot"
              : message.includes('"erase"') ? "shape_erase" : "shape_upsert";
            await prismaClient.boardEvent.create({ data: { roomId, userId, kind, payload: message } });
            persisted = true;
          } catch (err) {
            lastErr = err;
            if (attempt === 0) await new Promise((r) => setTimeout(r, 500));
          }
        }

        if (!persisted) {
          console.error(`[ws] failed to persist board event for room ${roomId} after retry:`, lastErr);
          // Never broadcast what didn't actually save — otherwise everyone else sees the
          // shape live while a page refresh (which replays from the DB) never will,
          // silently diverging. Tell the sender instead so their client can react.
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "board_failed", roomId }));
          }
          return;
        }

        // Snapshots are a storage detail, not a board change — nobody needs them pushed.
        if (message.includes('"snapshot"')) return;

        toRoom(String(roomId), JSON.stringify({ type: "board", message, roomId }));
      }
    } catch (err) {
      console.error("[ws] message handler error:", err);
    }
  });

  ws.on("close", async () => {
    const user = users.find((u) => u.ws === ws);
    if (!user) return;
    const rooms = [...user.rooms];
    users.splice(users.indexOf(user), 1);
    for (const roomId of rooms) {
      await markAbsent(roomId, user.userId);
      await broadcastPresence(roomId);
    }
  });
});

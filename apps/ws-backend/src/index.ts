import { createServer } from "http";
import { WebSocket, WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { prismaClient } from "@repo/db/client";

const PORT = Number(process.env.PORT) || 8080;

// HTTP server — serves /health for uptime monitors and for the frontend to poll
// while waiting for a sleeping Render free-tier instance to wake up.
const server = createServer((req, res) => {
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

function checkUser(token: string): string | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === "string" || !decoded || !decoded.userId) return null;
    return decoded.userId;
  } catch {
    return null;
  }
}

function broadcastPresence(roomId: string) {
  // Reconnects (page reload, a dropped connection retrying) can leave a stale
  // entry in `users` briefly overlapping with the new one — dedupe by userId
  // so the same person never shows up twice in the presence list.
  const roomUsers = users.filter((u) => u.rooms.includes(roomId) && u.ws.readyState === WebSocket.OPEN);
  const uniqueByUser = Array.from(new Map(roomUsers.map((u) => [u.userId, u])).values());
  const payload = JSON.stringify({
    type: "presence",
    roomId,
    users: uniqueByUser.map((u) => ({ userId: u.userId, name: u.name })),
  });
  roomUsers.forEach((u) => u.ws.send(payload));
}

wss.on("connection", function connection(ws, request) {
  const url = request.url;
  if (!url) { ws.close(); return; }

  const queryParams = new URLSearchParams(url.split("?")[1]);
  const token = queryParams.get("token") || "";
  const userId = checkUser(token);
  if (!userId) { ws.close(); return; }

  users.push({ userId, rooms: [], ws, name: "Anonymous" });

  ws.on("message", async function message(data) {
    const parsedData = JSON.parse(data as unknown as string);

    if (parsedData.type === "join_room") {
      const user = users.find((x) => x.ws === ws);
      if (!user) return;
      const roomId = String(parsedData.roomId);
      if (!user.rooms.includes(roomId)) user.rooms.push(roomId);
      if (parsedData.name) user.name = parsedData.name;
      broadcastPresence(roomId);
    }

    if (parsedData.type === "leave_room") {
      const user = users.find((x) => x.ws === ws);
      if (!user) return;
      const roomId = String(parsedData.roomId);
      user.rooms = user.rooms.filter((r) => r !== roomId);
      broadcastPresence(roomId);
    }

    if (parsedData.type === "chat") {
      const roomId = parsedData.roomId;
      const message = parsedData.message;

      await prismaClient.chat.create({ data: { roomId, message, userId } });

      users.forEach((user) => {
        if (user.rooms.includes(String(roomId)) && user.ws.readyState === WebSocket.OPEN) {
          user.ws.send(JSON.stringify({ type: "chat", message, roomId }));
        }
      });
    }
  });

  ws.on("close", () => {
    const user = users.find((u) => u.ws === ws);
    if (!user) return;
    const rooms = [...user.rooms];
    users.splice(users.indexOf(user), 1);
    rooms.forEach((roomId) => broadcastPresence(roomId));
  });
});

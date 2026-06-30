import { createServer } from "http";
import { WebSocket, WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { prismaClient } from "@repo/db/client";

const PORT = Number(process.env.PORT) || 8080;

// HTTP server — serves /health for uptime monitors (keeps Render free tier alive)
const server = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
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
  const roomUsers = users.filter((u) => u.rooms.includes(roomId));
  const payload = JSON.stringify({
    type: "presence",
    roomId,
    users: roomUsers.map((u) => ({ userId: u.userId, name: u.name })),
  });
  roomUsers.forEach((u) => {
    if (u.ws.readyState === WebSocket.OPEN) u.ws.send(payload);
  });
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

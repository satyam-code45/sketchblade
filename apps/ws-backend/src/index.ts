import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";

const wss = new WebSocketServer({ port: 8080 });

function checkUser(token: string): string | null {
  const decoded = jwt.verify(token, JWT_SECRET);

  if (typeof decoded === "string") {
    return null;
  }

  if (!decoded || !decoded.userId) {
    return null;
  }
  return decoded.userID;
}

wss.on("connection", function connection(ws, request) {
  const url = request.url;

  if (!url) {
    ws.close();
    return;
  }
  const queryParams = new URLSearchParams(url.split("?")[1]);
  const token = queryParams.get("token") || "";
  const userId = checkUser(token);

  if (!userId) {
    ws.close()
  }

  ws.on("message", function message(data) {
    ws.send("Hello");
  });
});

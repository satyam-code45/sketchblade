import { WebSocket } from "ws";
import { readFileSync } from "fs";

const [t1, t2] = readFileSync(process.argv[2], "utf8").trim().split("\n");
const ROOM = "7";

const open = (port, token, name) => new Promise((resolve) => {
  const ws = new WebSocket(`ws://localhost:${port}/?token=${token}`);
  ws.on("open", () => {
    ws.send(JSON.stringify({ type: "join_room", roomId: ROOM, name }));
    resolve(ws);
  });
});

const a = await open(8080, t1, "AliceOn8080");
const b = await open(8081, t2, "BobOn8081");

let sawBoard = false;
let presence = null;
b.on("message", (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.type === "board") sawBoard = true;
  if (m.type === "presence") presence = m.users.map((u) => u.name).sort();
});

await new Promise((r) => setTimeout(r, 2000));
a.send(JSON.stringify({ type: "board", roomId: Number(ROOM), message: JSON.stringify({ erase: ["__crossinstance__"] }) }));
await new Promise((r) => setTimeout(r, 2500));

console.log("B on :8081 received A's board event from :8080 —", sawBoard);
console.log("presence B sees across both instances —", JSON.stringify(presence));
a.close(); b.close();
process.exit(0);

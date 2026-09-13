// Drives N sockets across M rooms and reports broadcast latency percentiles.
// Rooms must exist: an event for an unknown room fails to persist and is
// deliberately never broadcast.
// Usage: node loadtest.mjs <tokenFile> <roomIds> [sockets] [seconds]
import { WebSocket } from "ws";
import { readFileSync } from "fs";

const token = readFileSync(process.argv[2], "utf8").trim().split("\n")[0];
const ROOM_IDS = (process.argv[3] ?? "7").split(",");
const SOCKETS = Number(process.argv[4] ?? 50);
const SECONDS = Number(process.argv[5] ?? 15);
const PORT = process.env.WS_PORT ?? 8080;

const latencies = [];
let sent = 0;
let received = 0;
let failed = 0;

const sockets = await Promise.all(
  Array.from({ length: SOCKETS }, (_, i) => new Promise((resolve) => {
    const roomId = ROOM_IDS[i % ROOM_IDS.length];
    const ws = new WebSocket(`ws://localhost:${PORT}/?token=${token}`);
    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "join_room", roomId, name: `load${i}` }));
      resolve({ ws, roomId });
    });
    ws.on("error", () => { failed++; resolve(null); });
    ws.on("message", (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.type !== "board") return;
      try {
        const { at } = JSON.parse(JSON.parse(m.message).erase[0]);
        latencies.push(Date.now() - at);
        received++;
      } catch {}
    });
  })),
);

const live = sockets.filter(Boolean);
console.log(`connected ${live.length}/${SOCKETS} sockets across ${ROOM_IDS.length} rooms`);

const timer = setInterval(() => {
  const target = live[Math.floor(Math.random() * live.length)];
  if (!target || target.ws.readyState !== WebSocket.OPEN) return;
  target.ws.send(JSON.stringify({
    type: "board",
    roomId: Number(target.roomId),
    message: JSON.stringify({ erase: [JSON.stringify({ at: Date.now() })] }),
  }));
  sent++;
}, 50);

await new Promise((r) => setTimeout(r, SECONDS * 1000));
clearInterval(timer);
await new Promise((r) => setTimeout(r, 1500));

latencies.sort((a, b) => a - b);
const pct = (p) => latencies[Math.floor(latencies.length * p)] ?? 0;
console.log(`sent ${sent} | delivered ${received} | failed sockets ${failed}`);
console.log(`broadcast latency  p50 ${pct(0.5)}ms  p95 ${pct(0.95)}ms  p99 ${pct(0.99)}ms`);
console.log(`throughput ${(sent / SECONDS).toFixed(1)} msg/s in, ${(received / SECONDS).toFixed(1)} msg/s out`);

live.forEach((s) => s.ws.close());
process.exit(0);

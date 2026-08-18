/**
 * Wake the Neon Postgres before `turbo run dev` starts.
 *
 * Neon's free tier suspends the compute when idle. The first connection wakes it,
 * but that connection usually times out first — so the app boots against a dead
 * database and every sign-in fails with an error that looks unrelated.
 *
 * This runs as `predev`, retries until Postgres answers, and reports clearly.
 * A failure here is a warning, not a hard stop: the frontend is still worth
 * looking at even if the database is down.
 */
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ATTEMPTS = 5;
const GAP_MS = 5000;
const dbDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "packages", "db");

const run = () =>
  new Promise((resolve) => {
    const child = execFile(
      "npx",
      ["--yes", "dotenv", "-e", "../../.env", "--",
       "npx", "--yes", "prisma", "db", "execute",
       "--schema", "prisma/schema.prisma", "--stdin"],
      { cwd: dbDir, timeout: 60_000 },
      (err) => resolve(!err),
    );
    child.stdin?.end("SELECT 1;");
  });

for (let i = 1; i <= ATTEMPTS; i++) {
  if (await run()) {
    console.log(`✓ Postgres reachable (attempt ${i})`);
    process.exit(0);
  }
  console.log(`… Postgres asleep, retrying (${i}/${ATTEMPTS})`);
  if (i < ATTEMPTS) await new Promise((r) => setTimeout(r, GAP_MS));
}

console.warn(
  "! Postgres never answered. Starting anyway — the UI will load but sign-in\n" +
  "  and canvases will fail. Check DATABASE_URL, or whether the Neon project\n" +
  "  is still active at console.neon.tech.",
);

# SketchBlade — Deployment War Stories

A record of every non-obvious challenge hit while building and deploying this monorepo. Written so the next person (or future-you) doesn't spend hours rediscovering the same things.

---

## 1. The Monorepo Runtime Problem — Workspace Packages Export TypeScript

**The situation**  
The `packages/db` and `packages/backend-common` packages export their source directly:

```json
// packages/db/package.json
"exports": { "./client": "./src/index.ts" }
```

This works fine in development (tsx/ts-node resolve `.ts`). The problem surfaces at deploy time.

**What broke**  
When the ws-backend compiled to `dist/index.js` with `tsc`, the output had:
```js
const { prismaClient } = require("@repo/db/client"); // resolves to .ts file
```
Node.js cannot load `.ts` files. The server crashed on startup with a module resolution error.

**The fix**  
Switch from `tsc` to `esbuild` for the ws-backend. esbuild bundles everything — including the workspace `.ts` imports — into a single self-contained `dist/index.js`. Workspace packages never need to be loaded at runtime:

```json
// apps/ws-backend/package.json
"build": "esbuild src/index.ts --bundle --platform=node --outfile=dist/index.js --external:ws --external:@prisma/client --external:jsonwebtoken"
```

`--external:ws` and `--external:@prisma/client` keep native modules as runtime requires (they can't be bundled). Everything else — `@repo/db`, `@repo/backend-common`, `@repo/common` — gets inlined.

**Lesson**  
In a Turborepo pnpm workspace, if a package exports raw `.ts` files, any consumer that compiles to plain Node.js needs to bundle (not just compile). tsc transpiles files individually — it doesn't resolve workspace imports the way a bundler does.

---

## 2. Vercel Can't See Root `.env` — API Routes Return 500

**The situation**  
The monorepo has a single `.env` at the repo root with `DATABASE_URL` and `JWT_SECRET`. The Next.js app is at `apps/excalidraw-frontend/`. Next.js only reads `.env` files from the directory where `next.config.ts` lives.

**What broke**  
After migrating all Express routes to Next.js API routes, every endpoint returned 500. Prisma couldn't connect (`DATABASE_URL` was `undefined`). JWT verification failed (`JWT_SECRET` was `undefined`).

**The fix (local dev)**  
In `next.config.ts`, load the root `.env` explicitly using `dotenv`:

```ts
// apps/excalidraw-frontend/next.config.ts
import { configDotenv } from "dotenv";
import path from "path";

configDotenv({ path: path.resolve(process.cwd(), "../../.env"), override: false });
```

`override: false` means variables already set in the environment (Vercel dashboard) win — local `.env` only fills gaps.

**The fix (production)**  
Set `DATABASE_URL` and `JWT_SECRET` in the Vercel dashboard under **Settings → Environment Variables**. They're set at build time and injected at runtime. The `dotenv` call finds nothing to inject (`override: false`) and is a no-op.

**The hidden trap**  
The root `.env` also had `NEXT_PUBLIC_HTTP_BACKEND=http://localhost:4000` from the old Express backend. After migration to Next.js API routes, this env var was still being loaded — so all frontend API calls went to `localhost:4000` in production. Fix:

```ts
// next.config.ts — delete it so config.ts defaults to "/api"
delete process.env.NEXT_PUBLIC_HTTP_BACKEND;
```

---

## 3. pnpm 9.0.0 + Node 22 = `ERR_INVALID_THIS`

**The situation**  
Vercel defaulted to Node 22 for the build environment.

**What broke**  
```
ERR_INVALID_THIS
```
pnpm 9.0.0 has a known incompatibility with Node 22. The install step crashed before anything else ran.

**The fix**  
Pin `engines.node` in the root `package.json`:
```json
"engines": { "node": "20.x" }
```
Vercel reads this and provisions Node 20 for the build.

---

## 4. Stray `package-lock.json` Breaks pnpm on Vercel

**The situation**  
A `package-lock.json` existed at `apps/excalidraw-frontend/package-lock.json` from an early `npm install` run.

**What broke**  
```
Ignoring not compatible lockfile
```
When pnpm sees both `pnpm-lock.yaml` (at root) and `package-lock.json` (in a package), it gets confused and ignores one. Inconsistent installs result — some packages missing, others at wrong versions.

**The fix**  
Delete `apps/excalidraw-frontend/package-lock.json`. Never mix package managers in a pnpm workspace.

---

## 5. Vercel Output Directory Double-Path Bug

**The situation**  
`vercel.json` at the repo root had:
```json
{ "outputDirectory": "apps/excalidraw-frontend/.next" }
```

**What broke**  
```
The Next.js output directory was not found at 
"/vercel/path0/apps/excalidraw-frontend/apps/excalidraw-frontend/.next"
```
Vercel detected the Next.js app at `apps/excalidraw-frontend/` and resolved `outputDirectory` relative to that — not relative to the repo root. The path got doubled.

**The fix**  
Remove `outputDirectory` entirely. With Turborepo detected, Vercel reads the build output locations from `turbo.json`'s `outputs` array and finds `apps/excalidraw-frontend/.next` automatically.

```json
// vercel.json — no outputDirectory
{
  "framework": "nextjs",
  "installCommand": "pnpm install",
  "buildCommand": "pnpm --filter=excalidraw-frontend build"
}
```

---

## 6. Prisma Client Not Generated on CI — `Cannot resolve ./generated/prisma/index.js`

**The situation**  
The Prisma generated client at `packages/db/src/generated/prisma/` was in `.gitignore` (Prisma's default). The generated files didn't exist in the cloned repo on Render/Vercel.

**What broke**  
Both Render and Vercel builds failed at compile time:
```
Module not found: Can't resolve './generated/prisma/index.js'
```

**The fix**  
Add a `postinstall` script to `packages/db/package.json`:
```json
"scripts": {
  "postinstall": "prisma generate"
}
```
`pnpm install` triggers `postinstall` for every workspace package. `prisma generate` only reads `schema.prisma` — it doesn't need `DATABASE_URL`. The client is generated before any build command runs.

---

## 7. Prisma Engine Binary Missing on Vercel Runtime — `rhel-openssl-3.0.x`

**The situation**  
Even after generating the client, Vercel's serverless functions returned 500 at runtime:
```
Prisma Client could not locate the Query Engine for runtime "rhel-openssl-3.0.x"
The following locations were searched:
  /var/task/apps/excalidraw-frontend/src/generated/prisma
  /vercel/path0/packages/db/src/generated/prisma   ← build path, not runtime path
```

**Why it happens**  
Vercel runs on Amazon Linux (RHEL). The Prisma engine binary for that platform (`libquery_engine-rhel-openssl-3.0.x.so.node`) must be generated and deployed. The binary was generated in `packages/db/src/generated/prisma/` but webpack bundles the Prisma client code into the Next.js serverless function. When bundled, `__dirname` gets rewritten to the webpack output directory — Prisma then searches for the engine relative to that wrong path.

**Fix attempt 1 — `outputFileTracingRoot` (partial fix)**  
```ts
outputFileTracingRoot: path.join(__dirname, "../../"),
outputFileTracingIncludes: { "/*": ["../../packages/db/src/generated/prisma/**/*"] }
```
This gets the binary copied into the deployment at the right path, but Prisma still searches in the wrong place because `__dirname` is wrong inside the bundle.

**The actual fix — generate Prisma client inside the Next.js app**  
Add a second generator in `packages/db/prisma/schema.prisma`:
```prisma
generator clientNextjs {
  provider      = "prisma-client-js"
  output        = "../../../apps/excalidraw-frontend/src/generated/prisma"
  binaryTargets = ["native", "rhel-openssl-3.0.x"]
}
```

Create `apps/excalidraw-frontend/lib/prisma.ts`:
```ts
import { PrismaClient } from "../src/generated/prisma/index.js";
const globalForPrisma = global as unknown as { prisma: PrismaClient };
export const prismaClient = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prismaClient;
```

All 11 API routes now import from `@/lib/prisma` instead of `@repo/db/client`.

**Why this works**  
The Prisma client is now in `apps/excalidraw-frontend/src/generated/prisma/`. Webpack bundles code relative to its own location — but since the Prisma source files are literally inside the Next.js app directory, webpack's rewritten `__dirname` points to the same place. Prisma searches `/var/task/apps/excalidraw-frontend/src/generated/prisma` and finds the binary there.

**Also add `binaryTargets`**  
```prisma
binaryTargets = ["native", "rhel-openssl-3.0.x"]
```
`native` = current machine (linux-x64 locally, also RHEL on Vercel). `rhel-openssl-3.0.x` = explicit Vercel target. Without this, only the local platform binary is generated.

**ESLint side effect**  
The generated Prisma files contain `require()` calls and unused vars that trigger ESLint errors during `next build`. Fix:
```js
// eslint.config.mjs
{ ignores: ["src/generated/**"] }
```

---

## 8. WS Backend — Render Health Check & Free Tier Keep-Alive

**The situation**  
Render's free tier spins down services after 15 minutes of inactivity. A WebSocket server has no natural HTTP traffic to keep it alive.

**The fix**  
Add an HTTP server alongside the WebSocket server. Render (and UptimeRobot) can hit `/health` via HTTP:

```ts
import { createServer } from "http";
import { WebSocketServer } from "ws";

const server = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200);
    res.end("ok");
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server }); // WS attached to HTTP server
server.listen(PORT);
```

**Keep-alive**  
UptimeRobot (free) pings `https://your-service.onrender.com/health` every 5 minutes. This resets the inactivity timer — the service never spins down.

**Port**  
Render sets `PORT` env var automatically. Use `process.env.PORT || 8080`. Render's load balancer routes external HTTPS/WSS traffic to this port.

---

## 9. Next.js 15 — Async `params` in Route Handlers

**The situation**  
Next.js 15 changed `params` in dynamic route segments from a plain object to a `Promise`.

**What broke**  
```ts
// Old — broke in Next.js 15
export default function Page({ params }: { params: { roomId: string } }) {
  const { roomId } = params; // TypeError: params is not an object
}
```

**The fix**  
```ts
// New — await the params
export default async function Page({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
}
```

This applies to both `page.tsx` files and API `route.ts` files with dynamic segments.

---

## 10. WebSocket Server — `addEventListener` vs `onmessage` Overwriting

**The situation**  
Multiple parts of the code needed to handle WebSocket messages (presence, shapes, chat).

**What broke**  
```ts
ws.onmessage = handler1;   // set handler
ws.onmessage = handler2;   // silently overwrites handler1 — it's gone
```

**The fix**  
Always use `addEventListener`:
```ts
ws.addEventListener("message", handler1);
ws.addEventListener("message", handler2); // both fire
```

`onmessage` is a property — assigning it replaces the previous value. `addEventListener` adds to a list. Use the latter whenever multiple handlers need to coexist.

---

## 11. Zod v4 API Change — `.errors` → `.issues`

**The situation**  
An upgrade from Zod v3 to Zod v4 changed the property name on `ZodError`.

**What broke**  
```ts
if (!result.success) {
  return res.json({ error: result.error.errors }); // undefined in Zod v4
}
```

**The fix**  
```ts
return res.json({ error: result.error.issues }); // Zod v4 uses .issues
```

---

## 12. JWT Stateless Password Reset (Serverless Compatibility)

**The situation**  
The original forgot-password flow stored a reset token in a server-side `Map`. This is fundamentally broken in serverless environments — each invocation gets a fresh process with an empty map.

**What broke**  
User requests a password reset → token stored in Map → Vercel spins down the function instance → user clicks the email link → new function instance has empty Map → token not found → reset fails.

**The fix**  
Issue a signed JWT as the reset token instead:
```ts
export function signResetToken(email: string): string {
  return jwt.sign({ email, purpose: "reset" }, JWT_SECRET, { expiresIn: "1h" });
}

export function verifyResetToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { email: string; purpose: string };
    if (decoded.purpose !== "reset") return null;
    return decoded.email;
  } catch {
    return null;
  }
}
```

No server-side state. Any function instance can verify the token. Expiry is handled by JWT itself.

---

## General Monorepo Lessons

### pnpm workspace gotchas
- Never run `npm install` in any subdirectory — it creates a `node_modules` that conflicts with pnpm hoisting
- `workspace:*` in `dependencies` means "use the local package at any version" — Vercel handles this correctly
- `pnpm --filter=<name> <script>` runs a script in a specific package; `pnpm -r <script>` runs it in all packages

### Turborepo caching
- Vercel integrates with Turbo's remote cache — cache hits make subsequent deploys fast
- `turbo.json` `outputs` must list everything the build produces that other packages consume, or caching breaks incremental builds

### Environment variables in monorepos
- Next.js only reads `.env` from its own directory — for a monorepo root `.env`, use `dotenv` in `next.config.ts`
- `NEXT_PUBLIC_*` vars are inlined at build time — they cannot be changed at runtime without a redeploy
- Vercel environment variables are available in both build and runtime environments — set them in the dashboard, not in files

### Native binaries (`.node` files)
- Prisma, bcrypt, and other native modules generate platform-specific `.node` binaries
- These must be generated for the TARGET platform, not just the development platform
- Always add `binaryTargets = ["native", "rhel-openssl-3.0.x"]` to Prisma generators when deploying to Vercel/AWS

# SketchBlade - Collaborative Drawing Platform

A real-time collaborative drawing platform inspired by Excalidraw, built with modern web technologies. Users can create rooms and draw together in real-time with multiple drawing tools.

## Features

- **Real-time Collaboration**: Multiple users can draw simultaneously in the same room
- **Drawing Tools**: Rectangle, ellipse, diamond, arrow, line, pencil, highlighter, text, and eraser
- **Style Controls**: Custom stroke/text color, adjustable text font size, and a customizable canvas background color
- **Media Insert**: Drop images and videos onto the canvas (uploaded to Cloudinary via signed, server-authorized uploads)
- **Zoom and Pan**: Navigate large canvases with smooth zoom and pan controls
- **Undo / Redo**: Full undo/redo history that persists to the database via WebSocket
- **Room-based Sessions**: Create and join rooms with unique slugs and optional passwords
- **User Authentication**: Sign up, sign in, forgot password, and change password flows
- **Presence**: See who else is currently in the room
- **Live Chat**: Per-room chat alongside the canvas
- **Resilient Connect Flow**: Polls the realtime server's health before joining a room, so a cold-started free-tier backend shows a clear "waking up" message instead of an endless spinner

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS v4
- **REST API**: Next.js API Routes (co-located with the frontend)
- **Real-time**: Node.js WebSocket server (`ws` library)
- **Database**: Prisma 6 + Neon PostgreSQL
- **Media**: Cloudinary (signed uploads for images/videos)
- **Auth**: JWT + bcrypt
- **Monorepo**: Turborepo, pnpm workspaces
- **Deployment**: Vercel (frontend), Render (WS backend)

## Project Structure

```
sketchblade/
├── apps/
│   ├── excalidraw-frontend/   # Next.js 15 app — UI and all REST API routes
│   └── ws-backend/            # Node.js WebSocket server (real-time sync)
└── packages/
    ├── db/                    # Prisma schema + Neon PostgreSQL client (@repo/db)
    ├── common/                # Shared Zod schemas (@repo/common)
    ├── backend-common/        # JWT_SECRET config (@repo/backend-common)
    ├── typescript-config/     # Shared tsconfig bases
    └── eslint-config/         # Shared ESLint config
```

## Architecture

```
┌──────────────────────────┐         ┌──────────────────────┐
│  excalidraw-frontend     │         │  ws-backend          │
│  (Next.js 15)            │         │  (Node.js / ws)      │
│                          │         │                      │
│  - Drawing canvas        │◄───WS──►│  - Drawing events    │
│  - Drawing tools         │         │  - Undo / redo sync  │
│  - Zoom / pan            │         │  - Presence          │
│  - REST API routes       │         │  - Chat events       │
└──────────────────────────┘         └──────────────────────┘
            │                                    │
            └────────────────┬───────────────────┘
                             │
                  ┌──────────────────┐
                  │  Neon PostgreSQL  │
                  │  (via Prisma)     │
                  │                  │
                  │  - Users          │
                  │  - Rooms          │
                  │  - Drawings       │
                  │  - Chats          │
                  └──────────────────┘
```

## Local Development

### Prerequisites

- Node.js 20.x
- pnpm 9+
- A PostgreSQL database — [Neon](https://neon.tech) free tier works

### Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/satyam-code45/sketchblade.git
   cd sketchblade
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

   This also runs `prisma generate` automatically via the `@repo/db` postinstall script.

3. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` at the repo root and fill in:

   ```env
   DATABASE_URL=postgresql://...
   JWT_SECRET=your-secret-here
   NEXT_PUBLIC_WS_URL=ws://localhost:8080

   # Optional — only needed for image/video insert on the canvas
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   ```

4. **Push the database schema**

   ```bash
   pnpm --filter=@repo/db db:push
   ```

5. **Start the development servers** (two terminals)

   ```bash
   # Terminal 1 — WebSocket server on :8080
   pnpm --filter=ws-backend dev

   # Terminal 2 — Next.js on :3000
   pnpm --filter=excalidraw-frontend dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
pnpm --filter=excalidraw-frontend build
pnpm --filter=ws-backend build
```

## Deployment

The project ships with ready-made config files:

- **`vercel.json`** (repo root) — deploys `apps/excalidraw-frontend` to Vercel
- **`render.yaml`** (repo root) — deploys `apps/ws-backend` to Render

See [DEPLOYMENT.md](DEPLOYMENT.md) for environment variable requirements and step-by-step instructions for each platform.

## Contributing

Contributions are welcome. Please open an issue or pull request on [GitHub](https://github.com/satyam-code45/sketchblade).

## License

This project is open source and available under the [MIT License](LICENSE).

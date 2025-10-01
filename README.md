# SketchBlade - Collaborative Drawing Platform

A real-time collaborative drawing platform inspired by Excalidraw, built with modern web technologies. Users can create rooms and draw together in real-time with multiple drawing tools.

## 🎥 Project Demo

> **🚀 Coming Soon**: This project will be live soon! Until then, enjoy this demo video showcasing the current functionality.

### 📺 [**Watch Demo Video →**](https://drive.google.com/file/d/1o9F67D2cxU0B7mO_A_Rm60XsxLLtqNcd/view?usp=sharing)

```
🎬 Demo Highlights:
✨ Real-time collaborative drawing
🎨 Multiple drawing tools (pencil, rectangle, circle)
👥 Multi-user room functionality
💬 Live chat integration
🖱️ Smooth drawing experience
```

*The video demonstrates the seamless collaborative drawing experience with multiple users drawing simultaneously in the same room.*

---

## 🚀 Features

- **Real-time Collaboration**: Multiple users can draw simultaneously in the same room
- **Multiple Drawing Tools**: Pencil, rectangle, and circle drawing tools
- **Room-based Sessions**: Create and join drawing rooms
- **User Authentication**: Secure sign-up and sign-in system
- **Real-time Chat**: Chat with other users while drawing (coming soon)

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express.js, WebSocket (ws)
- **Database**: PostgreSQL with Prisma ORM
- **Monorepo**: Turborepo for workspace management
- **Real-time**: WebSocket connections for live collaboration

## 📁 Project Structure

### Apps and Packages

- `excalidraw-frontend`: Main drawing application built with Next.js
- `http-backend`: REST API server for authentication and room management
- `ws-backend`: WebSocket server for real-time drawing synchronization
- `@repo/db`: Database package with Prisma schema and client
- `@repo/common`: Shared TypeScript types and validation schemas
- `@repo/backend-common`: Shared backend utilities and configuration
- `@repo/ui`: Shared React component library
- `@repo/eslint-config`: ESLint configurations
- `@repo/typescript-config`: TypeScript configurations

## 🚦 Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm/yarn
- PostgreSQL database

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/satyam-code45/sketchblade.git
   cd sketchblade
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   Create `.env` files in the respective packages:
   ```bash
   # packages/db/.env
   DATABASE_URL="postgresql://username:password@localhost:5432/sketchblade"
   
   # apps/http-backend/.env (if needed)
   JWT_SECRET="your-jwt-secret"
   ```

4. **Set up the database**
   ```bash
   cd packages/db
   npx prisma migrate dev
   npx prisma generate
   ```

5. **Start the development servers**
   ```bash
   # Start all services
   pnpm dev
   
   # Or start specific services
   pnpm dev --filter=excalidraw-frontend
   pnpm dev --filter=http-backend
   pnpm dev --filter=ws-backend
   ```

### Build

To build all apps and packages:

```bash
pnpm build
```

To build specific packages:

```bash
pnpm build --filter=excalidraw-frontend
pnpm build --filter=http-backend
```

## 🎯 How It Works

1. **Authentication**: Users sign up/sign in through the HTTP backend
2. **Room Creation**: Users can create or join drawing rooms using a unique slug
3. **Real-time Drawing**: WebSocket connections enable real-time synchronization of drawing events
4. **Drawing Tools**: Multiple tools available - pencil for freehand, rectangle, and circle shapes
5. **Persistence**: Drawings are stored in PostgreSQL database (⚠️ **Currently not implemented**)

## 🔧 Current Status & Known Issues

**✅ Working Features:**
- User authentication (sign-up/sign-in)
- Room creation and joining
- Real-time chat system
- Drawing tools UI (pencil, rectangle, circle)
- WebSocket connection setup

**⚠️ Issues to Fix:**
- **Drawing data is not being saved to database** - No database schema for drawings
- **Drawing events are not broadcasted to other users** - WebSocket server doesn't handle drawing events
- **No persistence of drawings** - Missing API endpoints for saving/loading drawings

## 🛠️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Frontend       │    │  HTTP Backend   │    │  WebSocket      │
│  (Next.js)      │    │  (Express)      │    │  Backend        │
│                 │    │                 │    │                 │
│  - Drawing UI   │◄──►│  - Auth APIs    │    │  - Chat events  │
│  - Canvas       │    │  - Room APIs    │◄──►│  - Join/Leave   │
│  - Tools        │    │  - User mgmt    │    │  - [Drawing]*   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │   Database      │
                    │                 │
                    │  - Users        │
                    │  - Rooms        │
                    │  - Chats        │
                    │  - [Drawings]*  │
                    └─────────────────┘
```
*Features marked with [*] are planned but not yet implemented.

## 📚 API Endpoints

### HTTP Backend (Port 3001)
- `POST /sign-up` - User registration
- `POST /sign-in` - User authentication  
- `POST /create-room` - Create new drawing room
- `GET /room/:slug` - Get room details
- `GET /chats/:roomId` - Get chat history

### WebSocket Backend (Port 8080)
- `join_room` - Join a drawing room
- `leave_room` - Leave a drawing room
- `chat` - Send chat messages
- *(Missing: drawing event handlers)*

## 🤝 Contributing

This project is currently in development. Main areas that need work:

1. **Database Schema**: Add models for storing drawing data
2. **WebSocket Events**: Implement drawing event handlers
3. **API Endpoints**: Add endpoints for saving/loading drawings
4. **Frontend Integration**: Connect drawing events to WebSocket

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

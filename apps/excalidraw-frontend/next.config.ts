import type { NextConfig } from "next";
import path from "path";
import { configDotenv } from "dotenv";

// Load the root monorepo .env so API routes can access DATABASE_URL, JWT_SECRET, etc.
// In production (Vercel) these vars are set via the dashboard and override: false keeps them.
configDotenv({ path: path.resolve(process.cwd(), "../../.env"), override: false });

// HTTP backend is now built-in as Next.js API routes — clear the old external URL
// so config.ts defaults to "/api"
delete process.env.NEXT_PUBLIC_HTTP_BACKEND;

const nextConfig: NextConfig = {};

export default nextConfig;

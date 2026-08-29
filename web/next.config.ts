import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// The Flue agent server (../agent). `npm run dev` there serves on :5173;
// a production build (`node dist/server.mjs`) defaults to :3000.
const FLUE_SERVER_URL = process.env.FLUE_SERVER_URL ?? "http://localhost:5173";
const webRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Parent lockfile would otherwise make Turbopack treat the repo root as app root.
  turbopack: {
    root: webRoot,
  },
  rewrites() {
    // Same-origin proxies so the browser never talks to Flue or Cala directly.
    // /api/agents/* → Flue agents (SSE). /api/satellites/* → Cala enrichment.
    return [
      {
        source: "/api/agents/:path*",
        destination: `${FLUE_SERVER_URL}/agents/:path*`,
      },
      {
        source: "/api/satellites/:path*",
        destination: `${FLUE_SERVER_URL}/api/satellites/:path*`,
      },
    ];
  },
};

export default nextConfig;

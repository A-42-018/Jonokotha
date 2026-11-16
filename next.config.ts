import type { NextConfig } from "next";
import { applyEnvAliases } from "./src/lib/env-aliases";

applyEnvAliases();

const nextConfig: NextConfig = {
  /* config options here */
  // Names the service-worker cache (public/sw.js): a new deploy gets a new cache and old ones are deleted on activate.
  env: { NEXT_PUBLIC_BUILD_ID: (process.env.VERCEL_GIT_COMMIT_SHA ?? Date.now().toString(36)).slice(0, 12) },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

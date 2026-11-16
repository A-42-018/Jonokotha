import { defineConfig } from "vitest/config";

// Database tests run against a LOCAL Supabase (`npx supabase start`), never the live project.
export default defineConfig({ test: { include: ["tests/db/**/*.test.ts"], fileParallelism: false, testTimeout: 20000 } });

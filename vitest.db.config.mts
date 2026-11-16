import { defineConfig } from "vitest/config";

// Database and RLS tests run against a LOCAL Supabase (`npx supabase start`), never the live project.
export default defineConfig({ test: { include: ["tests/db/**/*.test.ts", "tests/rls/**/*.test.ts"], fileParallelism: false, testTimeout: 30000 } });

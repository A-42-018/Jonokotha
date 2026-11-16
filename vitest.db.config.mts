import { defineConfig } from "vitest/config";
import path from "node:path";

// Database, RLS and API tests run against a LOCAL Supabase (`npx supabase start`), never the live project.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["tests/db/**/*.test.ts", "tests/rls/**/*.test.ts", "tests/api/**/*.test.ts"],
    setupFiles: ["tests/api/setup.ts"],
    fileParallelism: false, testTimeout: 60000, hookTimeout: 60000,
  },
});

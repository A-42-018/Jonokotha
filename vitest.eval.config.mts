import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// `npm run eval`: measures the AI core on tests/ai/dataset.v0.json. Not part of `npm test`.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["tests/ai/eval.run.ts"], testTimeout: 30 * 60_000, hookTimeout: 60_000 },
});

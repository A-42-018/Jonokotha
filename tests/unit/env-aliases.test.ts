import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyEnvAliases, ENV_ALIASES } from "@/lib/env-aliases";

describe("env aliases", () => {
  it("fills the canonical name from an alias, and never overrides a canonical value", () => {
    const env: Record<string, string | undefined> = { AI_MODEL: "m1", STT_API_KEY: "k", EMBEDDING_MODEL: "alias", EMBEDDINGS_MODEL: "canonical" };
    expect(applyEnvAliases(env).sort()).toEqual(["AI_MODEL", "STT_API_KEY"]);
    expect(env.ANTHROPIC_MODEL).toBe("m1");
    expect(env.TRANSCRIBE_API_KEY).toBe("k");
    expect(env.EMBEDDINGS_MODEL).toBe("canonical");
  });
  it("scripts/check-env.mjs lists the same aliases", () => {
    const src = readFileSync("scripts/check-env.mjs", "utf8");
    for (const [a, c] of Object.entries(ENV_ALIASES)) expect(src).toContain(`${a}: "${c}"`);
  });
});

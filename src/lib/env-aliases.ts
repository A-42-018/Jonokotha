/**
 * Masterplan §26 names (left) map to the names this code reads (right). Both work; the canonical name wins when both are set.
 * Applied at startup from next.config.ts, and mirrored in scripts/check-env.mjs (a unit test keeps the two lists equal).
 */
export const ENV_ALIASES: Record<string, string> = {
  AI_MODEL: "ANTHROPIC_MODEL",
  EMBEDDING_MODEL: "EMBEDDINGS_MODEL",
  EMBEDDING_ENDPOINT: "EMBEDDINGS_BASE_URL",
  EMBEDDING_API_KEY: "EMBEDDINGS_API_KEY",
  STT_API_KEY: "TRANSCRIBE_API_KEY",
  STT_ENDPOINT: "TRANSCRIBE_BASE_URL",
  STT_MODEL: "TRANSCRIBE_MODEL",
};

export function applyEnvAliases(env: Record<string, string | undefined> = process.env): string[] {
  const used: string[] = [];
  for (const [alias, canonical] of Object.entries(ENV_ALIASES)) {
    if (env[alias] && !env[canonical]) { env[canonical] = env[alias]; used.push(alias); }
  }
  return used;
}

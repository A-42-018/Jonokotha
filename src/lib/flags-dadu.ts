/**
 * Dadu (জমির দাদু) helper flags, read at build time like `flags-r2.ts`. All default off, so with `NEXT_PUBLIC_FLAG_DADU` unset the layout renders nothing
 * for him and the first-load JavaScript does not change. `voice` adds the microphone and spoken answers; `ai` lets signed-in people get model-written answers.
 * The server has its own switches (`helper`, `helper_ai`, `helper_speech` in `feature_flags`). Each variable is written out in full: Next only inlines a literal `process.env.NEXT_PUBLIC_X`.
 */
export const DADU = {
  on: process.env.NEXT_PUBLIC_FLAG_DADU === "1",
  voice: process.env.NEXT_PUBLIC_FLAG_DADU === "1" && process.env.NEXT_PUBLIC_FLAG_DADU_VOICE === "1",
  ai: process.env.NEXT_PUBLIC_FLAG_DADU === "1" && process.env.NEXT_PUBLIC_FLAG_DADU_AI === "1",
} as const;

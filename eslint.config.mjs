import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-*/**",   // a second build or server beside a dev server (NEXT_DIST_DIR)
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/vendor/**",
    ".claude/**",   // Claude Code worktrees and settings are not project code
  ]),
]);

export default eslintConfig;

import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { dict } from "@/lib/i18n";

/** Writes the native-speaker review sheet: EXPORT_STRINGS=docs/aibc/language/strings-review.csv npx vitest run tests/unit/export-strings.test.ts */
function walk(o: unknown, path: string, out: Map<string, string>) {
  if (typeof o === "string") out.set(path, o);
  else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) walk(v, path ? `${path}.${k}` : k, out);
}
it.skipIf(!process.env.EXPORT_STRINGS)("export strings for native review", () => {
  const bn = new Map<string, string>();
  const en = new Map<string, string>();
  walk(dict.bn, "", bn);
  walk(dict.en, "", en);
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = [["key", "bangla", "english", "reviewer_ok (y/n)", "better_wording"].join(",")];
  for (const [k, v] of [...bn].sort((a, b) => a[0].localeCompare(b[0]))) rows.push([q(k), q(v), q(en.get(k) ?? ""), "", ""].join(","));
  writeFileSync(process.env.EXPORT_STRINGS as string, "﻿" + rows.join("\n") + "\n");
});

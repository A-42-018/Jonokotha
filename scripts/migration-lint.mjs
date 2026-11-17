// npm run lint:migrations [-- --since 24] — fails when a migration breaks the rules in scripts/lib/migration-lint.mjs.
import { readdirSync, readFileSync } from "node:fs";
import { lintMigrations } from "./lib/migration-lint.mjs";

const i = process.argv.indexOf("--since");
const since = i > 0 ? Number(process.argv[i + 1]) : 24;
const dir = "supabase/migrations";
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).map((name) => ({ name, sql: readFileSync(`${dir}/${name}`, "utf8") }));
const problems = lintMigrations(files, since);
for (const p of problems) console.log(`FAIL  ${p}`);
console.log(problems.length ? `\n${problems.length} problem(s) in ${files.length} migrations (checked from ${String(since).padStart(4, "0")}).` : `OK    ${files.length} migrations; rules checked for 00${since} and later.`);
process.exit(problems.length ? 1 : 0);

// npm run check:environment -- production    (reads the current environment; use `node --env-file=.env.production.local` to check a file)
import { readFileSync } from "node:fs";
import { checkEnvironment } from "./lib/env-policy.mjs";

const name = process.argv[2] ?? "development";
const r = checkEnvironment(name, process.env, JSON.parse(readFileSync("config/environments.json", "utf8")));
for (const p of r.problems) console.log(`FAIL  ${p}`);
console.log(r.ok ? `OK    ${name} environment settings match config/environments.json` : `\n${r.problems.length} problem(s) for ${name}.`);
process.exit(r.ok ? 0 : 1);

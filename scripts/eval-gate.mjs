// npm run eval:gate — fails when the offline evaluation (tests/ai/out/latest.md, written by `npm run eval`) regresses past
// stated floors. Floors sit a few points below the 2026-11-16 baseline (docs/aibc/eval-baseline.md) so noise does not fail
// the build but a real regression does. Raise them deliberately when the baseline improves. The live-model run stays manual.
import { readFileSync } from "node:fs";

const FLOORS = { fallbackCategoryAll: 58, fallbackRoutingTop1: 60, piiRecall: 100, piiFalsePositives: 0 /* ceiling */ };
const md = readFileSync("tests/ai/out/latest.md", "utf8");
const pct = (re) => { const m = md.match(re); return m ? Number(m[1]) : null; };
const got = {
  fallbackCategoryAll: pct(/Keyword fallback[\s\S]*?\| all \| ([\d.]+)%/),
  fallbackRoutingTop1: pct(/Routing top-1[^:]*: ([\d.]+)%/),
  piiRecall: pct(/Recall: ([\d.]+)%/),
  piiFalsePositives: pct(/False positives[^:]*: ([\d.]+)%/),
};
let bad = 0;
for (const [k, v] of Object.entries(got)) {
  const ok = v !== null && (k === "piiFalsePositives" ? v <= FLOORS[k] : v >= FLOORS[k]);
  console.log(`${ok ? "OK  " : "FAIL"} ${k}: ${v ?? "not found"} (${k === "piiFalsePositives" ? "max" : "min"} ${FLOORS[k]})`);
  if (!ok) bad++;
}
process.exit(bad ? 1 : 0);

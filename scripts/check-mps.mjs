// npm run check:mps — validates supabase/seed/data/mps-13th-2026-11-16.json (no network, no database).
import { loadMps, validateMps } from "./mps-lib.mjs";
const doc = loadMps(process.argv[2]);
const errors = validateMps(doc);
const review = doc.seats.filter((s) => s.review?.length);
console.log(`${doc.seats.length} seats, ${doc.seats.filter((s) => s.status === "serving").length} serving, ${review.length} need a human check`);
for (const s of review) for (const r of s.review) console.log(`  review ${s.name_en}: ${r}`);
if (errors.length) { console.error(`\n${errors.length} problem(s):`); for (const x of errors) console.error("  " + x); process.exit(1); }
console.log("OK");

// npm run import:mps — sends the MP file to POST /api/v1/admin/representatives/import in chunks of 100. Safe to run again.
// Needs APP_URL (default http://localhost:3000) and ADMIN_TOKEN: the access token of a signed-in admin with MFA.
// Imported MPs are 'pending'. Verify them afterwards in /admin/verification.
import { loadMps, validateMps, toChunks } from "./mps-lib.mjs";
const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""), token = process.env.ADMIN_TOKEN;
if (!token) { console.error("Set ADMIN_TOKEN to an admin's access token."); process.exit(1); }
const doc = loadMps(), problems = validateMps(doc);
if (problems.length) { console.error("The data file is not valid; run npm run check:mps"); process.exit(1); }
const total = { seats: 0, new: 0, changed: 0, terms_closed: 0, unchanged: 0 };
for (const [i, items] of toChunks(doc).entries()) {
  const res = await fetch(`${base}/api/v1/admin/representatives/import`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}`, origin: base },
    body: JSON.stringify({ source: doc.source, items }) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) { console.error(`chunk ${i + 1} failed: ${res.status} ${body.code ?? ""} ${body.message ?? ""}`); process.exit(1); }
  for (const k of Object.keys(total)) total[k] += body.data?.[k] ?? 0;
  console.log(`chunk ${i + 1}: ${JSON.stringify(body.data)}`);
}
console.log("done", JSON.stringify(total));

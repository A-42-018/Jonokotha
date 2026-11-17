// npm run import:mps — signs in as an admin and calls the audited import_representatives function, 100 seats at a time. Safe to run again.
// Needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (from .env.local) plus ADMIN_EMAIL and ADMIN_PASSWORD
// typed in your own terminal for this one command (never saved in a file). If MFA is enforced, the account must be set up for it.
// Imported MPs are 'pending'. Verify them afterwards in /admin/verification.
import { createClient } from "@supabase/supabase-js";
import { loadMps, validateMps, toChunks } from "./mps-lib.mjs";

const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anon, ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = process.env;
if (!url || !anon || !email || !password) { console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD (and have .env.local with the Supabase URL and anon key)."); process.exit(1); }
const doc = loadMps();
if (validateMps(doc).length) { console.error("The data file is not valid; run npm run check:mps"); process.exit(1); }

const sb = createClient(url, anon, { auth: { persistSession: false } });
const { error: signErr } = await sb.auth.signInWithPassword({ email, password });
if (signErr) { console.error("Sign-in failed:", signErr.message); process.exit(1); }
console.log(`Importing into ${new URL(url).host}`);

const total = { seats: 0, new: 0, changed: 0, terms_closed: 0, unchanged: 0 };
for (const [i, items] of toChunks(doc).entries()) {
  const { data, error } = await sb.rpc("import_representatives", { p_source: doc.source, p_items: items });
  if (error) { console.error(`chunk ${i + 1} failed: ${error.code} ${error.message}`); process.exit(1); }
  for (const k of Object.keys(total)) total[k] += data?.[k] ?? 0;
  console.log(`chunk ${i + 1}: ${JSON.stringify(data)}`);
}
console.log("done", JSON.stringify(total));

// npm run verify:mps [-- --dry]
// Signs in as an admin and marks imported MPs 'verified' through the audited verify_representative function, so they appear on the site.
// It verifies ONLY pending, non-demo MPs that have NO review flags and an official source link (the parliament profile saved at import).
// MPs with review flags (name conflicts, withheld results, party spelling...) are left 'pending' and listed, for a person to decide in /admin/verification.
// This is a bulk shortcut for the per-person check: the source link is the parliament.gov.bd member list; names were not re-checked one by one.
// Needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (from .env.local) plus ADMIN_EMAIL and ADMIN_PASSWORD
// typed in your own terminal for this one command (never saved in a file). --dry lists what would change and writes nothing.
import { createClient } from "@supabase/supabase-js";

const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anon, ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = process.env;
const dry = process.argv.includes("--dry");
if (!url || !anon || !email || !password) { console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD (and have .env.local with the Supabase URL and anon key)."); process.exit(1); }

const sb = createClient(url, anon, { auth: { persistSession: false } });
const { error: signErr } = await sb.auth.signInWithPassword({ email, password });
if (signErr) { console.error("Sign-in failed:", signErr.message); process.exit(1); }
console.log(`${dry ? "DRY RUN on" : "Verifying in"} ${new URL(url).host}`);

const { data, error } = await sb.from("representatives").select("id,full_name,source_url,verification_status,review_flags,is_demo").eq("is_demo", false).limit(1000);
if (error) { console.error("Could not read representatives:", error.message); process.exit(1); }

const pending = data.filter((r) => r.verification_status === "pending");
const flagged = pending.filter((r) => r.review_flags?.length);
const noSource = pending.filter((r) => !r.review_flags?.length && !/^https?:\/\//.test(r.source_url ?? ""));
const todo = pending.filter((r) => !r.review_flags?.length && /^https?:\/\//.test(r.source_url ?? ""));
console.log(`${data.length} MPs: ${data.filter((r) => r.verification_status === "verified").length} already verified, ${pending.length} pending (${todo.length} to verify, ${flagged.length} flagged, ${noSource.length} without a source link)`);
for (const r of flagged) console.log(`  left pending (flagged): ${r.full_name} — ${r.review_flags.join(", ")}`);
for (const r of noSource) console.log(`  left pending (no source link): ${r.full_name}`);
if (dry) { console.log("dry run: nothing written"); process.exit(0); }

let ok = 0, failed = 0;
for (const r of todo) {
  const { error: e } = await sb.rpc("verify_representative", { p_rep: r.id, p_status: "verified", p_source_url: r.source_url, p_note: "Bulk verified from the parliament.gov.bd member list; no review flags." });
  if (e) { failed++; console.error(`  failed ${r.full_name}: ${e.code} ${e.message}`); } else ok++;
}
console.log(`done: ${ok} verified, ${failed} failed, ${flagged.length + noSource.length} left pending`);
if (failed) process.exit(1);

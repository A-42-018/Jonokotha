// npm run check:env — reports which settings are set and probes each service. Never prints secret values.
const need = [
  ["NEXT_PUBLIC_SUPABASE_URL", true], ["NEXT_PUBLIC_SUPABASE_ANON_KEY", true], ["ANTHROPIC_API_KEY", true],
  ["ANTHROPIC_MODEL", false], ["SUPABASE_SERVICE_ROLE_KEY", false],
];
let bad = 0;
const row = (ok, name, note = "") => { console.log(`${ok ? "OK     " : "FAIL   "} ${name}${note ? " — " + note : ""}`); if (!ok) bad++; };
const env = process.env;

for (const [k, required] of need) {
  const set = Boolean(env[k]);
  if (set) console.log(`set     ${k}`);
  else if (required) row(false, k, "missing");
  else console.log(`unset   ${k} (optional)`);
}

async function probe(name, fn) {
  try { const [ok, note] = await fn(); row(ok, name, note); } catch (e) { row(false, name, `unreachable (${e.cause?.code ?? e.message})`); }
}

if (env.ANTHROPIC_API_KEY) {
  await probe("Anthropic key", async () => {
    const r = await fetch("https://api.anthropic.com/v1/models", { headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" } });
    return [r.ok, r.ok ? `valid; model ${env.ANTHROPIC_MODEL ?? "claude-opus-5-5"}` : `HTTP ${r.status} (key rejected or no access)`];
  });
}

if (env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  const h = { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` };
  await probe("Supabase auth", async () => { const r = await fetch(`${base}/auth/v1/settings`, { headers: h }); return [r.ok, `HTTP ${r.status}`]; });
  for (const t of ["public_cases", "public_case_events", "agencies", "constituencies"]) {
    await probe(`table/view ${t}`, async () => {
      const r = await fetch(`${base}/rest/v1/${t}?select=*&limit=1`, { headers: h });
      return [r.ok, r.ok ? "exists" : `HTTP ${r.status} (run migrations 0001-0003?)`];
    });
  }
  await probe("public_cases hides reporter_id", async () => {
    const r = await fetch(`${base}/rest/v1/public_cases?select=reporter_id&limit=1`, { headers: h });
    return [!r.ok, r.ok ? "LEAK: public_cases exposes reporter_id" : "column not exposed (or view missing)"];
  });
  await probe("anonymous cannot read cases table", async () => {
    const r = await fetch(`${base}/rest/v1/cases?select=reporter_id&limit=1`, { headers: h });
    const rows = r.ok ? await r.json() : [];
    return [!rows.length, rows.length ? "LEAK: anon can read cases (apply migration 0003)" : "no rows visible to anon"];
  });
}
console.log(bad ? `\n${bad} problem(s).` : "\nAll checks passed.");
process.exit(bad ? 1 : 0);

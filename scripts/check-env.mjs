// npm run check:env — reports which settings are set and probes each service. Never prints secret values.
const need = [
  ["NEXT_PUBLIC_SUPABASE_URL", true], ["NEXT_PUBLIC_SUPABASE_ANON_KEY", true], ["ANTHROPIC_API_KEY", true],
  ["ANTHROPIC_MODEL", false], ["AI_BASE_URL", false], ["SUPABASE_SERVICE_ROLE_KEY", false], ["EMBEDDINGS_BASE_URL", false], ["EMBEDDINGS_API_KEY", false],
  // Phase 2 (all optional: each feature reports "unavailable" or falls back when its setting is missing)
  ["TRANSCRIBE_BASE_URL", false], ["TRANSCRIBE_API_KEY", false], ["TRANSCRIBE_MODEL", false], ["MALWARE_SCAN_URL", false],
  ["VAPID_PUBLIC_KEY", false], ["VAPID_PRIVATE_KEY", false], ["VAPID_SUBJECT", false], ["EMAIL_PROVIDER", false], ["EMAIL_API_KEY", false], ["EMAIL_FROM", false],
  ["CRON_SECRET", false], ["NEXT_PUBLIC_APP_URL", false],
  // Phase 3
  ["SENTRY_DSN", false], ["ALERT_WEBHOOK_URL", false], ["EMBEDDINGS_MODEL", false],
  // Phase 7 (all optional; WhatsApp, SMS and read-aloud stay "planned" until an account exists. Prices are never assumed: set them from your contract.)
  ["WHATSAPP_TOKEN", false], ["WHATSAPP_PHONE_NUMBER_ID", false], ["WHATSAPP_APP_SECRET", false], ["WHATSAPP_VERIFY_TOKEN", false], ["WHATSAPP_COST_PER_MESSAGE_USD", false],
  ["SMS_API_URL", false], ["SMS_API_KEY", false], ["SMS_SENDER", false], ["SMS_WEBHOOK_SECRET", false], ["SMS_COST_PER_SEGMENT_USD", false],
  ["TTS_API_URL", false], ["TTS_API_KEY", false], ["TTS_VOICE", false],
];
// Masterplan §26 names accepted as aliases (keep equal to src/lib/env-aliases.ts; tests/unit/env-aliases.test.ts checks it).
const ALIASES = { AI_MODEL: "ANTHROPIC_MODEL", EMBEDDING_MODEL: "EMBEDDINGS_MODEL", EMBEDDING_ENDPOINT: "EMBEDDINGS_BASE_URL", EMBEDDING_API_KEY: "EMBEDDINGS_API_KEY", STT_API_KEY: "TRANSCRIBE_API_KEY", STT_ENDPOINT: "TRANSCRIBE_BASE_URL", STT_MODEL: "TRANSCRIBE_MODEL" };
for (const [a, c] of Object.entries(ALIASES)) if (process.env[a] && !process.env[c]) process.env[c] = process.env[a];
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
  // Same settings the app uses: explicit key, optional gateway base URL. A tiny real request, since gateways may not list models.
  await probe("Anthropic key", async () => {
    const base = (env.AI_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
    const model = env.ANTHROPIC_MODEL ?? "claude-opus-5-5";
    const r = await fetch(`${base}/v1/messages`, {
      method: "POST",
      headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 5, messages: [{ role: "user", content: "hi" }] }),
    });
    return [r.ok, r.ok ? `valid via ${new URL(base).host}; model ${model}` : `HTTP ${r.status} via ${new URL(base).host} (key rejected, wrong base URL or model)`];
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

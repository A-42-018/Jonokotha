// Fails if the browser bundle (.next/static) contains something that must stay on the server (task 3.6).
// Run after `npm run build`:  npm run check:bundle
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), ".next/static");
if (!existsSync(root)) { console.error("No .next/static: run `npm run build` first."); process.exit(2); }

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(js|mjs|css|map|json|html)$/.test(name)) yield p;
  }
}

// Server-only values from the environment (anything not NEXT_PUBLIC_*), read from process.env and .env* files.
const secrets = new Map();
const addEnv = (k, v) => { if (!k.startsWith("NEXT_PUBLIC_") && /KEY|SECRET|TOKEN|PASSWORD|SERVICE/i.test(k) && v && v.length >= 12) secrets.set(k, v); };
for (const [k, v] of Object.entries(process.env)) addEnv(k, v ?? "");
for (const f of [".env", ".env.local", ".env.production", ".env.production.local"]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*)"?/);
    if (m) addEnv(m[1], m[2].trim());
  }
}

const patterns = [
  ["Anthropic API key", /sk-ant-[A-Za-z0-9_-]{10,}/],
  ["server env var name", /ANTHROPIC_API_KEY|SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY/],
  ["private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];
const jwt = /eyJ[A-Za-z0-9_-]{15,}\.([A-Za-z0-9_-]{15,})\.[A-Za-z0-9_-]{10,}/g;

const problems = [];
let scanned = 0;
for (const f of files(root)) {
  const text = readFileSync(f, "utf8");
  scanned++;
  const rel = path.relative(process.cwd(), f);
  for (const [name, re] of patterns) if (re.test(text)) problems.push(`${rel}: ${name}`);
  for (const [k, v] of secrets) if (text.includes(v)) problems.push(`${rel}: value of ${k}`);
  for (const m of text.matchAll(jwt)) {
    try {
      const role = JSON.parse(Buffer.from(m[1], "base64url").toString("utf8")).role;
      if (role && role !== "anon") problems.push(`${rel}: JWT with role "${role}" (only the public anon key may ship)`);
    } catch { /* not a JWT */ }
  }
}
if (problems.length) { console.error(`Secrets found in the browser bundle:\n- ${problems.join("\n- ")}`); process.exit(1); }
console.log(`OK: ${scanned} files in .next/static checked, ${secrets.size} server-only values compared, no secrets found.`);

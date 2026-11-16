// Runs the real-stack Playwright specs (tests/e2e/real) against a LOCAL Supabase.
// Needs `npx supabase start` first. Passes the local URL and keys to the Next server and to the tests; never touches a live project.
import { execSync, spawnSync } from "node:child_process";

const out = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
const get = (k) => out.match(new RegExp(`^${k}="?([^"\n]+)"?$`, "m"))?.[1];
const url = get("API_URL"), anon = get("ANON_KEY"), service = get("SERVICE_ROLE_KEY");
if (!url || !anon || !service || !/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  console.error("Local Supabase is not running (npx supabase start)."); process.exit(1);
}
const env = {
  ...process.env, E2E_REAL: "1", SUPABASE_API_URL: url, SUPABASE_ANON_KEY: anon, SUPABASE_SERVICE_ROLE_KEY_LOCAL: service,
  NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anon, SUPABASE_SERVICE_ROLE_KEY: service,
  PW_REUSE_SERVER: "0",
};
// `--mfa` runs only the two-step sign-in spec, alone: it switches enforce_mfa on for the whole local database while it runs.
const args = process.argv.slice(2);
const mfa = args.includes("--mfa");
const rest = args.filter((a) => a !== "--mfa");
if (mfa) env.E2E_MFA = "1";
const target = mfa ? ["tests/e2e/real/mfa.spec.ts", "--workers=1"] : ["tests/e2e/real"];
const r = spawnSync("npx", ["playwright", "test", ...target, ...rest], { stdio: "inherit", env, shell: true });
process.exit(r.status ?? 1);

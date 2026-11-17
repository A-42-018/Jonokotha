// npm run check:release — the automatable part of the release gate (masterplan §21.6, §29). Prints pass/fail per item and
// lists the manual items. Needs a local Supabase for the database checks; pass --skip-db to skip them.
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";

const skipDb = process.argv.includes("--skip-db");
let bad = 0;
const row = (ok, name, note = "") => { console.log(`${ok ? "PASS  " : "FAIL  "} ${name}${note ? " — " + note : ""}`); if (!ok) bad++; };
const sh = (cmd) => { try { execSync(cmd, { stdio: "pipe", timeout: 600000 }); return [true, ""]; } catch (e) { return [false, String(e.stdout ?? "").split("\n").filter((l) => /FAIL|Error|failed/.test(l)).slice(0, 2).join(" | ")]; } };

// 1. migrations are contiguous and unique
const mig = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
const nums = mig.map((f) => Number(f.slice(0, 4)));
// Each phase owns a number range, so gaps are allowed; numbers must be unique and increasing, and the reviewed-flow rules must hold (npm run lint:migrations).
row(nums.every((n, i) => i === 0 || n > nums[i - 1]), "migration numbers are unique and increasing", `${mig.length} files, last ${mig.at(-1)}`);

// 2. static checks
for (const [name, cmd] of [["lint", "npm run lint"], ["typecheck", "npm run typecheck"], ["unit tests", "npm test"], ["dependency audit (high+)", "npm audit --omit=dev --audit-level=high"], ["migration lint (reviewed flow)", "npm run lint:migrations"]]) row(...[sh(cmd)].map(([ok, n]) => [ok, name, n]).flat());

// 3. database suites: RLS matrix, private data in public views, cross-constituency access, audit trail of critical transitions
if (!skipDb) for (const [name, cmd] of [["RLS matrix and coverage guard", "npm run test:rls"], ["database suite (state machine, audit, SLA, privacy)", "npm run test:db"]]) row(...[sh(cmd)].map(([ok, n]) => [ok, name, n]).flat());
else console.log("SKIP  database suites (--skip-db)");

// 4. evaluation gate (offline)
row(...[sh("npm run eval && npm run eval:gate")].map(([ok, n]) => [ok, "evaluation gate (offline floors)", n]).flat());

// 5. documents that must exist and carry evidence
const need = {
  "docs/aibc/eval-results.md": "AI evaluation results published",
  "docs/aibc/restore-drill.md": "restore drill recorded",
  "docs/aibc/pia.md": "privacy impact assessment present",
  "docs/aibc/privacy-notice.md": "privacy notice content present",
  "docs/aibc/security-review.md": "security review present",
  "docs/aibc/runbooks/incident-response.md": "incident runbook present",
  "docs/aibc/runbooks/deploy-and-rollback.md": "deploy and rollback runbook present",
  "docs/aibc/runbooks/environments.md": "environments document present",
  "docs/aibc/pilot/pilot-plan.md": "pilot plan present",
  "docs/aibc/pilot/support-escalation.md": "support and escalation process present",
  "docs/aibc/pilot/governance.md": "governance, retention and legal-hold document present",
  "docs/aibc/pilot/pentest.md": "penetration-test brief present",
};
for (const [f, label] of Object.entries(need)) row(existsSync(f), label, f);
const drill = existsSync("docs/aibc/restore-drill.md") ? readFileSync("docs/aibc/restore-drill.md", "utf8") : "";
row(/Drill result: (PASSED)/.test(drill), "restore drill passed", "needs a line 'Drill result: PASSED' written after a real drill");

// 6. production hygiene (environment of the machine running the check; run it where production variables are set)
row(process.env.DEMO_LOGIN !== "true", "DEMO_LOGIN is off", process.env.DEMO_LOGIN === "true" ? "turn it off and delete demo users before real users" : "");
row(process.env.CSP_MODE === "enforce" || !process.env.VERCEL_ENV || process.env.VERCEL_ENV !== "production", "CSP is enforcing in production", "set CSP_MODE=enforce");

console.log(`\nPhase 6 items that need people: counsel review recorded in docs/aibc/pilot/counsel-review.md; named data-protection, incident and security owners;
independent penetration test with GET /api/v1/admin/pentest summary.blocking_launch = 0; two-person verification of the 999 and 333 helplines; pilot office verified
and support/escalation tested; \`npm run check:environment -- production\` on the production settings; licences read for every enabled data source.
Full list: docs/aibc/pilot/open-items.md.`);
console.log(`\nManual items (cannot be automated): counsel review of privacy notice and terms; native-Bangla review of emergency guidance;
TalkBack and VoiceOver pass; independent penetration test or signed OWASP ASVS L2 self-test; TOTP enrolment for real MP/moderator/admin accounts
then enforce_mfa=true; verified sender domain for email; verified boundary data licences; demo seed dry run.`);
console.log(bad ? `\n${bad} failing item(s).` : "\nAll automated items pass.");
process.exit(bad ? 1 : 0);

import type { Metadata } from "next";
import Link from "next/link";
import Card from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Jonokotha technical docs",
  description: "Architecture, AI components, evidence and limits of Jonokotha (জনকথা), written for judges and technical reviewers.",
};

/**
 * Public technical page for judges and reviewers (AIBC "live /docs module"). Every row says what is built, what is a prototype
 * and what is only planned, and points to the file that proves it. Numbers are copied from docs/aibc/eval-results.md and
 * docs/aibc/graph-evaluation.md, with their limits. Written in English for the reviewers; the product itself is Bangla first.
 */
type Status = "built" | "optional" | "planned";
const BADGE: Record<Status, string> = { built: "Built", optional: "Built, off until configured", planned: "Planned" };

const AGENTS: { name: string; job: string; guard: string; status: Status; where: string }[] = [
  { name: "Intake", job: "Bangla, English or Banglish text becomes a draft title, category, description, area hint and urgency.", guard: "Citizen edits before sending. Danger words force urgent and point to 999. Keyword fallback.", status: "built", where: "src/lib/ai/prompts/index.ts (intake v1, v2)" },
  { name: "Office summary", job: "One-sentence summary of a case for staff.", guard: "No added facts. Staff only.", status: "built", where: "src/lib/ai/prompts/index.ts (summary)" },
  { name: "Office Copilot", job: "Summary, missing information and a Bangla reply draft for one case.", guard: "Must cite numbered facts that exist, otherwise a rule-based answer. Staff accept, edit or dismiss.", status: "built", where: "src/lib/ai/copilot.ts" },
  { name: "Routing", job: "Suggests the responsible agency from retrieved sources.", guard: "Only agencies in the retrieved set. Cites source name, URL and date. Below the threshold it says no confident suggestion.", status: "built", where: "src/lib/ai/routing.ts" },
  { name: "Duplicate finder", job: "Finds similar reports in the same office and category.", guard: "Embedding similarity with reasons, lexical fallback. The 0.80 threshold is not yet validated.", status: "optional", where: "src/lib/ai/duplicates.ts" },
  { name: "Insight", job: "Three-sentence note from aggregate statistics.", guard: "Dropped if it contains a number that is not in the data. Groups under 5 are hidden.", status: "built", where: "src/lib/ai/prompts/index.ts (insight)" },
  { name: "Helper Dadu", job: "Answers how-to questions and opens pages by voice.", guard: "Scripted answers first, model only for what is left and only for signed-in people. Answers with phone numbers, emails or links are discarded.", status: "built", where: "src/lib/helper/, src/lib/ai/helper.ts" },
];

const EVAL: [string, string][] = [
  ["Intake category accuracy (claude-sonnet-5-5, intake v1)", "96.6% (114/118) against 61.0% for the keyword fallback"],
  ["By language", "Bangla 95.5% (63/66), English 97.3% (36/37), Banglish 100% (15/15)"],
  ["Routing top-1 (category to sourced agency)", "97.5% (115/118) against 64.4% for the fallback"],
  ["Unsupported-number rate in drafts", "0.0% (0/118)"],
  ["Prompt-injection cases", "2 of 2 kept their true category"],
  ["PII redaction (phones, emails, ID numbers)", "Recall 100% (10/10), 0 false positives on 110 clean cases"],
  ["Draft latency", "p50 8.0 s, p95 16.6 s from one machine, so the form must work with a visible wait"],
  ["Duplicate detection (lexical baseline)", "Precision 36.4%, recall 40.0%. Embedding result not measured yet"],
];

const NOT_MEASURED = [
  "Copilot reply quality, routing top-3 and citation validity: no Bangla reviewer has scored them.",
  "Duplicate detection with embeddings: the embeddings key was not set during the recorded run.",
  "Bangla speech accuracy and cost per draft.",
  "Anything about real citizens. The 118 evaluation cases are synthetic text written by one author, from one run.",
];

const STACK: [string, string][] = [
  ["App", "Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, installable PWA"],
  ["Data", "Supabase Postgres with row-level security on every table, pgvector (1024 dimensions, HNSW), Supabase Storage and Auth"],
  ["Models", "Claude through the Anthropic SDK; BAAI/bge-m3 embeddings through an OpenAI-compatible endpoint; an optional local model through Ollama (AI_PROVIDER=ollama, docs/aibc/local-llm.md)"],
  ["Retrieval", "Sourced agency directory and service rules; a context line on every rule chunk; variable-length chunks that break on topic change when embeddings are set; cosine or lexical search; graph evidence from earlier routings (migration 0091, applied 2026-11-20). docs/aibc/rag-upgrade.md"],
  ["Graph", "Relations are Postgres edges queried with recursive SQL; Apache AGE was evaluated and not adopted"],
  ["MCP", "Two servers we built, both Streamable HTTP with JSON responses. /api/mcp: five tools for staff, the staff member's own token, row-level security, every call audited. /api/mcp/public: five read-only tools for public civic data (categories, agency directory, verified helplines, public reports and their timelines), no sign-in, anonymous role, rate limited per IP."],
  ["Automation", "Vercel Cron, GitHub Actions, an n8n workflow that alerts on urgent cases (workflows/n8n/urgent-cases.json), and a Supabase Realtime refresh of the office queue (migration 0092, applied 2026-11-20)"],
  ["Quality", "Vitest, Testing Library, Playwright, axe-core, Lighthouse, a local-Supabase database suite, a 118-case AI evaluation gate"],
];

const PRIVACY = [
  "Personal details (phones, emails, ID numbers, Bangla and English digits) are removed before any model call, before storage and before embedding. Names and addresses are not detected, and the report form says so.",
  "Public views omit the reporter. Photos have EXIF removed. AI input is stored as a hash only, with 180-day retention for run logs.",
  "Export, correction and deletion endpoints exist (/api/v1/me/*). Consents are versioned and timestamped.",
  "Demo and real data never share an index. Sample data is flagged and shown as নমুনা.",
  "Legal review is pending: docs/aibc/pia.md, privacy-notice.md and terms.md are drafts for counsel.",
];

export default function DocsPage() {
  const link = "inline-flex min-h-11 items-center text-civic underline";
  return (
    <div lang="en" className="space-y-4">
      <h1 className="jk-h1">Jonokotha technical docs</h1>
      <p className="text-muted">
        Jonokotha (জনকথা) lets a citizen describe a local problem in Bangla and follow it to an outcome. AI drafts, people decide.
        This page is for judges and technical reviewers. It says what is built, what is optional and what is only planned, and it
        gives the numbers we measured together with their limits.
      </p>

      <Card title="How it fits together">
        <ol className="list-decimal space-y-1 ps-5">
          <li>A citizen types or speaks a problem. Personal details are removed on the server.</li>
          <li>The Intake agent returns a draft as a forced tool call checked with Zod. The citizen edits it and sends it.</li>
          <li>The case gets a reference ID and a public status timeline. Duplicates and a cited agency suggestion are prepared for staff.</li>
          <li>Office staff see an AI panel (summary, similar cases, suggested agency with its source) and accept, edit or dismiss each suggestion.</li>
          <li>Every model call is logged with model, prompt id and version, tokens, latency and outcome.</li>
        </ol>
      </Card>

      <Card title="AI components">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead><tr className="border-b border-border"><th className="p-2 text-start">Agent</th><th className="p-2 text-start">What it does</th><th className="p-2 text-start">Safeguards</th><th className="p-2 text-start">Status</th><th className="p-2 text-start">Code</th></tr></thead>
            <tbody>
              {AGENTS.map((a) => (
                <tr key={a.name} className="border-b border-border align-top">
                  <th scope="row" className="p-2 text-start font-semibold">{a.name}</th>
                  <td className="p-2">{a.job}</td><td className="p-2">{a.guard}</td><td className="p-2">{BADGE[a.status]}</td><td className="p-2"><code>{a.where}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Measured results (2026-11-16)">
        <dl className="space-y-1">
          {EVAL.map(([k, v]) => <div key={k} className="grid gap-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"><dt className="font-medium">{k}</dt><dd>{v}</dd></div>)}
        </dl>
        <p className="mt-3 text-muted">Dataset: 118 synthetic cases (66 Bangla, 37 English, 15 Banglish), 10 duplicate groups, 8 cases with planted personal data. One run. A difference of a few points is noise. Full write-up: docs/aibc/eval-results.md.</p>
      </Card>

      <Card tone="danger" title="What we have not measured">
        <ul className="list-disc space-y-1 ps-5">{NOT_MEASURED.map((x) => <li key={x}>{x}</li>)}</ul>
      </Card>

      <Card title="Stack">
        <dl className="space-y-1">
          {STACK.map(([k, v]) => <div key={k} className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,4fr)]"><dt className="font-medium">{k}</dt><dd>{v}</dd></div>)}
        </dl>
      </Card>

      <Card title="Privacy and data handling">
        <ul className="list-disc space-y-1 ps-5">{PRIVACY.map((x) => <li key={x}>{x}</li>)}</ul>
      </Card>

      <Card tone="warning" title="Not proven in production yet">
        <ul className="list-disc space-y-1 ps-5">
          <li>Migrations 0091 (graph evidence for routing, an extra AI agent label) and 0092 (Realtime on issues) were applied to the live database on 2026-11-20 and checked in the catalog. Neither has been exercised with a real staff session yet, so graph evidence and the live queue refresh are untested in production.</li>
          <li>The local-model provider and the n8n workflow run only where someone starts Ollama or n8n; the live site uses Claude.</li>
          <li>Embeddings are optional and were not set during the recorded evaluation, so semantic chunking runs in size-only mode until they are.</li>
        </ul>
      </Card>

      <Card title="Graph queries">
        <p>
          Duplicate clusters use recursive SQL over a <code>graph_edges</code> table. A benchmark on a laptop with synthetic data followed one
          chain of depth 8 in about 0.5 ms up to 1.4 million edges. Apache AGE was not available in our local database image, so it was not
          benchmarked. Decision and triggers to revisit: docs/aibc/graph-evaluation.md.
        </p>
      </Card>

      <nav aria-label="More" className="flex flex-wrap gap-x-4">
        <Link href="/about" className={link}>About</Link>
        <Link href="/privacy" className={link}>Privacy</Link>
        <Link href="/accessibility" className={link}>Accessibility</Link>
        <Link href="/api/health" className={link}>Health check</Link>
      </nav>
    </div>
  );
}

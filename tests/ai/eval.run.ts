import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { it } from "vitest";
import { AGENCIES } from "../../src/lib/demo-data";
import { heuristicDraft, draftFromText } from "../../src/lib/intake";
import { redactPii } from "../../src/lib/pii";
import { pickAgency, similarity } from "../../src/lib/store";
import { embed, embeddingModel, embeddingsConfigured, issueEmbeddingText } from "../../src/lib/ai/embeddings";
import { realExamplesToCases } from "../../src/lib/eval-real/dataset";
import { DUPLICATE_MIN_SCORE } from "../../src/lib/ai/duplicates";

type Case = { id: string; lang: "bn" | "en" | "banglish"; text: string; category: string; agency: string; area: string; dup_group?: string; pii?: { kind: string; value: string }[]; note?: string };
const data = JSON.parse(readFileSync("tests/ai/dataset.v0.json", "utf8")) as { version: string; cases: Case[] };
// Optional: consented real examples (npm run eval with EVAL_REAL_EXPORT=path to the file from GET /api/v1/admin/ai/eval-set). The file stays out of git.
const real = process.env.EVAL_REAL_EXPORT ? realExamplesToCases(JSON.parse(readFileSync(process.env.EVAL_REAL_EXPORT, "utf8")).data ?? JSON.parse(readFileSync(process.env.EVAL_REAL_EXPORT, "utf8"))) : [];
const cases = [...data.cases, ...real] as Case[];
const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}% (${n}/${d})` : "n/a");
const LANGS = ["bn", "en", "banglish"] as const;
const digits = (s: string) => s.replace(/[০-৯]/g, (c) => String("০১২৩৪৫৬৭৮৯".indexOf(c))).replace(/\D/g, "");
const quantile = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0; };
const cosine = (a: number[], b: number[]) => { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] ** 2; y += b[i] ** 2; } return d / Math.sqrt(x * y); };

function categoryTable(preds: Map<string, string>) {
  const rows = LANGS.map((l) => { const cs = cases.filter((c) => c.lang === l); return `| ${l} | ${pct(cs.filter((c) => preds.get(c.id) === c.category).length, cs.length)} |`; });
  return `| Language | Category accuracy |\n|---|---|\n${rows.join("\n")}\n| all | ${pct(cases.filter((c) => preds.get(c.id) === c.category).length, cases.length)} |`;
}
function routing(preds: Map<string, string>) {
  const ok = cases.filter((c) => pickAgency(AGENCIES, preds.get(c.id) ?? "other").id === c.agency).length;
  return pct(ok, cases.length);
}
function dupScore(pred: (a: Case, b: Case) => boolean) {
  let tp = 0, fp = 0, fn = 0;
  for (let i = 0; i < cases.length; i++) for (let j = i + 1; j < cases.length; j++) {
    const a = cases[i], b = cases[j];
    const truth = !!a.dup_group && a.dup_group === b.dup_group;
    const p = a.category === b.category && pred(a, b);
    if (p && truth) tp++; else if (p && !truth) fp++; else if (!p && truth) fn++;
  }
  return { tp, fp, fn, precision: pct(tp, tp + fp), recall: pct(tp, tp + fn) };
}

it("evaluation", async () => {
  delete process.env.SUPABASE_SERVICE_ROLE_KEY; // eval never writes ai_runs
  const date = new Date().toISOString().slice(0, 10);
  const out: string[] = [];
  const groups = new Set(cases.filter((c) => c.dup_group).map((c) => c.dup_group)).size;
  out.push(`# AI evaluation baseline (dataset ${data.version})`, "",
    `Run date: ${date}. Dataset: ${cases.length} synthetic cases (${LANGS.map((l) => `${cases.filter((c) => c.lang === l).length} ${l}`).join(", ")}), ${groups} duplicate groups, ${cases.filter((c) => c.pii).length} cases with planted personal data. File: \`tests/ai/dataset.v0.json\`.`, "",
    "Limitations: synthetic text written by the project team, not real citizen reports; one author, so wording is less varied than reality; no reviewer-agreement score yet; small sample, so differences of a few points are noise. Numbers below are measured on this dataset only.", "");

  // 1. Manual / keyword path (what every user gets when the AI is unavailable) ------------------
  const heur = new Map(cases.map((c) => [c.id, heuristicDraft(redactPii(c.text).text).category as string]));
  out.push("## Keyword fallback (no AI)", "", categoryTable(heur), "", `Routing top-1 (category → sourced agency directory): ${routing(heur)}`, "");

  // 2. PII redaction ------------------------------------------------------------------------------
  const planted = cases.flatMap((c) => (c.pii ?? []).map((p) => ({ c, p })));
  const removed = planted.filter(({ c, p }) => !redactPii(c.text).text.includes(p.value) && !digits(redactPii(c.text).text).includes(digits(p.value) || "x")).length;
  const clean = cases.filter((c) => !c.pii);
  const falsePos = clean.filter((c) => redactPii(c.text).found.length > 0).length;
  out.push("## PII redaction (phones, emails, ID numbers)", "", `Recall: ${pct(removed, planted.length)}. False positives on cases with no personal data: ${pct(falsePos, clean.length)}. Names and addresses are not covered by this heuristic (documented limitation).`, "");

  // 3. Duplicates -----------------------------------------------------------------------------------
  const lex = dupScore((a, b) => similarity(a.text, b.text) > 0.35);
  out.push("## Duplicate detection", "", `Pairs are judged only within the same category (the production search is also restricted by office). Ground truth: same \`dup_group\`.`, "",
    `- Lexical baseline (token overlap, threshold 0.35): precision ${lex.precision}, recall ${lex.recall}`);
  if (embeddingsConfigured()) {
    const t0 = Date.now();
    const vecs: number[][] = [];
    const texts = cases.map((c) => issueEmbeddingText({ title: c.text.slice(0, 80), description: c.text, area: c.area }));
    for (let i = 0; i < texts.length; i += 16) vecs.push(...(await embed(texts.slice(i, i + 16), { timeoutMs: 60_000 })));
    const idx = new Map(cases.map((c, i) => [c.id, i]));
    for (const th of [0.7, 0.75, 0.8, 0.85, 0.9]) {
      const r = dupScore((a, b) => cosine(vecs[idx.get(a.id)!], vecs[idx.get(b.id)!]) >= th);
      out.push(`- ${embeddingModel()} embeddings, cosine ≥ ${th}${th === DUPLICATE_MIN_SCORE ? " (current default)" : ""}: precision ${r.precision}, recall ${r.recall}`);
    }
    out.push(`- Embedding time for ${cases.length} cases: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  } else out.push("- Embedding model: not measured (EMBEDDINGS_BASE_URL / EMBEDDINGS_API_KEY not set). The 0.80 threshold is unvalidated until this runs.");
  out.push("");

  // 4. AI drafting (opt-in: sends the synthetic cases to the model provider) ------------------------
  if (process.env.EVAL_AI === "1" && process.env.ANTHROPIC_API_KEY) {
    const preds = new Map<string, string>(), lat: number[] = [], src = new Map<string, string>(), unsupported: string[] = [];
    const queue = [...cases];
    await Promise.all(Array.from({ length: 4 }, async () => {
      for (let c = queue.shift(); c; c = queue.shift()) {
        const t = Date.now();
        const r = await draftFromText(c.text);
        lat.push(Date.now() - t); src.set(c.id, r.source); preds.set(c.id, r.draft.category);
        const given = new Set(digits(redactPii(c.text).text).match(/\d/g) ? [digits(redactPii(c.text).text)] : []);
        const nums = (r.draft.title + " " + r.draft.description).replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))).match(/\d+/g) ?? [];
        const inputDigits = digits(c.text);
        if (r.source === "ai" && nums.some((n) => !inputDigits.includes(n) && ![...given].some((g) => g.includes(n)))) unsupported.push(c.id);
      }
    }));
    const ai = [...src.values()].filter((s) => s === "ai").length;
    out.push(`## AI drafting (model ${process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5"}, prompt intake@v1)`, "",
      `Calls that returned a valid AI draft: ${pct(ai, cases.length)}; the rest used the keyword fallback (timeout, refusal, malformed output or provider error) and are scored with the fallback's category.`, "",
      categoryTable(preds), "", `Routing top-1 (category → sourced agency directory): ${routing(preds)}`, "",
      `Unsupported-number rate (a number in the draft that is not in the citizen's message; a hallucination proxy): ${pct(unsupported.length, ai)}`, "",
      `Latency per draft: p50 ${quantile(lat, 0.5)} ms, p95 ${quantile(lat, 0.95)} ms. Cost: not measured (set AI_PRICE_IN_PER_MTOK / AI_PRICE_OUT_PER_MTOK on the server to log it per run).`, "",
      `Prompt-injection cases (${cases.filter((c) => /injection/.test(c.note ?? "")).length}): ${pct(cases.filter((c) => /injection/.test(c.note ?? "") && preds.get(c.id) === c.category).length, cases.filter((c) => /injection/.test(c.note ?? "")).length)} kept their true category.`, "");
  } else out.push("## AI drafting", "", "Not run (set `EVAL_AI=1` and `ANTHROPIC_API_KEY`; this sends the synthetic cases to the model provider).", "");

  out.push("## Not yet measurable", "", "- Routing top-3 and citation validity: the Routing Agent (RAG with citations) is Phase 2; today routing is a category lookup in the sourced directory.", "- Hallucination rate beyond the number check, and reply-draft quality: Office Copilot is Phase 2.", "- Bangla-vs-English parity is the per-language table above; the Banglish group is small (15 cases).", "");
  const md = out.join("\n");
  console.log("\n" + md);
  mkdirSync("tests/ai/out", { recursive: true });
  writeFileSync("tests/ai/out/latest.md", md);
  if (process.env.EVAL_WRITE === "1") writeFileSync("docs/aibc/eval-baseline.md", md);
}, 30 * 60_000);

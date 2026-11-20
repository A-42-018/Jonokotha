// Simulated /api/v1 for demo mode (see demo-mode.ts). Loaded only on demand by the API client while the demo cookie is set.
// Every answer is built in code from src/lib/demo/*; writes change an in-memory copy that disappears when the page is reloaded.
import { ApiError, type Page } from "@/lib/api-client";
import { DEMO_CASES, findCase } from "./demo/cases";
import { commitFull, commitRow, DEMO_ANNOUNCEMENTS, DEMO_COMMENTS, DEMO_COMMITMENTS, DEMO_IDEAS, DEMO_IDEA_POINTS, DEMO_POLLS, DEMO_PROJECTS, findCommit, findIdea, findPoll, findProject, ideaRow, pollDetail, pollRow, projectDetail, projectRow } from "./demo/civic";
import { consultFull, consultReport, consultRow, DEMO_CONSULTS, DEMO_PBS, DEMO_ROUNDS, findConsult, findPb, findRound, pbCycle, pbFull, roundFull, roundResults, roundRow } from "./demo/consult";
import { DEMO_NOTICES, DEMO_QUESTIONS, demoAreas, demoLookup, demoRepDetail, demoResponsiveness, findQuestion, publicQuestion, questionThread, DEMO_REP_ID } from "./demo/people";
import { ago, AREA_KEY, bi, tx, type Lang } from "./demo/util";

export interface SimInit { method: string; body?: unknown; form?: boolean }
export interface SimResult { data: unknown; page?: Page }

const LATENCY = 220;
const wait = (ms = LATENCY) => new Promise((r) => setTimeout(r, ms));
const lang = (): Lang => (typeof document !== "undefined" && document.documentElement.lang === "en" ? "en" : "bn");
const page = (limit = 50): Page => ({ next_cursor: null, limit });
const notFound = () => new ApiError("not_found", 404);
const bodyOf = (b: unknown) => (b && typeof b === "object" ? (b as Record<string, unknown>) : {});

// In-memory state of this page view. A reload starts again from the examples.
const S = {
  affected: new Set<string>(), support: new Set<string>(), polls: new Map<string, string>(), votes: new Map<string, string>(), ballots: new Map<string, string[]>(), ranks: new Map<string, string[]>(),
  follows: [{ id: "fl-1", type: "area", target: AREA_KEY, label: "Sample Constituency", created_at: ago(5) }] as { id: string; type: string; target: string; label?: string; created_at: string }[],
  comments: new Map<string, { id: string; body: string; status: string; created_at: string; mine: boolean }[]>(),
  asked: [] as { ref: string; title: string; body: string; at: string; replies: { author_kind: "citizen" | "office"; body: string; created_at: string }[] }[],
  reported: [] as { ref: string; title: string }[], points: [] as { id: string; side: string; body: string; created_at: string; helpful_count: number }[], read: new Set<string>(), n: 0,
};
const nextRef = (prefix: string) => `${prefix}${9001 + S.n++}`;

type Handler = (m: RegExpMatchArray, q: URLSearchParams, init: SimInit, l: Lang) => SimResult | Promise<SimResult>;
const routes: { method: string; re: RegExp; run: Handler }[] = [];
const on = (method: string, path: string, run: Handler) => routes.push({ method, re: new RegExp(`^${path.replace(/\{(\w+)\}/g, "([^/]+)")}$`), run });
const ok = (data: unknown, p?: Page): SimResult => ({ data, ...(p ? { page: p } : {}) });

// Issues --------------------------------------------------------------------------------------------------------------------------------
const toLegacy = (c: (typeof DEMO_CASES)[number]) => c.steps[c.steps.length - 1].status;
const issueRow = (c: (typeof DEMO_CASES)[number], l: Lang) => ({ ref: c.ref, title: tx(c.title, l), category: c.category, area: tx(c.area, l), legacy_status: toLegacy(c), status: c.detail, created_at: ago(c.days), is_sample: true, affected_count: c.affected + (S.affected.has(c.ref) ? 1 : 0), location: { lat: c.lat, lng: c.lng, approximate: true } });
on("GET", "/issues", (_m, q, _i, l) => { const cat = q.get("category"); return ok(DEMO_CASES.filter((c) => !cat || c.category === cat).map((c) => issueRow(c, l)), page()); });
on("GET", "/issues/{ref}", (m, _q, _i, l) => { const c = findCase(m[1]); if (!c) throw notFound(); return ok(issueRow(c, l)); });
on("POST", "/issues", (_m, _q, i) => { const b = bodyOf(i.body); const ref = nextRef("JKD-2026-"); S.reported.push({ ref, title: String(b.title ?? "") }); return ok({ ref, status: "submitted", pii_removed: [] }); });
for (const method of ["POST", "DELETE"]) on(method, "/issues/{ref}/affected", (m, _q, i) => { const c = findCase(m[1]); const base = c?.affected ?? 1; if (i.method === "POST") S.affected.add(m[1]); else S.affected.delete(m[1]); return ok({ affected_count: base + (S.affected.has(m[1]) ? 1 : 0) }); });
on("GET", "/issues/{ref}/media", (m, _q, _i, l) => ok((findCase(m[1])?.photos ?? []).map((p, i) => ({ id: `${m[1]}-p${i + 1}`, url: p.file, caption: tx(p.caption, l), width: 640, height: 400 }))));
on("POST", "/issues/{ref}/media", () => ok({ id: `demo-photo-${S.n++}` }));

// Ideas ---------------------------------------------------------------------------------------------------------------------------------
const ideaSupport = (ref: string, base: number) => base + (S.support.has(ref) ? 1 : 0);
on("GET", "/ideas", (_m, q, _i, l) => { const cat = q.get("category"); return ok(DEMO_IDEAS.filter((i) => !cat || i.category === cat).map((i) => ideaRow(i, l, ideaSupport(i.ref, i.support))), page()); });
on("GET", "/ideas/new/similar", (_m, q) => { const words = (q.get("text") ?? "").toLowerCase().split(/[\s,।.]+/).filter((w) => w.length > 3); const hit = DEMO_IDEAS.map((i) => ({ i, s: words.filter((w) => `${i.title.bn} ${i.title.en}`.toLowerCase().includes(w)).length })).filter((x) => x.s > 0).slice(0, 3); return ok(hit.map(({ i, s }) => ({ ref: i.ref, title: tx(i.title, lang()), support_count: ideaSupport(i.ref, i.support), score: Math.min(0.95, 0.4 + s * 0.2) }))); });
on("GET", "/ideas/{ref}", (m, _q, _i, l) => { const i = findIdea(m[1]); if (!i) throw notFound(); return ok(ideaRow(i, l, ideaSupport(i.ref, i.support))); });
on("POST", "/ideas", () => ok({ ref: nextRef("JKD-ID-"), status: "pending_review", pii_removed: [] }));
for (const method of ["POST", "DELETE"]) on(method, "/ideas/{ref}/support", (m, _q, i) => { if (i.method === "POST") S.support.add(m[1]); else S.support.delete(m[1]); return ok({ support_count: ideaSupport(m[1], findIdea(m[1])?.support ?? 0) }); });
on("GET", "/ideas/{ref}/comments", (m, _q, _i, l) => ok([...DEMO_COMMENTS(l), ...(S.comments.get(m[1]) ?? [])], page(20)));
on("POST", "/ideas/{ref}/comments", (m, _q, i) => { const c = { id: `cm-${S.n++}`, body: String(bodyOf(i.body).body ?? ""), status: "pending_review", created_at: ago(0), mine: true }; S.comments.set(m[1], [...(S.comments.get(m[1]) ?? []), c]); return ok(c); });
on("GET", "/ideas/{ref}/arguments", (_m, _q, _i, l) => { const p = DEMO_IDEA_POINTS(l); return ok({ for: [...p.for, ...S.points.filter((x) => x.side === "for")], against: [...p.against, ...S.points.filter((x) => x.side === "against")] }); });
on("POST", "/ideas/{ref}/arguments", (_m, _q, i) => { const b = bodyOf(i.body); const p = { id: `pt-${S.n++}`, side: String(b.side), body: String(b.body), created_at: ago(0), helpful_count: 0 }; S.points.push(p); return ok(p); });

// Polls ---------------------------------------------------------------------------------------------------------------------------------
on("GET", "/polls", (_m, q, _i, l) => ok(DEMO_POLLS.filter((p) => !q.get("status") || p.status === q.get("status")).map((p) => pollRow(p, l)), page(20)));
on("GET", "/polls/{ref}", (m, _q, _i, l) => { const p = findPoll(m[1]); if (!p) throw notFound(); return ok(pollDetail(p, l, S.polls.get(m[1]) ?? null)); });
on("POST", "/polls/{ref}/vote", (m, _q, i) => { const p = findPoll(m[1]); if (!p) throw notFound(); if (p.status === "closed") throw new ApiError("conflict", 410, { _: "poll_closed" }); if (S.polls.has(m[1])) throw new ApiError("conflict", 409, { _: "already_voted" }); S.polls.set(m[1], String(bodyOf(i.body).option_id)); return ok({ voted: true }); });

// Projects and commitments --------------------------------------------------------------------------------------------------------------
on("GET", "/projects", (_m, _q, _i, l) => ok(DEMO_PROJECTS.map((p) => projectRow(p, l)), page()));
on("GET", "/projects/{ref}", (m, _q, _i, l) => { const p = findProject(m[1]); if (!p) throw notFound(); return ok(projectDetail(p, l)); });
on("GET", "/projects/{ref}/feedback", () => ok({ feedback_count: 23, average_rating: 4.1 }));
on("POST", "/projects/{ref}/feedback", () => ok({ submitted: true }));
on("GET", "/commitments", (_m, q, _i, l) => ok(DEMO_COMMITMENTS.filter((c) => !q.get("status") || c.status === q.get("status")).map((c) => commitRow(c, l)), page()));
on("GET", "/commitments/{ref}", (m, _q, _i, l) => { const c = findCommit(m[1]); if (!c) throw notFound(); return ok(commitFull(c, l)); });
on("GET", "/announcements", (_m, _q, _i, l) => ok(DEMO_ANNOUNCEMENTS(l), page(20)));

// Consultations, priorities, budgeting --------------------------------------------------------------------------------------------------
on("GET", "/consultations", (_m, q, _i, l) => ok(DEMO_CONSULTS.filter((c) => !q.get("status") || c.status === q.get("status")).map((c) => consultRow(c, l)), page()));
on("GET", "/consultations/{ref}", (m, _q, _i, l) => { const c = findConsult(m[1]); if (!c) throw notFound(); return ok(consultFull(c, l, Object.fromEntries(S.votes))); });
on("GET", "/consultations/{ref}/report", (m, _q, _i, l) => { const c = findConsult(m[1]); if (!c || c.status !== "reported") throw notFound(); return ok(consultReport(c, l)); });
on("PUT", "/consultations/{ref}/statements/{id}/vote", (m, _q, i) => { S.votes.set(m[2], String(bodyOf(i.body).vote)); return ok({ voted: true }); });
on("POST", "/consultations/{ref}/statements", () => ok({ id: `st-${S.n++}`, status: "pending_review" }));
on("GET", "/priorities", (_m, _q, _i, l) => ok(DEMO_ROUNDS.map((r) => roundRow(r, l)), page(20)));
on("GET", "/priorities/{ref}", (m, _q, _i, l) => { const r = findRound(m[1]); if (!r) throw notFound(); return ok(roundFull(r, l)); });
on("GET", "/priorities/{ref}/results", (m, _q, _i, l) => { const r = findRound(m[1]); if (!r) throw notFound(); return ok(roundResults(r, l, S.ranks.get(m[1]))); });
on("PUT", "/priorities/{ref}/ranking", (m, _q, i) => { S.ranks.set(m[1], (bodyOf(i.body).items as string[]) ?? []); return ok({ saved: true }); });
on("GET", "/participatory-budgets", (_m, _q, _i, l) => ok(DEMO_PBS.map((p) => pbCycle(p, l)), page()));
on("GET", "/participatory-budgets/{ref}", (m, _q, _i, l) => { const p = findPb(m[1]); if (!p) throw notFound(); return ok(pbFull(p, l, S.ballots.get(m[1]) ?? null)); });
on("PUT", "/participatory-budgets/{ref}/ballot", (m, _q, i) => { S.ballots.set(m[1], (bodyOf(i.body).option_ids as string[]) ?? []); return ok({ saved: true }); });

// Ask the MP, representative, areas -----------------------------------------------------------------------------------------------------
on("GET", "/questions", (_m, _q, _i, l) => ok(DEMO_QUESTIONS.map((q) => publicQuestion(q, l)), page(10)));
on("POST", "/questions", (_m, _q, i) => { const b = bodyOf(i.body); const ref = nextRef("JKD-QN-"); S.asked.push({ ref, title: String(b.title ?? ""), body: String(b.body ?? ""), at: ago(0), replies: [] }); return ok({ ref, pii_removed: [] }); });
on("GET", "/me/questions", (_m, _q, _i, l) => {
  const answered = { ...questionThread(findQuestion("JKD-QN-1002")!, l), messages: undefined };
  return ok([...S.asked.map((a) => ({ ref: a.ref, constituency_key: AREA_KEY, visibility: "private", title: a.title, body: a.body, status: "open", created_at: a.at, last_message_at: a.at })), answered], page(50));
});
on("GET", "/questions/{ref}", (m, _q, _i, l) => {
  const q = findQuestion(m[1]); if (q) return ok(questionThread(q, l));
  const a = S.asked.find((x) => x.ref === m[1]); if (!a) throw notFound();
  return ok({ ref: a.ref, constituency_key: AREA_KEY, visibility: "private", title: a.title, body: a.body, status: "open", created_at: a.at, last_message_at: a.at, messages: [{ author_kind: "citizen", body: a.body, created_at: a.at }, ...a.replies] });
});
on("POST", "/questions/{ref}/messages", (m, _q, i) => { S.asked.find((x) => x.ref === m[1])?.replies.push({ author_kind: "citizen", body: String(bodyOf(i.body).body ?? ""), created_at: ago(0) }); return ok({ pii_removed: [] }); });
on("GET", "/representatives/lookup", (_m, _q, _i, l) => ok(demoLookup(l)));
on("GET", `/representatives/${DEMO_REP_ID}`, (_m, _q, _i, l) => ok(demoRepDetail(l)));
on("GET", "/constituencies/{key}/responsiveness", () => ok(demoResponsiveness()));
on("GET", "/areas", (_m, q, _i, l) => ok(demoAreas(q.get("parent") ?? undefined, l)));
on("GET", "/areas/{id}/constituencies", (_m, _q, _i, l) => ok(demoLookup(l)));

// Me: follows, notifications, feed ------------------------------------------------------------------------------------------------------
on("GET", "/me/follows", () => ok(S.follows));
on("POST", "/me/follows", (_m, _q, i) => { const b = bodyOf(i.body); const f = { id: `fl-${S.n++}`, type: String(b.type), target: String(b.target), created_at: ago(0) }; S.follows.push(f); return ok(f); });
on("DELETE", "/me/follows/{id}", (m) => { S.follows = S.follows.filter((f) => f.id !== m[1]); return ok({ id: m[1] }); });
on("GET", "/me/feed", (_m, _q, _i, l) => ok(DEMO_CASES.slice(0, 8).map((c, i) => ({ ref: c.ref, title: tx(c.title, l), category: c.category, area: tx(c.area, l), status: c.detail, created_at: ago(c.days), is_sample: true, why: ([null, "area", "category", "issue"] as const)[i % 4] })), page(10)));
on("GET", "/me/notifications", () => ok(DEMO_NOTICES.map((n) => ({ ...n, read_at: S.read.has(n.id) ? ago(0) : n.read_at })), page(20)));
on("POST", "/me/notifications/read-all", () => { DEMO_NOTICES.forEach((n) => S.read.add(n.id)); return ok({ updated: DEMO_NOTICES.length }); });
on("POST", "/me/notifications/{id}/read", (m) => { S.read.add(m[1]); return ok({ id: m[1] }); });

// Helpers: AI assistants, feature flags -------------------------------------------------------------------------------------------------
on("POST", "/ai/translate", (_m, _q, i, l) => { const to = String(bodyOf(i.body).to ?? (l === "bn" ? "en" : "bn")); return ok({ available: true, translation: `${tx(bi("[নমুনা অনুবাদ] ", "[Sample translation] "), to as Lang)}${String(bodyOf(i.body).text ?? "")}`, target: to, machine_translated: true }); });
on("POST", "/ai/ideas/clarity", (_m, _q, _i, l) => ok({ available: true, suggestions: [{ text: tx(bi("সমস্যাটি কোথায় ঘটে তা এক লাইনে লিখুন।", "Say in one line where the problem happens."), l) }, { text: tx(bi("প্রস্তাবিত সমাধানের আনুমানিক খরচ বা সময় যোগ করুন।", "Add a rough cost or time for the proposed fix."), l) }] }));
on("GET", "/features", () => ok(["consultations", "idea_arguments", "commitments", "priorities", "surveys", "participatory_budgets"].map((key) => ({ key, enabled: true, data_status: "demo" }))));

/** Answers an /api/v1 call from code. `undefined` means "not simulated": reads then go to the real server; writes never do. */
export async function simulate(path: string, init: SimInit): Promise<SimResult | undefined> {
  const [raw, query = ""] = path.split("?");
  const route = routes.find((r) => r.method === init.method && r.re.test(raw));
  await wait();
  if (route) return route.run(raw.match(route.re)!, new URLSearchParams(query), init, lang());
  // An unlisted write is acknowledged but changes nothing, so trying the demo can never touch the real database.
  if (init.method !== "GET") return ok({ simulated: true });
  return undefined;
}

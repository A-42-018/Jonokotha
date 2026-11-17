import { z } from "zod";
import { fromDbError, parse, rpc, type Ctx, type Result } from "./api";
import { INSIGHT_V1 } from "./ai/prompts";
import { runAgent } from "./ai/run";
import { redactPii } from "./pii";

const KEY = z.string().max(60).regex(/^[a-z0-9-]+$/, "invalid");
const Days = z.coerce.number().int().min(1, "1 to 365").max(365, "1 to 365").default(30);

export async function overview(c: Ctx): Promise<Result> {
  const q = parse(z.object({ constituency: KEY, days: Days }), Object.fromEntries(c.url.searchParams));
  return { data: await rpc(c.sb, "analytics_overview", { p_constituency: q.constituency, p_days: q.days }) };
}

const BN = "০১২৩৪৫৬৭৮৯";
const numbersIn = (s: string) => new Set((s.replace(/[০-৯]/g, (d) => String(BN.indexOf(d))).match(/\d+(?:\.\d+)?/g) ?? []).map(Number));

/** Number check (no unmeasured figures): every number in the narrative must occur in the statistics it was written from. */
export function narrativeIsGrounded(narrative: string, payload: unknown): boolean {
  const allowed = numbersIn(JSON.stringify(payload));
  return [...numbersIn(narrative)].every((n) => allowed.has(n));
}

async function insightNarrative(c: Ctx, payload: Record<string, unknown>): Promise<string | null> {
  const compact = { ...payload, hotspots: undefined };   // coordinates add nothing to a three-sentence note
  const out = await runAgent({ agent: "insight", prompt: INSIGHT_V1, schema: z.object({ narrative: z.string().trim().min(10).max(800) }), input: JSON.stringify(compact).slice(0, 6000), maxTokens: 400, actorId: c.user!.id, requestId: c.rid,
    tool: { name: "submit_narrative", description: "Return the short note." } });
  return out.ok && narrativeIsGrounded(out.data.narrative, payload) ? out.data.narrative : null;
}

const NewReport = z.strictObject({ constituency: KEY, days: z.number().int().min(1).max(365).default(30), narrative: z.string().trim().max(1500).optional(), generate_narrative: z.boolean().default(false) });
export async function createReport(c: Ctx): Promise<Result> {
  const b = parse(NewReport, c.body);
  let narrative = b.narrative ? redactPii(b.narrative).text : null;
  if (!narrative && b.generate_narrative) narrative = await insightNarrative(c, await rpc<Record<string, unknown>>(c.sb, "analytics_overview", { p_constituency: b.constituency, p_days: b.days }));
  const out = await rpc<{ id: string; status: string }>(c.sb, "create_analytics_report", { p_constituency: b.constituency, p_days: b.days, p_narrative: narrative });
  return { status: 201, data: { ...out, narrative_source: b.narrative ? "staff" : narrative ? "ai_draft" : "none" } };
}

export async function listOfficeReports(c: Ctx): Promise<Result> {
  const { data, error } = await c.sb.from("analytics_reports").select("id,period_days,status,narrative,created_at,approved_at,constituencies(key)").order("created_at", { ascending: false }).limit(50);
  if (error) throw fromDbError(error);
  return { data: (data ?? []).map(({ constituencies, ...r }) => ({ ...r, constituency: (constituencies as unknown as { key: string } | null)?.key })) };
}

export async function setReportStatus(c: Ctx, status: "approved" | "withdrawn"): Promise<Result> {
  if (!/^[0-9a-f-]{36}$/i.test(c.params.id)) return { status: 404, data: null };
  return { data: await rpc(c.sb, "set_analytics_report_status", { p_id: c.params.id, p_status: status }) };
}

export async function listPublicReports(c: Ctx): Promise<Result> {
  const q = parse(z.object({ constituency: KEY.optional() }), Object.fromEntries(c.url.searchParams));
  let sel = c.sb.from("public_analytics_reports").select("id,constituency_key,period_days,payload,narrative,approved_at,is_demo").order("approved_at", { ascending: false }).limit(20);
  if (q.constituency) sel = sel.eq("constituency_key", q.constituency);
  const { data, error } = await sel;
  if (error) throw fromDbError(error);
  return { data: (data ?? []).map(({ is_demo, ...r }) => ({ ...r, is_sample: is_demo })) };
}

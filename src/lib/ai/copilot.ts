import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ApiError, type Ctx } from "../api";
import { can } from "../auth";
import { redactPii } from "../pii";
import { serviceClient } from "../supabase/service";
import { COPILOT_V1 } from "./prompts";
import { runAgent } from "./run";

const Out = z.object({
  summary: z.string().trim().min(1).max(400),
  missing_information: z.array(z.string().trim().min(2).max(160)).max(6),
  reply_draft: z.string().trim().min(10).max(900),
  confidence: z.number().min(0).max(1),
  cited_facts: z.array(z.string().regex(/^[FE]\d{1,2}$/)).min(1).max(14),
});

export interface Fact { id: string; label: string; text: string }
export interface CopilotSuggestion { id: string | null; type: "summary" | "missing_information" | "reply_draft"; payload: Record<string, unknown>; citations: { fact: string; label: string }[]; confidence: number | null }

/** Fallback when the model is unavailable: deterministic, rule-based, and labelled as such. */
export function fallbackCopilot(i: { ref: string; title: string; description: string; area: string | null; category: string; ai_summary: string | null }, hasLocation: boolean, photos: number) {
  const missing: { bn: string; en: string; fact: string }[] = [];
  if (!hasLocation && (i.area ?? "").trim().length < 3) missing.push({ bn: "ঠিক কোথায় সমস্যাটি (এলাকা বা রাস্তার নাম)", en: "Exactly where the problem is (area or road name)", fact: "F3" });
  if (photos === 0) missing.push({ bn: "সমস্যার একটি ছবি", en: "A photo of the problem", fact: "F7" });
  if (i.description.trim().length < 40) missing.push({ bn: "সমস্যাটি কতদিন ধরে আছে ও কতটা গুরুতর", en: "How long it has lasted and how serious it is", fact: "F2" });
  if (i.category === "other") missing.push({ bn: "সমস্যাটি কোন ধরনের", en: "What kind of problem this is", fact: "F4" });
  const summary = i.ai_summary || `${i.title}: ${i.description.slice(0, 160)}`;
  const ask = missing.length ? ` নিচের তথ্যগুলো জানালে আমাদের দেখতে সুবিধা হবে: ${missing.map((m) => m.bn).join("; ")}।` : "";
  const reply = `আপনার সমস্যাটি (নম্বর ${i.ref}) আমরা পেয়েছি এবং অফিস বিষয়টি দেখছে।${ask} এটি কোনো সময় বা ফলাফলের প্রতিশ্রুতি নয়।`;
  return { summary, missing, reply };
}

/**
 * Office Copilot (masterplan §17.3): summary, missing-information checklist and a Bangla reply draft for ONE issue, all stored as
 * pending `ai_suggestions` with citations (the facts used) and confidence. Nothing is sent or applied: staff edit and approve
 * through /ai/suggestions/{id}/decision, and a public reply is always posted by staff through the issue "update" action.
 */
export async function runCopilot(c: Ctx, ref: string): Promise<{ source: "ai" | "fallback"; suggestions: CopilotSuggestion[] }> {
  const sb: SupabaseClient = c.sb;
  const { data: i } = await sb.from("issues").select("id,ref,title,description,area,category,status,constituency_id,assigned_to,ai_summary,lat,created_at").eq("ref", ref).maybeSingle();
  if (!i) throw new ApiError("not_found", "Issue not found.");
  if (!can(c.actor, "update", { constituencyId: i.constituency_id, assignedTo: i.assigned_to })) throw new ApiError("forbidden", "You are not allowed to use the copilot on this issue.");
  const svc = serviceClient();
  if (!svc) throw new ApiError("unavailable", "AI suggestions are not configured on this server.");
  const [{ count: photos }, { data: events }] = await Promise.all([
    sb.from("issue_media").select("id", { count: "exact", head: true }).eq("issue_id", i.id),
    sb.from("issue_events").select("event_type,to_status,public_message,created_at").eq("issue_id", i.id).order("created_at").limit(12),
  ]);
  const R = (s: string | null | undefined) => redactPii(s ?? "").text;
  const facts: Fact[] = [
    { id: "F1", label: "title", text: R(i.title) }, { id: "F2", label: "description", text: R(i.description) }, { id: "F3", label: "area", text: R(i.area) || "(none)" },
    { id: "F4", label: "category", text: i.category }, { id: "F5", label: "status", text: i.status }, { id: "F6", label: "exact location given", text: i.lat != null ? "yes" : "no" }, { id: "F7", label: "photos", text: String(photos ?? 0) },
    ...(events ?? []).map((e, n) => ({ id: `E${n + 1}`, label: `event ${e.event_type}`, text: `${e.to_status ?? ""} ${R(e.public_message)}`.trim() })),
  ];
  const input = facts.map((f) => `${f.id} (${f.label}): ${f.text}`).join("\n");
  const out = await runAgent({ agent: "copilot", prompt: COPILOT_V1, schema: Out, input, maxTokens: 900, timeoutMs: 25_000, issueId: i.id, actorId: c.user!.id, requestId: c.rid,
    tool: { name: "submit_copilot", description: "Return the summary, missing information, reply draft, confidence and the cited fact ids." } });

  const known = new Map(facts.map((f) => [f.id, f]));
  const cited = out.ok ? [...new Set(out.data.cited_facts)].filter((id) => known.has(id)) : [];
  let rows: { type: CopilotSuggestion["type"]; payload: Record<string, unknown>; confidence: number | null; cites: string[] }[];
  let source: "ai" | "fallback" = "ai", runId = out.ok ? out.runId : null;
  if (out.ok && cited.length) {
    rows = [
      { type: "summary", payload: { text: out.data.summary }, confidence: out.data.confidence, cites: cited },
      { type: "missing_information", payload: { items: out.data.missing_information.map((t) => ({ bn: t })) }, confidence: out.data.confidence, cites: cited },
      { type: "reply_draft", payload: { text: out.data.reply_draft, language: "bn", needs_staff_approval: true }, confidence: out.data.confidence, cites: cited },
    ];
  } else {
    // No model, or an answer that cites nothing it was given: the rule-based fallback, never an uncited AI claim.
    source = "fallback"; runId = null;
    const f = fallbackCopilot({ ...i, area: i.area }, i.lat != null, photos ?? 0);
    rows = [
      { type: "summary", payload: { text: f.summary }, confidence: null, cites: ["F1", "F2"] },
      { type: "missing_information", payload: { items: f.missing.map(({ bn, en }) => ({ bn, en })) }, confidence: null, cites: f.missing.map((m) => m.fact) },
      { type: "reply_draft", payload: { text: f.reply, language: "bn", needs_staff_approval: true }, confidence: null, cites: ["F1"] },
    ];
  }
  const suggestions: CopilotSuggestion[] = [];
  for (const r of rows) {
    const citations = r.cites.filter((id) => known.has(id)).map((id) => ({ fact: id, label: known.get(id)!.label }));
    const { data: ins, error } = await svc.from("ai_suggestions").insert({
      ai_run_id: runId, target_type: "issue", target_id: i.id, suggestion_type: `copilot_${r.type}`, payload: { ...r.payload, source }, citations, confidence: r.confidence,
    }).select("id").single();
    if (error) throw new ApiError("internal_error", "The suggestion could not be saved.");
    suggestions.push({ id: ins.id, type: r.type, payload: { ...r.payload, source }, citations, confidence: r.confidence });
  }
  return { source, suggestions };
}

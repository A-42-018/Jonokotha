import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { embed, embeddingsConfigured, EmbeddingError, toVector } from "./embeddings";

export const KnowledgeRule = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]{3,60}$/), title_bn: z.string().min(3).max(200), title_en: z.string().min(3).max(200),
  text_bn: z.string().min(10).max(1500), text_en: z.string().min(10).max(1500),
  source_name: z.string().min(3).max(200), source_url: z.url({ protocol: /^https?$/ }), checked_at: z.iso.date(),
  agency_key: z.string().max(60).optional(), is_demo: z.boolean().default(false),
});
export type KnowledgeRule = z.infer<typeof KnowledgeRule>;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

interface Chunk { locale: "bn" | "en"; content: string; agency_id: string | null; metadata: Record<string, unknown> }

/** Replaces one source's chunks with `chunks`; unchanged chunks (same checksum) are kept, so re-ingesting is cheap and repeatable. */
async function syncSource(svc: SupabaseClient, src: { name: string; url: string | null; fetched_at: string | null; is_demo: boolean; collection_method: string }, chunks: Chunk[], embedOn: boolean) {
  const { data: existing } = await svc.from("knowledge_sources").select("id").eq("name", src.name).maybeSingle();
  const checksum = sha(chunks.map((c) => c.content).join("\n"));
  let id = existing?.id as string | undefined;
  if (id) await svc.from("knowledge_sources").update({ url: src.url, fetched_at: src.fetched_at, is_demo: src.is_demo, checksum, status: "active" }).eq("id", id).throwOnError();
  else id = (await svc.from("knowledge_sources").insert({ ...src, checksum }).select("id").single().throwOnError()).data!.id as string;
  const rows = chunks.map((c) => ({ source_id: id!, locale: c.locale, content: c.content, agency_id: c.agency_id, metadata: c.metadata, checksum: sha(`${c.locale}\n${c.content}`) }));
  const { data: have } = await svc.from("knowledge_chunks").select("id,checksum").eq("source_id", id);
  const keep = new Set(rows.map((r) => r.checksum)), haveSet = new Set((have ?? []).map((h) => h.checksum));
  const stale = (have ?? []).filter((h) => !keep.has(h.checksum)).map((h) => h.id);
  if (stale.length) await svc.from("knowledge_chunks").delete().in("id", stale);
  const fresh = rows.filter((r) => !haveSet.has(r.checksum));
  let embedded = 0;
  for (const r of fresh) {
    let embedding: string | null = null;
    if (embedOn) { try { embedding = toVector((await embed([r.content]))[0]); embedded++; } catch (e) { if (!(e instanceof EmbeddingError)) throw e; } }
    await svc.from("knowledge_chunks").insert({ ...r, ...(embedding ? { embedding } : {}) }).throwOnError();
  }
  return { added: fresh.length, removed: stale.length, embedded };
}

/**
 * Builds the retrieval index (masterplan §17.4) from the sourced agency directory plus any admin-supplied service rules.
 * Every chunk keeps its locale, source, fetch date (the date the source was checked) and a checksum. Agencies without a
 * verification date and rules flagged is_demo go to DEMO sources; retrieval never mixes demo and real sources.
 */
export async function ingestKnowledge(svc: SupabaseClient, rules: KnowledgeRule[] = []) {
  const { data: cats } = await svc.from("issue_categories").select("slug,name_bn,name_en");
  const bn = new Map((cats ?? []).map((c) => [c.slug, c.name_bn])), en = new Map((cats ?? []).map((c) => [c.slug, c.name_en]));
  const { data: agencies } = await svc.from("agencies").select("id,key,name_bn,name_en,categories,source,url,checked_at,contact_channel,verified_at");
  const embedOn = embeddingsConfigured();
  const out = { sources: 0, added: 0, removed: 0, embedded: 0 };
  const add = (r: { added: number; removed: number; embedded: number }) => { out.sources++; out.added += r.added; out.removed += r.removed; out.embedded += r.embedded; };
  for (const a of agencies ?? []) {
    const cs = a.categories as string[], meta = { kind: "agency", agency_key: a.key, categories: cs };
    const contact = a.contact_channel || a.url || "";
    add(await syncSource(svc, { name: `agency:${a.key}`, url: a.url, fetched_at: a.checked_at ? `${a.checked_at}T00:00:00Z` : null, is_demo: !a.verified_at, collection_method: "manual" }, [
      { locale: "bn", agency_id: a.id, metadata: meta, content: `${a.name_bn} (${a.name_en}) এই ধরনের সমস্যা দেখে: ${cs.map((c) => bn.get(c) ?? c).join(", ")}। যোগাযোগ: ${contact}। উৎস: ${a.source}` },
      { locale: "en", agency_id: a.id, metadata: meta, content: `${a.name_en} handles: ${cs.map((c) => en.get(c) ?? c).join(", ")}. Contact: ${contact}. Source: ${a.source}` },
    ], embedOn));
  }
  for (const r of rules) {
    const { data: ag } = r.agency_key ? await svc.from("agencies").select("id,categories").eq("key", r.agency_key).maybeSingle() : { data: null };
    const meta = { kind: "rule", rule_id: r.id, agency_key: r.agency_key ?? null, categories: ag?.categories ?? [] };
    add(await syncSource(svc, { name: `rule:${r.id}`, url: r.source_url, fetched_at: `${r.checked_at}T00:00:00Z`, is_demo: r.is_demo, collection_method: "manual" }, [
      { locale: "bn", agency_id: ag?.id ?? null, metadata: meta, content: `${r.title_bn}: ${r.text_bn}` }, { locale: "en", agency_id: ag?.id ?? null, metadata: meta, content: `${r.title_en}: ${r.text_en}` },
    ], embedOn));
  }
  return out;
}

import type { SupabaseClient } from "@supabase/supabase-js";

/** Data for the home page blocks (masterplan 7.3), read on the server so the home page ships no extra JavaScript. Each block fails alone. */
export type Loaded<T> = { ok: true; data: T } | { ok: false };

/** Groups smaller than this are not shown as a number (same rule as the public metrics page). */
export const MIN_GROUP = 5;

const IN_PROGRESS = ["under_review", "needs_information", "acknowledged", "assigned", "referred_to_authority", "in_progress", "reopened"];
const RESOLVED = ["resolved", "closed"];

export interface Snapshot { reported: number; inProgress: number; resolved: number; from: string; to: string; days: number }

/** Public counts for one area in the last `days` days, from the same public view the area map reads. Temporary until the B5.5 snapshot endpoint. */
export async function loadSnapshot(sb: SupabaseClient, key: string, days = 30, now = new Date()): Promise<Loaded<Snapshot>> {
  try {
    const from = new Date(now.getTime() - days * 86_400_000).toISOString();
    const base = () => sb.from("public_cases").select("ref", { count: "exact", head: true }).eq("constituency_key", key).gte("created_at", from);
    const [all, prog, done] = await Promise.all([base(), base().in("status_detail", IN_PROGRESS), base().in("status_detail", RESOLVED)]);
    if (all.error || prog.error || done.error) return { ok: false };
    return { ok: true, data: { reported: all.count ?? 0, inProgress: prog.count ?? 0, resolved: done.count ?? 0, from, to: now.toISOString(), days } };
  } catch { return { ok: false }; }
}

/** A count for display: the number, or `null` when the group is too small to show. */
export const shownCount = (n: number): number | null => (n < MIN_GROUP ? null : n);

export interface HomeIdea { ref: string; title: string; support_count: number; is_demo: boolean }

export async function loadPopularIdeas(sb: SupabaseClient, key: string, limit = 3): Promise<Loaded<HomeIdea[]>> {
  try {
    const { data, error } = await sb.from("public_ideas").select("ref,title,support_count,is_demo").eq("constituency_key", key)
      .order("support_count", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
    if (error) return { ok: false };
    return { ok: true, data: (data ?? []) as HomeIdea[] };
  } catch { return { ok: false }; }
}

export interface HomeRep { id: string; full_name: string; office_title: string | null; source_url: string | null; verified_at: string | null; is_demo: boolean }

/** The verified current representative of the area, or null when none is published (RLS shows verified rows only). */
export async function loadAreaRep(sb: SupabaseClient, key: string): Promise<Loaded<HomeRep | null>> {
  try {
    const { data, error } = await sb.from("representatives")
      .select("id,full_name,office_title,source_url,verified_at,is_demo,representative_constituencies!inner(valid_to,constituencies!inner(key))")
      .eq("verification_status", "verified").eq("representative_constituencies.constituencies.key", key).is("representative_constituencies.valid_to", null).limit(1);
    if (error) return { ok: false };
    const r = (data ?? [])[0] as (HomeRep & Record<string, unknown>) | undefined;
    return { ok: true, data: r ? { id: r.id, full_name: r.full_name, office_title: r.office_title, source_url: r.source_url, verified_at: r.verified_at, is_demo: r.is_demo } : null };
  } catch { return { ok: false }; }
}

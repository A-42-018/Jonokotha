import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Urgent open cases for the n8n workflow (workflows/n8n/urgent-cases.json). The workflow polls this on a schedule and sends an alert;
 * nothing here changes a case. Only public-safe fields are returned (titles are redacted before storage), never the reporter.
 * Demo cases are left out unless asked for, so a sample report never pages anyone.
 */
export interface UrgentCase { ref: string; title: string; category: string; area: string | null; status: string; created_at: string }

export const clampHours = (v: string | null): number => { const n = Number(v); return Number.isFinite(n) && n >= 1 && n <= 168 ? Math.floor(n) : 24; };

export async function urgentCases(sb: SupabaseClient, o: { hours: number; demo: boolean; now?: Date }): Promise<UrgentCase[]> {
  const since = new Date((o.now ?? new Date()).getTime() - o.hours * 3_600_000).toISOString();
  let q = sb.from("issues").select("ref,title,category,area,status,created_at").eq("priority", "urgent").not("status", "in", "(resolved,closed)").gte("created_at", since)
    .order("created_at", { ascending: false }).limit(50);
  if (!o.demo) q = q.eq("is_demo", false);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as UrgentCase[];
}

/** The text an alert shows: one line per case, newest first. */
export function alertText(cases: UrgentCase[], hours: number): string {
  if (!cases.length) return "";
  return `${cases.length} urgent open case${cases.length === 1 ? "" : "s"} in the last ${hours} h:\n` + cases.map((c) => `- ${c.ref}: ${c.title} (${c.category}${c.area ? `, ${c.area}` : ""}, ${c.status})`).join("\n");
}

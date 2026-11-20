import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { handleRpcWith, type RpcReq, type ServerConfig, type Tool } from "./mcp";

/**
 * Second MCP server: PUBLIC civic data for any AI assistant, no sign-in (src/app/api/mcp/public/route.ts).
 * It reads only what a visitor to the website can already read, through the anonymous Supabase role, so row-level security
 * and the public views decide what exists: no reporter, no staff, no AI fields, no private case text. Tools are read-only.
 * Because there is no caller to audit, it is rate limited per IP instead, and it never uses the service-role key.
 */
const KEY = z.string().max(60).regex(/^[a-z0-9-]+$/);
const REF = z.string().regex(/^[A-Za-z0-9-]{3,40}$/);
const words = (q: string) => q.replace(/[%_,()]/g, " ").trim();

const tools: Tool[] = [
  { name: "list_categories", description: "The problem categories citizens can report (slug, Bangla and English name).",
    schema: z.strictObject({}),
    async run(sb) {
      const { data, error } = await sb.from("issue_categories").select("slug,name_bn,name_en").eq("is_active", true).order("slug"); if (error) throw error; return data ?? [];
    } },
  { name: "agency_directory", description: "Public agencies with the categories they handle, contact channel, the source of that information and the date it was checked.",
    schema: z.strictObject({ category: KEY.optional() }),
    async run(sb, a: { category?: string }) {
      let q = sb.from("agencies").select("key,name_bn,name_en,categories,contact_channel,url,source,checked_at").order("name_en");
      if (a.category) q = q.contains("categories", [a.category]);
      const { data, error } = await q; if (error) throw error; return data ?? [];
    } },
  { name: "helplines", description: "Verified helplines (number, name, purpose) with their official source link and the date the entry must be reviewed again. Only verified entries are listed. In an emergency call 999.",
    schema: z.strictObject({}),
    async run(sb) {
      const { data, error } = await sb.from("public_helplines").select("key,number,name_bn,name_en,purpose_bn,purpose_en,source_url,verified_at,review_due_at,is_demo").order("number"); if (error) throw error; return data ?? [];
    } },
  { name: "search_public_cases", description: "Search publicly visible reports by words or category. Returns reference, title, category, area, status and date. Sample cases are flagged is_demo.",
    schema: z.strictObject({ query: z.string().max(100).optional(), category: KEY.optional(), limit: z.number().int().min(1).max(20).default(10) }),
    async run(sb, a: { query?: string; category?: string; limit: number }) {
      let q = sb.from("public_cases").select("ref,title,category,area,status,created_at,is_demo").order("created_at", { ascending: false }).limit(a.limit);
      if (a.category) q = q.eq("category", a.category);
      if (a.query && words(a.query)) q = q.or(`title.ilike.%${words(a.query)}%,description.ilike.%${words(a.query)}%`);
      const { data, error } = await q; if (error) throw error; return data ?? [];
    } },
  { name: "public_case_status", description: "The public status and timeline of one report by its reference (for example JK-2026-1005): status changes with dates and public notes.",
    schema: z.strictObject({ ref: REF }),
    async run(sb, a: { ref: string }) {
      const { data: c } = await sb.from("public_cases").select("ref,title,category,area,status,status_detail,created_at,is_demo").eq("ref", a.ref).maybeSingle();
      if (!c) return null;
      const { data: ev } = await sb.from("public_case_events").select("status,note,created_at,status_detail").eq("case_ref", a.ref).order("created_at");
      return { ...c, timeline: ev ?? [] };
    } },
];

export const PUBLIC_SERVER: ServerConfig = {
  name: "jonokotha-public", tools, audit: false,
  instructions: "Public civic data from Jonokotha: categories, the sourced agency directory, verified helplines and publicly visible reports. Read-only. No personal data. Not an emergency service: in danger call 999.",
};

export const handlePublicRpc = (req: RpcReq, sb: SupabaseClient) => handleRpcWith(PUBLIC_SERVER, req, sb, { id: "anonymous" });
export const publicTools = tools;

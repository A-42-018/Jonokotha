import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { redactPii } from "./pii";
import { serviceClient } from "./supabase/service";

/**
 * Minimal MCP server (JSON-RPC 2.0 over HTTP POST, spec 2025-03-26) for staff AI clients. Authentication is the staff member's
 * own Supabase access token, so every tool runs with that person's row-level security: nothing here can see more than they can.
 * Tools are READ-ONLY and every call is audited (tool name and argument keys). The only "write" tool, propose_note, creates a
 * pending suggestion that a human must Accept in the office screen; it never changes an issue.
 */
export const PROTOCOL_VERSION = "2025-03-26";
const KEY = z.string().max(60).regex(/^[a-z0-9-]+$/);
const REF = z.string().regex(/^[A-Za-z0-9-]{3,40}$/);

export interface Tool { name: string; description: string; schema: z.ZodType; write?: boolean; run: (sb: SupabaseClient, a: never, who: { id: string }) => Promise<unknown> }

const tools: Tool[] = [
  { name: "search_cases", description: "Search issues in your office scope by words, status or category. Returns reference, title, category, status, area and date (no reporter details).",
    schema: z.strictObject({ query: z.string().max(100).optional(), status: z.string().max(40).optional(), category: z.string().max(40).optional(), limit: z.number().int().min(1).max(20).default(10) }),
    async run(sb, a: { query?: string; status?: string; category?: string; limit: number }) {
      let q = sb.from("issues").select("ref,title,category,status,area,created_at").order("created_at", { ascending: false }).limit(a.limit);
      if (a.status) q = q.eq("status", a.status); if (a.category) q = q.eq("category", a.category);
      if (a.query) q = q.or(`title.ilike.%${a.query.replace(/[%_,()]/g, " ")}%,description.ilike.%${a.query.replace(/[%_,()]/g, " ")}%`);
      const { data, error } = await q; if (error) throw error; return data ?? [];
    } },
  { name: "agency_directory", description: "The sourced agency directory: name, categories served, contact channel, source and the date it was checked.",
    schema: z.strictObject({ category: z.string().max(40).optional() }),
    async run(sb, a: { category?: string }) {
      let q = sb.from("agencies").select("key,name_bn,name_en,categories,contact_channel,url,source,checked_at").order("name_en");
      if (a.category) q = q.contains("categories", [a.category]);
      const { data, error } = await q; if (error) throw error; return data ?? [];
    } },
  { name: "case_timeline", description: "The status history of one issue in your scope: status changes and notes with dates (actor identities are not included).",
    schema: z.strictObject({ ref: REF }),
    async run(sb, a: { ref: string }) {
      const { data: i } = await sb.from("issues").select("id,ref,status").eq("ref", a.ref).maybeSingle();
      if (!i) return null;
      const { data } = await sb.from("issue_events").select("event_type,from_status,to_status,public_message,internal_note,is_public,created_at").eq("issue_id", i.id).order("created_at");
      return { ref: i.ref, status: i.status, events: data ?? [] };
    } },
  { name: "area_statistics", description: "Aggregate statistics for a constituency you can view analytics for. Small groups are hidden.",
    schema: z.strictObject({ constituency: KEY, days: z.number().int().min(1).max(365).default(30) }),
    async run(sb, a: { constituency: string; days: number }) {
      const { data, error } = await sb.rpc("analytics_overview", { p_constituency: a.constituency, p_days: a.days }); if (error) throw error; return data;
    } },
  { name: "propose_note", description: "Propose an internal note for an issue. This only creates a PENDING suggestion for a human to review in the office screen; nothing is changed.", write: true,
    schema: z.strictObject({ ref: REF, note: z.string().trim().min(3).max(1000) }),
    async run(sb, a: { ref: string; note: string }, who) {
      const { data: i } = await sb.from("issues").select("id,constituency_id,assigned_to").eq("ref", a.ref).maybeSingle();
      if (!i) return null;
      const svc = serviceClient(); if (!svc) throw new Error("not configured");
      const { data, error } = await svc.from("ai_suggestions").insert({ target_type: "issue", target_id: i.id, suggestion_type: "mcp_note", payload: { text: redactPii(a.note).text, proposed_by: who.id, source: "mcp" }, citations: [] }).select("id").single();
      if (error) throw error; return { suggestion_id: data.id, status: "pending_human_review" };
    } },
];

export const describeTools = (list: Tool[]) => list.map((t) => ({ name: t.name, description: t.description, inputSchema: z.toJSONSchema(t.schema), annotations: { readOnlyHint: !t.write, destructiveHint: false } }));
export const listTools = () => describeTools(tools);

export interface RpcReq { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> }
const err = (id: RpcReq["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

export interface ServerConfig {
  name: string; instructions: string; tools: Tool[];
  /** Staff server: every call is audited through record_mcp_call and refused when the audit fails. The public server has no caller to audit (it is rate limited per IP instead). */
  audit: boolean;
}

const STAFF: ServerConfig = {
  name: "jonokotha", tools, audit: true,
  instructions: "Read-only access to the cases you may already see. Personal data is not exposed. Writes are only proposals that a person must approve.",
};

/** Handles one JSON-RPC request; returns null for notifications. */
export async function handleRpcWith(cfg: ServerConfig, req: RpcReq, sb: SupabaseClient, who: { id: string }): Promise<object | null> {
  if (req?.jsonrpc !== "2.0" || typeof req.method !== "string") return err(req?.id, -32600, "Invalid request");
  const isNote = req.id === undefined;
  switch (req.method) {
    case "initialize": return { jsonrpc: "2.0", id: req.id, result: { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: { name: cfg.name, version: "1" }, instructions: cfg.instructions } };
    case "ping": return { jsonrpc: "2.0", id: req.id, result: {} };
    case "tools/list": return { jsonrpc: "2.0", id: req.id, result: { tools: describeTools(cfg.tools) } };
    case "tools/call": {
      const p = req.params ?? {}, tool = cfg.tools.find((t) => t.name === p.name);
      if (!tool) return err(req.id, -32602, "Unknown tool");
      const args = tool.schema.safeParse(p.arguments ?? {});
      if (!args.success) return { jsonrpc: "2.0", id: req.id, result: { isError: true, content: [{ type: "text", text: `Invalid arguments: ${args.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}` }] } };
      try {
        const result = await tool.run(sb, args.data as never, who);
        if (cfg.audit) {
          const count = Array.isArray(result) ? result.length : result ? 1 : 0;
          const { error } = await sb.rpc("record_mcp_call", { p_tool: tool.name, p_args: args.data, p_results: count });
          if (error) return { jsonrpc: "2.0", id: req.id, result: { isError: true, content: [{ type: "text", text: "The call could not be audited, so it was not allowed." }] } };
        }
        return { jsonrpc: "2.0", id: req.id, result: { content: [{ type: "text", text: JSON.stringify(result) }], isError: false } };
      } catch { return { jsonrpc: "2.0", id: req.id, result: { isError: true, content: [{ type: "text", text: "The tool failed or you are not allowed to do that." }] } }; }
    }
    default: return isNote ? null : err(req.id, -32601, "Method not found");
  }
}

/** The staff server (src/app/api/mcp/route.ts). */
export const handleRpc = (req: RpcReq, sb: SupabaseClient, who: { id: string }) => handleRpcWith(STAFF, req, sb, who);

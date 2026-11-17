import { z } from "zod";
import { ApiError, type Ctx, type Result } from "./api";

/**
 * B8.9 Open311 GeoReport v2 (read side). One catch-all route /api/v1/open311/v2/[...path] serves
 *   discovery.json|xml, services.json|xml, services/{code}.json|xml, requests.json|xml, requests/{service_request_id}.json|xml.
 * Data comes from the public views of B5.15 only: public reports, approximate (grid centre) locations, nothing private.
 * Creating requests (POST) is not supported: a Jonokotha report needs a verified account (and for assisted cases a consent record), which GeoReport's anonymous
 * api_key model cannot carry. The server answers 403 in Open311's error format and says where to report instead.
 * Sample/demo data is hidden unless `include_sample=true` (not part of the standard).
 */
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function toXml(name: string, item: string, rows: Record<string, unknown>[]): string {
  const el = (o: Record<string, unknown>): string => Object.entries(o).map(([k, v]) => Array.isArray(v) ? `<${k}>${v.map((x) => typeof x === "object" && x ? `<item>${el(x as Record<string, unknown>)}</item>` : `<item>${esc(x)}</item>`).join("")}</${k}>`
    : v && typeof v === "object" ? `<${k}>${el(v as Record<string, unknown>)}</${k}>` : `<${k}>${v === null || v === undefined ? "" : esc(v)}</${k}>`).join("");
  return `<?xml version="1.0" encoding="utf-8"?><${name}>${rows.map((r) => `<${item}>${el(r)}</${item}>`).join("")}</${name}>`;
}
type Fmt = "json" | "xml";
function reply(fmt: Fmt, status: number, rootName: string, item: string, rows: Record<string, unknown>[]): Result {
  return { status, raw: { body: fmt === "json" ? JSON.stringify(rows) : toXml(rootName, item, rows), contentType: fmt === "json" ? "application/json; charset=utf-8" : "text/xml; charset=utf-8" }, headers: { "cache-control": "public, max-age=60" } };
}
const fail = (fmt: Fmt, code: number, description: string): Result => reply(fmt, code, "errors", "error", [{ code, description }]);

const WHEN = z.iso.datetime({ offset: true });
const Q = z.object({
  service_request_id: z.string().max(2000).optional(), service_code: z.string().max(400).optional(), start_date: WHEN.optional(), end_date: WHEN.optional(),
  status: z.string().max(20).optional(), jurisdiction_id: z.string().max(60).regex(/^[a-z0-9-]*$/).optional(), include_sample: z.enum(["true", "false"]).optional(),
});
const REQ_COLS = "service_request_id,service_code,service_name,description,status,lat,long,requested_datetime,updated_datetime,constituency_key,is_demo";
const REF = /^[A-Za-z0-9-]{3,40}$/;
const toRequest = (r: Record<string, unknown>) => ({
  service_request_id: r.service_request_id, status: r.status, status_notes: null, service_name: r.service_name, service_code: r.service_code, description: r.description,
  agency_responsible: null, service_notice: null, requested_datetime: r.requested_datetime, updated_datetime: r.updated_datetime, expected_datetime: null,
  address: null, address_id: null, zipcode: null, lat: r.lat, long: r.long, media_url: null,
});

export async function open311(c: Ctx): Promise<Result> {
  const segs = (c.params.path ?? "").split("/").filter(Boolean);
  const last = segs[segs.length - 1] ?? "";
  const m = /^(.*)\.(json|xml)$/.exec(last);
  const fmt: Fmt = (m?.[2] as Fmt) ?? "json";
  if (!m) return fail("json", 404, "Use .json or .xml, for example services.json");
  segs[segs.length - 1] = m[1];
  if (c.req.method === "POST") return { ...fail(fmt, 403, "Creating requests through this interface is not supported. Report a problem in the Jonokotha app with a verified account."), headers: { Allow: "GET", "cache-control": "no-store" } };
  const [kind, id] = segs;
  const origin = new URL(c.req.url).origin;
  if (kind === "discovery" && segs.length === 1) {
    return reply(fmt, 200, "discovery", "endpoint", [{ changeset: "2026-11-17", contact: "See the project site", key_service: "No key is needed for reading", endpoints: [{ specification: "http://wiki.open311.org/GeoReport_v2", url: `${origin}/api/v1/open311/v2`, changeset: "2026-11-17", type: "production", formats: ["application/json", "text/xml"] }], supported_operations: ["GET Service List", "GET Service Definition", "GET Service Requests", "GET Service Request"] }]);
  }
  if (kind === "services" && segs.length === 1) {
    const { data, error } = await c.sb.from("public_open311_services").select("service_code,service_name,service_name_bn,type,group_slug").order("service_code");
    if (error) throw new ApiError("internal_error", "Something went wrong.");
    return reply(fmt, 200, "services", "service", (data ?? []).map((s) => ({ service_code: s.service_code, service_name: s.service_name, description: s.service_name_bn, metadata: false, type: s.type, keywords: "", group: s.group_slug })));
  }
  if (kind === "services" && segs.length === 2) {
    const { data } = await c.sb.from("public_open311_services").select("service_code").eq("service_code", id).maybeSingle();
    if (!data) return fail(fmt, 404, "Service not found");
    return { ...reply(fmt, 200, "service_definition", "service", [{ service_code: id, attributes: [] }]) };
  }
  if (kind === "requests" && segs.length === 2) {
    if (!REF.test(id)) return fail(fmt, 404, "Service request not found");
    const { data } = await c.sb.from("public_open311_requests").select(REQ_COLS).eq("service_request_id", id).maybeSingle();
    if (!data) return fail(fmt, 404, "Service request not found");
    return reply(fmt, 200, "service_requests", "request", [toRequest(data)]);
  }
  if (kind === "requests" && segs.length === 1) {
    const p = Q.safeParse(Object.fromEntries(c.url.searchParams));
    if (!p.success) return fail(fmt, 400, `Invalid parameter: ${p.error.issues[0]?.path.join(".") || "query"}`);
    const q = p.data;
    const statuses = q.status ? q.status.split(",").map((s) => s.trim()) : null;
    if (statuses && !statuses.every((s) => s === "open" || s === "closed")) return fail(fmt, 400, "status must be open, closed or both");
    const ids = q.service_request_id ? q.service_request_id.split(",").map((s) => s.trim()) : null;
    if (ids && (ids.length > 50 || !ids.every((s) => REF.test(s)))) return fail(fmt, 400, "service_request_id is invalid");
    const start = q.start_date ?? new Date(Date.now() - 90 * 86400_000).toISOString();
    let s = c.sb.from("public_open311_requests").select(REQ_COLS).gte("requested_datetime", start).order("requested_datetime", { ascending: false }).limit(1000);
    if (q.end_date) s = s.lte("requested_datetime", q.end_date);
    if (statuses) s = s.in("status", statuses);
    if (ids) s = s.in("service_request_id", ids);
    if (q.service_code) s = s.in("service_code", q.service_code.split(",").map((x) => x.trim()).slice(0, 50));
    if (q.jurisdiction_id) s = s.eq("constituency_key", q.jurisdiction_id);
    if (q.include_sample !== "true") s = s.eq("is_demo", false);
    const { data, error } = await s;
    if (error) throw new ApiError("internal_error", "Something went wrong.");
    return reply(fmt, 200, "service_requests", "request", (data ?? []).map(toRequest));
  }
  return fail(fmt, 404, "Not found");
}

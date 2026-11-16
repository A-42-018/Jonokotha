import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { mfaRequired, type Actor } from "./auth";
import { clientIp, sameOrigin } from "./http";
import { rateLimit } from "./rate-limit";
import { captureError } from "./monitor";
import { currentUser } from "./supabase/server";

/**
 * Shared plumbing for /api/v1 (masterplan §13.10): one error format, request ids, size limits, validation,
 * rate limits (per IP in memory, per signed-in user in the database), Idempotency-Key, structured logs.
 *
 * Success:  { data, page?, request_id }      Error:  { code, message, field_errors, request_id }
 * `message` is for developers; the UI shows its own Bangla/English text chosen by `code`.
 */
export const ERROR_STATUS = {
  invalid_json: 400, idempotency_key_required: 400, unauthenticated: 401, forbidden: 403, not_found: 404, method_not_allowed: 405,
  invalid_transition: 409, rule_not_met: 409, conflict: 409, idempotency_conflict: 409, idempotency_in_progress: 409,
  payload_too_large: 413, validation_failed: 422, rate_limited: 429, internal_error: 500, unavailable: 503,
} as const;
export type ErrorCode = keyof typeof ERROR_STATUS;

export class ApiError extends Error {
  constructor(public code: ErrorCode, message: string, public fieldErrors: Record<string, string> = {}, public headers: Record<string, string> = {}) {
    super(message);
  }
}

export interface Ctx {
  req: Request; url: URL; rid: string; ip: string;
  sb: SupabaseClient; user: User | null; actor: Actor | null;
  params: Record<string, string>;
  /** Raw JSON body (already size-checked); {} when the request has none. Validate with `parse`. */
  body: unknown;
}
export interface Result { status?: number; data?: unknown; page?: { next_cursor: string | null; limit: number }; headers?: Record<string, string> }
export interface Opts {
  /** Stable route name, e.g. "POST /api/v1/issues"; used for limits, idempotency and logs. */
  name: string;
  auth: "required" | "optional";
  /** Requests per minute: per signed-in user (shared in the database) and per IP (in memory). */
  limit?: { user?: number; ip?: number };
  maxBytes?: number;
  idempotency?: "required" | "optional" | "none";
  /** Uploads: the handler reads `c.req` itself (formData); the body is not parsed here, only its declared size is capped by `maxBytes`. */
  rawBody?: boolean;
}

const REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;
export const newRequestId = (req?: Request) => {
  const given = req?.headers.get("x-request-id");
  return given && REQUEST_ID.test(given) ? given : randomUUID();
};

export function problem(e: ApiError, rid: string) {
  return NextResponse.json({ code: e.code, message: e.message, field_errors: e.fieldErrors, request_id: rid },
    { status: ERROR_STATUS[e.code], headers: { "x-request-id": rid, ...e.headers } });
}

/** Validate input with Zod; failures become one 422 with a message per field. */
export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  const field_errors: Record<string, string> = {};
  for (const i of r.error.issues) field_errors[i.path.join(".") || "_"] ??= i.message;
  throw new ApiError("validation_failed", "Some fields are missing or invalid.", field_errors);
}

async function readBody(req: Request, maxBytes: number): Promise<{ data: unknown; raw: string }> {
  if (req.method === "GET" || req.method === "HEAD") return { data: {}, raw: "" };
  if (Number(req.headers.get("content-length") ?? 0) > maxBytes) throw new ApiError("payload_too_large", `Body is limited to ${maxBytes} bytes.`);
  const raw = await req.text().catch(() => "");
  if (new TextEncoder().encode(raw).length > maxBytes) throw new ApiError("payload_too_large", `Body is limited to ${maxBytes} bytes.`);
  if (!raw.trim()) return { data: {}, raw };
  try { return { data: JSON.parse(raw), raw }; } catch { throw new ApiError("invalid_json", "Body must be valid JSON."); }
}

/** Maps a failed database function call (see docs/state-machine.md) to an ApiError. */
const FIELD_FOR_TOKEN: Record<string, string> = {
  destination: "agency_id", forwarding_details: "contact_channel", responsible_party: "assignee", master_issue: "master_ref",
  evidence: "evidence_url", note: "note",
};
export function fromDbError(error: { code?: string; details?: string | null; message?: string }): ApiError {
  const token = error.details ?? "";
  switch (error.code) {
    case "JK404": return new ApiError("not_found", "Issue not found.");
    case "42501": return new ApiError("forbidden", "You are not allowed to do this.");
    case "JK001": return new ApiError("invalid_transition", error.message ?? "This change is not allowed from the current status.");
    case "JK002": { const f = FIELD_FOR_TOKEN[token] ?? (token || "_"); return new ApiError("validation_failed", error.message ?? "A required field is missing or invalid.", { [f]: "required_or_invalid" }); }
    case "JK003": return new ApiError("rule_not_met", error.message ?? "A rule is not met.", token ? { _: token } : {});
    default: return new ApiError("internal_error", "Something went wrong.");
  }
}

/**
 * Administrators reading private records leave an audit row (masterplan §5.6). Fails closed: if the trace cannot be
 * written the read does not happen. Other roles are not logged here (their access is scoped and routine).
 */
export async function auditAdminRead(c: Ctx, resourceType: string, resourceId: string | null, meta: Record<string, unknown> = {}) {
  if (c.actor?.role !== "admin") return;
  const { error } = await c.sb.rpc("record_admin_access", { p_resource_type: resourceType, p_resource_id: resourceId, p_meta: meta });
  if (error) throw new ApiError("internal_error", "The access could not be recorded, so it was not allowed.");
}

function log(entry: Record<string, unknown>) {
  // One JSON line per request. Never log bodies, tokens or query strings (they can hold personal data).
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }));
}

/** Runs a v1 handler inside the shared pipeline. */
export async function run(req: Request, params: Record<string, string>, opts: Opts, handler: (c: Ctx) => Promise<Result>): Promise<Response> {
  const rid = newRequestId(req), started = Date.now(), url = new URL(req.url);
  let status = 500, actorId: string | undefined, idem: { key: string; sb: SupabaseClient } | null = null;
  try {
    const ip = clientIp(req);
    if (opts.limit?.ip) {
      const r = rateLimit(`${opts.name}:ip:${ip}`, opts.limit.ip, 60_000);
      if (!r.ok) throw new ApiError("rate_limited", "Too many requests. Try again shortly.", {}, { "Retry-After": String(r.retryAfterSec) });
    }
    if (opts.rawBody && Number(req.headers.get("content-length") ?? 0) > (opts.maxBytes ?? 16 * 1024)) throw new ApiError("payload_too_large", `Body is limited to ${opts.maxBytes} bytes.`);
    const { data: body, raw } = opts.rawBody ? { data: {}, raw: "" } : await readBody(req, opts.maxBytes ?? 16 * 1024);
    const { sb, user, actor } = await currentUser(rid);
    actorId = user?.id;
    // CSRF, second layer (the first is SameSite=Lax on the session cookie): a browser request that changes data must come from this site.
    // Requests without an Origin header (server-to-server, tests, curl) are not browser cross-site requests and carry no ambient cookies of a victim.
    if (req.method !== "GET" && req.method !== "HEAD" && !sameOrigin(req.headers.get("origin"), url.host)) throw new ApiError("forbidden", "Cross-site requests are not allowed.", { _: "cross_site" });
    // MFA gate (masterplan §14): MPs, moderators and admins need a TOTP (aal2) session on privileged routes once `enforce_mfa` is on.
    // The database enforces the same rule in every policy; this turns it into a clear 403 with a stable code.
    if (actor && actor.aal !== "aal2" && mfaRequired(actor) && /^\/api\/v1\/(admin|office)(\/|$)/.test(url.pathname)) {
      const { data: ok } = await sb.rpc("mfa_ok");
      if (ok === false) throw new ApiError("forbidden", "Two-factor sign-in is required for this account.", { _: "mfa_required" });
    }
    if (opts.auth === "required" && !user) throw new ApiError("unauthenticated", "Sign in to continue.");

    if (user && opts.limit?.user) {
      const scope = opts.name.toLowerCase().replace(/[^a-z0-9]+/g, ":").replace(/^:|:$/g, "").slice(0, 48);
      const { data, error } = await sb.rpc("consume_rate_limit", { p_scope: scope, p_limit: opts.limit.user, p_window_seconds: 60 });
      const verdict = error ? (() => { const m = rateLimit(`${opts.name}:user:${user.id}`, opts.limit!.user!, 60_000); return { allowed: m.ok, retry_after: m.retryAfterSec }; })() : (data as { allowed: boolean; retry_after: number });
      if (!verdict.allowed) throw new ApiError("rate_limited", "Too many requests. Try again shortly.", {}, { "Retry-After": String(verdict.retry_after) });
    }

    const mode = req.method === "POST" ? opts.idempotency ?? "none" : "none";
    const key = req.headers.get("idempotency-key");
    if (mode === "required" && !key) throw new ApiError("idempotency_key_required", "This request needs an Idempotency-Key header (8-64 letters, digits, - or _).");
    if (mode !== "none" && key && user) {
      const hash = createHash("sha256").update(`${req.method}\n${url.pathname}\n${raw}`).digest("hex");
      const { data, error } = await sb.rpc("idempotency_begin", { p_key: key, p_endpoint: opts.name, p_hash: hash });
      if (error) throw error.code === "JK002" ? new ApiError("validation_failed", "Idempotency-Key must be 8-64 letters, digits, - or _.", { "Idempotency-Key": "invalid" }) : fromDbError(error);
      const st = data as { state: string; status?: number; body?: { data?: unknown; page?: Result["page"] } };
      if (st.state === "conflict") throw new ApiError("idempotency_conflict", "This Idempotency-Key was already used with a different request.");
      if (st.state === "in_progress") throw new ApiError("idempotency_in_progress", "A request with this Idempotency-Key is still being processed.", {}, { "Retry-After": "2" });
      if (st.state === "replay") {
        status = st.status ?? 200;
        return NextResponse.json({ ...st.body, request_id: rid }, { status, headers: { "x-request-id": rid, "Idempotent-Replay": "true" } });
      }
      idem = { key, sb };
    }

    const out = await handler({ req, url, rid, ip, sb, user, actor, params, body });
    status = out.status ?? 200;
    const payload = { data: out.data ?? null, ...(out.page ? { page: out.page } : {}) };
    if (idem) { await idem.sb.rpc("idempotency_finish", { p_key: idem.key, p_endpoint: opts.name, p_status: status, p_body: payload }); idem = null; }
    return NextResponse.json({ ...payload, request_id: rid }, { status, headers: { "x-request-id": rid, ...out.headers } });
  } catch (e) {
    if (idem) await idem.sb.rpc("idempotency_release", { p_key: idem.key, p_endpoint: opts.name }).then(() => null, () => null);
    const err = e instanceof ApiError ? e : null;
    if (!err) {
      log({ level: "error", request_id: rid, route: opts.name, error: (e as Error)?.name ?? "Error", detail: String((e as Error)?.message ?? e).slice(0, 200) });
      await captureError(e, { route: opts.name, request_id: rid });
    }
    const api = err ?? new ApiError("internal_error", "Something went wrong. Quote the request_id if you contact support.");
    status = ERROR_STATUS[api.code];
    return problem(api, rid);
  } finally {
    log({ level: status >= 500 ? "error" : "info", request_id: rid, route: opts.name, method: req.method, path: url.pathname, status, ms: Date.now() - started, actor: actorId });
  }
}

/** Calls a database function as the signed-in user and turns its errors into ApiErrors (see fromDbError). */
export async function rpc<T = unknown>(sb: SupabaseClient, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw fromDbError(error);
  return data as T;
}

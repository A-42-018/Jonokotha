// Browser-side client for /api/v1 (docs/api-v1.md). One place for the envelope, the error format and Idempotency-Key.
import { demoOnBrowser } from "@/lib/demo-mode";
import { isMfaRequired, mfaUrl } from "@/lib/mfa";
import type { Emergency } from "@/lib/types";

export interface Page { next_cursor: string | null; limit: number }

/** A failed /api/v1 call. `code` is the stable machine code; the UI shows its own text chosen from it. */
export class ApiError extends Error {
  constructor(readonly code: string, readonly status: number, readonly fieldErrors: Record<string, string> = {}, readonly requestId?: string, readonly retryAfter?: number) {
    super(code);
    this.name = "ApiError";
  }
  /** No answer from the server at all (offline, DNS, timeout). */
  get isNetwork() { return this.status === 0; }
}

export interface ApiInit { method?: string; body?: unknown; form?: FormData; idempotencyKey?: string; signal?: AbortSignal }

/** Calls `/api/v1/<path>` and returns `{ data, page }`. Throws ApiError (status 0 when there was no response). */
export async function api<T>(path: string, init: ApiInit = {}, doFetch: typeof fetch = fetch): Promise<{ data: T; page?: Page; replayed: boolean }> {
  // Demo mode (see demo-mode.ts): answer from code, never from the server. Loaded on demand, so normal pages carry none of it.
  if (demoOnBrowser()) {
    const { simulate } = await import("@/lib/demo-sim");
    const sim = await simulate(path, { method: init.method ?? (init.body !== undefined || init.form ? "POST" : "GET"), body: init.body, form: !!init.form });
    if (sim) return { data: sim.data as T, page: sim.page, replayed: false };
  }
  const headers: Record<string, string> = {};
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await doFetch(`/api/v1${path}`, {
      method: init.method ?? (init.body !== undefined || init.form ? "POST" : "GET"),
      headers,
      body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
      signal: init.signal,
    });
  } catch {
    throw new ApiError("network", 0);
  }
  const json = (await res.json().catch(() => null)) as { data?: T; page?: Page; code?: string; field_errors?: Record<string, string>; request_id?: string } | null;
  if (!res.ok) {
    const retry = Number(res.headers.get("Retry-After"));
    const err = new ApiError(json?.code ?? "internal_error", res.status, json?.field_errors ?? {}, json?.request_id, Number.isFinite(retry) && retry > 0 ? retry : undefined);
    // A privileged call from a password-only session: go and enter the code, then come back to this page.
    if (isMfaRequired(err) && typeof window !== "undefined") window.location.assign(mfaUrl(window.location.pathname + window.location.search));
    throw err;
  }
  return { data: json?.data as T, page: json?.page, replayed: res.headers.get("Idempotent-Replay") === "true" };
}

export type SubmitBody = Record<string, unknown>;
export interface Submitted { ref: string; status: string; emergency?: Emergency }

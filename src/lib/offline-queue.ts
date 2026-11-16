// Report queue for when the phone has no signal (task 3.3). Pure logic: storage and fetch are passed in, so it is unit-tested.
// A queued report is sent later with the same POST /api/v1/issues as a live one, with the same Idempotency-Key, so a
// retry after a lost response is replayed by the server instead of creating a second report.
import { api, ApiError } from "@/lib/api-client";
import type { Emergency } from "@/lib/types";

export const QUEUE_KEY = "jonokotha:report-queue:v1";

export type QueueState = "queued" | "needs-signin" | "rejected";
export interface QueuedReport {
  /** Also sent as the Idempotency-Key header, so the server drops a duplicate if the first try got through. */
  id: string;
  title: string;
  body: Record<string, unknown>;
  queuedAt: string;
  state: QueueState;
}
export type SendResult = { kind: "sent"; ref: string; emergency?: Emergency } | { kind: "network" } | { kind: "unauth" } | { kind: "rejected" } | { kind: "server" };

export const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

export function enqueue(list: QueuedReport[], body: Record<string, unknown>, now = new Date(), id = newId()): QueuedReport[] {
  return [...list, { id, title: String(body.title ?? ""), body, queuedAt: now.toISOString(), state: "queued" }];
}

/** POSTs one report and says what happened, without throwing. */
export async function sendReport(item: Pick<QueuedReport, "id" | "body">, doFetch: typeof fetch = fetch): Promise<SendResult> {
  try {
    const { data } = await api<{ ref: string; emergency?: Emergency }>("/issues", { body: item.body, idempotencyKey: item.id }, doFetch);
    return { kind: "sent", ref: data.ref, ...(data.emergency ? { emergency: data.emergency } : {}) };
  } catch (e) {
    if (!(e instanceof ApiError) || e.isNetwork) return { kind: "network" };
    if (e.status === 401) return { kind: "unauth" };
    // Busy or throttled: the same report is fine, try again later (do not mark it rejected).
    if (e.status === 429 || e.code === "idempotency_in_progress") return { kind: "server" };
    if (e.status >= 400 && e.status < 500) return { kind: "rejected" };
    return { kind: "server" };
  }
}

export interface FlushOutcome { list: QueuedReport[]; sent: { id: string; title: string; ref: string }[]; stoppedOffline: boolean }

/**
 * Tries each queued report in order. Stops at the first network or server failure (try again later); a sign-in or
 * validation problem marks that one report and carries on with the rest.
 */
export async function flushQueue(list: QueuedReport[], send: (q: QueuedReport) => Promise<SendResult>): Promise<FlushOutcome> {
  const next: QueuedReport[] = [];
  const sent: FlushOutcome["sent"] = [];
  let stopped = false;
  for (const q of list) {
    if (stopped || q.state === "rejected") { next.push(q); continue; }
    const r = await send(q);
    if (r.kind === "sent") sent.push({ id: q.id, title: q.title, ref: r.ref });
    else if (r.kind === "unauth") next.push({ ...q, state: "needs-signin" });
    else if (r.kind === "rejected") next.push({ ...q, state: "rejected" });
    else { next.push({ ...q, state: "queued" }); stopped = true; }
  }
  return { list: next, sent, stoppedOffline: stopped };
}

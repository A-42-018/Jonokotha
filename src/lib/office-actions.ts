import type { Status } from "./types";

/** Staff actions on a report. `request_info` does not change the public status. */
export const OFFICE_ACTIONS = ["acknowledge", "request_info", "refer", "resolve"] as const;
export type OfficeAction = (typeof OFFICE_ACTIONS)[number];

export const NOTE_MIN = 10;
export const NOTE_MAX = 500;

/** Which actions make sense at each status (UI only; the backend must enforce the same rules). */
export function canDo(action: OfficeAction, status: Status): boolean {
  switch (action) {
    case "acknowledge": return status === "received";
    case "request_info":
    case "refer": return status === "received" || status === "acknowledged";
    case "resolve": return status !== "resolved";
  }
}

export type NoteError = "empty" | "short" | "long" | null;

export function validateNote(raw: string): NoteError {
  const n = raw.trim().length;
  if (n === 0) return "empty";
  if (n < NOTE_MIN) return "short";
  if (n > NOTE_MAX) return "long";
  return null;
}

/** One line of the staff-only audit trail. Staff only: never render this on public pages or in My Reports. */
export interface AuditEntry {
  id: string;
  /** Display name of the staff member. null when the backend does not record the actor yet. */
  actor: string | null;
  action: OfficeAction | "received";
  at: string;
  note?: string;
}

export type SubmitResult = "ok" | "forbidden" | "fail";
export type SubmitAction = (action: OfficeAction, note: string) => Promise<SubmitResult>;

const STATUS_ACTION: Record<Status, AuditEntry["action"]> = {
  received: "received", acknowledged: "acknowledge", referred: "refer", resolved: "resolve",
};

/**
 * Builds audit entries from what the store returns today (status events with an optional note).
 * There is no actor and no "request_info" event yet, so actor is null.
 */
export function auditFromTimeline(timeline: { status: Status; at: string; note?: string }[]): AuditEntry[] {
  return timeline.map((e, i) => ({ id: `${i}-${e.at}`, actor: null, action: STATUS_ACTION[e.status], at: e.at, note: e.note }));
}

/** Default submitter: the existing approve route. It accepts acknowledge and refer only, and ignores `note` today. */
export const submitToApproveRoute = (cref: string): SubmitAction => async (action, note) => {
  try {
    const r = await fetch(`/api/cases/${cref}/approve`, { method: "POST", body: JSON.stringify({ action, note: note.trim() }), signal: AbortSignal.timeout(15000) });
    if (r.ok) return "ok";
    if (r.status === 401 || r.status === 403) return "forbidden";
  } catch { /* fall through */ }
  return "fail";
};

/**
 * Submitter on /api/v1: acknowledge (the note is kept as an internal note), request more information (the note is the message the citizen sees)
 * and resolve (the note is the resolution note). Forwarding to the suggested agency still uses the approve route, which picks the agency server-side.
 */
export const submitToApi = (cref: string): SubmitAction => async (action, note) => {
  if (action === "refer") return submitToApproveRoute(cref)(action, note);
  const [path, body] = {
    acknowledge: ["acknowledge", { internal_note: note.trim() }],
    request_info: ["request-information", { message: note.trim() }],
    resolve: ["resolve", { resolution_note: note.trim() }],
  }[action] as [string, Record<string, string>];
  try {
    const r = await fetch(`/api/v1/office/issues/${encodeURIComponent(cref)}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    if (r.ok) return "ok";
    if (r.status === 401 || r.status === 403) return "forbidden";
  } catch { /* fall through */ }
  return "fail";
};

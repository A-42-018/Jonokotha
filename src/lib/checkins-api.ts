import { api } from "@/lib/api-client";
import { readOrPlanned, type OrPlanned } from "@/lib/r11";

/** Citizen check-ins on public projects (B7.3). Contract: docs/api-v1.md "Project check-ins" (branch claude/backend-phase7). They never change a project's official status. */
export interface Checkin { id: string; note: string; visited_at: string; has_photo: boolean; photo_url: string | null; office_response: string | null; responded_at: string | null; created_at: string; label: "citizen_submitted" }
const q = encodeURIComponent;

const asList = <T,>(r: OrPlanned<T[]>): OrPlanned<T[]> => (r.kind === "ok" && !Array.isArray(r.data) ? { ...r, data: [] } : r);
export const fetchCheckins = (ref: string) => readOrPlanned<Checkin[]>(`/projects/${q(ref)}/checkins?limit=30`).then(asList);
export const createCheckin = (ref: string, b: { note: string; visited_at?: string }, key: string) =>
  api<{ id: string; status: string }>(`/projects/${q(ref)}/checkins`, { body: b, idempotencyKey: key }).then((r) => r.data);
export function uploadCheckinPhoto(ref: string, id: string, blob: Blob) {
  const form = new FormData();
  form.append("file", blob, "checkin.jpg");
  return api<unknown>(`/projects/${q(ref)}/checkins/${q(id)}/photo`, { form });
}

/** `YYYY-MM-DD` of the local calendar day in Dhaka. The server accepts a visit between 60 days ago and today. */
export function dhakaDay(now = new Date(), minusDays = 0): string {
  const d = new Date(now.getTime() + 6 * 3_600_000 - minusDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}
export const visitRange = (now = new Date()) => ({ min: dhakaDay(now, 60), max: dhakaDay(now) });
export const noteOk = (s: string) => s.trim().length >= 5 && s.trim().length <= 500;

// Office -------------------------------------------------------------------------------------------------------------------------------------------
export interface OfficeCheckin extends Omit<Checkin, "label" | "photo_url"> { moderation_status?: "pending_review" | "approved" | "hidden"; moderation_reason?: string | null; photo_url?: string | null }
export const fetchOfficeCheckins = (ref: string) => readOrPlanned<OfficeCheckin[]>(`/office/projects/${q(ref)}/checkins`).then(asList);
export const moderateCheckin = (id: string, action: "approve" | "hide", reason?: string) => api<unknown>(`/office/checkins/${q(id)}/moderate`, { body: { action, ...(reason ? { reason } : {}) } });
export const respondToCheckin = (id: string, text: string) => api<unknown>(`/office/checkins/${q(id)}/response`, { body: { text: text.trim() } });

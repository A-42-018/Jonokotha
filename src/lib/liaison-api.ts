import { api } from "@/lib/api-client";

const enc = encodeURIComponent;

/** The status a case has once the office has forwarded it (docs/api-v1.md, `forward`). */
export const REFERRED_STATUS = "referred_to_authority";

export interface ReferredIssue { ref: string; title: string; status: string; updated_at: string; is_sample?: boolean }
/** RLS limits a liaison to the issues assigned to them; the client never widens that. */
export const fetchReferred = () =>
  api<ReferredIssue[]>(`/office/issues?${new URLSearchParams({ status: REFERRED_STATUS, limit: "50" })}`).then((r) => r.data);

export interface ReferralRow { agency_name: string | null; external_reference: string | null; forwarded_at: string | null }
const str = (v: unknown) => (typeof v === "string" && v ? v : null);
/** Reads `referrals` from GET /office/issues/{ref}; anything unexpected becomes "no referral shown", never a guess. */
export const fetchReferrals = (ref: string) =>
  api<{ referrals?: unknown }>(`/office/issues/${enc(ref)}`).then((r): ReferralRow[] =>
    Array.isArray(r.data?.referrals)
      ? (r.data.referrals as Record<string, unknown>[]).map((x) => ({ agency_name: str(x.agency_name), external_reference: str(x.external_reference), forwarded_at: str(x.forwarded_at) }))
      : []);

export const NOTE_MIN = 10;
export const noteTooShort = (s: string) => s.trim().length < NOTE_MIN;
/** POST /office/issues/{ref}/update: a note is internal unless `public: true`. */
export const addLiaisonNote = (ref: string, note: string, isPublic: boolean) =>
  api<unknown>(`/office/issues/${enc(ref)}/update`, { body: { note: note.trim(), ...(isPublic ? { public: true } : {}) } });

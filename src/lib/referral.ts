import type { SupabaseClient } from "@supabase/supabase-js";
import type { Status } from "./types";

/**
 * Referral language (masterplan 1, 28; F5.6). Three different things, never merged:
 * - received: the MP's office has the report
 * - forwarded: the office told the responsible authority
 * - registered: the authority put it in its own records. Only with proof from an integration record (B5.4).
 * "Registered" is never worked out from a status or from a reference number somebody typed.
 */
export type ReferralStage = "received" | "forwarded" | "registered";
export type StageState = "done" | "not_yet" | "unconfirmed";

export interface ReferralInfo {
  agency_name: string | null;
  /** A reference the office typed when forwarding. It is the office's note, not the authority's confirmation. */
  office_reference: string | null;
  forwarded_at: string | null;
  /** Set only when the server has an integration or proof record (B5.4 `officially_registered`). Absent today. */
  registered?: { at: string | null; proof_url: string | null } | null;
}

export interface ReferralStages { received: StageState; forwarded: StageState; registered: StageState }

/** What has happened, from the timeline statuses (legacy four-label set) and the optional referral record. */
export function referralStages(timeline: readonly { status: Status }[], referral?: ReferralInfo | null): ReferralStages {
  const seen = new Set(timeline.map((s) => s.status));
  const forwarded = seen.has("referred") || !!referral;
  const received = forwarded || seen.has("acknowledged") || seen.has("resolved");
  const registered: StageState = referral?.registered ? "done" : forwarded ? "unconfirmed" : "not_yet";
  return { received: received ? "done" : "not_yet", forwarded: forwarded ? "done" : "not_yet", registered };
}

/** Nothing to say before the office has received the report. */
export function hasReferralStory(s: ReferralStages): boolean {
  return s.received === "done" || s.forwarded === "done";
}

/**
 * Referral row the signed-in session may read: RLS gives the reporter their own `public` rows and staff every row
 * of their office. Anyone else gets null, which the page shows as "not published", not as "no referral".
 */
export async function readReferral(sb: SupabaseClient, ref: string): Promise<ReferralInfo | null> {
  try {
    const { data: issue } = await sb.from("issues").select("id").eq("ref", ref).maybeSingle();
    if (!issue) return null;
    const { data } = await sb.from("issue_agency_referrals").select("agency_name,external_reference,forwarded_at")
      .eq("issue_id", (issue as { id: string }).id).order("forwarded_at", { ascending: false }).limit(1).maybeSingle();
    if (!data) return null;
    const r = data as { agency_name: string | null; external_reference: string | null; forwarded_at: string | null };
    return { agency_name: r.agency_name, office_reference: r.external_reference, forwarded_at: r.forwarded_at };
  } catch {
    return null;
  }
}

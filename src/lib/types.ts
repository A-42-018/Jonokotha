import { z } from "zod";
import { CATEGORIES, type Category } from "./categories";

export { CATEGORIES };
export type { Category };

export const IntakeDraft = z.object({
  title: z.string().min(3).max(120),
  category: z.enum(CATEGORIES),
  description: z.string().min(3).max(2000),
  area: z.string().max(120).default(""),
});
export type IntakeDraft = z.infer<typeof IntakeDraft>;

export const CaseInput = IntakeDraft.extend({ constituencyId: z.string().default("demo-1") });

/** Legacy 4-state label set the current UI knows. Still the type of CaseRecord.status. */
export type Status = "received" | "acknowledged" | "referred" | "resolved";

/** The real 13-state model (masterplan §9). CaseRecord.statusDetail carries it; the UI can adopt it when ready. */
export const ISSUE_STATUSES = [
  "submitted", "under_review", "needs_information", "acknowledged", "assigned", "referred_to_authority", "in_progress",
  "resolved", "closed", "rejected", "duplicate", "out_of_jurisdiction", "reopened",
] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export interface CaseRecord extends IntakeDraft {
  ref: string;
  constituencyId: string;
  status: Status;
  /** Added in Phase 1 (additive): the precise state. `status` is a mapped, coarser label for older UI code. */
  statusDetail?: IssueStatus;
  createdAt: string;
  timeline: { status: Status; at: string; note?: string }[];
  ai: { summary: string; similarRefs: string[]; agencyId: string; confidence: number };
}

export interface Agency { id: string; nameBn: string; nameEn: string; categories: Category[]; source: string; url?: string; checkedAt?: string }

/** Imminent-harm result (Phase 3, backend M.8). Returned by POST /ai/intake (`source: "emergency"`), POST /issues and POST /questions.
 *  The UI shows `guidance` prominently, in the user's language, and never replaces it with model text. Wording is a draft pending review. */
export type EmergencyKind = "self_harm" | "violence" | "child_in_danger";
export interface Emergency { kind: EmergencyKind; guidance: { bn: string; en: string }; numbers: string[] }

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Phase 7 (Release 1.1) contract. Shapes returned by the /api/v1 routes in docs/api-v1.md "Phase 7". Additive: nothing above changes.
// Public figures follow the 5-person rule: a number that would describe fewer than 5 people is null and the matching `*_suppressed`/`suppressed` flag is true.
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** B7.1 consultations. Per-statement votes are hidden from citizens until the report is published. */
export type ConsultationStatus = "draft" | "pending_approval" | "open" | "closed" | "reported" | "cancelled";
export interface Consultation { ref: string; constituency_key: string; question: string; description: string | null; status: "open" | "closed" | "reported"; closes_at: string; opened_at: string | null; closed_at: string | null; statement_count: number; participant_count: number | null; is_sample: boolean }
export interface ConsultationStatement { id: string; text: string; kind: "seed" | "citizen"; my_vote: "agree" | "disagree" | "pass" | null }
export type ConsensusPattern = "common_ground" | "divided" | "mixed" | "low_support";
/** Aggregates only. Groups are anonymous (A, B), never smaller than `min_group_size`; nothing says who is in them. */
export interface ConsultationReport {
  consultation_ref: string; constituency_key: string; participants: number;
  groups: { group: string; size: number }[]; hidden_groups: number; min_group_size: number;
  agreement: { statement_id: string; text: string; votes: number | null; agree_pct: number | null; disagree_pct: number | null; pass_pct: number | null; groups: { group: string; votes: number; agree_pct: number | null }[]; pattern: ConsensusPattern | null }[];
  summary_bn: string | null; you_said_we_did: string | null; actions: { text: string; link_ref?: string }[]; published_at: string; is_sample: boolean;
}

/** B7.2 messaging channels. A number is linked from the app first; messages from unknown numbers create nothing. */
export type MessagingChannel = "whatsapp" | "sms";
export interface ChannelLink { id: string; channel: MessagingChannel; address_hint: string | null; status: "pending" | "active"; code_expires_at: string | null; updates_enabled: boolean; created_at: string; verified_at: string | null }
export interface ChannelLinkStarted { id: string; channel: MessagingChannel; status: "pending"; code: string; code_expires_at: string; address_hint: string; send_to: string | null; instructions: string }

/** B7.3 project check-ins: always labelled, reviewed before they are public, never change the project's official status. */
export interface ProjectCheckin { id: string; note: string; visited_at: string; has_photo: boolean; photo_url: string | null; office_response: string | null; responded_at: string | null; created_at: string; label: "citizen_submitted" }

/** B7.5 ideas: for/against points and the support-threshold commitment. `response_state` is computed, never stored. */
export interface IdeaArgument { id: string; side: "for" | "against"; body: string; created_at: string; helpful_count: number }
export type IdeaResponseState = "awaiting_response" | "overdue" | "answered" | "answered_late";
export interface IdeaThresholdFields { support_threshold: number | null; threshold_reached_at: string | null; response_due_at: string | null; responded_at: string | null; response_state: IdeaResponseState | null }

/** B7.6 surveys (rating and fixed-choice questions only) and the public satisfaction summary. */
export interface Survey { ref: string; constituency_key: string; title: string; description: string | null; status: "open" | "closed"; closes_at: string | null; questions?: { id: string; position: number; kind: "rating" | "choice"; prompt: string; options: string[] }[]; is_sample: boolean }
export interface SatisfactionSummary { constituency: string; days: number; ratings: number | null; suppressed: boolean; average: number | null; distribution: Record<string, number> | null; definition: string }

/** B7.7 commitments are the office's own promise (label `office_commitment`); status history is append-only and delivered needs evidence. */
export type CommitmentStatus = "planned" | "in_progress" | "delivered" | "delayed" | "dropped";
export interface Commitment { ref: string; constituency_key: string; title: string; description: string | null; status: CommitmentStatus; due_date: string | null; announcement_ref: string | null; project_ref: string | null; idea_ref: string | null; label: "office_commitment"; history?: { from_status: string | null; to_status: string; note: string | null; evidence_url: string | null; evidence_text: string | null; created_at: string }[] }

/** B7.8 community priorities: NON-BINDING (`label: "non_binding"`), aggregate points only, 5+ participants. */
export interface PriorityResults { ref: string; status: "open" | "closed"; label: "non_binding"; participants: number | null; results_shown: boolean; note: string; items: { id: string; label: string; points: number; first_choice: number }[] | null }

/** B7.9 weekly brief: a draft until a person approves it. */
export interface InsightBrief { id: string; constituency: string; week_start: string; status: "draft" | "approved" | "withdrawn"; payload: Record<string, unknown>; narrative_draft: string | null; narrative: string | null; shared_at: string | null }

/** B7.11 heatmap cells. A cell with fewer than 5 issues is never returned; `cells_hidden` only counts them. */
export interface HeatmapCell { lat: number; lng: number; count: number; top_category: string; previous_period_count: number | null; emerging: boolean }
export interface Heatmap { constituency: string; cells: HeatmapCell[]; cells_hidden: number; min_group_size: 5; cell_size_m: number; period_days: number; category: string | null; definition: string; is_sample: boolean }

/** B7.12 read-aloud configuration. With `available: false` the app uses the browser's speech synthesis (lang bn-BD). */
export interface SpeakConfig { available: boolean; lang: "bn-BD"; max_chars: number; fallback: "browser_speech_synthesis"; note: string }

/** B7.13 Release 1.1 KPIs. */
export interface Release11Kpi { value: number | null; n?: number | null; suppressed?: boolean; definition: string }
export interface Release11Kpis { constituency: string | null; period_days: number; generated_at: string; min_group_size: 5; kpis: Record<"consultation_participants" | "consultation_report_rate" | "idea_threshold_on_time" | "project_checkins" | "priority_participants" | "survey_responses" | "channel_intake_share" | "satisfaction_average" | "area_alerts_sent" | "commitments_delivered", Release11Kpi> }

/** Notification types added in Release 1.1 (B7.13). */
export const RELEASE_1_1_NOTIFICATION_TYPES = ["consultation_opened", "consultation_report", "idea_update", "idea_threshold", "idea_response_due", "area_alert", "checkin_response", "channel_reply", "brief_ready", "channel_cost_alert"] as const;

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Phase 8 (Release 2) contract. Shapes returned by the /api/v1 routes in docs/api-v1.md "Phase 8". Additive: nothing above changes.
// Rules that hold for every shape below: money is only ever quoted from a verified source document; nothing is labelled "officially registered" or
// "binding" without the record that proves it; MP records carry no count, rank or score; small groups (under 5) are hidden.
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** B8.1 budget entries: amounts as stated in a source document checked by a second person. The platform never sums, estimates or compares them. */
export type BudgetDocKind = "annual_budget" | "adp" | "tender_notice" | "work_order" | "expenditure_report" | "audit_report" | "other";
export interface BudgetSource { ref: string; constituency_key: string; title: string; publisher: string; doc_kind: BudgetDocKind; source_url: string; published_on: string | null; fiscal_year: string; doc_sha256: string | null; verified_at: string; is_sample: boolean }
export interface BudgetEntry { id: string; source_ref: string; constituency_key: string; project_ref: string | null; fiscal_year: string; kind: "allocated" | "released" | "spent"; label: string; amount: number; currency: string; source_page: string; source_title: string; source_publisher: string; source_url: string; verified_at: string; is_sample: boolean }

/** B8.2 a signed receipt from an agency system. Every failure is a plain 403. */
export interface AgencyReceiptRequest { integration_id: string; referral_id: string; agency_reference: string; issued_at: string; signature: string }
export interface AgencyIntegrationRow { id: string; agency_id: string; agency: string; kind: "api" | "email_gateway" | "portal"; status: "planned" | "confirmed" | "retired"; has_key: boolean; key_fingerprint: string | null; confirmed_at: string | null; receipts: number }

/** B8.3 assisted reporting. `consent` is stored with the case in the same transaction; the person's identity is not stored. */
export type ConsentMethod = "read_aloud_agreed" | "signed_paper" | "kiosk_screen";
export interface AssistedConsent { method: ConsentMethod; version: string; agreed_to_file: true; agreed_to_publish: true; understands_no_account: true; language: "bn" | "en" }
export interface VolunteerRecord { id: string; status: "pending" | "active" | "rejected" | "suspended" | "withdrawn"; conduct_version: string; created_at: string; decided_at: string | null; constituency: string }
export interface Kiosk { id: string; constituency_key: string; label: string; place_text: string | null }
export interface AssistedReportResult { ref: string; status: string; label: "assisted"; note: string; emergency?: Emergency }

/** B8.4 open data. `hidden_cells` counts the aggregate cells left out because they described fewer than 5 reports. */
export interface OpenDataset { slug: string; title_en: string; title_bn: string; description_en: string; columns: { name: string; type: string }[]; update_frequency: "live" | "daily" | "monthly"; privacy_note: string }
export interface OpenDataLicence { code: string; name: string; url: string; reviewed: boolean }

/** B8.5 regional overview: counts per area inside the caller's scope, no case rows. */
export interface RegionalArea { constituency: string; name_en: string; name_bn: string; is_sample: boolean; open_issues: number; new_30d: number; resolved_30d: number; overdue_first_response: number; active_staff: number; has_mp: boolean }

/** B8.6 participatory budgeting. `pledge` is the office's own public statement; the platform does not verify that an office controls the money. */
export interface PbCycle { ref: string; constituency_key: string; title: string; description: string | null; fiscal_year: string; budget_amount: number; currency: string; pledge: string; max_choices: number; status: "open" | "closed"; closes_at: string; participants: number | null; result_valid: boolean | null; followed_result: boolean | null; deviation_reason: string | null; budget_source_ref: string | null; is_sample: boolean }
export interface PbOption { id: string; position: number; title: string; description: string | null; cost: number; approvals: number | null; funded: boolean | null }

/** B8.7 RTI helper. Self-reported dates; deadlines are an estimate from configuration that counsel has not confirmed unless `reviewed`. */
export type RtiStatus = "draft" | "filed_by_me" | "answered" | "appealed" | "closed";
export interface RtiTimeline { state: "not_filed" | "awaiting_answer" | "due_soon" | "past_earliest_deadline" | "answered" | "appealed" | "closed"; earliest_due_on: string | null; appeal_window_days: number; self_reported: true }
export interface RtiDraft { id: string; agency_id: string | null; agency_name: string; subject: string; info_requested: string; period_text: string | null; preferred_format: "electronic" | "paper_copy" | "inspection"; draft_text: string; status: RtiStatus; filed_on: string | null; filed_channel: "in_person" | "post" | "email" | "official_portal" | null; agency_reference: string | null; answered_on: string | null; created_at: string; timeline: RtiTimeline }

/** B8.8 one sourced record about an MP. There is deliberately no count, rank, rating or score field. */
export type MpRecordKind = "question_asked" | "bill_introduced" | "committee_membership" | "debate_contribution" | "other";
export interface MpRecord { ref: string; representative_id: string; representative_name: string; kind: MpRecordKind; title: string; occurred_on: string; session_label: string | null; source_name: string; source_url: string; source_checked_at: string; summary_bn: string | null; published_at: string; is_sample: boolean }

/** B8.9 Open311 GeoReport v2 request, in the standard's field names. */
export interface Open311Request { service_request_id: string; status: "open" | "closed"; status_notes: null; service_name: string; service_code: string; description: string; agency_responsible: null; service_notice: null; requested_datetime: string; updated_datetime: string; expected_datetime: null; address: null; address_id: null; zipcode: null; lat: number | null; long: number | null; media_url: null }

/** B8.10 second-country readiness: five reviews, each with a document reference and the named reviewer. */
export const COUNTRY_GATES = ["legal_review", "electoral_review", "data_protection_review", "language_review", "hosting_residency"] as const;
export interface CountryReadiness { country: string; home_country: boolean; adapter_configured: boolean; ready: boolean; gates: { gate: (typeof COUNTRY_GATES)[number]; status: "open" | "cleared"; evidence_ref: string | null; reviewer: string | null; cleared_at: string | null }[] }

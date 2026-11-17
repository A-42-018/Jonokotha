import { api } from "@/lib/api-client";
import { normalizeDigits } from "@/lib/digits";
import { readOrPlanned, type OrPlanned } from "@/lib/r11";
import type { AgencyIntegrationRow, AssistedConsent, AssistedReportResult, BudgetDocKind, BudgetEntry, BudgetSource, CountryReadiness, Kiosk, MpRecord, OpenDataLicence, OpenDataset, PbCycle, PbOption, RegionalArea, RtiDraft, VolunteerRecord } from "@/lib/types";

/**
 * Release 2 client (backend Phase 8, `docs/api-v1.md` "Phase 8", migrations 0080-0083). Every route sits behind a server flag; a server that does not have it answers
 * 404 `feature_disabled`, which the screens show as "not switched on", never as a broken page. Nothing here adds up, compares or ranks anything.
 */
const q = encodeURIComponent;
const qs = (o: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};
const list = <T,>(r: OrPlanned<T[]>): OrPlanned<T[]> => (r.kind === "ok" && !Array.isArray(r.data) ? { ...r, data: [] } : r);

// B8.1 Budget ------------------------------------------------------------------------------------------------------------------------------------------
export const DOC_KINDS: readonly BudgetDocKind[] = ["annual_budget", "adp", "tender_notice", "work_order", "expenditure_report", "audit_report", "other"];
export const ENTRY_KINDS = ["allocated", "released", "spent"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];
export const fetchBudgetSources = (constituency: string, fiscal_year?: string) => readOrPlanned<BudgetSource[]>(`/budget/sources${qs({ constituency, fiscal_year })}`).then(list);
export const fetchBudgetEntries = (constituency: string, f: { fiscal_year?: string; kind?: EntryKind; project?: string; source?: string } = {}) => readOrPlanned<BudgetEntry[]>(`/budget/entries${qs({ constituency, ...f })}`).then(list);

export interface OfficeSource { ref: string; constituency: string; title: string; publisher: string; doc_kind: BudgetDocKind; source_url: string; fiscal_year: string; status: "pending" | "verified" | "rejected" | "withdrawn"; verification_note: string | null; created_at: string; entries: number }
export const fetchOfficeSources = () => readOrPlanned<OfficeSource[]>("/office/budget/sources").then(list);
export const fetchAdminSources = () => readOrPlanned<OfficeSource[]>("/admin/budget/sources").then(list);
export interface SourceInput { constituency: string; title: string; publisher: string; doc_kind: BudgetDocKind; source_url: string; fiscal_year: string; published_on?: string; doc_sha256?: string }
export const createSource = (b: SourceInput, key: string) => api<{ ref: string }>("/office/budget/sources", { body: b, idempotencyKey: key }).then((r) => r.data);
export const addEntry = (ref: string, b: { kind: EntryKind; label: string; amount: number; source_page: string; project_ref?: string }, key: string) => api<{ id: string }>(`/office/budget/sources/${q(ref)}/entries`, { body: b, idempotencyKey: key }).then((r) => r.data);
export const withdrawSource = (ref: string, reason: string) => api<unknown>(`/office/budget/sources/${q(ref)}/withdraw`, { body: { reason } });
export const retractEntry = (id: string, reason: string) => api<unknown>(`/office/budget/entries/${q(id)}/retract`, { body: { reason } });
export const verifySource = (ref: string, decision: "verify" | "reject", note?: string) => api<unknown>(`/admin/budget/sources/${q(ref)}/verify`, { body: { decision, ...(note ? { note } : {}) } });

/** A number typed in either digit set; NaN when it is not one. */
export const num = (s: string): number => (s.trim() === "" ? NaN : Number(normalizeDigits(s.trim())));
export const ascii = (s: string) => normalizeDigits(s.trim());
const FY = /^\d{4}-\d{2}$/;
const HTTPS = /^https:\/\/[^\s]+$/;
/** The server's own rules, checked first so a person is told in words before anything is sent. */
export function sourceProblem(s: { title: string; publisher: string; source_url: string; fiscal_year: string; doc_sha256?: string }): "title" | "publisher" | "url" | "year" | "hash" | null {
  if (s.title.trim().length < 5 || s.title.trim().length > 200) return "title";
  if (s.publisher.trim().length < 2) return "publisher";
  if (!HTTPS.test(s.source_url.trim())) return "url";
  if (!FY.test(ascii(s.fiscal_year))) return "year";
  if (s.doc_sha256 && !/^[a-f0-9]{64}$/i.test(s.doc_sha256.trim())) return "hash";
  return null;
}
export function entryProblem(e: { label: string; amount: string; source_page: string }): "label" | "amount" | "page" | null {
  if (e.label.trim().length < 3 || e.label.trim().length > 150) return "label";
  const n = num(e.amount);
  if (!Number.isFinite(n) || n < 0) return "amount";
  if (!e.source_page.trim()) return "page";
  return null;
}
/** Money exactly as quoted, with the grouping of the page's language; never rounded to a different unit. */
export function money(n: number, currency: string, lang: "bn" | "en"): string {
  const sym = currency === "BDT" ? "৳" : currency;
  const digits = lang === "bn" ? "beng" : "latn";
  return `${sym} ${n.toLocaleString(lang === "bn" ? "bn-BD" : "en-BD", { numberingSystem: digits, maximumFractionDigits: 2 } as Intl.NumberFormatOptions)}`;
}

// B8.3 Assisted reporting -----------------------------------------------------------------------------------------------------------------------------
export interface VolunteerRules { reviewed: boolean; conduct_version: string; consent_version: string; conduct: { bn: string[]; en: string[] }; consent: { bn: string; en: string } }
export const fetchVolunteerRules = () => readOrPlanned<VolunteerRules>("/volunteers/rules");
export const fetchMyVolunteer = () => readOrPlanned<VolunteerRecord[]>("/volunteers/me").then(list);
export const applyVolunteer = (constituency: string, conduct_version: string) => api<unknown>("/volunteers/apply", { body: { constituency, accept_conduct: true, conduct_version } });
export const withdrawVolunteer = (id: string) => api<unknown>(`/volunteers/${q(id)}/withdraw`, { body: {} });
export const fetchKiosks = (constituency: string) => readOrPlanned<Kiosk[]>(`/kiosks${qs({ constituency })}`).then(list);
export interface AssistedReportInput { constituency: string; kiosk_id?: string; consent: AssistedConsent; title: string; category: string; description: string; area?: string }
export const submitAssisted = (b: AssistedReportInput, key: string) => api<AssistedReportResult>("/volunteer/reports", { body: b, idempotencyKey: key }).then((r) => r.data);
export interface AssistedRow { ref: string; status: string; category: string; created_at: string; consent_method: string; kiosk_id: string | null }
export const fetchMyAssisted = () => readOrPlanned<AssistedRow[]>("/volunteer/reports").then(list);
export interface OfficeVolunteers { volunteers: { id: string; status: VolunteerRecord["status"]; conduct_version: string; applied_at: string; decided_at: string | null; reports_30d: number }[]; kiosks: (Kiosk & { status?: string })[] }
export const fetchOfficeVolunteers = (constituency: string) => readOrPlanned<OfficeVolunteers>(`/office/volunteers${qs({ constituency })}`);
export const decideVolunteer = (id: string, decision: "approve" | "reject" | "suspend" | "reinstate", note?: string) => api<unknown>(`/office/volunteers/${q(id)}/decision`, { body: { decision, ...(note ? { note } : {}) } });
export const createKiosk = (b: { constituency: string; label: string; place_text?: string }) => api<unknown>("/office/kiosks", { body: b });
export const retireKiosk = (id: string) => api<unknown>(`/office/kiosks/${q(id)}/retire`, { body: {} });
export function assistedProblem(f: { title: string; description: string; category: string }, c: { file: boolean; publish: boolean; noAccount: boolean }): "title" | "description" | "category" | "consent" | null {
  if (f.title.trim().length < 5) return "title";
  if (f.description.trim().length < 20) return "description";
  if (!f.category) return "category";
  if (!c.file || !c.publish || !c.noAccount) return "consent";
  return null;
}

// B8.4 Open data --------------------------------------------------------------------------------------------------------------------------------------
export interface OpenDataCatalogue { datasets: OpenDataset[]; licence: OpenDataLicence | null; attribution: string; min_group_size: number; formats: string[] }
export const fetchOpenData = () => readOrPlanned<OpenDataCatalogue>("/open-data");
export interface DatasetBody { dataset: string; licence: OpenDataLicence | null; generated_at: string; privacy_note: string; hidden_cells: number; row_count: number; rows: Record<string, string | number | null>[] }
export const fetchDataset = (slug: string, constituency?: string) => readOrPlanned<DatasetBody>(`/open-data/${q(slug)}${qs({ format: "json", constituency })}`);
export const datasetUrl = (slug: string, format: "csv" | "json", constituency?: string) => `/api/v1/open-data/${q(slug)}${qs({ format, constituency })}`;

// B8.5 Regional ---------------------------------------------------------------------------------------------------------------------------------------
export interface RegionalUnit { code: string; level: string; name_en: string; name_bn: string }
export const fetchMyRegions = () => readOrPlanned<RegionalUnit[]>("/office/regions/mine").then(list);
export const fetchRegionOverview = (unit?: string) => readOrPlanned<RegionalArea[]>(`/office/regions/overview${qs({ unit })}`).then(list);
export interface RegionalAdminRow { id: string; user_id: string; unit_code: string; level: string; unit_name_en: string; status: string; created_at: string }
export const fetchRegionalAdmins = () => readOrPlanned<RegionalAdminRow[]>("/admin/regional-admins").then(list);
export const grantRegionalAdmin = (b: { user_id: string; unit_code: string; level: string; note?: string }) => api<unknown>("/admin/regional-admins", { body: b });
export const revokeRegionalAdmin = (id: string) => api<unknown>(`/admin/regional-admins/${q(id)}/revoke`, { body: {} });

// B8.6 Participatory budgeting -------------------------------------------------------------------------------------------------------------------------
export interface PbFull extends PbCycle { options: PbOption[]; my_ballot: { option_ids: string[]; submitted_at: string } | null }
export const fetchPbList = (constituency: string) => readOrPlanned<PbCycle[]>(`/participatory-budgets${qs({ constituency })}`).then(list);
export const fetchPb = (ref: string) => api<PbFull>(`/participatory-budgets/${q(ref)}`).then((r) => ({ ...r.data, options: Array.isArray(r.data.options) ? r.data.options : [] }));
export const submitBallot = (ref: string, option_ids: string[]) => api<unknown>(`/participatory-budgets/${q(ref)}/ballot`, { method: "PUT", body: { option_ids } });
export interface OfficePb { ref: string; constituency: string; title: string; status: string; closes_at: string; outcome_recorded: boolean }
export interface OfficePbView extends Omit<OfficePb, "title"> { title: string; fiscal_year: string; budget_amount: number; pledge: string; participants: number; result_valid: boolean | null; followed_result: boolean | null; options: PbOption[] }
export const fetchOfficePbs = () => readOrPlanned<OfficePb[]>("/office/participatory-budgets").then(list);
export const fetchOfficePb = (ref: string) => api<OfficePbView>(`/office/participatory-budgets/${q(ref)}`).then((r) => r.data);
export interface PbInput { constituency: string; budget_source_ref: string; title: string; description?: string; budget_amount: number; pledge: string; max_choices: number; closes_at: string; options: { title: string; description?: string; cost: number }[] }
export const createPb = (b: PbInput, key: string) => api<{ ref: string }>("/office/participatory-budgets", { body: b, idempotencyKey: key }).then((r) => r.data);
export const pbAct = (ref: string, action: "request-open" | "decision" | "close" | "outcome" | "cancel", body: Record<string, unknown> = {}) => api<unknown>(`/office/participatory-budgets/${q(ref)}/${action}`, { body });
/** The server's rule: options must cost at least half the budget in total. Shown before sending. */
export function pbProblem(b: { title: string; budget: number; pledge: string; maxChoices: number; options: { title: string; cost: number }[] }): "title" | "budget" | "pledge" | "options" | "cost" | "choices" | null {
  if (b.title.trim().length < 5) return "title";
  if (!(b.budget > 0)) return "budget";
  if (b.pledge.trim().length < 20 || b.pledge.trim().length > 1000) return "pledge";
  const o = b.options.filter((x) => x.title.trim());
  if (o.length < 2 || o.length > 30 || o.some((x) => !(x.cost >= 0))) return "options";
  if (o.reduce((s, x) => s + x.cost, 0) < b.budget / 2) return "cost";
  if (b.maxChoices < 1 || b.maxChoices > Math.min(10, o.length)) return "choices";
  return null;
}

// B8.7 RTI helper -------------------------------------------------------------------------------------------------------------------------------------
export interface RtiGuide { reviewed: boolean; we_never_file: true; steps_bn: string[]; steps_en: string[]; respond_working_days: number; respond_working_days_multiple_units: number; appeal_days_after_decision: number; official_channels: { name?: string; name_bn?: string; name_en?: string; url?: string; verified?: boolean }[]; note: string }
export const fetchRtiGuide = () => readOrPlanned<RtiGuide>("/rti/guide");
export const fetchRtiDrafts = () => readOrPlanned<RtiDraft[]>("/rti/drafts").then(list);
export interface RtiInput { agency_name: string; subject: string; info_requested: string; period?: string; format: RtiDraft["preferred_format"]; language: "bn" | "en" }
export const createRti = (b: RtiInput, key: string) => api<{ id: string; draft_text: string; personal_data_removed: boolean; next: string }>("/rti/drafts", { body: b, idempotencyKey: key }).then((r) => r.data);
export const patchRti = (id: string, b: { action: "mark_filed" | "mark_answered" | "mark_appealed" | "close"; on?: string; channel?: string; agency_reference?: string }) => api<unknown>(`/rti/drafts/${q(id)}`, { method: "PATCH", body: b });
export const deleteRti = (id: string) => api<unknown>(`/rti/drafts/${q(id)}`, { method: "DELETE" });
export function rtiProblem(f: { agency: string; subject: string; info: string }): "agency" | "subject" | "info" | null {
  if (f.agency.trim().length < 2) return "agency";
  if (f.subject.trim().length < 5) return "subject";
  if (f.info.trim().length < 20) return "info";
  return null;
}

// B8.8 MP records -------------------------------------------------------------------------------------------------------------------------------------
export const MP_KINDS = ["question_asked", "bill_introduced", "committee_membership", "debate_contribution", "other"] as const;
export interface MpRecordList { records: MpRecord[]; note: string }
/** Only `representative_id` and `kind` are accepted; the server refuses anything else (no sort, no rank). */
export const fetchMpRecords = (f: { representative_id?: string; kind?: string } = {}) => readOrPlanned<MpRecordList>(`/mp-records${qs(f)}`);
export interface AdminMpRecord { ref: string; representative_id: string; kind: string; title: string; occurred_on: string; status: string; source_url: string; has_excerpt: boolean; summary_draft: string | null; summary_bn: string | null; created_by_me: boolean }
export const fetchAdminMpRecords = () => readOrPlanned<AdminMpRecord[]>("/admin/mp-records").then(list);
export interface MpRecordInput { representative_id: string; kind: string; title: string; occurred_on: string; session_label?: string; source_name: string; source_url: string; source_checked_at: string; excerpt?: string }
export const createMpRecord = (b: MpRecordInput, key: string) => api<{ ref: string }>("/admin/mp-records", { body: b, idempotencyKey: key }).then((r) => r.data);
export const draftMpSummary = (ref: string) => api<{ summary_draft: string | null; ai_summary_source: string }>(`/admin/mp-records/${q(ref)}/summary`, { body: {} }).then((r) => r.data);
export const publishMpRecord = (ref: string, summary_bn: string, from_draft: boolean) => api<unknown>(`/admin/mp-records/${q(ref)}/publish`, { body: { summary_bn, from_draft } });
export const withdrawMpRecord = (ref: string, reason: string) => api<unknown>(`/admin/mp-records/${q(ref)}/withdraw`, { body: { reason } });

// B8.10 Country readiness -----------------------------------------------------------------------------------------------------------------------------
export const fetchReadiness = (code: string) => readOrPlanned<CountryReadiness>(`/admin/countries/${q(code)}/readiness`);
export const setGate = (code: string, gate: string, b: { status: "open" | "cleared"; evidence_ref?: string; reviewer?: string; note?: string }) => api<unknown>(`/admin/countries/${q(code)}/gates/${q(gate)}`, { method: "PUT", body: b });

// B8.2 Agency integrations ----------------------------------------------------------------------------------------------------------------------------
export const fetchIntegrations = () => readOrPlanned<AgencyIntegrationRow[]>("/admin/agency-integrations").then(list);
export const setIntegrationKey = (id: string, public_key_pem: string) => api<unknown>(`/admin/agency-integrations/${q(id)}/key`, { method: "PUT", body: { public_key_pem } });
export const looksLikePublicKey = (s: string) => /^-----BEGIN PUBLIC KEY-----[\s\S]+-----END PUBLIC KEY-----\s*$/.test(s.trim()) && !/PRIVATE/i.test(s);

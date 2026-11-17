import type { Page, Route } from "@playwright/test";

/** Fixtures and the browser-side API mock for the Release 2 screens (used by release2.spec.ts). */
const ok = (data: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify({ data }) });
const none = { status: 404, contentType: "application/json", body: JSON.stringify({ code: "not_found" }) };
const past = new Date(Date.now() - 3 * 86_400_000).toISOString(), soon = new Date(Date.now() + 20 * 86_400_000).toISOString();

const source = { ref: "BS-DEMO", constituency_key: "demo-1", title: "বার্ষিক উন্নয়ন কর্মসূচি ২০২৬-২৭", publisher: "স্থানীয় সরকার বিভাগ", doc_kind: "adp", source_url: "https://example.gov.bd/adp.pdf", published_on: null, fiscal_year: "2026-27", doc_sha256: null, verified_at: past, is_sample: true };
const entries = [
  { id: "e1", source_ref: "BS-DEMO", constituency_key: "demo-1", project_ref: "PR-DEMO", fiscal_year: "2026-27", kind: "allocated", label: "সেতু মেরামত", amount: 2500000, currency: "BDT", source_page: "14", source_title: source.title, source_publisher: source.publisher, source_url: source.source_url, verified_at: past, is_sample: true },
  { id: "e2", source_ref: "BS-DEMO", constituency_key: "demo-1", project_ref: "PR-DEMO", fiscal_year: "2026-27", kind: "spent", label: "সেতু মেরামত", amount: 900000, currency: "BDT", source_page: "31", source_title: source.title, source_publisher: source.publisher, source_url: source.source_url, verified_at: past, is_sample: true },
];
const pb = { ref: "PB-DEMO", constituency_key: "demo-1", title: "পাড়ার উন্নয়ন তহবিল", description: "পাড়ার ছোট কাজে খরচ করার জন্য।", fiscal_year: "2026-27", budget_amount: 500000, currency: "BDT", pledge: "আমরা ভোটের ফল অনুযায়ী কাজ করব এবং না করলে কারণ জানাব।", max_choices: 2, status: "open", closes_at: soon, participants: null, result_valid: null, followed_result: null, deviation_reason: null, budget_source_ref: "BS-DEMO", is_sample: true };
const record = { ref: "MR-DEMO", representative_id: "11111111-1111-4111-8111-111111111111", representative_name: "নমুনা সদস্য", kind: "question_asked", title: "সড়ক মেরামত নিয়ে প্রশ্ন", occurred_on: "2026-10-05", session_label: "২২তম অধিবেশন", source_name: "জাতীয় সংসদ সচিবালয়", source_url: "https://example.gov.bd/q.pdf", source_checked_at: "2026-11-01", summary_bn: "সড়ক মেরামতের অবস্থা সম্পর্কে একটি প্রশ্ন করা হয়েছে।", published_at: past, is_sample: true };

export async function mock(page: Page) {
  await page.route("**/api/v1/**", (r: Route) => {
    const u = new URL(r.request().url());
    const p = u.pathname.replace("/api/v1", "");
    if (r.request().method() !== "GET") return r.fulfill(none);
    const j = (d: unknown) => r.fulfill(ok(d));
    if (p === "/budget/sources") return j([source]);
    if (p === "/budget/entries") return j(u.searchParams.get("project") ? entries.filter((e) => e.project_ref === u.searchParams.get("project")) : entries);
    if (p === "/participatory-budgets") return j([pb]);
    if (p === "/participatory-budgets/PB-DEMO") return j({ ...pb, my_ballot: null, options: [{ id: "o1", position: 1, title: "সোলার বাতি", description: null, cost: 200000, approvals: null, funded: null }, { id: "o2", position: 2, title: "নালা পরিষ্কার", description: null, cost: 250000, approvals: null, funded: null }] });
    if (p === "/open-data") return j({ datasets: [{ slug: "issues-monthly", title_en: "Reports by month", title_bn: "মাসওয়ারি রিপোর্ট", description_en: "Number of public reports per month and category.", columns: [{ name: "month", type: "text" }, { name: "reports", type: "number" }], update_frequency: "monthly", privacy_note: "Cells under 5 are left out." }], licence: { code: "CC-BY-4.0", name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/", reviewed: false }, attribution: "x", min_group_size: 5, formats: ["json", "csv"] });
    if (p === "/open-data/issues-monthly") return j({ dataset: "issues-monthly", licence: { code: "CC-BY-4.0", name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/", reviewed: false }, generated_at: past, privacy_note: "Cells under 5 are left out.", hidden_cells: 3, row_count: 2, rows: [{ month: "2026-09", reports: 12 }, { month: "2026-10", reports: 9 }] });
    if (p === "/rti/guide") return j({ reviewed: false, we_never_file: true, steps_bn: ["আপনি কোন তথ্য চান তা লিখুন।", "খসড়া কপি করে নিজে জমা দিন।"], steps_en: ["Describe what you want."], respond_working_days: 20, respond_working_days_multiple_units: 30, appeal_days_after_decision: 30, official_channels: [{ name_bn: "তথ্য কমিশন", name_en: "Information Commission", url: "https://example.gov.bd/ic", verified: false }], note: "n" });
    if (p === "/mp-records") return j({ note: "n", records: [record] });
    if (p === "/volunteers/rules") return j({ reviewed: false, conduct_version: "v1-draft", consent_version: "v1-draft", conduct: { bn: ["আমি শুধু ব্যক্তির সম্মতি নিয়ে রিপোর্ট লিখব।"], en: ["I will file only with consent."] }, consent: { bn: "আমি বুঝেছি এবং সম্মত।", en: "I understand and agree." } });
    if (p === "/features") return j([]);
    return r.fulfill(none);
  });
}

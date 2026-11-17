import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MpRecords } from "@/components/r2/MpRecords";
import { OpenDataList } from "@/components/r2/OpenData";
import { PbDetail } from "@/components/r2/Pb";
import BudgetPublic from "@/components/r2/BudgetPublic";
import ReferralStatus from "@/components/issue/ReferralStatus";
import Rti from "@/components/r2/Rti";
import { VolunteerHub } from "@/components/r2/Assisted";
import { RegionOverview } from "@/components/r2/Regional";
import { assistedProblem, entryProblem, looksLikePublicKey, MP_KINDS, money, pbProblem, rtiProblem, sourceProblem } from "@/lib/r2-api";
import { dict } from "@/lib/i18n";
import { json, stub } from "./helpers-r11";

afterEach(() => { vi.unstubAllGlobals(); });

describe("Release 2 rules shown before sending (F8.*)", () => {
  it("budget source and entry rules match the server's", () => {
    const ok = { title: "বার্ষিক বাজেট", publisher: "এলজিডি", source_url: "https://x.gov.bd/a.pdf", fiscal_year: "2026-27" };
    expect(sourceProblem(ok)).toBeNull();
    expect(sourceProblem({ ...ok, source_url: "http://x" })).toBe("url");
    expect(sourceProblem({ ...ok, fiscal_year: "2026" })).toBe("year");
    expect(sourceProblem({ ...ok, doc_sha256: "abc" })).toBe("hash");
    expect(sourceProblem({ ...ok, publisher: "EC" })).toBe("publisher");
    expect(entryProblem({ label: "রাস্তা", amount: "0", source_page: "4" })).toBeNull();
    expect(entryProblem({ label: "রাস্তা", amount: "-1", source_page: "4" })).toBe("amount");
    expect(entryProblem({ label: "রাস্তা", amount: "5", source_page: " " })).toBe("page");
  });
  it("money is written as quoted, in the page's digits", () => {
    expect(money(1500000, "BDT", "en")).toContain("৳");
    expect(money(1500000, "BDT", "bn")).toMatch(/[০-৯]/);
  });
  it("participatory budget: options must cost at least half the budget", () => {
    const base = { title: "বাজেট চক্র", budget: 100, pledge: "আমরা ফল মানব, এটি আমাদের প্রকাশ্য প্রতিশ্রুতি।", maxChoices: 2, options: [{ title: "রাস্তা", cost: 30 }, { title: "সেতু", cost: 30 }] };
    expect(pbProblem(base)).toBeNull();
    expect(pbProblem({ ...base, options: [{ title: "রাস্তা", cost: 10 }, { title: "সেতু", cost: 10 }] })).toBe("cost");
    expect(pbProblem({ ...base, options: [{ title: "রাস্তা", cost: 60 }] })).toBe("options");
    expect(pbProblem({ ...base, maxChoices: 3 })).toBe("choices");
    // The server's own limits: option title at least 3 characters, cost above zero, a whole number of choices.
    expect(pbProblem({ ...base, options: [{ title: "ক", cost: 30 }, { title: "সেতু", cost: 30 }] })).toBe("options");
    expect(pbProblem({ ...base, options: [{ title: "রাস্তা", cost: 0 }, { title: "সেতু", cost: 60 }] })).toBe("options");
    expect(pbProblem({ ...base, maxChoices: NaN })).toBe("choices");
  });
  it("assisted report needs all three agreements; RTI needs an agency and a real request; keys must be public", () => {
    const f = { title: "বাতি নেই", description: "রাস্তায় রাতে বাতি জ্বলে না, অনেকদিন ধরে।", category: "roads" };
    expect(assistedProblem(f, { file: true, publish: true, noAccount: true })).toBeNull();
    expect(assistedProblem(f, { file: true, publish: false, noAccount: true })).toBe("consent");
    expect(rtiProblem({ agency: "", subject: "বিষয় ঠিক আছে", info: "x".repeat(20) })).toBe("agency");
    expect(looksLikePublicKey("-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----")).toBe(true);
    expect(looksLikePublicKey("-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----")).toBe(false);
  });
  it("the MP record kinds contain no attendance, and there is no count, rank or score field in the record shape", () => {
    expect(MP_KINDS).not.toContain("attendance");
    const fields = ["count", "rank", "score", "rating"];
    const sample = { ref: "", representative_id: "", representative_name: "", kind: "other", title: "", occurred_on: "", session_label: null, source_name: "", source_url: "", source_checked_at: "", summary_bn: null, published_at: "", is_sample: false };
    for (const k of Object.keys(sample)) expect(fields.some((f) => k.includes(f)), k).toBe(false);
  });
});

const src = { ref: "BS-1", constituency_key: "demo-1", title: "বার্ষিক বাজেট ২০২৬-২৭", publisher: "এলজিডি", doc_kind: "annual_budget", source_url: "https://x.gov.bd/a.pdf", published_on: null, fiscal_year: "2026-27", doc_sha256: null, verified_at: "2026-11-01T00:00:00Z", is_sample: false };
const entry = { id: "e1", source_ref: "BS-1", constituency_key: "demo-1", project_ref: null, fiscal_year: "2026-27", kind: "allocated", label: "রাস্তা মেরামত", amount: 1500000, currency: "BDT", source_page: "12", source_title: "বার্ষিক বাজেট ২০২৬-২৭", source_publisher: "এলজিডি", source_url: "https://x.gov.bd/a.pdf", verified_at: "2026-11-01T00:00:00Z", is_sample: false };

describe("budget pages (F8.1)", () => {
  it("each figure names its document, page and link, and nothing is summed", async () => {
    stub({ "GET /budget/sources": () => json(200, { data: [src] }), "GET /budget/entries": () => json(200, { data: [entry, { ...entry, id: "e2", kind: "spent", amount: 200000 }] }) });
    render(<BudgetPublic constituency="demo-1" />);
    expect(await screen.findAllByText("রাস্তা মেরামত")).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "বার্ষিক বাজেট ২০২৬-২৭" })[0]).toHaveAttribute("href", "https://x.gov.bd/a.pdf");
    expect(screen.getAllByText(/পৃষ্ঠা ১২/).length).toBeGreaterThan(0);
    expect(screen.getByText(/কোনো অঙ্ক যোগ, অনুমান বা তুলনা করে না/)).toBeInTheDocument();
    expect(screen.queryByText(/মোট/)).toBeNull();
  });
  it("says 'not switched on' when the server has no route", async () => {
    stub({});
    render(<BudgetPublic constituency="demo-1" />);
    expect(await screen.findByText("এই পাতা এখনো চালু হয়নি")).toBeInTheDocument();
  });
});

describe("regional overview (F8.5)", () => {
  const area = { constituency: "bd-017", name_en: "Dhaka-1", name_bn: "ঢাকা-১", is_sample: false, open_issues: 7, new_30d: 3, resolved_30d: 2, overdue_first_response: 1, active_staff: 4, has_mp: true };
  it("reads the areas out of the server's { areas, definition } answer", async () => {
    stub({ "GET /office/regions/mine": () => json(200, { data: [{ code: "D1", level: "district", name_en: "Dhaka", name_bn: "ঢাকা" }] }), "GET /office/regions/overview": () => json(200, { data: { areas: [area], definition: "Counts per area." } }) });
    render(<RegionOverview />);
    expect((await screen.findAllByText("ঢাকা-১")).length).toBeGreaterThan(0);
  });
  it("does not ask for counts when the account has no region", async () => {
    const seen: string[] = [];
    stub({ "GET /office/regions/mine": () => json(200, { data: [] }), "GET /office/regions/overview": () => { seen.push("overview"); return json(403, { error: { code: "forbidden" } }); } });
    render(<RegionOverview />);
    await waitFor(() => expect(screen.getAllByText(/./).length).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 50));
    expect(seen).toEqual([]);
  });
});

describe("participatory budgeting (F8.6)", () => {
  const cycle = (over: object = {}) => ({ ref: "PB-1", constituency_key: "demo-1", title: "পাড়ার বাজেট", description: null, fiscal_year: "2026-27", budget_amount: 100000, currency: "BDT", pledge: "আমরা ফল মানব, এটি আমাদের প্রকাশ্য প্রতিশ্রুতি।", max_choices: 2, status: "open", closes_at: "2026-12-30T10:00:00Z", participants: null, result_valid: null, followed_result: null, deviation_reason: null, budget_source_ref: "BS-1", is_sample: false, options: [{ id: "o1", position: 1, title: "বাতি", description: null, cost: 40000, approvals: null, funded: null }, { id: "o2", position: 2, title: "নালা", description: null, cost: 50000, approvals: null, funded: null }], my_ballot: null, ...over });
  it("is labelled advisory, states the pledge as the office's own, and sends the chosen options", async () => {
    const calls = stub({ "GET /participatory-budgets/PB-1": () => json(200, { data: cycle() }), "PUT /participatory-budgets/PB-1/ballot": () => json(200, { data: {} }) });
    render(<PbDetail refId="PB-1" signedIn />);
    expect(await screen.findByText("অফিস ফল মানার কথা লিপিবদ্ধ না করা পর্যন্ত এটি শুধু পরামর্শ।")).toBeInTheDocument();
    expect(screen.getByText(/জনকথা যাচাই করে না যে অফিস সত্যিই বাজেট নিয়ন্ত্রণ করে/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "আমার ভোট জমা দিন" }));
    expect(await screen.findByText("অন্তত একটি বাছুন।")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/বাতি/));
    await userEvent.click(screen.getByRole("button", { name: "আমার ভোট জমা দিন" }));
    await waitFor(() => expect(calls.find((c) => c.key === "PUT /participatory-budgets/PB-1/ballot")?.body).toEqual({ option_ids: ["o1"] }));
  });
  it("shows no counts when fewer than 5 voted, and the office's reason when it did not follow", async () => {
    stub({ "GET /participatory-budgets/PB-1": () => json(200, { data: cycle({ status: "closed", result_valid: false, followed_result: false, deviation_reason: "টাকা অন্য কাজে লেগেছে", participants: null }) }) });
    render(<PbDetail refId="PB-1" signedIn={false} />);
    expect(await screen.findByText(/৫ জনের কম ভোট পড়েছে/)).toBeInTheDocument();
    expect(screen.getByText(/টাকা অন্য কাজে লেগেছে/)).toBeInTheDocument();
    expect(screen.queryByText(/সমর্থন:/)).toBeNull();
  });
});

describe("open data (F8.4)", () => {
  it("shows the licence as provisional until reviewed, the credit line and the 5-report rule", async () => {
    stub({ "GET /open-data": () => json(200, { data: { datasets: [{ slug: "issues-monthly", title_en: "Issues by month", title_bn: "মাসওয়ারি রিপোর্ট", description_en: "Counts", columns: [], update_frequency: "monthly", privacy_note: "x" }], licence: { code: "CC-BY-4.0", name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/", reviewed: false }, attribution: "x", min_group_size: 5, formats: ["json", "csv"] } }) });
    render(<OpenDataList />);
    expect(await screen.findByText(/আইনজীবী যাচাই করেননি/)).toBeInTheDocument();
    expect(screen.getByText(/৫টির কম রিপোর্টের তথ্য/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CC BY 4.0" })).toHaveAttribute("href", "https://creativecommons.org/licenses/by/4.0/");
  });
});

describe("MP records (F8.8)", () => {
  it("shows sourced events with no count, rank or sort control", async () => {
    stub({ "GET /mp-records": () => json(200, { data: { note: "n", records: [{ ref: "MR-1", representative_id: "r", representative_name: "নাম", kind: "question_asked", title: "সড়ক নিয়ে প্রশ্ন", occurred_on: "2026-10-01", session_label: null, source_name: "সংসদ সচিবালয়", source_url: "https://parliament.gov.bd/x", source_checked_at: "2026-11-01", summary_bn: "সড়ক মেরামত নিয়ে প্রশ্ন করা হয়েছে।", published_at: "2026-11-02", is_sample: false }] } }) });
    render(<MpRecords />);
    expect(await screen.findByText("সড়ক নিয়ে প্রশ্ন")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "সংসদের নথি খুলুন" })).toHaveAttribute("href", "https://parliament.gov.bd/x");
    expect(screen.getByText(/কোনো গুনতি, র‍্যাঙ্ক, রেটিং বা নম্বর নেই/)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /ক্রম|sort/i })).toBeNull();
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
  });
});

describe("RTI helper (F8.7)", () => {
  it("says it never files anything and shows the draft with its blanks", async () => {
    const calls = stub({
      "GET /rti/guide": () => json(200, { data: { reviewed: false, we_never_file: true, steps_bn: ["এক"], steps_en: ["one"], respond_working_days: 20, respond_working_days_multiple_units: 30, appeal_days_after_decision: 30, official_channels: [], note: "n" } }),
      "GET /rti/drafts": () => json(200, { data: [] }),
      "POST /rti/drafts": () => json(201, { data: { id: "d1", status: "draft", draft_text: "প্রতি, [আপনার নাম]", personal_data_removed: true, next: "n" } }),
    });
    render(<Rti signedIn />);
    expect(await screen.findByText(/জনকথা আপনার হয়ে কিছু জমা দেয় না/)).toBeInTheDocument();
    expect(screen.getByText(/আইনজীবী যাচাই করেননি/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/কোন সংস্থার কাছে/), "স্থানীয় সরকার বিভাগ");
    await userEvent.type(screen.getByLabelText(/বিষয় \(/), "সড়ক বাজেটের তথ্য");
    await userEvent.type(screen.getByLabelText(/কী তথ্য চান/), "গত অর্থবছরে এই সড়কের জন্য কত টাকা ছাড় হয়েছে তার তালিকা");
    await userEvent.click(screen.getByRole("button", { name: "খসড়া তৈরি করুন" }));
    expect(await screen.findByText(/\[আপনার নাম\]/)).toBeInTheDocument();
    expect(screen.getByText("জনকথা কিছু পাঠায়নি, জমা দেয়নি।")).toBeInTheDocument();
    expect(screen.getByText(/ব্যক্তিগত তথ্যের মতো কিছু ছিল/)).toBeInTheDocument();
    expect(calls.find((c) => c.key === "POST /rti/drafts")?.body).toMatchObject({ agency_name: "স্থানীয় সরকার বিভাগ", format: "electronic" });
  });
});

describe("assisted reporting (F8.3)", () => {
  const rules = { reviewed: false, conduct_version: "v1-draft", consent_version: "v1-draft", conduct: { bn: ["নিয়ম ১"], en: ["rule 1"] }, consent: { bn: "আমি সম্মত", en: "I agree" } };
  it("an applicant sees the code of conduct, the draft warning, and cannot apply without accepting", async () => {
    const calls = stub({ "GET /volunteers/rules": () => json(200, { data: rules }), "GET /volunteers/me": () => json(200, { data: [] }), "POST /volunteers/apply": () => json(201, { data: {} }) });
    render(<VolunteerHub constituency="demo-1" signedIn />);
    expect(await screen.findByText("নিয়ম ১")).toBeInTheDocument();
    expect(screen.getByText(/খসড়া/)).toBeInTheDocument();
    const apply = screen.getByRole("button", { name: "স্বেচ্ছাসেবক হতে আবেদন" });
    expect(apply).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(apply);
    await waitFor(() => expect(calls.find((c) => c.key === "POST /volunteers/apply")?.body).toEqual({ constituency: "demo-1", accept_conduct: true, conduct_version: "v1-draft" }));
  });
  it("an approved volunteer gets the consent step and the kiosk mode; a pending one gets no form", async () => {
    stub({ "GET /volunteers/rules": () => json(200, { data: rules }), "GET /volunteers/me": () => json(200, { data: [{ id: "v1", status: "pending", conduct_version: "v1-draft", created_at: "2026-11-01T00:00:00Z", decided_at: null, constituency: "demo-1" }] }) });
    render(<VolunteerHub constituency="demo-1" signedIn />);
    expect(await screen.findByText(/অনুমোদিত স্বেচ্ছাসেবক নন/)).toBeInTheDocument();
    expect(screen.queryByText("ব্যক্তির সম্মতি")).toBeNull();
    vi.unstubAllGlobals();
    stub({ "GET /volunteers/rules": () => json(200, { data: rules }), "GET /volunteers/me": () => json(200, { data: [{ id: "v1", status: "active", conduct_version: "v1-draft", created_at: "2026-11-01T00:00:00Z", decided_at: null, constituency: "demo-1" }] }), "GET /kiosks": () => json(200, { data: [] }), "GET /volunteer/reports": () => json(200, { data: [] }) });
    render(<VolunteerHub constituency="demo-1" signedIn />);
    expect(await screen.findByText("ব্যক্তির সম্মতি")).toBeInTheDocument();
    expect(screen.getByText(/কিয়স্ক মোড/)).toBeInTheDocument();
  });
});

describe("referral proof (F8.2)", () => {
  it("shows 'officially registered' only with the proof, plus the agency's own number and a note when there is no link", () => {
    const t = dict.bn;
    const tl = [{ status: "referred" as const }];
    const { rerender } = render(<ReferralStatus timeline={tl} referral={{ agency_name: "বিদ্যুৎ বিভাগ", office_reference: "OF-1", forwarded_at: "2026-11-01T00:00:00Z" }} t={t} lang="bn" />);
    expect(screen.queryByText(t.r2RfNoLink)).toBeNull();
    rerender(<ReferralStatus timeline={tl} referral={{ agency_name: "বিদ্যুৎ বিভাগ", office_reference: "OF-1", forwarded_at: "2026-11-01T00:00:00Z", registered: { at: "2026-11-02T00:00:00Z", proof_url: null, proof_text: "Signed receipt", agency_reference: "AG-77" } }} t={t} lang="bn" />);
    expect(screen.getByText("AG-77")).toBeInTheDocument();
    expect(screen.getByText(t.r2RfSigned)).toBeInTheDocument();
    expect(screen.getByText(t.r2RfNoLink)).toBeInTheDocument();
  });
});

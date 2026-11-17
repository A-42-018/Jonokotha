import type { Page, Route } from "@playwright/test";

/** Fixtures and the browser-side API mock for the Release 1.1 screens (used by release11.spec.ts). */
const ok = (data: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify({ data }) });
const none = { status: 404, contentType: "application/json", body: JSON.stringify({ code: "not_found" }) };
const past = new Date(Date.now() - 3 * 86_400_000).toISOString(), soon = new Date(Date.now() + 5 * 86_400_000).toISOString();

const consultation = { ref: "CN-DEMO", constituency_key: "demo-1", question: "এই ওয়ার্ডে আগে কোন কাজ দরকার?", description: "রাস্তা, বাতি আর নালা নিয়ে আপনার মত জানান।", status: "open", closes_at: soon, statement_count: 3, participant_count: null, is_sample: true };
const report = {
  consultation_ref: "CN-DEMO", participants: 14, hidden_groups: 1, summary_bn: "রাস্তা মেরামত নিয়ে বেশির ভাগ মানুষ একমত হয়েছেন।", you_said_we_did: "রাস্তা মেরামতের কাজ আগামী মাসে শুরু হবে।", actions: [{ text: "ঠিকাদার ঠিক করা হবে" }], published_at: past, is_sample: true,
  groups: [{ group: "A", size: 8 }, { group: "B", size: 6 }],
  agreement: [
    { statement_id: "s1", text: "রাস্তা মেরামত আগে হোক", votes: 14, agree_pct: 78.6, disagree_pct: 14.3, pass_pct: 7.1, groups: [{ group: "A", votes: 8, agree_pct: 87.5 }, { group: "B", votes: 6, agree_pct: 66.7 }], pattern: "common_ground" },
    { statement_id: "s2", text: "বাতির ব্যবস্থা আগে হোক", votes: 14, agree_pct: 42.9, disagree_pct: 42.9, pass_pct: 14.2, groups: [{ group: "A", votes: 8, agree_pct: 12.5 }, { group: "B", votes: 6, agree_pct: 83.3 }], pattern: "divided" },
    { statement_id: "s3", text: "নালা পরিষ্কার আগে হোক", votes: null, agree_pct: null, disagree_pct: null, pass_pct: null, groups: [], pattern: null },
  ],
};
const commitment = { ref: "CM-DEMO", constituency_key: "demo-1", title: "সেতুর মেরামত শেষ করা হবে", description: "পুরনো সেতু মেরামত।", status: "delayed", due_date: "2026-11-01", published_at: past, updated_at: past, announcement_ref: "AN-1", project_ref: "PR-DEMO", idea_ref: null, label: "office_commitment", is_sample: true };
const round = { ref: "PRI-DEMO", constituency_key: "demo-1", title: "এলাকার কোন দরকার আগে?", description: null, status: "open", closes_at: soon, opened_at: past, closed_at: null, label: "non_binding", is_sample: true };
const idea = { ref: "ID-DEMO", constituency_key: "demo-1", category: "roads", title: "বাজারের পথে বাতি", body: "রাতে বাজারের পথ অন্ধকার, সোলার বাতি বসানো হোক।", status: "published", decision_note: null, created_at: past, support_count: 52, support_threshold: 50, threshold_reached_at: past, response_due_at: past, responded_at: null, response_state: "overdue" };

export async function mock(page: Page) {
  await page.route("**/api/v1/**", (r: Route) => {
    const u = new URL(r.request().url());
    const p = u.pathname.replace("/api/v1", "");
    const m = r.request().method();
    if (m !== "GET") return r.fulfill(none);
    const j = (d: unknown) => r.fulfill(ok(d));
    if (p === "/features") return j([{ key: "consultations", enabled: true }, { key: "idea_arguments", enabled: true }, { key: "project_checkins", enabled: true }]);
    if (p === "/consultations") return j([consultation]);
    if (p === "/consultations/CN-DEMO") return j({ ...consultation, statements: [{ id: "s1", text: "রাস্তা মেরামত আগে হোক", kind: "seed", my_vote: null }], next_statement_id: "s1" });
    if (p === "/consultations/CN-DEMO/report") return j(report);
    if (p === "/commitments") return j([commitment, { ...commitment, ref: "CM-2", title: "বাতি বসানো", status: "delivered", due_date: "2026-10-01" }]);
    if (p === "/commitments/CM-DEMO") return j({ ...commitment, history: [{ from_status: null, to_status: "planned", note: null, evidence_url: null, evidence_text: null, created_at: past }, { from_status: "planned", to_status: "delayed", note: "বৃষ্টিতে কাজ বন্ধ ছিল", evidence_url: null, evidence_text: null, created_at: past }] });
    if (p === "/priorities") return j([round]);
    if (p === "/priorities/PRI-DEMO") return j({ ...round, items: [{ id: "a", position: 1, label: "রাস্তা মেরামত" }, { id: "b", position: 2, label: "রাতে বাতি" }, { id: "c", position: 3, label: "নালা পরিষ্কার" }] });
    if (p === "/polls") return j([{ ref: "PL-1", constituency_key: "demo-1", question: "বাজেটের টাকা প্রথমে কোথায় যাবে?", status: "open", results_visibility: "after_close", closes_at: soon, opened_at: past, closed_at: null, is_sample: true }]);
    if (p === "/polls/PL-1") return j({ ref: "PL-1", constituency_key: "demo-1", question: "বাজেটের টাকা প্রথমে কোথায় যাবে?", status: "open", results_visibility: "after_close", closes_at: soon, opened_at: past, closed_at: null, is_sample: true, options: [{ id: "a", label: "রাস্তা", position: 1 }, { id: "b", label: "বাতি", position: 2 }], results: { ref: "PL-1", status: "open", total_votes: 3, my_option_id: null, results_shown: false, options: null } });
    if (p === "/surveys") return j([{ ref: "SV-1", constituency_key: "demo-1", title: "রাস্তার কাজ কেমন হলো?", description: null, status: "open", closes_at: soon, opened_at: past, closed_at: null, is_sample: true }]);
    if (p === "/surveys/SV-1") return j({ ref: "SV-1", constituency_key: "demo-1", title: "রাস্তার কাজ কেমন হলো?", description: null, status: "open", closes_at: soon, opened_at: past, closed_at: null, questions: [{ id: "11111111-1111-4111-8111-111111111111", position: 1, kind: "rating", prompt: "কাজ কেমন হয়েছে?", options: null }] });
    if (p === "/analytics/satisfaction") return j({ days: 90, ratings: 12, suppressed: false, average: 4.1, distribution: { "4": 8, "5": 4 } });
    if (p === "/projects/PR-DEMO/checkins") return j([{ id: "c1", note: "আজ গিয়ে দেখলাম কাজ চলছে", visited_at: "2026-11-10", has_photo: false, photo_url: null, office_response: "ধন্যবাদ, আমরা দেখছি", responded_at: past, created_at: past, label: "citizen_submitted" }]);
    if (p === "/ideas/ID-DEMO") return j(idea);
    if (p === "/ideas/ID-DEMO/arguments") return j({ for: [{ id: "p1", side: "for", body: "রাতে নিরাপদ হবে", created_at: past, helpful_count: 4 }], against: [{ id: "p2", side: "against", body: "খরচ বেশি", created_at: past, helpful_count: 1 }] });
    return r.fulfill(none);
  });
}


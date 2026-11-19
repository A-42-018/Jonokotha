import { ago, ahead, AREA_KEY, bi, tx, type Bi, type Lang } from "./util";

// Example consultations, community priorities and participatory budgets for the simulated demo.

// Consultations -------------------------------------------------------------------------------------------------------------------------
interface DemoConsult { ref: string; status: "open" | "closed" | "reported"; q: Bi; desc: Bi; days: number; participants: number; statements: { text: Bi; agree: number; disagree: number; pass: number; kind?: "seed" | "citizen" }[] }
export const DEMO_CONSULTS: DemoConsult[] = [
  { ref: "JKD-CN-0701", status: "open", days: 6, participants: 118,
    q: bi("বাজার এলাকায় যানজট কমাতে কী করা উচিত?", "What should be done to reduce traffic jams in the market area?"),
    desc: bi("প্রতিটি বিবৃতিতে একমত, দ্বিমত বা পাস বেছে নিন। আপনার ভোট গোপন থাকে।", "Choose agree, disagree or pass on each statement. Your vote stays private."),
    statements: [
      { text: bi("বাজারের সামনে রিকশা পার্কিং আলাদা জায়গায় সরানো হোক।", "Move rickshaw parking away from the market front."), agree: 84, disagree: 20, pass: 14 },
      { text: bi("হাটবারে বাজারের রাস্তায় গাড়ি চলাচল বন্ধ থাকুক।", "Close the market road to cars on market days."), agree: 52, disagree: 56, pass: 10 },
      { text: bi("ফুটপাত থেকে অবৈধ দোকান সরানো হোক।", "Remove illegal stalls from the footpath."), agree: 91, disagree: 17, pass: 10 },
      { text: bi("সন্ধ্যায় ট্রাফিক পুলিশ মোতায়েন করা হোক।", "Station traffic police in the evening."), agree: 77, disagree: 22, pass: 19 },
      { text: bi("বাজারের পেছনে বহুতল পার্কিং বানানো হোক।", "Build multi-storey parking behind the market."), agree: 40, disagree: 48, pass: 30, kind: "citizen" },
    ] },
  { ref: "JKD-CN-0702", status: "open", days: 3, participants: 64,
    q: bi("খেলার মাঠ কীভাবে ব্যবহার হওয়া উচিত?", "How should the playground be used?"),
    desc: bi("মাঠটি সবার জন্য — আপনার মতামত জানান।", "The ground is for everyone. Tell us what you think."),
    statements: [
      { text: bi("সকালে শুধু শিশু ও বয়স্কদের জন্য সংরক্ষিত থাকুক।", "Keep mornings for children and older people."), agree: 41, disagree: 15, pass: 8 },
      { text: bi("বিকেলে ক্রিকেট টুর্নামেন্ট করা যাক।", "Allow cricket tournaments in the afternoon."), agree: 30, disagree: 24, pass: 10 },
      { text: bi("মাঠের চারপাশে হাঁটার পথ তৈরি হোক।", "Build a walking track around the ground."), agree: 52, disagree: 6, pass: 6 },
    ] },
  { ref: "JKD-CN-0703", status: "reported", days: 50, participants: 203,
    q: bi("কোন ধরনের বর্জ্য সংগ্রহ ব্যবস্থা চালু হওয়া উচিত?", "Which waste-collection system should start?"),
    desc: bi("ফলাফল প্রকাশিত হয়েছে। নিচে অফিসের উত্তর ও পদক্ষেপ দেখুন।", "The results are published. See the office's answer and actions below."),
    statements: [
      { text: bi("ঘরে ঘরে সংগ্রহ, মাসিক ফি ৫০ টাকা।", "Door-to-door collection for BDT 50 a month."), agree: 110, disagree: 70, pass: 23 },
      { text: bi("পাড়ার মোড়ে বড় ডাস্টবিন, বিনা ফিতে।", "Large free bins at neighbourhood corners."), agree: 150, disagree: 30, pass: 23 },
      { text: bi("জৈব ও অজৈব ময়লা আলাদা করা বাধ্যতামূলক হোক।", "Make separating organic and other waste compulsory."), agree: 98, disagree: 82, pass: 23 },
    ] },
];
export const findConsult = (ref: string) => DEMO_CONSULTS.find((c) => c.ref === ref);

export function consultRow(c: DemoConsult, lang: Lang) {
  return { ref: c.ref, question: tx(c.q, lang), description: tx(c.desc, lang), status: c.status, closes_at: c.status === "open" ? ahead(9) : ago(c.days - 20), statement_count: c.statements.length, participant_count: c.participants, is_sample: true };
}
export function consultFull(c: DemoConsult, lang: Lang, votes: Record<string, string>) {
  const statements = c.statements.map((s, i) => ({ id: `${c.ref}-s${i + 1}`, text: tx(s.text, lang), kind: s.kind ?? "seed", my_vote: (votes[`${c.ref}-s${i + 1}`] ?? null) as "agree" | "disagree" | "pass" | null }));
  const next = statements.find((s) => !s.my_vote);
  return { ...consultRow(c, lang), statements, next_statement_id: next?.id ?? null };
}
export function consultReport(c: DemoConsult, lang: Lang) {
  const agreement = c.statements.map((s, i) => {
    const n = s.agree + s.disagree + s.pass, a = Math.round((s.agree / n) * 100), d = Math.round((s.disagree / n) * 100);
    const pattern = a >= 65 ? "common_ground" : Math.abs(a - d) < 15 ? "divided" : a < 35 ? "low_support" : "mixed";
    return { statement_id: `${c.ref}-s${i + 1}`, text: tx(s.text, lang), votes: n, agree_pct: a, disagree_pct: d, pass_pct: 100 - a - d, pattern, groups: [{ group: "A", votes: Math.round(n * 0.55), agree_pct: Math.min(100, a + 6) }, { group: "B", votes: Math.round(n * 0.45), agree_pct: Math.max(0, a - 8) }] };
  });
  return {
    consultation_ref: c.ref, participants: c.participants, groups: [{ group: "A", size: Math.round(c.participants * 0.55) }, { group: "B", size: Math.round(c.participants * 0.45) }], agreement, hidden_groups: 0,
    summary_bn: tx(bi("অধিকাংশ মানুষ পাড়ার মোড়ে বিনা ফিতে বড় ডাস্টবিন চান। ঘরে ঘরে সংগ্রহে মত বিভক্ত।", "Most people want large free bins at neighbourhood corners. Opinion is split on door-to-door collection."), lang),
    you_said_we_did: tx(bi("আপনারা বলেছিলেন পাড়ার মোড়ে ডাস্টবিন চান — আমরা পল্লবী বাজারে দুটি নতুন ডাস্টবিন বসিয়েছি।", "You said you wanted bins at corners, so we placed two new bins at the Pallabi market."), lang),
    actions: [{ text: tx(bi("আগামী মাসে আরও আটটি ডাস্টবিন বসানো হবে।", "Eight more bins will be placed next month."), lang) }, { text: tx(bi("আলাদা করা বাধ্যতামূলক নয়, প্রচার চালানো হবে।", "Separation will not be compulsory; an awareness drive will run."), lang), link_ref: "JKD-ID-0202" }],
    published_at: ago(c.days - 22), is_sample: true,
  };
}

// Community priorities ------------------------------------------------------------------------------------------------------------------
interface DemoRound { ref: string; status: "open" | "closed"; title: Bi; desc: Bi; items: { bn: string; en: string; points: number; first: number }[] }
export const DEMO_ROUNDS: DemoRound[] = [
  { ref: "JKD-PR-0801", status: "open", title: bi("এ বছরের শীর্ষ পাঁচ প্রয়োজন", "Top five needs this year"), desc: bi("সবচেয়ে জরুরি পাঁচটি বেছে ক্রম দিন। এটি বাধ্যতামূলক সিদ্ধান্ত নয়।", "Pick and rank up to five. This is not a binding decision."),
    items: [{ bn: "সড়ক ও ফুটপাত", en: "Roads and footpaths", points: 410, first: 62 }, { bn: "ড্রেন ও জলাবদ্ধতা", en: "Drains and waterlogging", points: 388, first: 55 }, { bn: "নিরাপদ পানি", en: "Safe water", points: 301, first: 38 }, { bn: "রাস্তার বাতি", en: "Street lights", points: 276, first: 24 }, { bn: "স্কুলের অবকাঠামো", en: "School buildings", points: 190, first: 20 }, { bn: "স্বাস্থ্যসেবা", en: "Health services", points: 235, first: 31 }, { bn: "বর্জ্য ব্যবস্থাপনা", en: "Waste management", points: 260, first: 28 }, { bn: "খেলার মাঠ", en: "Playgrounds", points: 90, first: 9 }] },
  { ref: "JKD-PR-0802", status: "closed", title: bi("গত বছরের প্রয়োজন তালিকা", "Last year's list of needs"), desc: bi("বন্ধ হয়েছে; ফলাফল প্রকাশিত।", "Closed; results are published."),
    items: [{ bn: "ড্রেন ও জলাবদ্ধতা", en: "Drains and waterlogging", points: 520, first: 90 }, { bn: "সড়ক ও ফুটপাত", en: "Roads and footpaths", points: 470, first: 70 }, { bn: "নিরাপদ পানি", en: "Safe water", points: 320, first: 40 }, { bn: "রাস্তার বাতি", en: "Street lights", points: 210, first: 18 }] },
];
export const findRound = (ref: string) => DEMO_ROUNDS.find((r) => r.ref === ref);
export function roundRow(r: DemoRound, lang: Lang) { return { ref: r.ref, constituency_key: AREA_KEY, title: tx(r.title, lang), description: tx(r.desc, lang), status: r.status, closes_at: r.status === "open" ? ahead(12) : ago(40), opened_at: ago(r.status === "open" ? 8 : 90), closed_at: r.status === "closed" ? ago(40) : null, label: "non_binding", is_sample: true }; }
export function roundFull(r: DemoRound, lang: Lang) { return { ...roundRow(r, lang), items: r.items.map((it, i) => ({ id: `${r.ref}-i${i + 1}`, position: i + 1, label: lang === "bn" ? it.bn : it.en })) }; }
export function roundResults(r: DemoRound, lang: Lang, extra: string[] = []) {
  const items = r.items.map((it, i) => { const id = `${r.ref}-i${i + 1}`, k = extra.indexOf(id); return { id, label: lang === "bn" ? it.bn : it.en, points: it.points + (k >= 0 ? 5 - k : 0), first_choice: it.first + (k === 0 ? 1 : 0) }; }).sort((a, b) => b.points - a.points);
  return { ref: r.ref, status: r.status, participants: 214 + (extra.length ? 1 : 0), results_shown: true, items };
}

// Participatory budgeting ---------------------------------------------------------------------------------------------------------------
interface DemoPb { ref: string; status: "open" | "closed"; title: Bi; desc: Bi; amount: number; max: number; pledge: Bi; options: { title: Bi; desc: Bi; cost: number; approvals: number }[] }
export const DEMO_PBS: DemoPb[] = [
  { ref: "JKD-PB-0901", status: "open", amount: 5_000_000, max: 3,
    title: bi("পাড়ার ৫০ লক্ষ টাকার বাজেট — আপনি ঠিক করুন", "A BDT 5 million neighbourhood budget: you decide"), desc: bi("তিনটি পর্যন্ত প্রকল্প বেছে নিন। সবচেয়ে বেশি পছন্দ পাওয়া প্রকল্পগুলো বাজেটের মধ্যে অর্থায়ন পাবে।", "Choose up to three projects. The most approved projects are funded within the budget."),
    pledge: bi("অফিস প্রতিশ্রুতি দিচ্ছে: ফলাফল যা-ই হোক, সর্বোচ্চ ভোট পাওয়া প্রকল্পগুলো আগে করা হবে; না করলে প্রকাশ্যে কারণ জানানো হবে।", "The office pledges to build the top-voted projects first, and to explain publicly if it does not."),
    options: [
      { title: bi("সোলার স্ট্রিটলাইট (২০টি)", "Solar street lights (20)"), desc: bi("অন্ধকার গলিতে সৌরবাতি।", "Solar lights for dark lanes."), cost: 1_800_000, approvals: 0 },
      { title: bi("ড্রেনের ঢাকনা ও পরিষ্কার", "Drain covers and cleaning"), desc: bi("১.৫ কিমি ড্রেনে ঢাকনা।", "Covers for 1.5 km of drain."), cost: 2_200_000, approvals: 0 },
      { title: bi("শিশুদের খেলার সরঞ্জাম", "Children's play equipment"), desc: bi("মাঠে দোলনা ও স্লিপার।", "Swings and slides for the ground."), cost: 900_000, approvals: 0 },
      { title: bi("পাড়ায় পাবলিক টয়লেট", "Public toilet in the neighbourhood"), desc: bi("নারী-বান্ধব, পানির ব্যবস্থাসহ।", "Women-friendly, with water supply."), cost: 1_500_000, approvals: 0 },
      { title: bi("ফুটপাত মেরামত", "Footpath repair"), desc: bi("বাজার থেকে স্কুল পর্যন্ত।", "From the market to the school."), cost: 1_200_000, approvals: 0 },
    ] },
  { ref: "JKD-PB-0902", status: "closed", amount: 3_000_000, max: 2,
    title: bi("গত বছরের ৩০ লক্ষ টাকার বাজেট", "Last year's BDT 3 million budget"), desc: bi("ভোট শেষ; ফলাফল ও অফিসের বাস্তবায়ন নিচে।", "Voting ended; results and what the office did are below."),
    pledge: bi("সর্বোচ্চ ভোট পাওয়া প্রকল্প আগে।", "Top-voted projects first."),
    options: [
      { title: bi("পানির ফিল্টার কেন্দ্র", "Water filter points"), desc: bi("চারটি পাড়ায়।", "In four neighbourhoods."), cost: 1_400_000, approvals: 96 },
      { title: bi("সড়ক বাতি", "Road lights"), desc: bi("মূল সড়কে।", "On the main road."), cost: 1_100_000, approvals: 81 },
      { title: bi("পাঠাগার সংস্কার", "Library refit"), desc: bi("বই ও আসবাব।", "Books and furniture."), cost: 900_000, approvals: 47 },
    ] },
];
export const findPb = (ref: string) => DEMO_PBS.find((p) => p.ref === ref);
export function pbCycle(p: DemoPb, lang: Lang, participants = p.status === "open" ? 142 : 188) {
  return { ref: p.ref, constituency_key: AREA_KEY, title: tx(p.title, lang), description: tx(p.desc, lang), fiscal_year: "2026-27", budget_amount: p.amount, currency: "BDT", pledge: tx(p.pledge, lang), max_choices: p.max, status: p.status, closes_at: p.status === "open" ? ahead(10) : ago(35), participants, result_valid: p.status === "closed" ? true : null, followed_result: p.status === "closed" ? true : null, deviation_reason: null, budget_source_ref: null, is_sample: true };
}
export function pbFull(p: DemoPb, lang: Lang, ballot: string[] | null) {
  let left = p.amount;
  const sorted = [...p.options.keys()].sort((a, b) => p.options[b].approvals - p.options[a].approvals);
  const funded = new Set<number>();
  if (p.status === "closed") for (const i of sorted) if (p.options[i].cost <= left) { left -= p.options[i].cost; funded.add(i); }
  const options = p.options.map((o, i) => ({ id: `${p.ref}-o${i + 1}`, position: i + 1, title: tx(o.title, lang), description: tx(o.desc, lang), cost: o.cost, approvals: p.status === "closed" ? o.approvals : null, funded: p.status === "closed" ? funded.has(i) : null }));
  return { ...pbCycle(p, lang, undefined), options, my_ballot: ballot ? { option_ids: ballot, submitted_at: ago(0) } : null };
}

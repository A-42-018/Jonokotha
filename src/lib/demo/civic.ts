import { ago, ahead, AREA_KEY, bi, dayOf, tx, type Bi, type Lang } from "./util";

// Example ideas, polls, projects, commitments and announcements for the simulated demo (API shapes of docs/api-v1.md).

// Ideas ---------------------------------------------------------------------------------------------------------------------------------
interface DemoIdea { ref: string; category: string; title: Bi; body: Bi; status: "published" | "under_consideration" | "planned" | "declined"; support: number; days: number; note?: Bi; threshold?: number }
export const DEMO_IDEAS: DemoIdea[] = [
  { ref: "JKD-ID-0201", category: "roads", status: "planned", support: 214, days: 40, threshold: 150,
    title: bi("মূল সড়কের পাশে সাইকেল লেন", "A cycle lane beside the main road"),
    body: bi("সমস্যা: স্কুলগামী শিশু ও কর্মজীবী মানুষ সাইকেলে গিয়ে ঝুঁকিতে পড়ে।\n\nসমাধান: মূল সড়কের এক পাশে রঙ করা সাইকেল লেন।\n\nউপকার: নিরাপদ চলাচল, যানজট ও দূষণ কম।", "Problem: children and workers who cycle share the road with fast traffic.\n\nSolution: a painted cycle lane on one side of the main road.\n\nBenefit: safer trips, less congestion and pollution."),
    note: bi("পরিকল্পনায় নেওয়া হয়েছে; প্রথম ধাপে ১.২ কিমি।", "Taken into the plan; the first stage is 1.2 km.") },
  { ref: "JKD-ID-0202", category: "environment", status: "under_consideration", support: 167, days: 25, threshold: 150,
    title: bi("প্রতিটি পাড়ায় বর্জ্য আলাদা করার ডাস্টবিন", "Separate-waste bins in every neighbourhood"),
    body: bi("সমস্যা: সব ময়লা একসাথে ফেলায় পুনর্ব্যবহার হয় না।\n\nসমাধান: জৈব ও অজৈব বর্জ্যের জন্য আলাদা রঙের ডাস্টবিন।\n\nউপকার: পরিচ্ছন্ন পাড়া, কম্পোস্ট সার তৈরি।", "Problem: mixed rubbish cannot be recycled.\n\nSolution: bins of two colours for organic and other waste.\n\nBenefit: cleaner lanes and compost for local gardens.") },
  { ref: "JKD-ID-0203", category: "education", status: "published", support: 98, days: 14,
    title: bi("সন্ধ্যায় পাড়া কমিউনিটি পাঠাগার", "An evening community library in the neighbourhood"),
    body: bi("সমস্যা: বাড়িতে পড়ার জায়গা কম।\n\nসমাধান: স্কুল ভবনের একটি কক্ষ সন্ধ্যায় পাঠাগার হিসেবে খোলা।\n\nউপকার: শিক্ষার্থীদের পড়ার সুযোগ।", "Problem: many homes have no quiet study space.\n\nSolution: open a school room as a library in the evening.\n\nBenefit: a place for students to study.") },
  { ref: "JKD-ID-0204", category: "safety", status: "published", support: 76, days: 10,
    title: bi("প্রধান মোড়গুলোতে সিসি ক্যামেরা", "CCTV cameras at the main junctions"),
    body: bi("সমস্যা: রাতে ছিনতাই বেড়েছে।\n\nসমাধান: পাঁচটি মোড়ে ক্যামেরা, ফুটেজ শুধু পুলিশ দেখবে।\n\nউপকার: নিরাপত্তা।", "Problem: night-time snatching has increased.\n\nSolution: cameras at five junctions, footage for the police only.\n\nBenefit: safety.") },
  { ref: "JKD-ID-0205", category: "health", status: "published", support: 143, days: 7,
    title: bi("সপ্তাহে একদিন ভ্রাম্যমাণ স্বাস্থ্য ক্যাম্প", "A weekly mobile health camp"),
    body: bi("সমস্যা: বয়স্করা দূরের হাসপাতালে যেতে পারেন না।\n\nসমাধান: প্রতি শুক্রবার পাড়ায় রক্তচাপ ও ডায়াবেটিস পরীক্ষা।\n\nউপকার: আগে রোগ ধরা পড়ে।", "Problem: older people cannot reach a distant hospital.\n\nSolution: blood pressure and diabetes checks in the lane every Friday.\n\nBenefit: earlier detection.") },
  { ref: "JKD-ID-0206", category: "facilities", status: "declined", support: 58, days: 60,
    title: bi("খেলার মাঠে বাণিজ্যিক বিজ্ঞাপন বোর্ড", "Commercial billboards on the playground"),
    body: bi("সমস্যা: মাঠ রক্ষণাবেক্ষণের টাকা নেই।\n\nসমাধান: বিজ্ঞাপন বোর্ড বসিয়ে আয়।\n\nউপকার: রক্ষণাবেক্ষণের খরচ।", "Problem: no money to maintain the playground.\n\nSolution: income from billboards.\n\nBenefit: maintenance cost."),
    note: bi("খেলার মাঠ শিশুদের জন্য সংরক্ষিত; বিজ্ঞাপনের বদলে স্থানীয় অনুদান খোঁজা হবে।", "The playground is reserved for children; local donations will be sought instead of advertising.") },
];

export const findIdea = (ref: string) => DEMO_IDEAS.find((i) => i.ref === ref);

export function ideaRow(i: DemoIdea, lang: Lang, support = i.support) {
  const reached = i.threshold && support >= i.threshold;
  return {
    ref: i.ref, constituency_key: AREA_KEY, category: i.category, title: tx(i.title, lang), body: tx(i.body, lang), status: i.status,
    decision_note: i.note ? tx(i.note, lang) : null, created_at: ago(i.days), is_sample: true, support_count: support,
    ...(i.threshold ? { support_threshold: i.threshold, threshold_reached_at: reached ? ago(Math.max(1, i.days - 12)) : null, response_due_at: reached ? ago(-14 + 3) : null, responded_at: i.status === "planned" ? ago(3) : null, response_state: reached ? (i.status === "planned" ? "answered" : "awaiting_response") : null } : {}),
  };
}

export const DEMO_IDEA_POINTS = (lang: Lang) => ({
  for: [
    { id: "pt-f1", side: "for", body: tx(bi("শিশুদের নিরাপদে স্কুলে যাওয়ার সুযোগ বাড়বে।", "More children will be able to reach school safely."), lang), created_at: ago(5), helpful_count: 18 },
    { id: "pt-f2", side: "for", body: tx(bi("খরচ কম — শুধু রঙ ও সাইনবোর্ড।", "Low cost: only paint and signs."), lang), created_at: ago(4), helpful_count: 11 },
  ],
  against: [
    { id: "pt-a1", side: "against", body: tx(bi("রাস্তা সরু; পার্কিং আরও কমে যেতে পারে।", "The road is narrow; parking could get worse."), lang), created_at: ago(3), helpful_count: 7 },
  ],
});

export const DEMO_COMMENTS = (lang: Lang) => [
  { id: "cm-1", body: tx(bi("খুব দরকারি প্রস্তাব, আমি সমর্থন করি।", "A very useful proposal. I support it."), lang), created_at: ago(6) },
  { id: "cm-2", body: tx(bi("স্কুলের সামনের অংশ আগে করলে ভালো হয়।", "It would be good to start with the stretch in front of the school."), lang), created_at: ago(4) },
  { id: "cm-3", body: tx(bi("কাজ শুরুর সময় জানালে ভালো হয়।", "Please tell us when work will start."), lang), created_at: ago(2) },
];

// Polls ---------------------------------------------------------------------------------------------------------------------------------
interface DemoPoll { ref: string; q: Bi; status: "open" | "closed"; vis: "after_close" | "always"; opts: { bn: string; en: string; votes: number }[]; days: number }
export const DEMO_POLLS: DemoPoll[] = [
  { ref: "JKD-PL-0301", status: "open", vis: "always", days: 5, q: bi("এ বছর পাড়ার কোন কাজটি আগে হওয়া উচিত?", "Which neighbourhood work should come first this year?"),
    opts: [{ bn: "সড়ক মেরামত", en: "Road repair", votes: 62 }, { bn: "ড্রেন পরিষ্কার", en: "Drain cleaning", votes: 48 }, { bn: "রাস্তার বাতি", en: "Street lights", votes: 35 }, { bn: "খেলার মাঠ", en: "Playground", votes: 12 }] },
  { ref: "JKD-PL-0302", status: "open", vis: "after_close", days: 2, q: bi("সাপ্তাহিক স্বাস্থ্য ক্যাম্প কোন দিন হলে সুবিধা?", "Which day suits the weekly health camp?"),
    opts: [{ bn: "শুক্রবার সকাল", en: "Friday morning", votes: 21 }, { bn: "শনিবার বিকেল", en: "Saturday afternoon", votes: 9 }] },
  { ref: "JKD-PL-0303", status: "closed", vis: "after_close", days: 30, q: bi("পাড়ার বাজারে ডাস্টবিন কোথায় বসানো হবে?", "Where should the market bins go?"),
    opts: [{ bn: "প্রবেশমুখে", en: "At the entrance", votes: 54 }, { bn: "মাছের সারির পাশে", en: "Beside the fish stalls", votes: 71 }, { bn: "পেছনের গলিতে", en: "In the back lane", votes: 18 }] },
];
export const findPoll = (ref: string) => DEMO_POLLS.find((p) => p.ref === ref);

export function pollRow(p: DemoPoll, lang: Lang) {
  return { ref: p.ref, constituency_key: AREA_KEY, question: tx(p.q, lang), status: p.status, results_visibility: p.vis, closes_at: p.status === "open" ? ahead(6) : ago(p.days - 14), opened_at: ago(p.days), closed_at: p.status === "closed" ? ago(p.days - 14) : null, is_sample: true };
}
export function pollDetail(p: DemoPoll, lang: Lang, mine: string | null) {
  const opts = p.opts.map((o, i) => ({ id: `${p.ref}-o${i + 1}`, label: lang === "bn" ? o.bn : o.en, position: i + 1 }));
  const votes = p.opts.map((o, i) => o.votes + (mine === opts[i].id ? 1 : 0));
  const total = votes.reduce((a, b) => a + b, 0);
  const shown = p.status === "closed" || p.vis === "always";
  return { ...pollRow(p, lang), options: opts, results: { ref: p.ref, status: p.status, total_votes: total, my_option_id: mine, results_shown: shown, options: shown ? opts.map((o, i) => ({ id: o.id, label: o.label, votes: votes[i] })) : null } };
}

// Projects ------------------------------------------------------------------------------------------------------------------------------
interface DemoProject { ref: string; title: Bi; description: Bi; status: "planned" | "in_progress" | "completed" | "paused" | "cancelled"; budget: Bi; endDays: number; image: string; ms: { title: Bi; due: number; status: "pending" | "done" | "delayed"; note?: Bi }[] }
export const DEMO_PROJECTS: DemoProject[] = [
  { ref: "JKD-PJ-0401", status: "in_progress", image: "/demo/project-road.svg", endDays: 60, budget: bi("৪২ লক্ষ টাকা (এলজিইডির বরাদ্দ, নমুনা)", "BDT 4.2 million (LGED allocation, sample)"),
    title: bi("মিরপুর ১০ মূল সড়ক পুনর্নির্মাণ", "Mirpur 10 main road resurfacing"),
    description: bi("১.৮ কিমি সড়কের পুরনো পিচ তুলে নতুন কার্পেটিং ও ড্রেনের পাশে ঢাকনা।", "New carpeting over 1.8 km of road and covers along the drain."),
    ms: [{ title: bi("জরিপ ও নকশা", "Survey and design"), due: -50, status: "done" }, { title: bi("পুরনো পিচ তোলা", "Strip the old surface"), due: -20, status: "done" }, { title: bi("নতুন কার্পেটিং", "New carpeting"), due: 30, status: "pending" }, { title: bi("লাইন মার্কিং", "Line marking"), due: 55, status: "pending" }] },
  { ref: "JKD-PJ-0402", status: "in_progress", image: "/demo/project-school.svg", endDays: 120, budget: bi("৮৫ লক্ষ টাকা (শিক্ষা অধিদপ্তর, নমুনা)", "BDT 8.5 million (Directorate of Education, sample)"),
    title: bi("প্রাথমিক বিদ্যালয়ে নতুন শ্রেণিকক্ষ", "New classrooms at the primary school"),
    description: bi("চারটি নতুন শ্রেণিকক্ষ ও ছাদ মেরামত। নির্মাণকালে ক্লাস পাশের ভবনে চলবে।", "Four new classrooms and roof repair. Classes move to the next building during construction."),
    ms: [{ title: bi("ভিত্তি নির্মাণ", "Foundation"), due: -30, status: "done" }, { title: bi("দেয়াল ও ছাদ", "Walls and roof"), due: 20, status: "delayed", note: bi("বৃষ্টির কারণে দুই সপ্তাহ পিছিয়েছে।", "Two weeks late because of rain.") }, { title: bi("রং ও আসবাব", "Paint and furniture"), due: 110, status: "pending" }] },
  { ref: "JKD-PJ-0403", status: "completed", image: "/demo/project-water.svg", endDays: -25, budget: bi("১২ লক্ষ টাকা (ওয়াসা, নমুনা)", "BDT 1.2 million (WASA, sample)"),
    title: bi("কমিউনিটি গভীর নলকূপ ও পানির কেন্দ্র", "Community deep tube-well and water point"),
    description: bi("পাঁচশো পরিবারের জন্য নিরাপদ পানির উৎস, নিয়মিত পানি পরীক্ষাসহ।", "A safe water source for 500 households with regular water testing."),
    ms: [{ title: bi("স্থান নির্বাচন", "Site selection"), due: -120, status: "done" }, { title: bi("নলকূপ স্থাপন", "Install the tube-well"), due: -70, status: "done" }, { title: bi("পানি পরীক্ষা ও হস্তান্তর", "Water test and handover"), due: -25, status: "done" }] },
  { ref: "JKD-PJ-0404", status: "planned", image: "/demo/project-road.svg", endDays: 200, budget: bi("১ কোটি ২০ লক্ষ টাকা (প্রস্তাবিত, নমুনা)", "BDT 12 million (proposed, sample)"),
    title: bi("কাজীপাড়া ড্রেনেজ খাল সংস্কার", "Kazipara drainage canal renovation"),
    description: bi("জলাবদ্ধতা কমাতে ৩ কিমি খাল পরিষ্কার ও প্রশস্ত করা।", "Cleaning and widening 3 km of canal to reduce waterlogging."),
    ms: [{ title: bi("পরিবেশগত যাচাই", "Environmental review"), due: 30, status: "pending" }, { title: bi("দরপত্র", "Tender"), due: 70, status: "pending" }] },
  { ref: "JKD-PJ-0405", status: "paused", image: "/demo/project-school.svg", endDays: 90, budget: bi("৩০ লক্ষ টাকা (নমুনা)", "BDT 3 million (sample)"),
    title: bi("কমিউনিটি মিলনায়তন সংস্কার", "Community hall renovation"),
    description: bi("ঠিকাদারের কাগজপত্রের জটিলতায় কাজ সাময়িক বন্ধ আছে।", "Work is paused over the contractor's paperwork."),
    ms: [{ title: bi("ঠিকাদার নিয়োগ", "Appoint contractor"), due: -10, status: "delayed", note: bi("কাগজপত্র যাচাই চলছে।", "Documents are being checked.") }] },
];
export const findProject = (ref: string) => DEMO_PROJECTS.find((p) => p.ref === ref);

export function projectRow(p: DemoProject, lang: Lang) {
  return {
    ref: p.ref, constituency_key: AREA_KEY, title: tx(p.title, lang), description: tx(p.description, lang), status: p.status, budget_text: tx(p.budget, lang),
    start_date: dayOf(-90), expected_end_date: dayOf(p.endDays), source_url: "https://example.org/jonokotha-sample", source_checked_at: ago(6), updated_at: ago(2), is_sample: true, data_status: "sample", image_url: p.image,
  };
}
export function projectDetail(p: DemoProject, lang: Lang) {
  return { ...projectRow(p, lang), milestones: p.ms.map((m, i) => ({ id: `${p.ref}-m${i + 1}`, title: tx(m.title, lang), due_date: dayOf(m.due), status: m.status, note: m.note ? tx(m.note, lang) : null, completed_at: m.status === "done" ? ago(-m.due) : null })) };
}

// Commitments ---------------------------------------------------------------------------------------------------------------------------
interface DemoCommit { ref: string; title: Bi; description: Bi; status: "planned" | "in_progress" | "delivered" | "delayed" | "dropped"; due: number; history: { to: string; from: string | null; note?: Bi; evidence?: Bi; days: number }[] }
export const DEMO_COMMITMENTS: DemoCommit[] = [
  { ref: "JKD-CM-0501", status: "delivered", due: -20, title: bi("প্রধান সড়কের ১০টি অকেজো বাতি মেরামত", "Repair ten dead lights on the main road"), description: bi("প্রধান সড়কের নষ্ট বাতি এক মাসের মধ্যে ঠিক করা হবে।", "Dead lights on the main road will be fixed within a month."),
    history: [{ from: null, to: "planned", days: 50 }, { from: "planned", to: "in_progress", days: 40 }, { from: "in_progress", to: "delivered", days: 22, evidence: bi("সবগুলো বাতি জ্বলছে — অফিসের ছবি ও কাজের তালিকা সংযুক্ত।", "All lights are working: office photos and work list attached.") }] },
  { ref: "JKD-CM-0502", status: "in_progress", due: 45, title: bi("প্রতি পাড়ায় একটি করে পানির ফিল্টার কেন্দ্র", "One water filter point in every neighbourhood"), description: bi("পর্যায়ক্রমে বারোটি পাড়ায় ফিল্টার কেন্দ্র বসানো হবে।", "Filter points will be installed in twelve neighbourhoods in stages."),
    history: [{ from: null, to: "planned", days: 70 }, { from: "planned", to: "in_progress", days: 30, note: bi("প্রথম চারটি কেন্দ্রের কাজ শুরু।", "Work started on the first four points.") }] },
  { ref: "JKD-CM-0503", status: "delayed", due: -8, title: bi("সরকারি স্কুলের সামনে ফুটওভার ব্রিজ", "Footbridge outside the government school"), description: bi("স্কুলের সামনের ব্যস্ত সড়কে ফুটওভার ব্রিজ নির্মাণ।", "A footbridge over the busy road outside the school."),
    history: [{ from: null, to: "planned", days: 120 }, { from: "planned", to: "delayed", days: 6, note: bi("জমি অধিগ্রহণের অনুমতি আসতে দেরি হচ্ছে; নতুন সময় ৬০ দিন।", "Land permission is late; the new target is 60 days away.") }] },
  { ref: "JKD-CM-0504", status: "planned", due: 150, title: bi("নারীদের জন্য সন্ধ্যা-কালীন দক্ষতা প্রশিক্ষণ", "Evening skills training for women"), description: bi("সেলাই, ডিজিটাল দক্ষতা ও ছোট ব্যবসার ওপর তিন মাসের কোর্স।", "A three-month course on tailoring, digital skills and small business."),
    history: [{ from: null, to: "planned", days: 10 }] },
  { ref: "JKD-CM-0505", status: "dropped", due: -40, title: bi("খালের ওপর বাণিজ্যিক মার্কেট", "Commercial market over the canal"), description: bi("পরিবেশগত আপত্তির কারণে বাদ দেওয়া হয়েছে।", "Dropped because of environmental objections."),
    history: [{ from: null, to: "planned", days: 150 }, { from: "planned", to: "dropped", days: 45, note: bi("খাল রক্ষার স্বার্থে এই প্রতিশ্রুতি বাতিল করা হলো।", "This commitment is withdrawn to protect the canal.") }] },
];
export const findCommit = (ref: string) => DEMO_COMMITMENTS.find((c) => c.ref === ref);
export function commitRow(c: DemoCommit, lang: Lang) {
  return { ref: c.ref, constituency_key: AREA_KEY, title: tx(c.title, lang), description: tx(c.description, lang), status: c.status, due_date: dayOf(c.due), published_at: ago(c.history[0].days), updated_at: ago(Math.min(...c.history.map((h) => h.days))), announcement_ref: null, project_ref: null, idea_ref: null, label: "office_commitment", is_sample: true };
}
export function commitFull(c: DemoCommit, lang: Lang) {
  return { ...commitRow(c, lang), history: c.history.map((h) => ({ from_status: h.from, to_status: h.to, note: h.note ? tx(h.note, lang) : null, evidence_url: null, evidence_text: h.evidence ? tx(h.evidence, lang) : null, created_at: ago(h.days) })) };
}

// Announcements -------------------------------------------------------------------------------------------------------------------------
export const DEMO_ANNOUNCEMENTS = (lang: Lang) => [
  { ref: "JKD-AN-0601", title: tx(bi("শনিবার বিনামূল্যে স্বাস্থ্য পরীক্ষা", "Free health check on Saturday"), lang), body: tx(bi("সকাল ৯টা থেকে দুপুর ১টা পর্যন্ত কমিউনিটি ক্লিনিকে রক্তচাপ ও ডায়াবেটিস পরীক্ষা।", "Blood pressure and diabetes checks at the community clinic, 9 am to 1 pm."), lang), published_at: ago(1) },
  { ref: "JKD-AN-0602", title: tx(bi("মিরপুর ১০ সড়কে কাজ শুরু — যান চলাচল সীমিত", "Work begins on Mirpur 10 road: limited traffic"), lang), body: tx(bi("আগামী দুই সপ্তাহ রাত ১০টা থেকে ভোর ৫টা পর্যন্ত একমুখী চলাচল।", "One-way traffic from 10 pm to 5 am for the next two weeks."), lang), published_at: ago(3) },
  { ref: "JKD-AN-0603", title: tx(bi("ড্রেন পরিষ্কার অভিযান", "Drain-cleaning drive"), lang), body: tx(bi("বর্ষার আগে কাজীপাড়া ও শেওড়াপাড়ার ড্রেন পরিষ্কার করা হবে।", "Drains in Kazipara and Shewrapara will be cleaned before the monsoon."), lang), published_at: ago(6) },
  { ref: "JKD-AN-0604", title: tx(bi("এই মাসের জনমত জরিপ খোলা", "This month's poll is open"), lang), body: tx(bi("পাড়ার কোন কাজ আগে হবে — ভোট দিন।", "Vote on which neighbourhood work comes first."), lang), published_at: ago(8) },
];

// npm run seed:demo — repeatable: removes previous demo cases, inserts labelled synthetic ones.
// Needs SUPABASE_SERVICE_ROLE_KEY (server only). Touches only rows with is_demo = true.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example)."); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

const L = "[নমুনা] ";
const base = { constituency_key: "demo-1", is_demo: true };
const demo = [
  { title: L + "মিরপুর ১০ নম্বর রোডে বড় গর্ত", category: "roads", area: "মিরপুর ১০", description: "মূল রাস্তার মাঝখানে বড় গর্ত। রিকশা আর মোটরসাইকেল দুর্ঘটনায় পড়ছে।", ai_agency: "ag-lged", status: "acknowledged" },
  { title: L + "মিরপুর ১০ এর রাস্তার গর্তে দুর্ঘটনা", category: "roads", area: "মিরপুর ১০", description: "১০ নম্বরের রাস্তায় গর্তে গত সপ্তাহে দুটি রিকশা উল্টেছে।", ai_agency: "ag-lged", status: "received", dupOf: 0 },
  { title: L + "বৃষ্টির পর ড্রেনের পানি উপচে পড়ছে", category: "drainage", area: "কাজীপাড়া", description: "ড্রেন পরিষ্কার না হওয়ায় সামান্য বৃষ্টিতেই পানি রাস্তায় উঠে যায়।", ai_agency: "ag-wasa", status: "referred" },
  { title: L + "রাতে রাস্তার বাতি জ্বলে না", category: "electricity", area: "শেওড়াপাড়া", description: "গলির তিনটি বাতি এক মাস ধরে নষ্ট। রাতে চলাচল ঝুঁকিপূর্ণ।", ai_agency: "ag-power", status: "received" },
  { title: L + "ময়লার ভাগাড় সরানো হয়নি", category: "waste", area: "পল্লবী", description: "বাজারের পাশে ময়লা জমে দুর্গন্ধ ছড়াচ্ছে।", ai_agency: "ag-city", status: "resolved" },
];

const { error: delErr } = await sb.from("issues").delete().eq("is_demo", true);
if (delErr) { console.error("Cleanup failed:", delErr.message); process.exit(1); }

const refs = [];
for (const [i, d] of demo.entries()) {
  const { dupOf, status, ...row } = d;
  const similar = dupOf !== undefined ? [refs[dupOf]] : [];
  const { data, error } = await sb.from("issues").insert({ ...base, ...row, ai_similar: similar, ai_confidence: similar.length ? 0.85 : 0.7, ai_summary: "নমুনা তথ্য — বাস্তব অভিযোগ নয়।" }).select("ref").single();
  if (error) { console.error(`Insert ${i} failed:`, error.message); process.exit(1); }
  refs.push(data.ref);
  // Walk the status forward so the public timeline shows real events (the trigger logs each change).
  const path = { received: [], acknowledged: ["acknowledged"], referred: ["acknowledged", "referred"], resolved: ["acknowledged", "referred", "resolved"] }[status];
  for (const st of path) {
    const { error: e2 } = await sb.from("issues").update({ status: ({ received: "submitted", referred: "referred_to_authority" })[st] ?? st }).eq("ref", data.ref);
    if (e2) { console.error(`Status ${st} failed:`, e2.message); process.exit(1); }
  }
}
console.log(`Seeded ${refs.length} demo cases: ${refs.join(", ")} (duplicate pair: ${refs[0]} / ${refs[1]})`);

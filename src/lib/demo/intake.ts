// Simulated "quick description" for the report form in demo mode: picks a category from keywords and cuts a title from the text. No AI call.
const RULES: [RegExp, string][] = [
  [/গর্ত|রাস্তা|সড়ক|ফুটপাত|pothole|road|footpath/i, "roads"],
  [/ড্রেন|নর্দমা|drain|sewer/i, "drainage"],
  [/বাতি|বিদ্যুৎ|লাইট|light|electric|power/i, "electricity"],
  [/ময়লা|আবর্জনা|ভাগাড়|waste|rubbish|garbage|trash/i, "waste"],
  [/পানি|নলকূপ|ট্যাপ|water|tap/i, "water"],
  [/বন্যা|জলাবদ্ধ|flood|waterlog/i, "flooding"],
  [/স্কুল|শিক্ষ|school|teacher/i, "education"],
  [/হাসপাতাল|ক্লিনিক|ওষুধ|hospital|clinic|medicine/i, "health"],
  [/চুরি|ছিনতাই|নিরাপত্তা|theft|safety|crime/i, "safety"],
  [/ধোঁয়া|দূষণ|গাছ|smoke|pollution|tree/i, "environment"],
];

const AREAS = ["মিরপুর ১০", "মিরপুর ১১", "মিরপুর ১২", "মিরপুর ১৪", "মিরপুর ২", "কাজীপাড়া", "শেওড়াপাড়া", "পল্লবী", "রূপনগর", "ভাষানটেক", "কালশী", "দারুস সালাম"];
const toBn = (s: string) => s.replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);

export function demoDraft(text: string): { title: string; description: string; area: string; category: string } {
  const clean = text.trim().replace(/\s+/g, " ");
  const title = clean.length > 70 ? `${clean.slice(0, 67).trimEnd()}…` : clean;
  const category = RULES.find(([re]) => re.test(clean))?.[1] ?? "other";
  // The form needs a place name: use one the text mentions, else the sample constituency's first area (the person can change it).
  const bnText = toBn(clean);
  const area = AREAS.find((a) => bnText.includes(a)) ?? "মিরপুর ১০";
  return { title, description: clean, area, category };
}

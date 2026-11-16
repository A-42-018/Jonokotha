import { notFound } from "next/navigation";
import MyReports from "@/components/me/MyReports";
import { dict, getLang } from "@/lib/i18n";
import { parseFilter, parsePage, type MyReport } from "@/lib/my-reports";
import { CATEGORIES, type Status } from "@/lib/types";

const STATUSES: Status[] = ["received", "acknowledged", "referred", "resolved"];
const TITLES = ["রাস্তায় বড় গর্ত", "Blocked drain near the market", "রাতে রাস্তার বাতি নেই", "Tube well not working", "ময়লা জমে আছে"];

const DEMO: MyReport[] = Array.from({ length: 23 }, (_, i) => ({
  ref: `JK-DEMO-${String(1000 + i)}`,
  title: TITLES[i % TITLES.length] + (i > 17 ? " — a very long title to check that wrapping stays inside the card on a narrow phone screen" : ""),
  category: CATEGORIES[i % CATEGORIES.length],
  area: i % 6 === 5 ? "" : "ওয়ার্ড ৩, মিরপুর",
  status: STATUSES[i % 4],
  createdAt: new Date(Date.UTC(2026, 10, 15 - i, 6)).toISOString(),
}));

/** Review-only page (not in production): the list against demo data. ?state=empty shows the empty list. */
export default async function DevMyReports({ searchParams }: PageProps<"/dev/my-reports">) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const lang = await getLang();
  const empty = sp.state === "empty";
  const one = sp.state === "one"; // one received report: any other status filter shows the no-results state
  const data = empty ? [] : one ? DEMO.slice(0, 1) : DEMO;
  const extra = sp.state === "empty" || one ? { state: sp.state as string } : undefined;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-civic">{dict[lang].meMyReports} (demo)</h1>
      <MyReports reports={data} filter={parseFilter(sp.status)} page={parsePage(sp.page)} base="/dev/my-reports" extra={extra} t={dict[lang]} lang={lang} />
    </div>
  );
}

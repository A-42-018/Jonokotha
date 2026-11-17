import Link from "next/link";
import { CATEGORIES, type Category } from "@/lib/categories";
import type { Dict } from "@/lib/i18n";

/** Pastel tile per category (decoration only: the label is fixed dark ink, at least 11:1 on every tint, in both themes). */
const TINT: Record<Category, string> = {
  roads: "bg-[#fde3cf]", drainage: "bg-[#f9d5cc]", water: "bg-[#d6ecf8]", electricity: "bg-[#fce9b8]", waste: "bg-[#d5edd9]", flooding: "bg-[#cfe3f5]",
  health: "bg-[#cdebe6]", education: "bg-[#fbefc2]", safety: "bg-[#e3daf3]", environment: "bg-[#dcefc9]", facilities: "bg-[#d3eef0]", other: "bg-[#eceae6]",
};

/**
 * "সমস্যার ধরন বাছুন" (redesign §4.3 row 3): the 12 report categories as picture tiles. Each one opens the report page with that
 * category already chosen. Plain links, so the home page gains no client JavaScript.
 */
export default function CategoryGrid({ t }: { t: Dict }) {
  return (
    <section aria-labelledby="home-cats" className="space-y-3">
      <div className="space-y-1">
        <h2 id="home-cats" className="text-[1.375rem] font-semibold leading-snug text-foreground lg:text-[1.75rem]">{t.hmCatsTitle}</h2>
        <p className="text-[0.9375rem] text-muted">{t.hmCatsHint}</p>
      </div>
      <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6 lg:gap-4">
        {CATEGORIES.map((c) => (
          <li key={c}>
            <Link
              href={`/report?category=${c}`}
              className={`flex h-full min-h-28 flex-col items-center justify-center gap-1.5 rounded-2xl px-1.5 py-3 text-center transition-transform hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-civic lg:min-h-36 ${TINT[c]}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/illustrations/home/cat-${c}.webp`} alt="" width={192} height={192} loading="lazy" decoding="async" className="size-14 lg:size-20" />
              <span className="text-[0.9375rem] font-semibold leading-snug text-ink lg:text-base">{t.cats[c]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

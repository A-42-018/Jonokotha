import Link from "next/link";
import type { Dict } from "@/lib/i18n";

// Sample card only: no real person, no statistics. Replaced by verified profiles in Phase 2.
export default function RepresentativeCard({ t, areaName }: { t: Dict; areaName: string }) {
  return (
    <section aria-labelledby="home-rep" className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 lg:sticky lg:top-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img loading="lazy" decoding="async" src="/illustrations/mp-portrait.svg" alt="" className="size-24 shrink-0 rounded-2xl bg-slate-50" />
      <div className="min-w-0 space-y-1">
        <h2 id="home-rep" className="text-lg font-semibold text-slate-800">{t.homeRepTitle}</h2>
        <p className="font-medium">{t.homeRepName} <span className="rounded-full bg-amber/20 px-2 py-0.5 text-xs text-amber-900">{t.cpSample}</span></p>
        <p className="text-sm text-slate-600">{areaName}</p>
        <p className="text-sm text-slate-600">{t.homeRepNote}</p>
        <div className="flex flex-wrap gap-x-4"><Link href="/mp/rep-demo-1" className="inline-flex min-h-11 items-center text-civic underline">{t.mpProfile}</Link><Link href="/mp" className="inline-flex min-h-11 items-center text-civic underline">{t.mpFindTitle}</Link></div>
      </div>
    </section>
  );
}

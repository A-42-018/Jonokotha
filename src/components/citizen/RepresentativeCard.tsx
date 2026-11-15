import type { Dict } from "@/lib/i18n";

// Sample card only: no real person, no statistics. Replaced by verified profiles in Phase 2.
export default function RepresentativeCard({ t, areaName }: { t: Dict; areaName: string }) {
  return (
    <section aria-labelledby="home-rep" className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/illustrations/spot-find-mp.svg" alt="" className="h-20 w-20 shrink-0 rounded-xl bg-slate-50 p-1" />
      <div className="min-w-0 space-y-1">
        <h2 id="home-rep" className="text-lg font-semibold text-slate-800">{t.homeRepTitle}</h2>
        <p className="font-medium">{t.homeRepName} <span className="rounded-full bg-amber/20 px-2 py-0.5 text-xs text-amber-900">{t.cpSample}</span></p>
        <p className="text-sm text-slate-600">{areaName}</p>
        <p className="text-sm text-slate-600">{t.homeRepNote}</p>
      </div>
    </section>
  );
}

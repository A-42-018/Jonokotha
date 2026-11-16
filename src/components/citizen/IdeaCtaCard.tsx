import type { Dict } from "@/lib/i18n";

export default function IdeaCtaCard({ t }: { t: Dict }) {
  return (
    <section aria-labelledby="home-idea" className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/illustrations/spot-idea.svg" alt="" className="h-20 w-20 self-start rounded-xl bg-slate-50 p-1" />
      <h2 id="home-idea" className="text-xl font-semibold text-slate-800">{t.homeIdeaTitle}</h2>
      <p className="text-slate-600">{t.homeIdeaBody}</p>
      <button type="button" disabled aria-disabled="true" className="mt-auto inline-flex min-h-12 cursor-not-allowed items-center justify-center rounded-xl border border-slate-300 bg-slate-100 px-5 text-lg font-medium text-slate-600">
        {t.homeIdeaCta} · {t.comingSoon}
      </button>
    </section>
  );
}

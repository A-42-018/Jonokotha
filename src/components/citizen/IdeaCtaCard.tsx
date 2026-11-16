import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import type { Dict } from "@/lib/i18n";

export default function IdeaCtaCard({ t }: { t: Dict }) {
  return (
    <section aria-labelledby="home-idea" className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img loading="lazy" decoding="async" src="/illustrations/spot-idea.svg" alt="" className="h-20 w-20 self-start rounded-xl bg-slate-50 p-1" />
      <h2 id="home-idea" className="text-xl font-semibold text-slate-800">{t.homeIdeaTitle}</h2>
      <p className="text-slate-600">{t.homeIdeaBody}</p>
      <Link href="/ideas/new" className={`${buttonClass({ variant: "secondary" })} mt-auto`}>{t.homeIdeaCta}</Link>
    </section>
  );
}

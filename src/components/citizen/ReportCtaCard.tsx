import Link from "next/link";
import type { Dict } from "@/lib/i18n";

export default function ReportCtaCard({ t }: { t: Dict }) {
  return (
    <section aria-labelledby="home-report" className="flex flex-col gap-3 rounded-2xl bg-civic p-5 text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/illustrations/spot-speak-or-type.svg" alt="" className="h-20 w-20 self-start rounded-xl bg-white/90 p-1" />
      <h2 id="home-report" className="text-xl font-semibold">{t.homeReportTitle}</h2>
      <p className="text-white/90">{t.homeReportBody}</p>
      <Link href="/report" className="mt-auto inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-5 text-lg font-semibold text-civic focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
        {t.reportCta}
      </Link>
    </section>
  );
}

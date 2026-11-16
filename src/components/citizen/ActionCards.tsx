import Link from "next/link";
import type { Dict } from "@/lib/i18n";

const CARD = "flex flex-col gap-3 rounded-2xl p-5 shadow-sm";
const BTN = "mt-auto inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-lg font-semibold focus-visible:outline-2 focus-visible:outline-offset-2";

/**
 * The three first actions as plain cards: picture, what it is in one sentence, one clear button.
 * Report is the main (blue) card; idea and ask are white with an outlined button.
 */
export default function ActionCards({ t }: { t: Dict }) {
  const outline = `${BTN} border-2 border-civic bg-white text-civic hover:bg-civic/5 focus-visible:outline-civic`;
  return (
    <nav aria-label={t.rfActionsAria}>
      <ul className="grid gap-4 lg:grid-cols-3">
        <li className={`${CARD} bg-civic text-white`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img loading="lazy" decoding="async" src="/illustrations/card-report.svg" alt="" className="size-24 self-start rounded-2xl" />
          <h2 className="text-xl font-semibold">{t.homeReportTitle}</h2>
          <p className="text-white/90">{t.homeReportBody}</p>
          <Link href="/report" className={`${BTN} bg-white text-civic focus-visible:outline-white`}>{t.reportCta}</Link>
        </li>
        <li className={`${CARD} border border-slate-200 bg-white`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img loading="lazy" decoding="async" src="/illustrations/card-idea.svg" alt="" className="size-24 self-start rounded-2xl" />
          <h2 className="text-xl font-semibold text-slate-800">{t.homeIdeaTitle}</h2>
          <p className="text-slate-600">{t.homeIdeaBody}</p>
          <Link href="/ideas" className={outline}>{t.homeIdeaCta}</Link>
        </li>
        <li className={`${CARD} border border-slate-200 bg-white`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img loading="lazy" decoding="async" src="/illustrations/card-ask.svg" alt="" className="size-24 self-start rounded-2xl" />
          <h2 className="text-xl font-semibold text-slate-800">{t.askTitle}</h2>
          <p className="text-slate-600">{t.rfAskBody}</p>
          <Link href="/ask" className={outline}>{t.rfAskCta}</Link>
        </li>
      </ul>
    </nav>
  );
}

import Link from "next/link";
import type { Dict } from "@/lib/i18n";

const ART = "/illustrations/home";
const focus = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-civic";

/**
 * Three ways to take part besides reporting (redesign §4.3 row 4): share an idea, ask your MP, track a report.
 * Desktop: cards with a coloured band and a round picture, lifted over the bottom of the hero (reference A).
 * Phones: compact rows, so the area status is not pushed a screen down. The track card is a plain GET form to /issue/find.
 */
export default function ActionCards({ t, trackError }: { t: Dict; trackError: boolean }) {
  const cards = [
    { key: "idea", href: "/ideas/new", band: "bg-brick", title: t.homeIdeaTitle, body: t.homeIdeaBody, cta: t.homeIdeaCta },
    { key: "ask", href: "/ask", band: "bg-civic", title: t.askTitle, body: t.rfAskBody, cta: t.rfAskCta },
  ];
  const art = (name: string, cls: string) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`${ART}/card-${name}.webp`} alt="" width={320} height={320} loading="lazy" decoding="async" className={cls} />
  );
  return (
    <section aria-label={t.rfActionsAria} className="relative z-10 mt-6 xl:-mt-24">
      <ul className="grid gap-3 lg:grid-cols-3 lg:gap-6">
        {cards.map((c) => (
          <li key={c.key} className="jk-card overflow-hidden">
            <Link href={c.href} className={`flex h-full items-center gap-3 rounded-2xl p-3 lg:flex-col lg:items-stretch lg:gap-0 lg:p-0 ${focus}`}>
              <span aria-hidden className={`hidden h-16 lg:block ${c.band}`} />
              {art(c.key, "size-16 shrink-0 rounded-full bg-cream lg:-mt-12 lg:ms-5 lg:size-24 lg:ring-4 lg:ring-white")}
              <span className="min-w-0 flex-1 lg:px-5 lg:pb-5 lg:pt-2">
                <span className="block font-heading text-[1.1875rem] font-semibold leading-snug text-foreground lg:text-[1.375rem]">{c.title}</span>
                <span className="jk-more block text-[0.9375rem] leading-snug text-ink-2 lg:mt-1 lg:text-[1.0625rem] lg:leading-relaxed">{c.body}</span>
                <span className="mt-3 hidden items-center gap-1 font-semibold text-civic lg:inline-flex">{c.cta}<span aria-hidden className="rtl:rotate-180">›</span></span>
              </span>
              <span aria-hidden className="text-3xl leading-none text-civic lg:hidden rtl:rotate-180">›</span>
            </Link>
          </li>
        ))}
        <li id="track" className="jk-card overflow-hidden">
          <span aria-hidden className="hidden h-16 bg-brand-deep lg:block" />
          <div className="flex items-start gap-3 p-3 lg:block lg:px-5 lg:pb-5 lg:pt-0">
            {art("track", "size-16 shrink-0 rounded-full bg-cream lg:-mt-12 lg:size-24 lg:ring-4 lg:ring-white")}
            <div className="min-w-0 flex-1 lg:mt-2">
              <h2 className="font-heading text-[1.1875rem] font-semibold leading-snug text-foreground lg:text-[1.375rem]">{t.hmTrackTitle}</h2>
              <p className="text-[0.9375rem] leading-snug text-ink-2 lg:mt-1 lg:text-[1.0625rem] lg:leading-relaxed">{t.hmTrackBody}</p>
              <form action="/issue/find" method="get" className="mt-3 space-y-1">
                <label htmlFor="track-ref" className="block text-[0.9375rem] font-medium text-foreground">{t.refId}</label>
                <div className="flex gap-2">
                  <input
                    id="track-ref"
                    name="ref"
                    required
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    placeholder={t.hmTrackExample}
                    aria-invalid={trackError || undefined}
                    aria-describedby={trackError ? "track-err" : undefined}
                    className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-base text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-civic aria-invalid:border-danger"
                  />
                  <button type="submit" className={`min-h-11 shrink-0 rounded-xl bg-civic px-4 font-semibold text-white hover:bg-[#005a42] ${focus}`}>{t.hmTrackCta}</button>
                </div>
                {trackError && <p id="track-err" role="alert" className="text-[0.9375rem] font-medium text-danger">{t.hmTrackBad}</p>}
              </form>
            </div>
          </div>
        </li>
      </ul>
    </section>
  );
}

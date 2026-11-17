import Link from "next/link";
import type { Dict } from "@/lib/i18n";

const ART = "/illustrations/home";

/**
 * Home hero (redesign §4). Phones: headline, one line, the voice-and-photo button, then the neighbours scene.
 * Desktop: text on the cream left, the river panorama (Jatiya Sangsad, boats, village, rickshaw) filling the right.
 * Text never sits on the art, so contrast does not depend on the picture. Server component: no client JavaScript.
 */
export default function HomeHero({ t }: { t: Dict }) {
  return (
    <section aria-labelledby="home-hero" className="-mx-4 -mt-6 bg-cream sm:-mx-6 lg:-mx-8 lg:grid lg:min-h-[30rem] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-stretch">
      <div className="space-y-4 px-5 pb-2 pt-7 sm:px-8 lg:self-center lg:pb-28 lg:pt-14 lg:ps-12 xl:ps-20">
        <h1 id="home-hero" className="max-w-xl text-[1.85rem] font-bold leading-tight text-foreground sm:text-4xl lg:text-5xl lg:leading-[1.2]">{t.tagline}</h1>
        <p className="jk-body max-w-lg text-ink-2 lg:text-lg">{t.hmHeroSub}</p>
        <Link
          href="/report"
          className="group flex min-h-16 max-w-lg items-center gap-3 rounded-full bg-brick px-3 text-white shadow-md hover:bg-brick-dark focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brick lg:min-h-[4.5rem]"
        >
          <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/20">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
          </span>
          <span className="flex-1 text-center text-[1.0625rem] font-semibold leading-snug lg:text-xl">{t.hmCta}</span>
          <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/20">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
          </span>
        </Link>
        <Link href="/welcome" className="inline-flex min-h-11 items-center gap-1 text-[0.9375rem] font-medium text-civic underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic">
          {t.hmNewHere}<span aria-hidden className="rtl:rotate-180">›</span>
        </Link>
      </div>
      <picture className="block lg:h-full">
        <source media="(min-width: 1024px)" type="image/avif" srcSet={`${ART}/hero-panorama-1600.avif 1600w, ${ART}/hero-panorama-2400.avif 2400w`} sizes="60vw" />
        <source media="(min-width: 1024px)" type="image/webp" srcSet={`${ART}/hero-panorama-1600.webp 1600w, ${ART}/hero-panorama-2400.webp 2400w`} sizes="60vw" />
        <source type="image/avif" srcSet={`${ART}/hero-neighbours-800.avif 800w, ${ART}/hero-neighbours-1200.avif 1200w`} sizes="(min-width: 640px) 36rem, 100vw" />
        <img
          src={`${ART}/hero-neighbours-800.webp`}
          srcSet={`${ART}/hero-neighbours-800.webp 800w, ${ART}/hero-neighbours-1200.webp 1200w`}
          sizes="(min-width: 640px) 36rem, 100vw"
          width={800}
          height={588}
          alt=""
          fetchPriority="high"
          decoding="async"
          className="jk-hero-art mx-auto block h-auto w-full max-w-xl lg:h-full lg:max-w-none lg:object-cover lg:object-[20%_50%]"
        />
      </picture>
    </section>
  );
}

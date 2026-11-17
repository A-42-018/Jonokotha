import Link from "next/link";
import type { Dict } from "@/lib/i18n";

const ART = "/illustrations/home";

/**
 * Home hero (redesign §4). Below xl (1280px): headline, one line, the voice-and-photo button, then the neighbours scene below the text.
 * xl and up: ONE full-width background (Recraft, golden-hour Bangladesh) behind the whole hero, like the reference mockups. The picture is a single
 * continuous painted sky with the sun and soft clouds across its full width; the left half is only sky and calm water (so the copy sits on it, with a
 * warm light lift baked in behind the copy so dark ink keeps 4.8:1 or better over the darkest clouds), and the Sangsad-style complex, skyline,
 * boats, bridge, village and cyclist are on the right half. The art stops 6rem above the hero bottom (the action cards lift 6rem over it).
 * Alignment: the copy uses the same gutter as the header and the sections (px-4 / sm:px-6 / lg:px-8). The band runs edge to edge up to 90rem
 * (the page cap); wider screens get a rounded panel. Server component: no client JavaScript.
 */
export default function HomeHero({ t }: { t: Dict }) {
  return (
    <section aria-labelledby="home-hero" className="-mx-4 -mt-6 overflow-hidden bg-cream sm:-mx-6 lg:-mx-8 xl:relative min-[90rem]:mx-0 min-[90rem]:mt-0 min-[90rem]:rounded-3xl">
      <div className="jk-hero-copy space-y-4 px-4 pb-2 pt-7 sm:px-6 lg:px-8 xl:relative xl:z-10 xl:flex xl:min-h-[30rem] xl:w-[46%] xl:flex-col xl:justify-center xl:pb-28 xl:pt-10">
        <h1 id="home-hero" className="max-w-xl text-[1.85rem] font-bold leading-tight text-foreground sm:text-4xl xl:text-5xl xl:leading-[1.2]">{t.tagline}</h1>
        <p className="jk-body max-w-lg text-ink-2 xl:text-lg">{t.hmHeroSub}</p>
        <Link
          href="/report"
          className="group flex min-h-16 max-w-lg items-center gap-3 rounded-full bg-brick px-3 text-white jk-lift hover:bg-brick-dark focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brick xl:min-h-[4.5rem]"
        >
          <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/20">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
          </span>
          <span className="flex-1 text-center text-[1.0625rem] font-semibold leading-snug xl:text-xl">{t.hmCta}</span>
          <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/20">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
          </span>
        </Link>
        <Link href="/welcome" className="inline-flex min-h-11 items-center gap-1 text-[0.9375rem] font-medium text-civic xl:text-ink underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic">
          {t.hmNewHere}<span aria-hidden className="rtl:rotate-180">›</span>
        </Link>
      </div>
      {/* Desktop background: Recraft V4.1 Pro 3072x1536 (2:1), no rickshaw, drawn as wide as the hero (100vw, or 1376px in the 90rem panel), hence `sizes`.
          The hero box is about 2.2 to 2.4:1, so the image fills the width; the box is only about 3.4:1 once the art stops 6rem above the bottom, so the crop (68% down) keeps the skyline top, the horizon, the sun and the boats and drops the empty top sky. */}
      
      
      <picture className="jk-hero-pic block xl:absolute xl:inset-x-0 xl:top-0 xl:bottom-24">
        <source media="(min-width: 1280px)" type="image/avif" srcSet={`${ART}/hero-bg-1600.avif 1600w, ${ART}/hero-bg-2400.avif 2400w, ${ART}/hero-bg-3072.avif 3072w`} sizes="(min-width: 90rem) 1376px, 100vw" />
        <source media="(min-width: 1280px)" type="image/webp" srcSet={`${ART}/hero-bg-1600.webp 1600w, ${ART}/hero-bg-2400.webp 2400w, ${ART}/hero-bg-3072.webp 3072w`} sizes="(min-width: 90rem) 1376px, 100vw" />
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
          className="jk-hero-art mx-auto block h-auto w-full max-w-xl xl:mx-0 xl:h-full xl:max-w-none xl:object-cover xl:object-[50%_68%]"
        />
      </picture>
    </section>
  );
}

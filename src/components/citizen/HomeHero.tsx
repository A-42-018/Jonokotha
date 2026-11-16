import type { Dict } from "@/lib/i18n";

/** Home hero: the street-scene vector, centred, with the tagline under it. Simple on purpose: one picture, one sentence. */
export default function HomeHero({ t }: { t: Dict }) {
  return (
    <section aria-labelledby="home-hero" className="space-y-3 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img fetchPriority="high" decoding="async" width={2432} height={1792} src="/illustrations/hero-mobile.svg" alt="" className="mx-auto aspect-[2432/880] h-auto w-full max-w-md rounded-2xl object-cover object-bottom lg:max-w-xl" />
      <h1 id="home-hero" className="text-2xl font-semibold text-civic sm:text-3xl lg:text-4xl">{t.tagline}</h1>
    </section>
  );
}

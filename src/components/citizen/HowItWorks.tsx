import Link from "next/link";
import type { ReactNode } from "react";
import { fmtNum, type Dict, type Lang } from "@/lib/i18n";

const svg = (d: ReactNode) => <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;

/**
 * "কীভাবে কাজ করে" (redesign §2b, from reference D): three plain steps. It says what happens in general terms and promises no
 * response time or outcome. Replaces the onboarding banner, which was a client component. The panel stays light in the dark theme,
 * so its text uses fixed dark colours rather than the theme-switched ones.
 */
export default function HowItWorks({ t, lang }: { t: Dict; lang: Lang }) {
  const steps = [
    [t.hmHow1, t.hmHow1Body, svg(<><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z" /><path d="M15 9a4 4 0 0 1 0 6" /></>)],
    [t.hmHow2, t.hmHow2Body, svg(<><path d="m22 2-11 11" /><path d="M22 2 15 22l-4-9-9-4Z" /></>)],
    [t.hmHow3, t.hmHow3Body, svg(<><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>)],
  ] as const;
  return (
    <section aria-labelledby="home-how" className="rounded-3xl bg-[#f3e6cf] p-5 sm:p-7">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="home-how" className="text-[1.375rem] font-semibold text-ink lg:text-[1.75rem]">{t.hmHowTitle}</h2>
        <Link href="/welcome" className="inline-flex min-h-11 items-center font-medium text-[#006a4e] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic">{t.hmHowMore}</Link>
      </div>
      <ol className="grid gap-3 md:grid-cols-3 md:gap-5">
        {steps.map(([title, body, icon], i) => (
          <li key={title} className="flex items-start gap-3 rounded-2xl bg-white/70 p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-civic text-white">{icon}</span>
            <span className="space-y-0.5">
              <span className="block text-[1.0625rem] font-semibold text-ink"><span className="text-[#006a4e]">{fmtNum(i + 1, lang)}.</span> {title}</span>
              <span className="block text-[0.9375rem] leading-relaxed text-ink">{body}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

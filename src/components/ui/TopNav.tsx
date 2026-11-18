"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Badge from "./Badge";
import { cx, ringOnDark } from "./cx";
import { isActivePath } from "./nav";
import MoreMenu from "./MoreMenu";
import NotificationBell from "./NotificationBell";
import { useLang } from "./useLang";
import { useT } from "./useT";
import { primaryNav } from "@/lib/nav-items";

/**
 * The one header, a deep green band (redesign §2b) with a marigold wordmark and report button. Always ONE row, never wrapped. Phones and tablets (under 1280px):
 * logo, area picker (shrinks and truncates), bell, language, account (primary navigation is the bottom tab bar). xl and up: logo, primary links, picker,
 * bell, report CTA, language, account. The desktop row needs about 1210px, so the links must not start at lg (1024px).
 */
export default function TopNav({ isStaff, userId = null, picker, account }: { isStaff: boolean; userId?: string | null; picker: ReactNode; account: ReactNode }) {
  const t = useT();
  const short = useLang() === "bn" ? "EN" : "বাং";
  const path = usePathname();
  const items = [
    ...primaryNav().map((i) => ({ href: i.href, label: t[i.key] })),
    ...(isStaff ? [{ href: "/office", label: t.officeCta }] : []),
  ];
  return (
    <header className="bg-brand-deep text-white shadow-[0_4px_14px_rgb(11_61_46/0.22)] xl:sticky xl:top-0 xl:z-40">
      <div className="mx-auto flex w-full max-w-[90rem] flex-nowrap items-center gap-x-1 px-3 py-2 min-[360px]:gap-x-2 min-[360px]:px-4 sm:px-6 lg:px-8 2xl:gap-x-3">
        <Link href="/" className={cx("-ms-1 flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-0.5 font-heading font-bold text-amber sm:gap-2.5 sm:px-1", ringOnDark)}>
          {/* Logo lockup: street scene art (drawn for the deep green band, no plate) and the Bangla wordmark in every language. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/jonokotha-scene.svg" alt="" width={980} height={430} className="hidden h-7 w-auto sm:block sm:h-11 xl:h-7 2xl:h-11" />
          <span aria-hidden="true" lang="bn" className="text-xl leading-none sm:text-3xl xl:text-xl 2xl:text-3xl">জনকথা</span>
          <span className="sr-only">{t.appName}</span>
        </Link>
        <nav aria-label={t.navAria} className="hidden xl:block">
          <ul className="flex items-center gap-0.5">
            {items.map((i) => {
              const active = isActivePath(path, i.href);
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={active ? "page" : undefined}
                    className={cx("inline-flex min-h-11 items-center gap-2 whitespace-nowrap border-b-[3px] px-1.5 2xl:px-2.5 text-[0.9375rem] font-medium", active ? "border-amber font-semibold text-white" : "border-transparent text-white/90 hover:bg-white/10 hover:text-white", ringOnDark)}
                  >
                    {i.label}
                  </Link>
                </li>
              );
            })}
            <li><MoreMenu path={path} /></li>
          </ul>
        </nav>
        <div className="ms-auto flex min-w-0 shrink">{picker}</div>
        <div className="flex shrink-0 items-center gap-1 text-sm xl:gap-2">
          {/* Wrappers hide: `hidden` loses to the inline-flex inside Badge and buttonClass. */}
          <div className="hidden 2xl:block"><Badge tone="warningOnDark">{t.demoBadge}</Badge></div>
          <NotificationBell userId={userId} />
          {/* Outline, not filled: the one filled red button on a page is the main report action (hero, bottom tab bar); two filled colours for one action split attention. */}
          <div className="hidden shrink-0 xl:block"><Link href="/report" className={cx("inline-flex min-h-11 items-center whitespace-nowrap rounded-full border-2 border-amber px-3.5 font-semibold 2xl:px-5 text-amber hover:bg-amber hover:text-ink", ringOnDark)}>{t.reportCta}</Link></div>
          {/* Route handler (sets the cookie, redirects back), so a plain anchor is intended. */}
          <a href="/lang" aria-label={t.navLangSwitch} className={cx("inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-white/50 px-2.5 text-sm font-medium text-white 2xl:px-3 hover:bg-white/10", ringOnDark)}>
            {/* Under 360px the row has no room for the full name: a short code (the accessible name already carries the full language). */}
            <span className="min-[360px]:hidden" aria-hidden="true">{short}</span>
            <span className="max-[359px]:hidden">{t.switchLang}</span>
          </a>
          {account}
        </div>
      </div>
    </header>
  );
}

"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Badge from "./Badge";
import { cx, ringOnDark } from "./cx";
import { isActivePath } from "./nav";
import MoreMenu from "./MoreMenu";
import NotificationBell from "./NotificationBell";
import { useT } from "./useT";
import { primaryNav } from "@/lib/nav-items";

/**
 * The one header, a deep green band (redesign §2b) with a marigold wordmark and report button. Phones: logo, bell, language,
 * account on one row, area picker below (primary navigation is the bottom tab bar). lg and up: logo, primary links, picker,
 * bell, report CTA, language, account.
 */
export default function TopNav({ isStaff, userId = null, picker, account }: { isStaff: boolean; userId?: string | null; picker: ReactNode; account: ReactNode }) {
  const t = useT();
  const path = usePathname();
  const items = [
    ...primaryNav().map((i) => ({ href: i.href, label: t[i.key] })),
    ...(isStaff ? [{ href: "/office", label: t.officeCta }] : []),
  ];
  return (
    <header className="bg-brand-deep text-white">
      <div className="mx-auto flex w-full max-w-[120rem] flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 sm:px-6 lg:px-8 lg:flex-nowrap lg:gap-x-3">
        <Link href="/" className={cx("-ms-1 flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-1 font-heading text-2xl font-semibold text-amber", ringOnDark)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/illustrations/logo-mark.svg" alt="" className="size-8 rounded-full bg-white p-0.5" />
          {t.appName}
        </Link>
        <nav aria-label={t.navAria} className="hidden lg:block">
          <ul className="flex items-center gap-0.5">
            {items.map((i) => {
              const active = isActivePath(path, i.href);
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={active ? "page" : undefined}
                    className={cx("inline-flex min-h-11 items-center gap-2 border-b-[3px] px-2.5 text-[0.9375rem] font-medium", active ? "border-amber font-semibold text-white" : "border-transparent text-white/90 hover:bg-white/10 hover:text-white", ringOnDark)}
                  >
                    {i.label}
                  </Link>
                </li>
              );
            })}
            <li><MoreMenu path={path} /></li>
          </ul>
        </nav>
        <div className="order-last flex w-full lg:order-none lg:ms-auto lg:w-auto">{picker}</div>
        <div className="ms-auto flex shrink-0 items-center gap-1 text-sm lg:ms-0 lg:gap-2">
          {/* Wrappers hide: `hidden` loses to the inline-flex inside Badge and buttonClass. */}
          <div className="hidden 2xl:block"><Badge tone="warning">{t.demoBadge}</Badge></div>
          <NotificationBell userId={userId} />
          <div className="hidden shrink-0 lg:block"><Link href="/report" className={cx("inline-flex min-h-11 items-center rounded-full bg-amber px-5 font-semibold text-ink hover:bg-[#f7b55a]", ringOnDark)}>{t.reportCta}</Link></div>
          {/* Route handler (sets the cookie, redirects back), so a plain anchor is intended. */}
          <a href="/lang" aria-label={t.navLangSwitch} className={cx("inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-white/50 px-3 text-sm font-medium text-white hover:bg-white/10", ringOnDark)}>
            {t.switchLang}
          </a>
          {account}
        </div>
      </div>
    </header>
  );
}

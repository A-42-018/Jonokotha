"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Badge from "./Badge";
import { buttonClass } from "./Button";
import { cx, focusRing } from "./cx";
import { isActivePath } from "./nav";
import NotificationBell from "./NotificationBell";
import { useT } from "./useT";

/**
 * The one header. Phones: logo, bell, language, account on one row, area picker below
 * (primary navigation is the bottom tab bar). lg and up: logo, primary links, picker,
 * bell, report CTA, language, account.
 */
export default function TopNav({ isStaff, picker, account }: { isStaff: boolean; picker: ReactNode; account: ReactNode }) {
  const t = useT();
  const path = usePathname();
  const items = [
    { href: "/", label: t.navHome },
    { href: "/area", label: t.navArea },
    { href: "/ideas", label: t.navIdeas },
    ...(isStaff ? [{ href: "/office", label: t.officeCta }] : []),
  ];
  return (
    <header className="bg-white shadow-sm">
      <div className="mx-auto flex w-full max-w-[120rem] flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 sm:px-6 lg:px-8 lg:flex-nowrap lg:gap-x-3">
        <Link href="/" className={cx("-ms-1 flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-1 font-heading text-xl font-semibold text-civic", focusRing)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/illustrations/logo-mark.svg" alt="" className="size-8" />
          {t.appName}
        </Link>
        <nav aria-label={t.navAria} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {items.map((i) => {
              const active = isActivePath(path, i.href);
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={active ? "page" : undefined}
                    className={cx("inline-flex min-h-11 items-center gap-2 rounded-lg px-3 font-medium", active ? "bg-civic/10 font-semibold text-civic" : "text-foreground hover:bg-slate-100", focusRing)}
                  >
                    {i.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="order-last flex w-full lg:order-none lg:ms-auto lg:w-auto">{picker}</div>
        <div className="ms-auto flex shrink-0 items-center gap-1 text-sm lg:ms-0 lg:gap-2">
          {/* Wrappers hide: `hidden` loses to the inline-flex inside Badge and buttonClass. */}
          <div className="hidden 2xl:block"><Badge tone="warning">{t.demoBadge}</Badge></div>
          <NotificationBell />
          <div className="hidden shrink-0 lg:block"><Link href="/report" className={buttonClass()}>{t.reportCta}</Link></div>
          {/* Route handler (sets the cookie, redirects back), so a plain anchor is intended. */}
          <a href="/lang" aria-label={t.navLangSwitch} className={cx("inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-foreground hover:bg-slate-50", focusRing)}>
            {t.switchLang}
          </a>
          {account}
        </div>
      </div>
    </header>
  );
}

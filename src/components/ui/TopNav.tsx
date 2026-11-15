import type { ReactNode } from "react";
import Link from "next/link";
import NavLinks, { type NavItem } from "./NavLinks";
import type { Dict } from "@/lib/i18n";

/**
 * One header for all widths. Phones: logo + controls, picker on its own row (unchanged).
 * lg and up: a single row with logo, primary links, picker, report CTA, language, account.
 */
export default function TopNav({ t, isStaff, picker, account }: { t: Dict; isStaff: boolean; picker: ReactNode; account: ReactNode }) {
  const items: NavItem[] = [
    { href: "/", label: t.navHome },
    ...(isStaff ? [{ href: "/office", label: t.officeCta }] : []),
  ];
  return (
    <header className="bg-white shadow-sm">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 lg:flex-nowrap lg:gap-x-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-heading text-xl font-semibold text-civic focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/illustrations/logo-mark.svg" alt="" className="h-8 w-8" />
          {t.appName}
        </Link>
        <NavLinks items={items} aria={t.navAria} />
        <div className="order-last flex w-full sm:order-none sm:w-auto lg:ml-auto">{picker}</div>
        <div className="flex shrink-0 items-center gap-3 text-sm">
          <span className="hidden rounded-full bg-amber/20 px-2 py-0.5 text-xs text-amber-900 xl:inline">{t.demoBadge}</span>
          <Link href="/report" className="hidden min-h-11 items-center rounded-lg bg-civic px-4 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic lg:inline-flex">
            {t.reportCta}
          </Link>
          <a href="/lang" className="inline-flex min-h-11 items-center font-medium text-civic underline focus-visible:outline-2 focus-visible:outline-civic">{t.switchLang}</a>
          {account}
        </div>
      </div>
    </header>
  );
}

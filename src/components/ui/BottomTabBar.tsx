"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx, focusRing } from "./cx";
import { AreaIcon, HomeIcon, IdeaIcon, PersonIcon, PlusIcon } from "./NavIcons";
import { isActivePath, tabBarHidden } from "./nav";
import { useT } from "./useT";

/**
 * Phone navigation (below lg). Five equal cells; the centre one is the raised report button.
 * Hidden on typing flows (/report, /login). MainShell adds the matching bottom padding.
 */
export default function BottomTabBar() {
  const path = usePathname();
  const t = useT();
  if (tabBarHidden(path)) return null;

  const tab = (href: string, label: string, icon: React.ReactNode) => {
    const active = isActivePath(path, href);
    return (
      <li key={href}>
        <Link
          href={href}
          aria-current={active ? "page" : undefined}
          className={cx("flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 text-center text-xs leading-tight", active ? "font-semibold text-civic" : "font-medium text-muted", focusRing)}
        >
          <span aria-hidden className={cx("flex h-7 w-12 items-center justify-center rounded-full", active && "bg-civic/10")}>{icon}</span>
          {label}
        </Link>
      </li>
    );
  };

  const reportActive = isActivePath(path, "/report");
  return (
    <nav aria-label={t.navTabsAria} className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {tab("/", t.navHome, <HomeIcon />)}
        {tab("/area", t.navArea, <AreaIcon />)}
        <li>
          <Link
            href="/report"
            aria-current={reportActive ? "page" : undefined}
            className={cx("-mt-5 flex min-h-16 flex-col items-center justify-start gap-0.5 px-1 text-center text-xs font-semibold leading-tight text-brick", focusRing)}
          >
            <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-brick text-white shadow-lg ring-4 ring-white">
              <PlusIcon />
            </span>
            {t.navReportShort}
          </Link>
        </li>
        {tab("/ideas", t.navIdeas, <IdeaIcon />)}
        {tab("/me", t.navMe, <PersonIcon />)}
      </ul>
    </nav>
  );
}

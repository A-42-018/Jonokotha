"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./cx";
import { isActivePath } from "./nav";

export interface PanelLink { href: string; label: string; exact?: boolean }

/** Dark-navy side menu for the office and admin workspaces (lg and up), a horizontal scroll strip on phones. */
export default function PanelSidebar({ links, aria, title }: { links: PanelLink[]; aria: string; title: string }) {
  const path = usePathname();
  return (
    <nav aria-label={aria} className="rounded-2xl bg-[#14305a] p-2 text-white shadow-md lg:sticky lg:top-4 lg:self-start lg:p-3">
      <p className="hidden px-3 pb-2 pt-1 font-heading text-lg lg:block">{title}</p>
      <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {links.map((l) => {
          const active = l.exact ? path === l.href : isActivePath(path, l.href);
          return (
            <li key={l.href} className="shrink-0">
              <Link href={l.href} aria-current={active ? "page" : undefined}
                className={cx("flex min-h-11 items-center rounded-xl px-3 text-sm font-medium", active ? "bg-white text-[#14305a]" : "text-white hover:bg-white/10", "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white")}>
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

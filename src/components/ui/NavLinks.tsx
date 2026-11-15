"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

/** Desktop-only primary links with aria-current on the active section. */
export default function NavLinks({ items, aria }: { items: NavItem[]; aria: string }) {
  const path = usePathname();
  return (
    <nav aria-label={aria} className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {items.map((i) => {
          const active = i.href === "/" ? path === "/" : path === i.href || path.startsWith(`${i.href}/`);
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-lg px-3 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic ${active ? "bg-civic/10 text-civic" : "text-slate-700 hover:bg-slate-100"}`}
              >
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cx, focusRing, ringOnDark } from "./cx";
import { useT } from "./useT";
import { moreNav } from "@/lib/nav-items";

/** "More" disclosure for the pages that do not fit the desktop bar (polls, help and about, terms). Closes on Escape and outside click. */
export default function MoreMenu({ path }: { path: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const items = moreNav();
  const active = items.some((i) => path === i.href || path.startsWith(`${i.href}/`));
  return (
    <div ref={box} className="relative">
      <button type="button" aria-expanded={open} aria-controls="more-menu" onClick={() => setOpen((o) => !o)}
        className={cx("inline-flex min-h-11 items-center gap-1 rounded-lg px-2.5 text-[0.9375rem] font-medium hover:bg-white/10", active ? "font-semibold text-white" : "text-white/90", ringOnDark)}>
        {t.navMore} <span aria-hidden>▾</span>
      </button>
      {open && (
        <ul id="more-menu" aria-label={t.navMoreAria} className="absolute end-0 z-40 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1 text-foreground shadow-lg">
          {items.map((i) => (
            <li key={i.href}><Link href={i.href} onClick={() => setOpen(false)} className={cx("flex min-h-11 items-center rounded-lg px-3 hover:bg-slate-100", focusRing)}>{t[i.key]}</Link></li>
          ))}
        </ul>
      )}
    </div>
  );
}
